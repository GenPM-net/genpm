import type { ReactElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ cookie: '' }));
vi.mock('next/headers', () => ({
  draftMode: async () => ({ isEnabled: false, enable() {}, disable() {} }),
  cookies: async () => ({
    get: (name: string) => {
      const c = state.cookie.split(/;\s*/).find((x) => x.startsWith(`${name}=`));
      return c ? { value: c.slice(name.length + 1) } : undefined;
    },
  }),
}));

import { admin, blocks } from '@/genpm';
import { formTimingToken } from '@/lib/antispam';
import { RenderBlocks } from '@/lib/blocks';
import { createEntry, publish, seedEntry } from '@/lib/content';
import { projectDb } from '@/genpm/__fixtures__/db';
import { formSubmissions } from '@/lib/forms';
import { runDue } from '@/lib/jobs';
import { pixelAttributions } from '@/lib/pixels';
import { leadsByLandingWidget } from './_lib/widgets';
import { POST as consentPost } from './api/consent/route';
import { POST as leadPost } from './lp/[slug]/lead/[formKey]/route';
import Landing, { generateMetadata } from './lp/[slug]/page';
import Thanks from './lp/[slug]/thanks/page';

const html = async (node: Promise<unknown> | unknown) => {
  const stream = await renderToReadableStream((await node) as ReactElement);
  await stream.allReady;
  return new Response(stream).text();
};
let db: Awaited<ReturnType<typeof projectDb>>;
const realFetch = globalThis.fetch;
const props = (slug: string, sp: Record<string, string> = {}) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(sp) });

async function lead(fields: Record<string, string>, opts: { cookie?: string; ip: string; referer?: string }) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...fields, _ts: await formTimingToken(Date.now() - 5000), website: '' })) fd.set(k, v);
  return leadPost(
    new Request('https://site.test/lp/launch/lead/contact', {
      method: 'POST',
      body: fd,
      headers: { 'x-forwarded-for': opts.ip, referer: opts.referer ?? 'https://site.test/lp/launch?utm_source=newsletter&utm_campaign=launch', ...(opts.cookie && { cookie: opts.cookie }) },
    }),
    { params: Promise.resolve({ slug: 'launch', formKey: 'contact' }) },
  );
}

async function consentCookie(marketing: boolean): Promise<string> {
  const res = await consentPost(new Request('https://site.test/api/consent', { method: 'POST', body: JSON.stringify({ analytics: false, marketing, preferences: false }) }));
  return res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

beforeAll(() => {
  Object.assign(process.env, { AUTH_SECRET: 'a'.repeat(40), CONTENT_PREVIEW_SECRET: 'p'.repeat(40), SITE_URL: 'https://site.test', ANTISPAM_SECRET: 's'.repeat(40), CONSENT_POLICY_VERSION: '2026-10' });
});

beforeEach(async () => {
  state.cookie = '';
  db = await projectDb();
  await seedEntry({ collection: 'site_settings', data: { name: 'Acme' } });
  const l = await createEntry({
    collection: 'landings',
    slug: 'launch',
    data: {
      title: 'Launch',
      blocks: [
        { id: 'h', type: 'hero', data: { title: 'The best mug', ctaLabel: 'Get yours', ctaHref: '#form-contact' } },
        { id: 'f', type: 'form', data: { title: 'Join the waitlist', formKey: 'contact' } },
      ],
      thanksTitle: 'You are on the list',
    },
  });
  await publish(l.id);
});
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.META_PIXEL_ID;
  delete process.env.META_CAPI_TOKEN;
});

describe('landing page', () => {
  it('renders blocks without site chrome and posts forms to the landing lead route', async () => {
    const out = await html(Landing(props('launch')));
    expect(out).toContain('.site-chrome{display:none}');
    expect(out.match(/<h1/g)).toHaveLength(1);
    expect(out).toContain('action="/lp/launch/lead/contact"');
    expect((await generateMetadata(props('launch'))).alternates?.canonical).toBe('https://site.test/lp/launch');
  });

  it('only shows countdowns with a real future deadline', async () => {
    const render = (endsAt: Date) => html(<RenderBlocks blocks={[{ id: 'c', type: 'countdown', data: { title: 'Launch price ends in', endsAt: endsAt.toISOString(), terms: 'Price goes from €19 to €25.' } }]} registry={blocks} />);
    const future = await render(new Date(Date.now() + 2 * 86_400_000 + 3_600_000));
    expect(future).toMatch(/2 days (0|1) hours/);
    expect(future).toContain('Price goes from €19 to €25.');
    expect(await render(new Date(Date.now() - 1000))).toBe('');
    expect(blocks.schema.safeParse([{ id: 'c', type: 'countdown', data: { title: 'x', endsAt: 'soon', terms: 'x' } }]).success).toBe(false);
  });
});

describe('lead conversion', () => {
  const fields = { name: 'Ana', email: 'ana@x.test', message: 'I want one please', consent: 'on' };

  it('saves the lead with UTM, redirects to thanks and sends a deduplicated server event with consent', async () => {
    process.env.META_PIXEL_ID = '123456';
    process.env.META_CAPI_TOKEN = 'token';
    const calls: Array<{ url: string; body: string }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), body: String(init.body) });
      return Response.json({ events_received: 1 });
    }) as typeof fetch;

    const res = await lead(fields, { ip: '198.51.100.1', cookie: await consentCookie(true) });
    expect(res.status).toBe(303);
    const thanks = new URL(res.headers.get('location')!);
    expect(thanks.pathname).toBe('/lp/launch/thanks');
    const eventId = thanks.searchParams.get('e')!;
    const [sub] = await db.select().from(formSubmissions);
    expect(eventId).toBe(`lead_${sub!.id}`);
    expect(sub).toMatchObject({ sourcePath: '/lp/launch', utm: { utm_source: 'newsletter', utm_campaign: 'launch' } });

    await runDue();
    const meta = calls.find((c) => c.url.includes('graph.facebook.com'));
    expect(meta).toBeTruthy();
    expect(JSON.parse(meta!.body).data[0]).toMatchObject({ event_name: 'Lead', event_id: eventId });
    expect(await db.select().from(pixelAttributions)).toEqual([]); // usada una vez y borrada

    const page = await html(Thanks(props('launch', { e: eventId, f: 'contact' })));
    expect(page).toContain('You are on the list');
  });

  it('sends nothing to ad platforms without consent, and returns errors to the landing', async () => {
    process.env.META_PIXEL_ID = '123456';
    process.env.META_CAPI_TOKEN = 'token';
    let called = false;
    globalThis.fetch = (async () => ((called = true), Response.json({}))) as unknown as typeof fetch;
    expect((await lead(fields, { ip: '198.51.100.2' })).status).toBe(303);
    await runDue();
    expect(called).toBe(false);
    expect(await db.select().from(pixelAttributions)).toEqual([]);

    const bad = await lead({ ...fields, email: 'nope' }, { ip: '198.51.100.3' });
    expect(bad.headers.get('location')).toBe('https://site.test/lp/launch?utm_source=newsletter&utm_campaign=launch&form=contact&form_status=invalid&form_errors=email#form-contact');
  });

  it('counts leads per landing for the dashboard', async () => {
    await lead({ name: 'A', email: 'a@x.test', message: 'Hello there', consent: 'on' }, { ip: '198.51.100.4' });
    await lead({ name: 'B', email: 'b@x.test', message: 'Hello there', consent: 'on' }, { ip: '198.51.100.5' });
    const w = await leadsByLandingWidget.load({ user: { id: 'u', email: null, name: null }, can: async () => true });
    expect(w.rows).toEqual([{ label: '/lp/launch', value: 2, href: '/lp/launch' }]);
    expect(admin.resources.map((r) => r.name)).toContain('landings');
  });
});
