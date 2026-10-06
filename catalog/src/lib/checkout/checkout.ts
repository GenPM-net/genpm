// Del carrito al pago con Stripe Checkout. El pedido SOLO se crea en el webhook (pago confirmado), desde la
// instantánea guardada al iniciar el pago, de forma idempotente y reservando stock; si el pedido no se puede crear
// (stock agotado, variante retirada, datos no válidos), se reembolsa automáticamente.
import { and, eq, gt, ne, sql } from 'drizzle-orm';
import type Stripe from 'stripe';
import { z } from 'zod';
import { type Cart, type CartTotals, clearCart, computeTotals, registerPendingCodeUses } from '../cart/index.ts';
import { CatalogError } from '../catalog/index.ts';
import type { CommerceEvent, PaymentProvider } from '../contracts/index.ts';
import { type Executor, getDb } from '../db/index.ts';
import { getEmailProvider } from '../email/index.ts';
import { defineJob } from '../jobs/index.ts';
import { money, toDecimalString } from '../money/index.ts';
import { type Address, createOrder, getOrder, type OrderDetail, OrderError, registerPaymentProvider } from '../orders/index.ts';
import { getStripe, onStripeEvent } from '../stripe/index.ts';
import { type CheckoutSession, checkoutSessions } from './schema.ts';

export class CheckoutError extends Error {
  constructor(
    readonly code: 'empty' | 'issues' | 'needs_shipping' | 'invalid',
    message: string = code,
    readonly issues: CartTotals['issues'] = [],
  ) {
    super(message);
    this.name = 'CheckoutError';
  }
}

const BLOCKING = new Set(['no_shipping']);
/** Vida de la sesión de Stripe Checkout (y de la reserva de los códigos de descuento que lleva). */
const SESSION_TTL_MS = 30 * 60_000;

export type StartCheckoutInput = {
  cart: Cart;
  email: string;
  locale?: string;
  /** URLs absolutas https. A `successUrl` se le añade `session_id`. */
  successUrl: string;
  cancelUrl: string;
};

/** Crea la sesión de Stripe Checkout con los totales calculados en servidor y guarda su instantánea. */
export async function startCheckout(input: StartCheckoutInput, db: Executor = getDb()): Promise<{ url: string; sessionId: string }> {
  const email = z.email().safeParse(input.email.trim().toLowerCase());
  if (!email.success) throw new CheckoutError('invalid', 'invalid email');
  const t = await computeTotals(input.cart, { email: email.data }, db);
  if (!t.lines.length) throw new CheckoutError('empty', 'cart is empty', t.issues);
  if (t.issues.some((i) => BLOCKING.has(i.code))) throw new CheckoutError('issues', 'cart has blocking issues', t.issues);
  const physical = t.lines.some((l) => l.kind === 'physical');
  const country = t.context.meta.country;
  if (physical && (!country || !t.shipping)) throw new CheckoutError('needs_shipping', 'choose a shipping country and method first');
  const stripe = getStripe();
  let coupon: string | undefined;
  if (t.discountTotal.amount > 0) {
    // Cupón de un solo uso por el importe exacto de los descuentos calculados aquí.
    const c = await stripe.coupons.create({ amount_off: t.discountTotal.amount, currency: t.currency.toLowerCase(), duration: 'once', max_redemptions: 1, name: t.discounts.map((d) => d.label).join(' + ').slice(0, 40) || 'Discount' });
    coupon = c.id;
  }
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email.data,
    client_reference_id: t.cartId,
    locale: (input.locale as Stripe.Checkout.SessionCreateParams.Locale | undefined) ?? 'auto',
    line_items: t.lines.map((l) => ({
      quantity: l.quantity,
      price_data: { currency: t.currency.toLowerCase(), unit_amount: l.unitPrice.amount, product_data: { name: l.title ? `${l.name} (${l.title})` : l.name, metadata: { variantId: l.variantId } } },
    })),
    ...(coupon && { discounts: [{ coupon }] }),
    ...(physical &&
      t.shipping && {
        shipping_address_collection: { allowed_countries: [country as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry] },
        shipping_options: [{ shipping_rate_data: { type: 'fixed_amount', display_name: t.shipping.label, fixed_amount: { amount: t.shipping.amount.amount, currency: t.currency.toLowerCase() } } }],
      }),
    ...(process.env.STRIPE_TAX === '1' && { automatic_tax: { enabled: true } }),
    metadata: { cartId: t.cartId, ...(input.cart.userId && { userId: input.cart.userId }) },
    payment_intent_data: { metadata: { cartId: t.cartId } },
    success_url: `${input.successUrl}${input.successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: input.cancelUrl,
    expires_at: Math.floor((Date.now() + SESSION_TTL_MS) / 1000),
  });
  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  await db
    .insert(checkoutSessions)
    .values({ id: session.id, cartId: t.cartId, userId: input.cart.userId, email: email.data, locale: input.locale ?? null, currency: t.currency, total: t.total.amount, snapshot: t })
    .onConflictDoNothing();
  // Con la sesión ya guardada (y contando como reserva de sus códigos), se recalcula: si otro pago simultáneo agotó
  // un código limitado, los totales cambian y esta sesión se anula en vez de sobrepasar el límite.
  const again = await computeTotals(input.cart, { email: email.data }, db);
  if (again.total.amount !== t.total.amount || again.discountTotal.amount !== t.discountTotal.amount) {
    await stripe.checkout.sessions.expire(session.id).catch(() => undefined);
    await db.update(checkoutSessions).set({ status: 'expired' }).where(eq(checkoutSessions.id, session.id));
    throw new CheckoutError('issues', 'cart totals changed while starting checkout', again.issues);
  }
  return { url: session.url, sessionId: session.id };
}

function addressOf(s: Stripe.Checkout.Session): Address | null {
  const d = s.collected_information?.shipping_details;
  const a = d?.address;
  if (!d || !a?.line1 || !a.city || !a.postal_code || !a.country) return null;
  return {
    name: d.name ?? s.customer_details?.name ?? '',
    line1: a.line1,
    ...(a.line2 && { line2: a.line2 }),
    city: a.city,
    postalCode: a.postal_code,
    ...(a.state && { region: a.state }),
    country: a.country,
    ...(s.customer_details?.phone && { phone: s.customer_details.phone }),
  };
}

/** Convierte una sesión pagada en pedido. Idempotente: el pedido usa el id de la sesión como referencia única. */
export async function finalizeSession(s: Stripe.Checkout.Session, tx: Executor): Promise<CheckoutSession | null> {
  if (s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return null;
  const [cs] = await tx.select().from(checkoutSessions).where(eq(checkoutSessions.id, s.id)).for('update');
  if (!cs || cs.status !== 'open') return cs ?? null;
  const tax = s.total_details?.amount_tax ?? 0;
  const paymentRef = typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? s.id);
  if (s.amount_total !== cs.total + tax || (s.currency ?? '').toUpperCase() !== cs.currency) {
    // No debería ocurrir (los importes salen de la instantánea); si ocurre, no se crea el pedido y se avisa.
    const [row] = await tx.update(checkoutSessions).set({ status: 'amount_mismatch' }).where(eq(checkoutSessions.id, s.id)).returning();
    await alertJob.enqueue({ sessionId: s.id, reason: 'amount_mismatch' }, {}, tx);
    return row!;
  }
  const t = cs.snapshot;
  try {
    const order = await savepoint(tx, (inner) =>
      createOrder(
        {
          email: cs.email,
          userId: cs.userId,
          locale: cs.locale,
          currency: cs.currency,
          lines: t.lines.map((l) => ({ variantId: l.variantId, productId: l.productId, sku: l.sku, name: l.name, title: l.title, kind: l.kind, quantity: l.quantity, unitPrice: l.unitPrice.amount, discount: l.discount.amount })),
          discounts: t.discounts.map((d) => ({ source: d.source, label: d.label, amount: d.amount.amount, ...(d.code && { code: d.code }) })),
          shipping: t.shipping ? { label: t.shipping.label, amount: t.shipping.amount.amount, ...(t.shipping.code && { rateId: t.shipping.code }) } : null,
          taxTotal: tax,
          shippingAddress: addressOf(s),
          cartId: s.id,
          payment: { provider: 'stripe', ref: paymentRef, status: 'paid' },
        },
        inner,
      ),
    );
    await clearCart(cs.cartId, tx);
    const [row] = await tx.update(checkoutSessions).set({ status: 'completed', orderId: order.id }).where(eq(checkoutSessions.id, s.id)).returning();
    return row!;
  } catch (e) {
    // Solo los fallos permanentes (el pedido nunca se podrá crear) se reembolsan; el resto (base de datos, red) se
    // relanza para que Stripe reintente el webhook.
    if (!permanent(e)) throw e;
    const oos = e instanceof CatalogError && e.code === 'out_of_stock';
    // Reembolso completo automático y aviso al cliente y al equipo: nunca un cobro sin pedido.
    await getStripe().refunds.create({ payment_intent: paymentRef, reason: 'requested_by_customer' }, { idempotencyKey: `${oos ? 'oos' : 'fail'}:${s.id}` });
    const [row] = await tx.update(checkoutSessions).set({ status: oos ? 'refunded_out_of_stock' : 'refunded_order_failed' }).where(eq(checkoutSessions.id, s.id)).returning();
    await alertJob.enqueue({ sessionId: s.id, reason: oos ? 'out_of_stock' : 'order_failed', ...(!oos && { detail: (e instanceof Error ? e.message : String(e)).slice(0, 300) }) }, {}, tx);
    return row!;
  }
}

/** Errores de validación del catálogo o del pedido: reintentar no los arregla (variante retirada, datos no válidos…). */
const permanent = (e: unknown) => e instanceof CatalogError || e instanceof OrderError || e instanceof z.ZodError;

// createOrder abre su propia lógica transaccional; con SAVEPOINT un fallo de stock deshace solo su parte.
async function savepoint<T>(tx: Executor, fn: (inner: Executor) => Promise<T>): Promise<T> {
  return (tx as unknown as { transaction<R>(f: (t: Executor) => Promise<R>): Promise<R> }).transaction((inner) => fn(inner));
}

/** Avisos por email: al cliente si se le reembolsó; al equipo (`CHECKOUT_ALERT_TO`) siempre. */
export const alertJob = defineJob('checkout.alert', z.object({ sessionId: z.string(), reason: z.enum(['out_of_stock', 'order_failed', 'amount_mismatch']), detail: z.string().max(300).optional() }), async ({ sessionId, reason, detail }) => {
  const [cs] = await getDb().select().from(checkoutSessions).where(eq(checkoutSessions.id, sessionId));
  const from = process.env.EMAIL_FROM;
  if (!cs || !from) return;
  const total = toDecimalString(money(cs.total, cs.currency));
  if (reason === 'out_of_stock')
    await getEmailProvider().send({
      from,
      to: cs.email,
      subject: 'Your payment has been refunded',
      text: `Sorry: an item in your order sold out while you were paying, so we have refunded the full amount (${total} ${cs.currency}). No order was created.`,
      html: `<p>Sorry: an item in your order sold out while you were paying, so we have refunded the full amount (${total} ${cs.currency}). No order was created.</p>`,
    });
  if (reason === 'order_failed')
    await getEmailProvider().send({
      from,
      to: cs.email,
      subject: 'Your payment has been refunded',
      text: `Sorry: we could not complete your order (an item is no longer available), so we have refunded the full amount (${total} ${cs.currency}). No order was created.`,
      html: `<p>Sorry: we could not complete your order (an item is no longer available), so we have refunded the full amount (${total} ${cs.currency}). No order was created.</p>`,
    });
  const team = (process.env.CHECKOUT_ALERT_TO ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const why = detail ? `${reason} (${detail})` : reason;
  const esc = (x: string) => x.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  if (team.length) await getEmailProvider().send({ from, to: team, subject: `Checkout ${reason}: ${sessionId}`, text: `Session ${sessionId} (${cs.email}, ${total} ${cs.currency}): ${why}.`, html: `<p>Session ${sessionId}: ${esc(why)}.</p>` });
});

/** Estado para la página de éxito: consulta la base de datos (lo que dijo el webhook), nunca la URL. */
export async function getCheckoutStatus(sessionId: string, db: Executor = getDb()): Promise<{ status: 'pending' | 'paid' | 'expired' | 'refunded'; orderNumber?: string }> {
  const [cs] = await db.select().from(checkoutSessions).where(eq(checkoutSessions.id, sessionId));
  if (!cs) return { status: 'pending' };
  if (cs.status === 'completed' && cs.orderId) {
    const o = await getOrder(cs.orderId, db);
    return { status: 'paid', ...(o && { orderNumber: o.number }) };
  }
  if (cs.status === 'expired') return { status: 'expired' };
  if (cs.status === 'refunded_out_of_stock' || cs.status === 'refunded_order_failed') return { status: 'refunded' };
  return { status: 'pending' };
}

/** Pasarela Stripe para @core/orders (reembolsos desde el panel). */
export const stripePaymentProvider: PaymentProvider = {
  name: 'stripe',
  async getPayment(ref) {
    const pi = await getStripe().paymentIntents.retrieve(ref);
    const status = pi.status === 'succeeded' ? 'succeeded' : pi.status === 'canceled' ? 'failed' : 'pending';
    return { status, amount: money(pi.amount_received || pi.amount, pi.currency.toUpperCase()) };
  },
  async refund(ref, amount, opts) {
    const r = await getStripe().refunds.create({ payment_intent: ref, amount: amount.amount, ...(opts.reason && { metadata: { reason: opts.reason.slice(0, 200) } }) }, { idempotencyKey: opts.idempotencyKey });
    return { refundRef: r.id };
  },
};

/** Registra webhooks y la pasarela. Se llama al importar el módulo. */
export function registerCheckout(): void {
  onStripeEvent(['checkout.session.completed', 'checkout.session.async_payment_succeeded'], async (event, tx) => {
    await finalizeSession(event.data.object as Stripe.Checkout.Session, tx);
  });
  onStripeEvent('checkout.session.expired', async (event, tx) => {
    await tx.update(checkoutSessions).set({ status: 'expired' }).where(eq(checkoutSessions.id, (event.data.object as Stripe.Checkout.Session).id));
  });
  registerPaymentProvider(stripePaymentProvider);
  registerPendingCodeUses('checkout', pendingCheckoutCodeUses);
}

/**
 * Reservas de códigos de descuento: sesiones de pago abiertas y no caducadas que llevan `code` en su instantánea (sin
 * contar las del mismo carrito, que se sustituyen al volver a pagar). Las usa @core/discounts para sus límites.
 */
async function pendingCheckoutCodeUses(code: string, who: { email?: string; userId: string | null; excludeCartId: string }, db: Executor) {
  const rows = await db
    .select({ email: checkoutSessions.email, userId: checkoutSessions.userId })
    .from(checkoutSessions)
    .where(
      and(
        eq(checkoutSessions.status, 'open'),
        gt(checkoutSessions.createdAt, new Date(Date.now() - SESSION_TTL_MS)),
        ne(checkoutSessions.cartId, who.excludeCartId),
        sql`${checkoutSessions.snapshot}->'discounts' @> ${JSON.stringify([{ code }])}::jsonb`,
      ),
    );
  const mine = rows.filter((r) => (who.email && r.email === who.email) || (who.userId && r.userId === who.userId)).length;
  return { total: rows.length, mine };
}
registerCheckout();

// —— eventos para píxeles (@core/pixels) ——

export const beginCheckoutEvent = (t: CartTotals, eventId: string): CommerceEvent => ({
  type: 'begin_checkout',
  eventId,
  value: t.total,
  items: t.lines.map((l) => ({ id: l.variantId, name: l.name, price: l.unitPrice, quantity: l.quantity, ...(l.title && { variant: l.title }) })),
});

/** Evento `purchase` con `eventId` = id del pedido (el mismo en navegador y servidor para deduplicar). */
export const purchaseEvent = (o: OrderDetail): CommerceEvent => ({
  type: 'purchase',
  eventId: o.id,
  orderId: o.number,
  value: money(o.total, o.currency),
  items: o.lines.map((l) => ({ id: l.variantId ?? l.id, name: l.name, price: money(l.unitPrice, o.currency), quantity: l.quantity, ...(l.title && { variant: l.title }) })),
});
