// Stripe: webhook (V10-05) y patrocinios self-serve (V10-06).
//   POST /v1/billing/webhook          eventos firmados; idempotentes por `evt_…`
//   POST /v1/sponsorships/checkout    el patrocinador elige paquete, palabra clave y semanas y paga en Stripe Checkout
//   GET  /v1/sponsorships/mine        sus campañas con impresiones y clics
// Un patrocinio pagado queda en `draft` con `paid_at` hasta que el staff lo aprueba (ADR-010: siempre marcado como
// patrocinado y nunca en el MCP); rechazarlo lo reembolsa.

import { NAME_RE } from '@genpm/manifest';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env.js';
import { httpError } from '../http.js';
import { newId } from '../ids.js';
import { requireAuth } from '../middleware/auth.js';
import { stripe, stripeConfigured, verifyWebhook } from '../services/stripe.js';
import { repoOf } from './util.js';

const WEEK = 7 * 86_400_000;
type Obj = Record<string, unknown>;

const ACTIVE = new Set(['active', 'trialing', 'past_due']);

async function syncSubscription(c: Context<AppEnv>, sub: Obj) {
  const meta = (sub['metadata'] ?? {}) as Record<string, string>;
  const registryId = meta['registry_id'];
  if (!registryId) return;
  const status = String(sub['status'] ?? 'canceled');
  const items = ((sub['items'] as { data?: Array<{ quantity?: number }> } | undefined)?.data ?? [])[0];
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO registry_billing (registry_id, customer_id, subscription_id, status, seats, current_period_end, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT (registry_id) DO UPDATE SET customer_id = ?2, subscription_id = ?3, status = ?4, seats = ?5, current_period_end = ?6, updated_at = ?7`,
    ).bind(
      registryId,
      String(sub['customer'] ?? ''),
      String(sub['id'] ?? ''),
      status,
      items?.quantity ?? 1,
      typeof sub['current_period_end'] === 'number' ? (sub['current_period_end'] as number) * 1000 : null,
      now,
    ),
    // Sin suscripción viva, el registro vuelve al plan gratuito (con sus límites); nunca se borran datos.
    c.env.DB.prepare("UPDATE registries SET plan = ?1 WHERE id = ?2 AND plan != 'enterprise'").bind(
      ACTIVE.has(status) ? 'team' : 'free',
      registryId,
    ),
    c.env.DB.prepare(
      "INSERT INTO audit_log (id, registry_id, actor_id, action, target_type, target_id, metadata, created_at) VALUES (?1, ?2, NULL, 'registry.billing', 'registry', ?2, ?3, ?4)",
    ).bind(newId('aud'), registryId, JSON.stringify({ status, seats: items?.quantity ?? 1 }), now),
  ]);
}

export const billing = new Hono<AppEnv>().post('/webhook', async (c) => {
  const payload = await c.req.text();
  const event = c.env.STRIPE_WEBHOOK_SECRET
    ? await verifyWebhook(c.env.STRIPE_WEBHOOK_SECRET, payload, c.req.header('stripe-signature'))
    : null;
  if (!event) throw httpError('E_AUTH');
  const first = await c.env.DB.prepare(
    'INSERT INTO billing_events (id, type, created_at) VALUES (?1, ?2, ?3) ON CONFLICT (id) DO NOTHING',
  )
    .bind(event.id, event.type, Date.now())
    .run();
  if (!first.meta.changes) return c.json({ ok: true, duplicate: true });
  const obj = event.data.object;
  const meta = (obj['metadata'] ?? {}) as Record<string, string>;
  switch (event.type) {
    case 'checkout.session.completed': {
      if (meta['kind'] === 'sponsorship' && meta['sponsorship_id']) {
        if (obj['payment_status'] !== 'paid') break;
        await c.env.DB.prepare(
          "UPDATE sponsorships SET paid_at = ?1, external_ref = ?2 WHERE id = ?3 AND status = 'draft'",
        )
          .bind(Date.now(), String(obj['payment_intent'] ?? obj['id']), meta['sponsorship_id'])
          .run();
      } else if (meta['kind'] === 'registry' && obj['subscription']) {
        const sub = await stripe<Obj>(c.env, 'GET', `/subscriptions/${String(obj['subscription'])}`);
        await syncSubscription(c, sub);
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await syncSubscription(c, obj);
      break;
    case 'invoice.payment_failed':
      await c.env.DB.prepare(
        "UPDATE registry_billing SET status = 'past_due', updated_at = ?1 WHERE subscription_id = ?2",
      )
        .bind(Date.now(), String(obj['subscription'] ?? ''))
        .run();
      break;
  }
  return c.json({ ok: true });
});

const Checkout = z.strictObject({
  package: z.string().regex(NAME_RE),
  keyword: z
    .string()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,31}$/)
    .optional(),
  weeks: z.number().int().min(1).max(12),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const sponsorships = new Hono<AppEnv>()
  .post('/checkout', requireAuth(), async (c) => {
    if (!stripeConfigured(c.env)) throw httpError('E_NOT_FOUND', { name: 'sponsorships' });
    const body = Checkout.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw httpError('E_BAD_REQUEST', { detail: body.error.issues[0]?.path.join('.') ?? 'body' });
    const starts = Date.parse(`${body.data.startsAt}T00:00:00Z`);
    if (Number.isNaN(starts) || starts < Date.now() || starts > Date.now() + 180 * 86_400_000)
      throw httpError('E_BAD_REQUEST', { detail: 'startsAt' });
    // Solo paquetes públicos activos y sin cuarentena (el patrocinio no compra visibilidad a nada en revisión).
    const pkg = await repoOf(c).packageByName(body.data.package);
    if (!pkg || pkg.status !== 'active') throw httpError('E_NOT_FOUND', { name: body.data.package });
    const weekly = Number(c.env.SPONSOR_WEEKLY_CENTS ?? 4900) || 4900;
    const amount = weekly * body.data.weeks;
    const id = newId('spn');
    const now = Date.now();
    await c.env.DB.prepare(
      `INSERT INTO sponsorships (id, registry_id, package_id, sponsor_account_id, placement, target, starts_at, ends_at, status, amount_cents, currency, created_at)
       VALUES (?1, ?2, ?3, ?4, 'search_slot', ?5, ?6, ?7, 'draft', ?8, 'USD', ?9)`,
    )
      .bind(
        id,
        c.get('tenant').registryId,
        pkg.id,
        c.get('actor')!.accountId,
        body.data.keyword ?? null,
        starts,
        starts + body.data.weeks * WEEK,
        amount,
        now,
      )
      .run();
    const session = await stripe<{ id: string; url: string }>(c.env, 'POST', '/checkout/sessions', {
      mode: 'payment',
      line_items: [
        {
          quantity: body.data.weeks,
          price_data: {
            currency: 'usd',
            unit_amount: weekly,
            product_data: {
              name: `GenPM sponsored search slot · ${pkg.full_name}${body.data.keyword ? ` · "${body.data.keyword}"` : ''}`,
            },
          },
        },
      ],
      client_reference_id: id,
      metadata: { kind: 'sponsorship', sponsorship_id: id },
      payment_intent_data: { metadata: { sponsorship_id: id } },
      success_url: `${c.env.WEB_ORIGIN}/sponsors?paid=${id}`,
      cancel_url: `${c.env.WEB_ORIGIN}/sponsors`,
    });
    await c.env.DB.prepare('UPDATE sponsorships SET external_ref = ?1 WHERE id = ?2').bind(session.id, id).run();
    return c.json({ id, url: session.url, amountCents: amount }, 201);
  })
  .get('/mine', requireAuth(), async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT s.id, p.full_name AS package, s.target AS keyword, s.starts_at, s.ends_at, s.status, s.paid_at,
              s.amount_cents, s.impressions, s.clicks
       FROM sponsorships s JOIN packages p ON p.id = s.package_id WHERE s.sponsor_account_id = ?1 ORDER BY s.created_at DESC LIMIT 100`,
    )
      .bind(c.get('actor')!.accountId)
      .all<{
        id: string;
        package: string;
        keyword: string | null;
        starts_at: number;
        ends_at: number;
        status: string;
        paid_at: number | null;
        amount_cents: number;
        impressions: number;
        clicks: number;
      }>();
    return c.json({
      sponsorships: results.map((r) => ({
        id: r.id,
        package: r.package,
        keyword: r.keyword,
        startsAt: new Date(r.starts_at).toISOString(),
        endsAt: new Date(r.ends_at).toISOString(),
        // `review`: pagado y pendiente de aprobación del staff.
        status: r.status === 'draft' ? (r.paid_at ? 'review' : 'unpaid') : r.status,
        amountCents: r.amount_cents,
        impressions: r.impressions,
        clicks: r.clicks,
      })),
    });
  });

/** Staff: aprobar (activa en su fecha) o rechazar un patrocinio pagado (reembolso completo). */
export async function reviewSponsorship(c: Context<AppEnv>, id: string, approve: boolean): Promise<boolean> {
  const s = await c.env.DB.prepare('SELECT status, paid_at, external_ref FROM sponsorships WHERE id = ?1')
    .bind(id)
    .first<{ status: string; paid_at: number | null; external_ref: string | null }>();
  if (!s || s.status !== 'draft' || !s.paid_at) return false;
  if (!approve && s.external_ref?.startsWith('pi_') && stripeConfigured(c.env))
    await stripe(c.env, 'POST', '/refunds', { payment_intent: s.external_ref });
  // `active` con fecha futura: el cron diario solo la muestra entre starts_at y ends_at.
  await c.env.DB.prepare('UPDATE sponsorships SET status = ?1 WHERE id = ?2')
    .bind(approve ? 'active' : 'cancelled', id)
    .run();
  return true;
}
