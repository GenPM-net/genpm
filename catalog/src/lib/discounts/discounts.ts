// Validación y aplicación de descuentos como pasos de la tubería de totales de @core/cart, y registro de usos al
// pagarse el pedido (@core/orders).
import { and, count, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type CartTotals, registerTotalsStep } from '../cart/index.ts';
import { categories, productCategories } from '../catalog/index.ts';
import { type Executor, getDb } from '../db/index.ts';
import { add, allocate, money, percent, sub, zero } from '../money/index.ts';
import { onOrderEvent, orders } from '../orders/index.ts';
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

/** Por qué no aplica un descuento (o null si aplica). */
async function rejection(t: CartTotals, d: Discount, now: Date, db: Executor): Promise<string | null> {
  if (!d.active || (d.startsAt && d.startsAt > now) || (d.endsAt && d.endsAt <= now)) return 'This code is not active';
  const remaining = sub(t.subtotal, t.discountTotal).amount;
  if (d.minSubtotal != null && remaining < d.minSubtotal) return 'Minimum order not reached';
  if (d.usageLimit != null) {
    const [r] = await db.select({ n: count() }).from(discountRedemptions).where(eq(discountRedemptions.discountId, d.id));
    if ((r?.n ?? 0) >= d.usageLimit) return 'This code has been used up';
  }
  const email = t.context.email?.toLowerCase();
  if (d.perCustomerLimit != null && (email || t.context.userId)) {
    const who = or(email ? eq(discountRedemptions.email, email) : undefined, t.context.userId ? eq(discountRedemptions.userId, t.context.userId) : undefined);
    const [r] = await db.select({ n: count() }).from(discountRedemptions).where(and(eq(discountRedemptions.discountId, d.id), who));
    if ((r?.n ?? 0) >= d.perCustomerLimit) return 'You have already used this code';
  }
  if (d.firstOrderOnly) {
    if (!email && !t.context.userId) return 'Sign in or enter your email to use this code';
    const who = or(email ? eq(orders.email, email) : undefined, t.context.userId ? eq(orders.userId, t.context.userId) : undefined);
    const [r] = await db.select({ n: count() }).from(orders).where(and(who, inArray(orders.status, ['paid', 'partially_refunded', 'refunded'])));
    if ((r?.n ?? 0) > 0) return 'This code is only for first orders';
  }
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
  if (free) out = { ...out, context: { ...out.context, meta: { ...out.context.meta, freeShipping: free.d.code ?? free.d.name } } };
  return out;
}

/** Paso de envío gratis (orden 250, tras el envío): pone a cero la tarifa si un descuento lo concede. */
export function freeShippingStep(t: CartTotals): CartTotals {
  const label = t.context.meta.freeShipping;
  if (!label || !t.shipping || t.shipping.amount.amount === 0) return t;
  return { ...t, shipping: { ...t.shipping, amount: zero(t.currency) }, discounts: [...t.discounts, { source: 'discounts', label: `Free shipping (${label})`, amount: zero(t.currency) }] };
}

/** Registra los pasos y el contador de usos. Se llama al importar el módulo. */
export function registerDiscounts(): void {
  registerTotalsStep({ name: 'discounts', order: 100, run: (t) => discountsStep(t) });
  registerTotalsStep({ name: 'free-shipping', order: 250, run: freeShippingStep });
  onOrderEvent('paid', 'discounts.redemptions', async (o) => {
    const codes = o.discounts.filter((d) => d.code).map((d) => d.code!);
    if (!codes.length) return;
    const rows = await getDb().select().from(discounts).where(inArray(discounts.code, codes));
    for (const d of rows) {
      const amount = o.discounts.filter((x) => x.code === d.code).reduce((a, x) => a + x.amount, 0);
      await getDb().insert(discountRedemptions).values({ discountId: d.id, orderId: o.id, email: o.email, userId: o.userId, amount }).onConflictDoNothing();
    }
  });
}
registerDiscounts();
