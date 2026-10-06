import { and, eq, ne } from 'drizzle-orm';
import { Hono } from 'hono';
import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as authSchema from '../auth/schema.ts';
import { addLine, type Cart, carts, getOrCreateCart, setCartMeta, setDiscountCodes } from '../cart/index.ts';
import * as cartSchema from '../cart/schema.ts';
import { createProduct, getProduct, productVariants } from '../catalog/index.ts';
import * as catalogSchema from '../catalog/schema.ts';
import { testDb } from '../db/__fixtures__/pglite.ts';
import { discountRedemptions, upsertDiscount } from '../discounts/index.ts';
import * as discountsSchema from '../discounts/schema.ts';
import type { Db } from '../db/index.ts';
import { type EmailMessage, setEmailProvider } from '../email/index.ts';
import { runDue } from '../jobs/index.ts';
import * as jobsSchema from '../jobs/schema.ts';
import { createOrder, getOrder, orderEvents, orders, ordersAdminResource } from '../orders/index.ts';
import * as ordersSchema from '../orders/schema.ts';
import { ratesFor, upsertRate, upsertZone } from '../shipping/index.ts';
import * as shippingSchema from '../shipping/schema.ts';
import { handleStripeWebhook, setStripe } from '../stripe/index.ts';
import * as stripeSchema from '../stripe/schema.ts';
import { checkoutRoutes } from './adapters/hono.ts';
import * as schema from './schema.ts';
import { CheckoutError, checkoutSessions, getCheckoutStatus, purchaseEvent, startCheckout } from './index.ts';

const SECRET = 'whsec_checkout';
let db: Db;
let stripe: Stripe;
let mug: string;
const sent: EmailMessage[] = [];
let sessionParams: Stripe.Checkout.SessionCreateParams | undefined;
let nextSession = 0;

beforeEach(async () => {
  db = await testDb(authSchema, catalogSchema, cartSchema, ordersSchema, jobsSchema, stripeSchema, shippingSchema, discountsSchema, schema);
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
  vi.spyOn(stripe.checkout.sessions, 'expire').mockResolvedValue({} as never);
  vi.spyOn(stripe.refunds, 'create').mockImplementation((async (p: { amount?: number }) => ({ id: `re_${p.amount ?? 'full'}` })) as never);
  await createProduct({ slug: 'mug', name: 'Mug', status: 'active', variants: [{ price: 1500, stock: 3, weightGrams: 400 }] });
  mug = (await getProduct('mug'))!.variants[0]!.id;
  const es = await upsertZone({ name: 'Spain', countries: ['ES'] });
  await upsertRate({ zoneId: es.id, name: 'Standard', amount: 399 });
});

async function readyCart(qty = 2, meta: Record<string, string> = { country: 'ES' }, codes: string[] = []): Promise<Cart> {
  const { cart } = await getOrCreateCart(null, null);
  await addLine(cart.id, mug, qty);
  if (Object.keys(meta).length) await setCartMeta(cart.id, meta);
  if (codes.length) await setDiscountCodes(cart.id, codes);
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

  it('refunds (and answers 2xx) when the order can never be created, e.g. the variant was withdrawn while paying', async () => {
    const a = await start(await readyCart(2));
    await db.update(productVariants).set({ active: false }).where(eq(productVariants.id, mug));
    await expect(completed(a.sessionId, 3399)).resolves.toMatchObject({ received: true });
    expect(await db.select().from(orders)).toHaveLength(0);
    expect(stripe.refunds.create).toHaveBeenCalledWith({ payment_intent: `pi_${a.sessionId}`, reason: 'requested_by_customer' }, { idempotencyKey: `fail:${a.sessionId}` });
    expect(await getCheckoutStatus(a.sessionId)).toEqual({ status: 'refunded' });
    expect((await db.select().from(checkoutSessions))[0]!.status).toBe('refunded_order_failed');
    // Una dirección que no pasa la validación del pedido también se reembolsa en vez de fallar para siempre.
    await db.update(productVariants).set({ active: true }).where(eq(productVariants.id, mug));
    const b = await start(await readyCart(1));
    await expect(completed(b.sessionId, 1899, { collected_information: { shipping_details: { name: 'Ana', address: { line1: 'x', city: 'y', postal_code: '1', country: 'es' } } } })).resolves.toMatchObject({ received: true });
    expect(await getCheckoutStatus(b.sessionId)).toEqual({ status: 'refunded' });
    await runDue();
    expect(sent.filter((m) => m.to === 'ana@x.test').map((m) => m.subject)).toEqual(['Your payment has been refunded', 'Your payment has been refunded']);
    expect(sent.filter((m) => Array.isArray(m.to) && m.to.includes('ops@shop.test')).map((m) => m.subject)).toEqual([`Checkout order_failed: ${a.sessionId}`, `Checkout order_failed: ${b.sessionId}`]);
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

describe('discount limits under concurrent checkouts', () => {
  it('open checkout sessions reserve a usage-limited code; the redemption is recorded with the order', async () => {
    const d = await upsertDiscount({ code: 'ONE', name: 'One use', type: 'fixed', value: 500, usageLimit: 1 });
    const a = await start(await readyCart(1, { country: 'ES' }, ['ONE']));
    expect((await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, a.sessionId)))[0]!.total).toBe(1399);
    // Otro cliente a la vez: el código está reservado por el pago abierto y no se aplica.
    const b = await start(await readyCart(1, { country: 'ES' }, ['ONE']));
    expect((await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, b.sessionId)))[0]!.total).toBe(1899);
    // El mismo carrito puede volver a pagar (su propia sesión no cuenta como reserva ajena).
    await completed(a.sessionId, 1399);
    // El uso queda registrado en la misma transacción del pedido, sin esperar a las tareas en segundo plano.
    expect(await db.select().from(discountRedemptions).where(eq(discountRedemptions.discountId, d.id))).toHaveLength(1);
    const c = await start(await readyCart(1, { country: 'ES' }, ['ONE']));
    expect((await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, c.sessionId)))[0]!.total).toBe(1899);
  });

  it('a session racing another one for the last use is cancelled instead of oversubscribing', async () => {
    await upsertDiscount({ code: 'LAST', name: 'Last', type: 'fixed', value: 500, usageLimit: 1 });
    const rival = await readyCart(1, { country: 'ES' }, ['LAST']);
    const mine = await readyCart(1, { country: 'ES' }, ['LAST']);
    const create = stripe.checkout.sessions.create as unknown as ReturnType<typeof vi.fn>;
    const original = create.getMockImplementation()!;
    // Mientras Stripe crea nuestra sesión, otra petición guarda la suya con el mismo código.
    create.mockImplementationOnce(async (p: Stripe.Checkout.SessionCreateParams) => {
      await db.insert(checkoutSessions).values({ id: 'cs_rival', cartId: rival.id, email: 'r@x.test', currency: 'EUR', total: 1399, snapshot: { discounts: [{ source: 'discounts', label: 'Last', amount: { amount: 500, currency: 'EUR' }, code: 'LAST' }] } as never });
      return original(p);
    });
    await expect(start(mine)).rejects.toMatchObject({ code: 'issues' });
    expect(stripe.checkout.sessions.expire).toHaveBeenCalledTimes(1);
    expect((await db.select().from(checkoutSessions).where(ne(checkoutSessions.id, 'cs_rival')))[0]!.status).toBe('expired');
  });

  it('if a limit was exceeded anyway, the paid order is still created and flagged for the team', async () => {
    const d = await upsertDiscount({ code: 'SOLO', name: 'Solo', type: 'fixed', value: 500, usageLimit: 1 });
    const a = await start(await readyCart(1, { country: 'ES' }, ['SOLO']));
    // Otro canal (p. ej. un pedido manual) consume el último uso mientras el cliente paga.
    await createOrder({ email: 'z@x.test', currency: 'EUR', lines: [{ variantId: null, productId: null, sku: null, name: 'Gift', title: '', kind: 'digital', quantity: 1, unitPrice: 1000, discount: 500 }], discounts: [{ source: 'discounts', label: 'Solo', amount: 500, code: 'SOLO' }], payment: { provider: 'manual', ref: 'm', status: 'paid' } });
    await completed(a.sessionId, 1399);
    const [o] = await db.select().from(orders).where(eq(orders.cartId, a.sessionId));
    expect(o).toMatchObject({ status: 'paid', total: 1399 });
    expect(await db.select().from(discountRedemptions).where(eq(discountRedemptions.discountId, d.id))).toHaveLength(2);
    const flags = await db.select().from(orderEvents).where(and(eq(orderEvents.orderId, o!.id), eq(orderEvents.type, 'discount_over_limit')));
    expect(flags.map((f) => f.data)).toEqual([{ code: 'SOLO', discountId: d.id, limit: 'usage_limit', amount: 500 }]);
  });

  it('free-shipping codes carry their code and count as used', async () => {
    const d = await upsertDiscount({ code: 'SHIP', name: 'Free shipping', type: 'free_shipping', usageLimit: 1 });
    const a = await start(await readyCart(1, { country: 'ES' }, ['SHIP']));
    await completed(a.sessionId, 1500);
    expect((await getOrder((await db.select().from(orders))[0]!.id))!.discounts).toEqual([{ source: 'discounts', label: 'Free shipping (SHIP)', amount: 0, code: 'SHIP' }]);
    expect(await db.select().from(discountRedemptions).where(eq(discountRedemptions.discountId, d.id))).toHaveLength(1);
    const b = await start(await readyCart(1, { country: 'ES' }, ['SHIP']));
    expect((await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, b.sessionId)))[0]!.total).toBe(1899);
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
