// Validación y aplicación de descuentos como pasos de la tubería de totales de @core/cart, y registro de usos al
// pagarse el pedido (@core/orders), en la misma transacción y con la fila del descuento bloqueada.
import { and, asc, count, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type CartTotals, pendingCodeUses, registerTotalsStep } from '../cart/index.ts';
import { categories, productCategories } from '../catalog/index.ts';
import { type Executor, getDb } from '../db/index.ts';
import { add, allocate, money, percent, sub, zero } from '../money/index.ts';
import { type Order, onOrderPaidTx, orderEvents, orders } from '../orders/index.ts';
import { type Discount, discountRedemptions, discounts } from './schema.ts';

export const DiscountInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,40}$/)
      .nullish(),
    name: z.string().min(1).max(80),
    type: z.enum(['percent', 'fixed', 'free_shipping']),
    value: z.number().int().min(0).default(0),
    minSubtotal: z.number().int().min(0).nullish(),
    productSlugs: z.array(z.string()).max(100).default([]),
    categorySlugs: z.array(z.string()).max(50).default([]),
    firstOrderOnly: z.boolean().default(false),
    usageLimit: z.number().int().min(1).nullish(),
    perCustomerLimit: z.number().int().min(1).nullish(),
    combinable: z.boolean().default(false),
    startsAt: z.coerce.date().nullish(),
    endsAt: z.coerce.date().nullish(),
    active: z.boolean().default(true),
  })
  .refine((d) => d.type !== 'percent' || (d.value >= 1 && d.value <= 100), 'percent must be 1–100')
  .refine((d) => d.type !== 'fixed' || d.value > 0, 'fixed amount must be positive')
  .refine((d) => !d.startsAt || !d.endsAt || d.startsAt < d.endsAt, 'end must be after start');

export async function upsertDiscount(input: z.input<typeof DiscountInput>, id?: string, db: Executor = getDb()): Promise<Discount> {
  const d = DiscountInput.parse(input);
  const values = { ...d, code: d.code ?? null, minSubtotal: d.minSubtotal ?? null, usageLimit: d.usageLimit ?? null, perCustomerLimit: d.perCustomerLimit ?? null, startsAt: d.startsAt ?? null, endsAt: d.endsAt ?? null };
  const [row] = id ? await db.update(discounts).set(values).where(eq(discounts.id, id)).returning() : await db.insert(discounts).values(values).returning();
  return row!;
}

type Candidate = { d: Discount; amount: number; lineAmounts: number[] };

async function eligibleLines(t: CartTotals, d: Discount, db: Executor): Promise<boolean[]> {
  if (!d.productSlugs.length && !d.categorySlugs.length) return t.lines.map(() => true);
  let inCategory = new Set<string>();
  if (d.categorySlugs.length) {
    const rows = await db
      .select({ productId: productCategories.productId })
      .from(productCategories)
      .innerJoin(categories, eq(categories.id, productCategories.categoryId))
      .where(and(inArray(categories.slug, d.categorySlugs), inArray(productCategories.productId, t.lines.map((l) => l.productId))));
    inCategory = new Set(rows.map((r) => r.productId));
  }
  return t.lines.map((l) => d.productSlugs.includes(l.slug) || inCategory.has(l.productId));
}

const PAID = ['paid', 'partially_refunded', 'refunded'] as const;

type Who = { email?: string; userId?: string | null };
const whoRedeemed = (who: Who) => or(who.email ? eq(discountRedemptions.email, who.email) : undefined, who.userId ? eq(discountRedemptions.userId, who.userId) : undefined);
const whoOrdered = (who: Who) => or(who.email ? eq(orders.email, who.email) : undefined, who.userId ? eq(orders.userId, who.userId) : undefined);

/** Usos ya registrados (sin contar el pedido `exceptOrderId`): de todos y de este cliente. */
async function redemptions(d: Discount, who: Who, db: Executor, exceptOrderId?: string): Promise<{ total: number; mine: number }> {
  const base = and(eq(discountRedemptions.discountId, d.id), exceptOrderId ? ne(discountRedemptions.orderId, exceptOrderId) : undefined);
  const [all] = d.usageLimit != null ? await db.select({ n: count() }).from(discountRedemptions).where(base) : [{ n: 0 }];
  const [mine] = d.perCustomerLimit != null && (who.email || who.userId) ? await db.select({ n: count() }).from(discountRedemptions).where(and(base, whoRedeemed(who))) : [{ n: 0 }];
  return { total: all?.n ?? 0, mine: mine?.n ?? 0 };
}

/** ¿Tiene el cliente pedidos pagados (sin contar `exceptOrderId`)? */
async function hasPaidOrders(who: Who, db: Executor, exceptOrderId?: string): Promise<boolean> {
  const [r] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(whoOrdered(who), inArray(orders.status, [...PAID]), exceptOrderId ? ne(orders.id, exceptOrderId) : undefined));
  return (r?.n ?? 0) > 0;
}

/**
 * Por qué no aplica un descuento (o null si aplica). Los límites cuentan los usos registrados más los pagos abiertos
 * con ese código (reservas de @core/checkout vía `pendingCodeUses`), salvo los del propio carrito.
 */
async function rejection(t: CartTotals, d: Discount, now: Date, db: Executor): Promise<string | null> {
  if (!d.active || (d.startsAt && d.startsAt > now) || (d.endsAt && d.endsAt <= now)) return 'This code is not active';
  const remaining = sub(t.subtotal, t.discountTotal).amount;
  if (d.minSubtotal != null && remaining < d.minSubtotal) return 'Minimum order not reached';
  const email = t.context.email?.toLowerCase();
  const who: Who = { email, userId: t.context.userId };
  if (d.firstOrderOnly && !email && !t.context.userId) return 'Sign in or enter your email to use this code';
  const limited = d.usageLimit != null || d.perCustomerLimit != null || d.firstOrderOnly;
  const pending = limited && d.code ? await pendingCodeUses(d.code, { email, userId: t.context.userId, excludeCartId: t.cartId }, db) : { total: 0, mine: 0 };
  const used = await redemptions(d, who, db);
  if (d.usageLimit != null && used.total + pending.total >= d.usageLimit) return 'This code has been used up';
  if (d.perCustomerLimit != null && (email || t.context.userId) && used.mine + pending.mine >= d.perCustomerLimit) return 'You have already used this code';
  if (d.firstOrderOnly && (pending.mine > 0 || (await hasPaidOrders(who, db)))) return 'This code is only for first orders';
  return null;
}

async function candidate(t: CartTotals, d: Discount, db: Executor): Promise<Candidate | null> {
  if (d.type === 'free_shipping') return { d, amount: 0, lineAmounts: t.lines.map(() => 0) };
  const eligible = await eligibleLines(t, d, db);
  const base = t.lines.map((l, i) => (eligible[i] ? sub(l.subtotal, l.discount).amount : 0));
  const baseTotal = base.reduce((a, b) => a + b, 0);
  if (baseTotal <= 0) return null;
  const amount = Math.min(d.type === 'percent' ? percent(money(baseTotal, t.currency), d.value).amount : d.value, baseTotal);
  return { d, amount, lineAmounts: allocate(money(amount, t.currency), base).map((m) => m.amount) };
}

function apply(t: CartTotals, c: Candidate): CartTotals {
  const amount = money(c.amount, t.currency);
  return {
    ...t,
    lines: t.lines.map((l, i) => ({ ...l, discount: add(l.discount, money(c.lineAmounts[i] ?? 0, t.currency)) })),
    discounts: [...t.discounts, { source: 'discounts', label: c.d.name, amount, ...(c.d.code && { code: c.d.code }) }],
    discountTotal: add(t.discountTotal, amount),
  };
}

/**
 * Paso de descuentos (orden 100): automáticos vigentes + códigos del carrito. Los combinables se suman; de los no
 * combinables gana el de mayor importe. Los códigos que no aplican generan un aviso `invalid_code`.
 */
export async function discountsStep(t: CartTotals, db: Executor = getDb(), now = new Date()): Promise<CartTotals> {
  if (!t.lines.length) return t;
  const codes = t.context.discountCodes;
  const rows = await db
    .select()
    .from(discounts)
    .where(or(and(isNull(discounts.code), eq(discounts.active, true)), codes.length ? inArray(discounts.code, codes) : sql`false`));
  const issues = [...t.issues];
  for (const code of codes) if (!rows.some((r) => r.code === code)) issues.push({ code: 'invalid_code', message: `Code ${code} is not valid` });
  const valid: Candidate[] = [];
  for (const d of rows) {
    const why = await rejection(t, d, now, db);
    if (why) {
      if (d.code) issues.push({ code: 'invalid_code', message: why });
      continue;
    }
    const c = await candidate(t, d, db);
    if (c) valid.push(c);
    else if (d.code) issues.push({ code: 'invalid_code', message: `Code ${d.code} does not apply to these products` });
  }
  let out: CartTotals = { ...t, issues };
  const exclusive = valid.filter((c) => !c.d.combinable && c.d.type !== 'free_shipping').sort((a, b) => b.amount - a.amount);
  const chosen = [...valid.filter((c) => c.d.combinable && c.d.type !== 'free_shipping'), ...exclusive.slice(0, 1)];
  for (const c of chosen) {
    // Recalcula sobre lo que queda tras los anteriores para no descontar dos veces la misma parte.
    const fresh = await candidate(out, c.d, db);
    if (fresh && fresh.amount > 0) out = apply(out, fresh);
  }
  const free = valid.find((c) => c.d.type === 'free_shipping');
  if (free) out = { ...out, context: { ...out.context, meta: { ...out.context.meta, freeShipping: free.d.code ?? free.d.name, ...(free.d.code && { freeShippingCode: free.d.code }) } } };
  return out;
}

/**
 * Paso de envío gratis (orden 250, tras el envío): pone a cero la tarifa si un descuento lo concede. El ajuste lleva
 * el código (si lo hay) para que su uso se registre y cuente para los límites.
 */
export function freeShippingStep(t: CartTotals): CartTotals {
  const label = t.context.meta.freeShipping;
  if (!label || !t.shipping || t.shipping.amount.amount === 0) return t;
  const code = t.context.meta.freeShippingCode;
  return {
    ...t,
    shipping: { ...t.shipping, amount: zero(t.currency) },
    discounts: [...t.discounts, { source: 'discounts', label: `Free shipping (${label})`, amount: zero(t.currency), ...(code && { code }) }],
  };
}

/** Por qué este pedido ya no cabía en los límites del descuento (o null). Se evalúa con la fila bloqueada. */
async function overLimit(d: Discount, o: Order, db: Executor): Promise<string | null> {
  const who: Who = { email: o.email, userId: o.userId };
  const used = await redemptions(d, who, db, o.id);
  if (d.usageLimit != null && used.total >= d.usageLimit) return 'usage_limit';
  if (d.perCustomerLimit != null && used.mine >= d.perCustomerLimit) return 'per_customer_limit';
  if (d.firstOrderOnly && (await hasPaidOrders(who, db, o.id))) return 'first_order_only';
  return null;
}

/**
 * Registra los usos de los códigos de un pedido pagado en su misma transacción, bloqueando las filas de los
 * descuentos (FOR UPDATE) para que pagos simultáneos se serialicen y vuelvan a comprobar los límites. Si el límite
 * ya se había superado, el pedido sigue adelante (el cliente ya pagó con ese precio) pero el uso se registra igual y
 * queda un evento `discount_over_limit` en el historial del pedido para que el equipo lo revise.
 */
export async function recordRedemptions(o: Order, tx: Executor): Promise<void> {
  const codes = [...new Set(o.discounts.flatMap((d) => (d.code ? [d.code] : [])))];
  if (!codes.length) return;
  const rows = await tx.select().from(discounts).where(inArray(discounts.code, codes)).orderBy(asc(discounts.id)).for('update');
  for (const d of rows) {
    const why = await overLimit(d, o, tx);
    const amount = o.discounts.filter((x) => x.code === d.code).reduce((a, x) => a + x.amount, 0);
    const [inserted] = await tx.insert(discountRedemptions).values({ discountId: d.id, orderId: o.id, email: o.email, userId: o.userId, amount }).onConflictDoNothing().returning();
    if (inserted && why) await tx.insert(orderEvents).values({ orderId: o.id, type: 'discount_over_limit', data: { code: d.code, discountId: d.id, limit: why, amount } });
  }
}

/** Registra los pasos y el registro de usos al pagarse un pedido. Se llama al importar el módulo. */
export function registerDiscounts(): void {
  registerTotalsStep({ name: 'discounts', order: 100, run: (t) => discountsStep(t) });
  registerTotalsStep({ name: 'free-shipping', order: 250, run: freeShippingStep });
  onOrderPaidTx('discounts.redemptions', recordRedemptions);
}
registerDiscounts();
