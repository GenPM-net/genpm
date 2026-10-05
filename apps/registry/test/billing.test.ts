// V10-05 (Stripe: plan Team de registros privados) y V10-06 (patrocinios self-serve) con un Stripe falso.
import { env } from 'cloudflare:test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { __signWebhook } from '../src/services/stripe.js';
import type { FakeGitHub } from './fake-github.js';
import { account, call, seed } from './helpers.js';

const SECRET = 'whsec_test';
const calls: Array<{ path: string; body: string }> = [];
const stripeFake = {
  fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    calls.push({ path: url.pathname, body: String(init?.body ?? '') });
    if (url.pathname === '/v1/checkout/sessions')
      return Response.json({ id: 'cs_test_1', url: 'https://checkout.stripe.com/c/cs_test_1' });
    if (url.pathname === '/v1/billing_portal/sessions') return Response.json({ url: 'https://billing.stripe.com/p/1' });
    if (url.pathname === '/v1/refunds') return Response.json({ id: 're_1' });
    if (url.pathname.startsWith('/v1/subscriptions/')) return Response.json(sub('active', 4));
    return new Response('{}', { status: 404 });
  },
} as unknown as FakeGitHub;

let regId = '';
const sub = (status: string, quantity: number) => ({
  id: 'sub_1',
  customer: 'cus_1',
  status,
  current_period_end: 1_900_000_000,
  metadata: { registry_id: regId },
  items: { data: [{ quantity }] },
});

const req = (token: string, body?: unknown, method = body === undefined ? 'GET' : 'POST') => ({
  method,
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
async function webhook(event: unknown) {
  const payload = JSON.stringify(event);
  return call(
    '/v1/billing/webhook',
    {
      method: 'POST',
      headers: { 'stripe-signature': await __signWebhook(SECRET, payload), 'content-type': 'application/json' },
      body: payload,
    },
    stripeFake,
  );
}

let owner: string;
beforeAll(async () => {
  await seed();
  Object.assign(env, { STRIPE_SECRET_KEY: 'sk_test', STRIPE_WEBHOOK_SECRET: SECRET, STRIPE_PRICE_TEAM: 'price_team' });
  ({ token: owner } = await account({ login: 'payowner', orgs: [{ login: 'payorg', role: 'owner' }] }));
  const r = (await (await call('/v1/registries', req(owner, { slug: 'payorg-int', owner: 'payorg' }))).json()) as {
    slug: string;
  };
  expect(r.slug).toBe('payorg-int');
  regId = (await env.DB.prepare("SELECT id FROM registries WHERE slug = 'payorg-int'").first<{ id: string }>())!.id;
});
afterAll(() => {
  Object.assign(env, { STRIPE_SECRET_KEY: undefined, STRIPE_WEBHOOK_SECRET: undefined, STRIPE_PRICE_TEAM: undefined });
});

describe('billing (V10-05)', () => {
  it('free plan limits members until the registry upgrades through Checkout and the webhook', async () => {
    for (const h of ['m1', 'm2', 'm3', 'm4']) await account({ login: h });
    for (const h of ['m1', 'm2', 'm3'])
      expect((await call(`/v1/registries/payorg-int/members/${h}`, req(owner, { role: 'reader' }, 'PUT'))).status).toBe(
        200,
      );
    const over = await call('/v1/registries/payorg-int/members/m4', req(owner, { role: 'reader' }, 'PUT'));
    expect(over.status).toBe(402);
    expect(((await over.json()) as { code: string }).code).toBe('E_PLAN_LIMIT');

    const co = await call('/v1/registries/payorg-int/billing/checkout', req(owner, {}), stripeFake);
    expect(await co.json()).toEqual({ url: 'https://checkout.stripe.com/c/cs_test_1' });
    expect(decodeURIComponent(calls.at(-1)!.body)).toContain('line_items[0][quantity]=3');

    // Webhook sin firma válida: fuera.
    const forged = await call('/v1/billing/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 't=1,v1=00' },
      body: '{}',
    });
    expect(forged.status).toBe(401);
    const done = {
      id: 'evt_1',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_test_1', subscription: 'sub_1', metadata: { kind: 'registry', registry_id: regId } } },
    };
    expect((await webhook(done)).status).toBe(200);
    expect(((await (await webhook(done)).json()) as { duplicate?: boolean }).duplicate).toBe(true);
    const b = (await (await call('/v1/registries/payorg-int/billing', req(owner))).json()) as {
      plan: string;
      subscription: { seats: number };
    };
    expect(b).toMatchObject({ plan: 'team', subscription: { seats: 4 } });
    expect((await call('/v1/registries/payorg-int/members/m4', req(owner, { role: 'reader' }, 'PUT'))).status).toBe(
      200,
    );
    expect(
      (
        (await (await call('/v1/registries/payorg-int/billing/portal', req(owner, {}), stripeFake)).json()) as {
          url: string;
        }
      ).url,
    ).toContain('billing.stripe.com');

    // Cancelada: vuelve a free sin borrar nada.
    await webhook({ id: 'evt_2', type: 'customer.subscription.deleted', data: { object: sub('canceled', 4) } });
    const after = (await (await call('/v1/registries/payorg-int/billing', req(owner))).json()) as { plan: string };
    expect(after.plan).toBe('free');
  });
});

describe('self-serve sponsorships (V10-06)', () => {
  it('pays through Checkout, waits for staff review and goes live; rejection refunds', async () => {
    const { token: sponsor } = await account({ login: 'sponsorco' });
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const r = await call(
      '/v1/sponsorships/checkout',
      req(sponsor, { package: '@core/auth', keyword: 'auth', weeks: 2, startsAt: tomorrow }),
      stripeFake,
    );
    expect(r.status).toBe(201);
    const { id, amountCents } = (await r.json()) as { id: string; amountCents: number };
    expect(amountCents).toBe(9800);
    expect(
      (
        await call(
          '/v1/sponsorships/checkout',
          req(sponsor, { package: '@core/nope', weeks: 1, startsAt: tomorrow }),
          stripeFake,
        )
      ).status,
    ).toBe(404);
    const mine = async () =>
      (
        (await (await call('/v1/sponsorships/mine', req(sponsor))).json()) as {
          sponsorships: Array<{ id: string; status: string }>;
        }
      ).sponsorships.find((s) => s.id === id)!.status;
    expect(await mine()).toBe('unpaid');
    await webhook({
      id: 'evt_3',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          payment_status: 'paid',
          payment_intent: 'pi_1',
          metadata: { kind: 'sponsorship', sponsorship_id: id },
        },
      },
    });
    expect(await mine()).toBe('review');
    const { token: staff } = await account({ login: 'reviewer', staff: true });
    expect((await call(`/v1/admin/sponsorships/${id}`, req(staff, { decision: 'approve' }))).status).toBe(200);
    expect(await mine()).toBe('active');

    // Otro, rechazado ⇒ reembolso.
    const r2 = (await (
      await call(
        '/v1/sponsorships/checkout',
        req(sponsor, { package: '@core/db', weeks: 1, startsAt: tomorrow }),
        stripeFake,
      )
    ).json()) as { id: string };
    await webhook({
      id: 'evt_4',
      type: 'checkout.session.completed',
      data: {
        object: {
          payment_status: 'paid',
          payment_intent: 'pi_2',
          metadata: { kind: 'sponsorship', sponsorship_id: r2.id },
        },
      },
    });
    expect((await call(`/v1/admin/sponsorships/${r2.id}`, req(staff, { decision: 'reject' }), stripeFake)).status).toBe(
      200,
    );
    expect(calls.some((c) => c.path === '/v1/refunds' && c.body.includes('pi_2'))).toBe(true);
  });
});
