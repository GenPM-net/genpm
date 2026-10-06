import { Hono } from 'hono';
import type { ReactElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { formTimingToken } from '../antispam/index.js';
import * as antispamSchema from '../antispam/schema.js';
import { seedEntry } from '../content/index.js';
import * as contentSchema from '../content/schema.js';
import type { AdminContext } from '../contracts/index.js';
import { testDb } from '../db/__fixtures__/pglite.js';
import type { Db } from '../db/index.js';
import { type EmailMessage, setEmailProvider } from '../email/index.js';
import { runDue } from '../jobs/index.js';
import * as jobsSchema from '../jobs/schema.js';
import { formRoutes } from './adapters/hono.js';
import { formRoute } from './adapters/next.js';
import * as schema from './schema.js';
import {
  clearForms,
  clearSubmissionHandlers,
  defineForm,
  deleteSubmissionsByEmail,
  exportSubmissionsCsv,
  Form,
  fieldsFromSchema,
  formSubmissions,
  onSubmission,
  pruneSubmissions,
  sourceInfo,
  submissionsAdminResource,
  submitForm,
  webhookSignature,
} from './index.js';

let db: Db;
const sent: EmailMessage[] = [];
const realFetch = globalThis.fetch;
const headers = () => new Headers({ 'x-forwarded-for': `203.0.113.${Math.floor(Math.random() * 250)}` });
const human = async (data: Record<string, unknown>) => ({ ...data, _ts: await formTimingToken(Date.now() - 5000), website: '' });
const admin = (perms: string[]): AdminContext => ({ user: { id: 'usr_1', email: null, name: null }, can: async (p) => perms.includes(p) });

beforeEach(async () => {
  db = await testDb(antispamSchema, contentSchema, jobsSchema, schema);
  clearForms();
  clearSubmissionHandlers();
  sent.length = 0;
  setEmailProvider({ name: 'test', send: async (m) => (sent.push(m), { id: 'm' }) });
  Object.assign(process.env, { ANTISPAM_SECRET: 'a'.repeat(40), EMAIL_FROM: 'Site <hi@site.test>', FORMS_WEBHOOK_SECRET: 'w'.repeat(40) });
  delete process.env.FORMS_NOTIFY_TO;
  delete process.env.TURNSTILE_SECRET_KEY;
  defineForm({
    key: 'contact',
    label: 'Contact',
    schema: z.object({ name: z.string().min(1), email: z.email(), message: z.string().min(5).max(2000) }),
    notify: ['team@site.test'],
    emailField: 'email',
    autoReply: { subject: 'Thanks!', text: 'We got your message.' },
    consent: { required: true, version: 'v1', text: 'I accept the privacy policy' },
  });
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('submitForm', () => {
  it('stores valid submissions with consent version and campaign data, then notifies in the background', async () => {
    const r = await submitForm('contact', await human({ name: 'Ana', email: 'ana@x.test', message: 'Hello <b>there</b>', consent: 'on' }), {
      headers: headers(),
      sourceUrl: 'https://site.test/contact?utm_source=ig&utm_campaign=fall&x=1',
    });
    expect(r.ok).toBe(true);
    const [row] = await db.select().from(formSubmissions);
    expect(row).toMatchObject({ consentVersion: 'v1', sourcePath: '/contact', utm: { utm_source: 'ig', utm_campaign: 'fall' } });
    expect(row!.data).toEqual({ name: 'Ana', email: 'ana@x.test', message: 'Hello <b>there</b>' });
    expect(sent).toHaveLength(0);
    expect((await runDue()).done).toBe(1);
    expect(sent.map((m) => [m.to, m.subject, m.replyTo])).toEqual([
      [['team@site.test'], 'New Contact submission', 'ana@x.test'],
      ['ana@x.test', 'Thanks!', undefined],
    ]);
    expect(sent[0]!.html).toContain('Hello &lt;b&gt;there&lt;/b&gt;');
  });

  it('rejects spam, invalid data, missing consent and unknown forms', async () => {
    const base = { name: 'Ana', email: 'ana@x.test', message: 'Hello there', consent: 'on' };
    expect(await submitForm('contact', { ...(await human(base)), website: 'http://spam' }, { headers: headers() })).toEqual({ ok: false, reason: 'spam' });
    expect(await submitForm('contact', base, { headers: headers() })).toEqual({ ok: false, reason: 'spam' }); // sin token de tiempo
    const bad = await submitForm('contact', await human({ ...base, email: 'nope', message: 'hi' }), { headers: headers() });
    expect(bad.ok === false && bad.reason === 'invalid' && bad.errors.map((e) => e.field).sort()).toEqual(['email', 'message']);
    expect(await submitForm('contact', await human({ ...base, consent: undefined }), { headers: headers() })).toEqual({ ok: false, reason: 'consent_required' });
    expect(await submitForm('nope', {}, { headers: headers() })).toEqual({ ok: false, reason: 'not_found' });
    expect(await db.select().from(formSubmissions)).toHaveLength(0);
  });

  it('rate limits per form and IP', async () => {
    const h = headers();
    const data = await human({ name: 'A', email: 'a@x.test', message: 'Hello there', consent: 'on' });
    for (let i = 0; i < 5; i++) expect((await submitForm('contact', data, { headers: h })).ok).toBe(true);
    expect(await submitForm('contact', data, { headers: h })).toMatchObject({ ok: false, reason: 'rate_limited' });
  });

  it('sends a signed webhook and runs onSubmission handlers, retrying on failure', async () => {
    defineForm({ key: 'lead', label: 'Lead', schema: z.object({ email: z.email() }), webhook: 'https://crm.test/hook' });
    const calls: Request[] = [];
    let fail = true;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push(new Request(url, init));
      return new Response(null, { status: fail ? 500 : 200 });
    }) as typeof fetch;
    const seen: string[] = [];
    onSubmission('lead', (s) => void seen.push(String(s.data.email)));
    await submitForm('lead', await human({ email: 'l@x.test' }), { headers: headers() });
    expect((await runDue()).retried).toBe(1);
    expect(seen).toEqual([]);
    fail = false;
    expect((await runDue({ now: new Date(Date.now() + 60_000) })).done).toBe(1);
    expect(seen).toEqual(['l@x.test']);
    const last = calls.at(-1)!;
    const body = await last.text();
    const [t] = last.headers.get('x-genpm-signature')!.match(/t=(\d+)/)!.slice(1);
    expect(last.headers.get('x-genpm-signature')).toBe(await webhookSignature(body, Number(t)));
    expect(JSON.parse(body)).toMatchObject({ form: 'lead', data: { email: 'l@x.test' } });
    expect(() => defineForm({ key: 'bad', label: 'B', schema: z.object({}), webhook: 'http://crm.test' })).toThrow(/https/);
  });
});

describe('forms built in the admin', () => {
  it('turns builder fields into validation, coercing checkboxes, numbers and selects', async () => {
    process.env.FORMS_NOTIFY_TO = 'ops@site.test';
    await seedEntry({
      collection: 'forms',
      slug: 'quote',
      data: {
        label: 'Quote',
        fields: [
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'qty', label: 'Quantity', type: 'number', required: true },
          { name: 'size', label: 'Size', type: 'select', required: true, options: ['S', 'M'] },
          { name: 'gift', label: 'Gift wrap', type: 'checkbox' },
          { name: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
    });
    const ok = await submitForm('quote', await human({ email: 'q@x.test', qty: '3', size: 'M', gift: 'on', notes: '' }), { headers: headers() });
    expect(ok.ok).toBe(true);
    const [row] = await db.select().from(formSubmissions);
    expect(row!.data).toEqual({ email: 'q@x.test', qty: 3, size: 'M', gift: true });
    const bad = await submitForm('quote', await human({ email: 'q@x.test', qty: '1', size: 'XL' }), { headers: headers() });
    expect(bad).toMatchObject({ ok: false, reason: 'invalid' });
    await runDue();
    expect(sent[0]!.to).toEqual(['ops@site.test']);
  });
});

describe('admin, export and privacy', () => {
  it('lists with permissions, marks status, exports safe CSV and erases by email', async () => {
    for (const message of ['=HYPERLINK("http://evil")', 'Plain "quoted" text'])
      await submitForm('contact', await human({ name: 'Ana', email: 'Ana@X.test', message, consent: 'on' }), { headers: headers() });
    const ctx = admin(['submissions:read', 'submissions:update', 'submissions:export', 'submissions:delete']);
    const list = await submissionsAdminResource.list({ page: 1, pageSize: 10, search: 'quoted' }, ctx);
    expect(list.total).toBe(1);
    await expect(submissionsAdminResource.list({ page: 1, pageSize: 10 }, admin([]))).rejects.toThrow(/forbidden/);
    const read = submissionsAdminResource.actions!.find((a) => a.name === 'read')!;
    expect((await read.run(list.rows[0]!.id, {}, ctx)).status).toBe('read');
    const csv = await exportSubmissionsCsv('contact', ctx);
    expect(csv.split('\r\n')[0]).toBe('"received","status","page","name","email","message"');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain('"Plain ""quoted"" text"');
    await expect(exportSubmissionsCsv('contact', admin(['submissions:read']))).rejects.toThrow(/forbidden/);
    expect(await deleteSubmissionsByEmail('ana@x.TEST')).toBe(2);
    expect(await pruneSubmissions(30)).toBe(0);
  });

  it('sourceInfo ignores bad URLs', () => {
    expect(sourceInfo('not a url')).toEqual({ sourcePath: null, utm: null });
    expect(sourceInfo('https://s.test/p?gclid=abc')).toEqual({ sourcePath: '/p', utm: { gclid: 'abc' } });
  });
});

describe('adapters', () => {
  it('Hono and Next accept form-data and JSON with proper status codes', async () => {
    const app = new Hono().route('/api/forms', formRoutes());
    const fd = new FormData();
    for (const [k, v] of Object.entries(await human({ name: 'Ana', email: 'ana@x.test', message: 'Hello there', consent: 'on' }))) fd.set(k, String(v));
    const h = headers();
    expect((await app.request('/api/forms/contact', { method: 'POST', body: fd, headers: h })).status).toBe(201);
    const json = await app.request('/api/forms/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.9' },
      body: JSON.stringify(await human({ name: '', email: 'x', message: 'short', consent: 'on' })),
    });
    expect(json.status).toBe(422);
    expect((await app.request('/api/forms/missing', { method: 'POST', body: new FormData() })).status).toBe(404);
    const res = await formRoute(
      new Request('http://s.test/api/forms/contact', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.10' }, body: JSON.stringify(await human({ name: 'B', email: 'b@x.test', message: 'Hello there', consent: true })) }),
      { params: Promise.resolve({ key: 'contact' }) },
    );
    expect(res.status).toBe(201);
  });
});

describe('<Form> and HTML posts without JavaScript', () => {
  const html = async (props: Parameters<typeof Form>[0]) => {
    const el = (await Form(props)) as ReactElement | null;
    if (!el) return '';
    const stream = await renderToReadableStream(el);
    await stream.allReady;
    return new Response(stream).text();
  };

  it('renders fields from the zod schema with honeypot, timing token and consent', async () => {
    const out = await html({ formKey: 'contact' });
    expect(out).toContain('action="/api/forms/contact"');
    const email = out.match(/<input id="form-contact-email"[^>]*>/)![0];
    for (const attr of ['name="email"', 'type="email"', 'required=""', 'autoComplete="email"']) expect(email).toContain(attr);
    expect(out).toMatch(/<textarea id="form-contact-message"[^>]*maxLength="2000"/);
    expect(out).toContain('name="website"');
    expect(out).toMatch(/name="_ts" value="\d+\.[0-9a-f]+"/);
    expect(out).toContain('I accept the privacy policy');
    expect(await html({ formKey: 'nope' })).toBe('');
    expect(fieldsFromSchema(z.object({ ok: z.boolean().optional(), n: z.number(), kind: z.enum(['a', 'b']) }))).toEqual([
      { name: 'ok', label: 'Ok', required: false, type: 'checkbox' },
      { name: 'n', label: 'N', required: true, type: 'number' },
      { name: 'kind', label: 'Kind', required: true, type: 'select', options: ['a', 'b'] },
    ]);
  });

  it('shows the result after a classic POST and redirects back with 303', async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(await human({ name: 'Ana', email: 'bad', message: 'Hello there', consent: 'on' }))) fd.set(k, String(v));
    const res = await formRoute(
      new Request('http://s.test/api/forms/contact', { method: 'POST', body: fd, headers: { accept: 'text/html', referer: 'http://s.test/contact?x=1', 'x-forwarded-for': '198.51.100.20' } }),
      { params: Promise.resolve({ key: 'contact' }) },
    );
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get('location')!);
    expect(`${loc.pathname}?${loc.searchParams}${loc.hash}`).toBe('/contact?x=1&form=contact&form_status=invalid&form_errors=email#form-contact');
    const out = await html({ formKey: 'contact', searchParams: Object.fromEntries(loc.searchParams) });
    expect(out).toContain('role="alert"');
    expect(out).toContain('aria-invalid="true" aria-describedby="form-contact-email-error"');
    // Un referer de otro sitio no se usa para redirigir: respuesta JSON.
    const foreign = await formRoute(
      new Request('http://s.test/api/forms/contact', { method: 'POST', body: fd, headers: { accept: 'text/html', referer: 'https://evil.test/', 'x-forwarded-for': '198.51.100.21' } }),
      { params: Promise.resolve({ key: 'contact' }) },
    );
    expect(foreign.status).toBe(422);
    expect(await html({ formKey: 'contact', searchParams: { form: 'contact', form_status: 'sent' } })).toContain('role="status"');
  });
});
