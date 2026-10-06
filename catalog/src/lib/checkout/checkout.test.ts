import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authSchema from '../auth/schema.js';
import { addLine, type Cart, carts, getOrCreateCart, setCartMeta } from '../cart/index.js';
import * as cartSchema from '../cart/schema.js';
import { createProduct, getProduct, productVariants } from '../catalog/index.js';
import * as catalogSchema from '../catalog/schema.js';
import { testDb } from '../db/__fixtures__/pglite.js';
import type { Db } from '../db/index.js';
import { type EmailMessage, setEmailProvider } from '../email/index.js';
import { runDue } from '../jobs/index.js';
import * as jobsSchema from '../jobs/schema.js';
import { getOrder, orders, ordersAdminResource } from '../orders/index.js';
import * as ordersSchema from '../orders/schema.js';
import { ratesFor, upsertRate, upsertZone } from '../shipping/index.js';
import * as shippingSchema from '../shipping/schema.js';
import { handleStripeWebhook, setStripe } from '../stripe/index.js';
import * as stripeSchema from '../stripe/schema.js';
import { checkoutRoutes } from './adapters/hono.js';
import * as schema from './schema.js';
import { CheckoutError, checkoutSessions, getCheckoutStatus, purchaseEvent, startCheckout } from './index.js';

const SECRET = 'whsec_checkout';
let db: Db;
let stripe: Stripe;
let mug: string;
const sent: EmailMessage[] = [];
let sessionParams: Stripe.Checkout.SessionCreateParams | undefined;
let nextSession = 0;

beforeEach(async () => {
  db = await testDb(authSchema, catalogSchema, cartSchema, ordersSchema, jobsSchema, stripeSchema, shippingSchema, schema);
  Object.assign(process.env, { STRIPE_WEBHOOK_SECRET: SECRET, CART_COOKIE_SECRET: 'c'.repeat(40), STORE_CURRENCY: 'EUR', ORDER_LINK_SECRET: 'o'.repeat(40), SITE_URL: 'https://shop.test', EMAIL_FROM: 'Shop <s@shop.test>', CHECKOUT_ALERT_TO: 'ops@shop.test' });
  delete process.env.STRIPE_TAX;
  sent.length = 0;
  setEmailProvider({ name: 't', send: async (m) => (sent.push(m), { id: null }) });
  stripe = new Stripe('sk_test_123');
  setStripe(stripe);
  vi.spyOn(stripe.coupons, 'create').mockResolvedValue({ id: 'cpn_1' } as never);
  vi.spyOn(stripe.checkout.sessions, 'create').mockImplementation((async (p: Stripe.Checkout.SessionCreateParams) => {
    sessionParams = p;
    nextSession++;
    return { id: `cs_test_${nextSession}`, url: `https://checkout.stripe.com/c/${nextSession}` };
  }) as never);
  vi.spyOn(stripe.refunds, 'create').mockImplementation((async (p: { amount?: number }) => ({ id: `re_${p.amount ?? 'full'}` })) as never);
  await createProduct({ slug: 'mug', name: 'Mug', status: 'active', variants: [{ price: 1500, stock: 3, weightGrams: 400 }] });
  mug = (await getProduct('mug'))!.variants[0]!.id;
  const es = await upsertZone({ name: 'Spain', countries: ['ES'] });
  await upsertRate({ zoneId: es.id, name: 'Standard', amount: 399 });
});

async function readyCart(qty = 2, meta: Record<string, string> = { country: 'ES' }): Promise<Cart> {
  const { cart } = await getOrCreateCart(null, null);
  await addLine(cart.id, mug, qty);
  if (Object.keys(meta).length) await setCartMeta(cart.id, meta);
  return (await db.select().from(carts).where(eq(carts.id, cart.id)))[0]!;
}

function completed(id: string, amount: number, over: Record<string, unknown> = {}) {
  const payload = JSON.stringify({
    id: `evt_${id}_${Math.random()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id,
        object: 'checkout.session',
        payment_status: 'paid',
        amount_total: amount,
        currency: 'eur',
        payment_intent: `pi_${id}`,
        total_details: { amount_tax: 0 },
        customer_details: { name: 'Ana', phone: null },
        collected_information: { shipping_details: { name: 'Ana', address: { line1: 'Calle Mayor 1', line2: null, city: 'Valencia', postal_code: '46001', state: null, country: 'ES' } } },
        ...over,
      },
    },
  });
  return handleStripeWebhook(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }));
}

const start = (cart: Cart) => startCheckout({ cart, email: 'Ana@X.test', successUrl: 'https://shop.test/checkout/success', cancelUrl: 'https://shop.test/cart' });

describe('starting checkout', () => {
  it('requires a cart with shipping chosen and sends server-computed amounts to Stripe', async () => {
    await expect(start(await readyCart(2, {}))).rejects.toMatchObject({ code: 'needs_shipping' });
    await expect(startCheckout({ cart: await readyCart(), email: 'nope', successUrl: 'https://s', cancelUrl: 'https://s' })).rejects.toBeInstanceOf(CheckoutError);
    const { url, sessionId } = await start(await readyCart());
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com/);
    expect(sessionParams).toMatchObject({
      mode: 'payment',
      customer_email: 'ana@x.test',
      line_items: [{ quantity: 2, price_data: { currency: 'eur', unit_amount: 1500 } }],
      shipping_address_collection: { allowed_countries: ['ES'] },
      shipping_options: [{ shipping_rate_data: { fixed_amount: { amount: 399, currency: 'eur' } } }],
      success_url: 'https://shop.test/checkout/success?session_id={CHECKOUT_SESSION_ID}',
    });
    expect(sessionParams?.discounts).toBeUndefined();
    const [cs] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, sessionId));
    expect(cs).toMatchObject({ total: 3399, status: 'open', email: 'ana@x.test' });
    expect(await getCheckoutStatus(sessionId)).toEqual({ status: 'pending' });
  });
});

describe('webhook → order', () => {
  it('creates the order once from the snapshot, clears the cart and reports paid', async () => {
    const cart = await readyCart();
    const { sessionId } = await start(cart);
    // El precio cambia después de ir a pagar: el pedido respeta lo que el cliente vio y pagó.
    await db.update(productVariants).set({ priceAmount: 9999 }).where(eq(productVariants.id, mug));
    await completed(sessionId, 3399);
    await completed(sessionId, 3399);
    const all = await db.select().from(orders);
    expect(all).toHaveLength(1);
    const o = (await getOrder(all[0]!.id))!;
    expect(o).toMatchObject({ status: 'paid', total: 3399, shippingTotal: 399, paymentRef: `pi_${sessionId}`, email: 'ana@x.test' });
    expect(o.lines[0]).toMatchObject({ unitPrice: 1500, quantity: 2 });
    expect(o.shippingAddress).toMatchObject({ city: 'Valencia', country: 'ES' });
    expect((await getProduct('mug'))!.variants[0]!.stock).toBe(1);
    expect(await getCheckoutStatus(sessionId)).toEqual({ status: 'paid', orderNumber: o.number });
    expect(purchaseEvent(o)).toMatchObject({ type: 'purchase', eventId: o.id, value: { amount: 3399, currency: 'EUR' } });
    const s2 = await start(await readyCart(1));
    expect(s2.sessionId).not.toBe(sessionId);
  });

  it('ignores unpaid sessions and refuses amount mismatches', async () => {
    const { sessionId } = await start(await readyCart());
    await completed(sessionId, 3399, { payment_status: 'unpaid' });
    expect(await db.select().from(orders)).toHaveLength(0);
    await completed(sessionId, 100);
    expect(await db.select().from(orders)).toHaveLength(0);
    expect((await db.select().from(checkoutSessions))[0]!.status).toBe('amount_mismatch');
    await runDue();
    expect(sent.map((m) => m.to)).toEqual([['ops@shop.test']]);
  });

  it('refunds automatically when stock ran out while paying', async () => {
    const a = await start(await readyCart(2));
    await db.update(productVariants).set({ stock: 1 }).where(eq(productVariants.id, mug));
    await completed(a.sessionId, 3399);
    expect(await db.select().from(orders)).toHaveLength(0);
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: `pi_${a.sessionId}`, reason: 'requested_by_customer' }, { idempotencyKey: `oos:${a.sessionId}` });
    expect(await getCheckoutStatus(a.sessionId)).toEqual({ status: 'refunded' });
    expect((await getProduct('mug'))!.variants[0]!.stock).toBe(1); // la reserva fallida se deshizo
    await runDue();
    expect(sent.find((m) => m.to === 'ana@x.test')?.subject).toBe('Your payment has been refunded');
  });

  it('marks expired sessions and refunds paid orders through Stripe from the admin', async () => {
    const exp = await start(await readyCart(1));
    const payload = JSON.stringify({ id: 'evt_exp', object: 'event', type: 'checkout.session.expired', data: { object: { id: exp.sessionId, object: 'checkout.session' } } });
    await handleStripeWebhook(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }));
    expect(await getCheckoutStatus(exp.sessionId)).toEqual({ status: 'expired' });
    const paid = await start(await readyCart(1));
    await completed(paid.sessionId, 1899);
    const [o] = await db.select().from(orders);
    const refund = ordersAdminResource.actions!.find((a) => a.name === 'refund')!;
    await refund.run(o!.id, { amount: 500 }, { user: { id: 'u', email: null, name: null }, can: async () => true });
    expect(stripe.refunds.create).toHaveBeenLastCalledWith({ payment_intent: `pi_${paid.sessionId}`, amount: 500 }, { idempotencyKey: `refund:${o!.id}:1` });
  });
});

describe('HTTP', () => {
  it('starts checkout from the cart cookie and exposes status', async () => {
    const { cart, setCookie } = await getOrCreateCart(null, null);
    await addLine(cart.id, mug, 1);
    await setCartMeta(cart.id, { country: 'ES', shippingRateId: (await ratesFor({ lines: [], subtotal: { amount: 0, currency: 'EUR' }, discountTotal: { amount: 0, currency: 'EUR' }, currency: 'EUR' }, 'ES'))[0]!.id });
    const app = new Hono().route('/api/checkout', checkoutRoutes({ currentUserId: async () => null }));
    const res = await app.request('/api/checkout', { method: 'POST', headers: { cookie: setCookie!.split(';')[0]!, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'b@x.test' }) });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { url: string }).url).toMatch(/^https:\/\/checkout/);
    expect((await app.request('/api/checkout', { method: 'POST', body: '{}' })).status).toBe(400);
    expect((await app.request('/api/checkout/status?session_id=../x')).status).toBe(400);
    expect(((await (await app.request(`/api/checkout/status?session_id=cs_test_${nextSession}`)).json()) as { status: string }).status).toBe('pending');
  });
});
