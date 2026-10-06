// Envío de formularios: antispam → validación → consentimiento → guardar → avisos en segundo plano (@core/jobs).
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { verifyHuman } from '../antispam/index.ts';
import { type Executor, getDb } from '../db/index.ts';
import { getEmailProvider } from '../email/index.ts';
import { defineJob } from '../jobs/index.ts';
import { type FormDefinition, getForm } from './definitions.ts';
import { type FormSubmission, formSubmissions } from './schema.ts';

export const CONSENT_FIELD = 'consent';
const RESERVED = new Set(['website', '_ts', 'cf-turnstile-response', 'h-captcha-response', CONSENT_FIELD]);
const TRACKING = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ttclid'];

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not_found' | 'spam' | 'rate_limited' | 'consent_required'; retryAfterSeconds?: number }
  | { ok: false; reason: 'invalid'; errors: Array<{ field: string; message: string }> };

type Handler = (submission: FormSubmission, form: FormDefinition) => Promise<void> | void;
const handlers = new Map<string, Handler[]>();

/** Reacciona a envíos (alta en newsletter, CRM…). Se ejecuta en segundo plano, con reintentos. */
export function onSubmission(formKey: string, handler: Handler): void {
  handlers.set(formKey, [...(handlers.get(formKey) ?? []), handler]);
}

/** Solo tests. */
export const clearSubmissionHandlers = () => handlers.clear();

function fieldsOf(input: FormData | Record<string, unknown>): Record<string, unknown> {
  if (!(input instanceof FormData)) return { ...input };
  const out: Record<string, unknown> = {};
  input.forEach((v, k) => {
    if (typeof v === 'string') out[k] = v;
  });
  return out;
}

/** UTM y click IDs de la URL de origen; la ruta se guarda sin query. */
export function sourceInfo(sourceUrl: string | null | undefined): { sourcePath: string | null; utm: Record<string, string> | null } {
  if (!sourceUrl) return { sourcePath: null, utm: null };
  try {
    const u = new URL(sourceUrl);
    const utm = Object.fromEntries(TRACKING.flatMap((k) => (u.searchParams.get(k) ? [[k, u.searchParams.get(k)!.slice(0, 200)]] : [])));
    return { sourcePath: u.pathname.slice(0, 500), utm: Object.keys(utm).length ? utm : null };
  } catch {
    return { sourcePath: null, utm: null };
  }
}

export async function submitForm(
  formKey: string,
  input: FormData | Record<string, unknown>,
  ctx: { headers: Headers; sourceUrl?: string | null; skipAntispam?: boolean },
  db: Executor = getDb(),
): Promise<SubmitResult> {
  const form = await getForm(formKey);
  if (!form) return { ok: false, reason: 'not_found' };
  const fields = fieldsOf(input);
  if (!ctx.skipAntispam) {
    const human = await verifyHuman(ctx.headers, fields, { scope: `forms:${formKey}`, limit: 5, windowMs: 600_000 }, db);
    if (!human.ok)
      return human.reason === 'rate_limited'
        ? { ok: false, reason: 'rate_limited', retryAfterSeconds: human.retryAfterSeconds }
        : { ok: false, reason: 'spam' };
  }
  const data = Object.fromEntries(Object.entries(fields).filter(([k]) => !RESERVED.has(k)));
  const parsed = form.schema.safeParse(data);
  if (!parsed.success)
    return { ok: false, reason: 'invalid', errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })) };
  const consented = [true, 'on', 'true', 'yes'].includes(fields[CONSENT_FIELD] as string | boolean);
  if (form.consent?.required && !consented) return { ok: false, reason: 'consent_required' };
  const [row] = await db
    .insert(formSubmissions)
    .values({ formKey, data: parsed.data as Record<string, unknown>, consentVersion: consented && form.consent ? form.consent.version : null, ...sourceInfo(ctx.sourceUrl) })
    .returning();
  await processSubmissionJob.enqueue({ submissionId: row!.id }, { dedupeKey: `forms:${row!.id}` }, db);
  return { ok: true, id: row!.id };
}

const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

async function sign(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Firma del webhook: `x-genpm-signature: t=<unix>,v1=<hmac_sha256("<t>.<body>")>`. */
export async function webhookSignature(body: string, t: number, secret = process.env.FORMS_WEBHOOK_SECRET ?? ''): Promise<string> {
  if (secret.length < 32) throw new Error('FORMS_WEBHOOK_SECRET must be set (>= 32 chars) to use webhooks');
  return `t=${t},v1=${await sign(secret, `${t}.${body}`)}`;
}

/**
 * Aviso al equipo, respuesta automática, webhook y `onSubmission`. Cada paso se anota en `processed` al terminar:
 * si uno falla y la tarea se reintenta, los ya hechos no se repiten (no se reenvían emails ni se repite el webhook).
 */
export const processSubmissionJob = defineJob(
  'forms.process',
  z.object({ submissionId: z.string() }),
  async ({ submissionId }, { signal }) => {
    const db = getDb();
    const [sub] = await db.select().from(formSubmissions).where(eq(formSubmissions.id, submissionId));
    if (!sub) return;
    const form = await getForm(sub.formKey);
    if (!form) return;
    const done = new Set(sub.processed ?? []);
    const step = async (name: string, run: () => Promise<void>) => {
      if (done.has(name)) return;
      await run();
      done.add(name);
      await db
        .update(formSubmissions)
        .set({ processed: sql`${formSubmissions.processed} || ${JSON.stringify([name])}::jsonb` })
        .where(eq(formSubmissions.id, sub.id));
    };
    const from = process.env.EMAIL_FROM;
    const notify = form.notify?.length ? form.notify : (process.env.FORMS_NOTIFY_TO ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const sender = form.emailField ? z.email().safeParse(sub.data[form.emailField]) : null;
    const lines = Object.entries(sub.data).map(([k, v]) => [k, show(v)] as const);
    if (from && notify.length)
      await step('notify', async () => {
        await getEmailProvider().send({
          from,
          to: notify,
          subject: `New ${form.label} submission`,
          text: lines.map(([k, v]) => `${k}: ${v}`).join('\n'),
          html: `<table>${lines.map(([k, v]) => `<tr><th align="left">${esc(k)}</th><td>${esc(v).replaceAll('\n', '<br>')}</td></tr>`).join('')}</table>`,
          ...(sender?.success && { replyTo: sender.data }),
        });
      });
    if (from && form.autoReply && sender?.success) {
      const reply = form.autoReply;
      await step('auto_reply', async () => {
        await getEmailProvider().send({ from, to: sender.data, subject: reply.subject, text: reply.text, html: `<p>${esc(reply.text).replaceAll('\n', '<br>')}</p>` });
      });
    }
    if (form.webhook) {
      const url = form.webhook;
      await step('webhook', async () => {
        const body = JSON.stringify({ id: sub.id, form: sub.formKey, data: sub.data, createdAt: sub.createdAt.toISOString(), utm: sub.utm });
        const t = Math.floor(Date.now() / 1000);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-genpm-signature': await webhookSignature(body, t) },
          body,
          redirect: 'error',
          signal,
        });
        if (!res.ok) throw new Error(`webhook responded ${res.status}`);
      });
    }
    for (const [i, h] of (handlers.get(sub.formKey) ?? []).entries()) await step(`handler:${i}`, async () => void (await h(sub, form)));
  },
  { maxAttempts: 5, timeoutMs: 30_000 },
);
