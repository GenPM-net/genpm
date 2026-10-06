import { Hono } from 'hono';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../db/__fixtures__/pglite.js';
import type { Db } from '../db/index.js';
import { stripeWebhookRoutes } from './adapters/hono.js';
import { stripeWebhookRoute } from './adapters/next.js';
import * as schema from './schema.js';
import { clearStripeHandlers, getStripe, handleStripeWebhook, onStripeEvent, setStripe, stripeEvents, WebhookSignatureError } from './index.js';

const SECRET = 'whsec_test_secret';
let db: Db;
const stripe = new Stripe('sk_test_123');
const event = (id: string, type = 'checkout.session.completed') => {
  const payload = JSON.stringify({ id, object: 'event', type, data: { object: { id: 'cs_1', object: 'checkout.session' } } });
  return { payload, header: stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }) };
};

beforeEach(async () => {
  db = await testDb(schema);
  setStripe(stripe);
  clearStripeHandlers();
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

describe('webhooks', () => {
  it('verifies signatures and dispatches each event once to every handler', async () => {
    const seen: string[] = [];
    onStripeEvent('checkout.session.completed', async (e) => void seen.push(`a:${e.id}`));
    onStripeEvent(['checkout.session.completed', 'charge.refunded'], async (e) => void seen.push(`b:${e.id}`));
    const ev = event('evt_1');
    expect(await handleStripeWebhook(ev.payload, ev.header)).toEqual({ received: true, duplicate: false, type: 'checkout.session.completed', handled: 2 });
    expect(await handleStripeWebhook(ev.payload, ev.header)).toMatchObject({ duplicate: true, handled: 0 });
    expect(seen).toEqual(['a:evt_1', 'b:evt_1']);
    await expect(handleStripeWebhook(ev.payload, 't=1,v1=bad')).rejects.toBeInstanceOf(WebhookSignatureError);
    await expect(handleStripeWebhook(ev.payload, null)).rejects.toBeInstanceOf(WebhookSignatureError);
    const unknown = event('evt_2', 'customer.created');
    expect((await handleStripeWebhook(unknown.payload, unknown.header)).handled).toBe(0);
  });

  it('rolls back the event record when a handler fails, so Stripe can retry', async () => {
    let fail = true;
    onStripeEvent('checkout.session.completed', async () => {
      if (fail) throw new Error('db down');
    });
    const ev = event('evt_3');
    await expect(handleStripeWebhook(ev.payload, ev.header)).rejects.toThrow('db down');
    expect(await db.select().from(stripeEvents)).toHaveLength(0);
    fail = false;
    expect((await handleStripeWebhook(ev.payload, ev.header)).duplicate).toBe(false);
  });

  it('Hono and Next routes return 400 on bad signatures', async () => {
    const app = new Hono().route('/api/stripe/webhook', stripeWebhookRoutes());
    const ev = event('evt_4');
    expect((await app.request('/api/stripe/webhook', { method: 'POST', body: ev.payload, headers: { 'stripe-signature': ev.header } })).status).toBe(200);
    expect((await app.request('/api/stripe/webhook', { method: 'POST', body: ev.payload, headers: { 'stripe-signature': 'x' } })).status).toBe(400);
    const n = await stripeWebhookRoute(new Request('http://x', { method: 'POST', body: event('evt_5').payload, headers: { 'stripe-signature': 'x' } }));
    expect(n.status).toBe(400);
  });

  it('getStripe needs STRIPE_SECRET_KEY', () => {
    expect(getStripe()).toBe(stripe);
  });
});
