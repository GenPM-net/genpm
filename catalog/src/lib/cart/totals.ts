// Cálculo de totales siempre en servidor, con precios actuales de @core/catalog, y una tubería de pasos que otros
// módulos registran: descuentos (@core/discounts), envío (@core/shipping), impuestos (checkout/Stripe Tax).
import type { Money } from '../contracts/index.ts';
import { add, allocate, money, sub, sum, zero } from '../money/index.ts';

export type TotalsLine = {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  title: string;
  sku: string | null;
  mediaId: string | null;
  kind: 'physical' | 'digital';
  quantity: number;
  unitPrice: Money;
  /** unitPrice × quantity, antes de descuentos. */
  subtotal: Money;
  /** Parte de los descuentos de pedido asignada a esta línea (para impuestos y reembolsos). */
  discount: Money;
  weightGrams: number | null;
};

export type Adjustment = { source: string; label: string; amount: Money; code?: string };

export type CartTotals = {
  cartId: string;
  currency: string;
  lines: TotalsLine[];
  subtotal: Money;
  discounts: Adjustment[];
  discountTotal: Money;
  shipping: Adjustment | null;
  /** Impuestos añadidos al total (si los precios no los incluyen). */
  tax: Adjustment | null;
  total: Money;
  /** Avisos para el cliente: producto agotado, código no válido, sin envío a ese país… */
  issues: Array<{ code: string; message: string; variantId?: string }>;
  /** Lo que el carrito pide a los pasos (códigos, país, tarifa elegida). */
  context: { discountCodes: string[]; meta: Record<string, string>; userId: string | null; email?: string };
};

export type TotalsStep = { name: string; order: number; run(t: CartTotals): Promise<CartTotals> | CartTotals };

const steps: TotalsStep[] = [];

/** Registra un paso. Orden recomendado: descuentos 100, envío 200, impuestos 300. */
export function registerTotalsStep(step: TotalsStep): void {
  const i = steps.findIndex((s) => s.name === step.name);
  if (i >= 0) steps.splice(i, 1);
  steps.push(step);
  steps.sort((a, b) => a.order - b.order);
}

/** Solo tests. */
export const clearTotalsSteps = () => void steps.splice(0);

/** Aplica un descuento de pedido: lo reparte entre líneas proporcionalmente (sin perder céntimos). */
export function applyOrderDiscount(t: CartTotals, adj: Adjustment): CartTotals {
  const remaining = sub(sub(t.subtotal, t.discountTotal), adj.amount);
  const amount = remaining.amount < 0 ? sub(t.subtotal, t.discountTotal) : adj.amount;
  const parts = allocate(amount, t.lines.map((l) => sub(l.subtotal, l.discount).amount));
  return {
    ...t,
    lines: t.lines.map((l, i) => ({ ...l, discount: add(l.discount, parts[i]!) })),
    discounts: [...t.discounts, { ...adj, amount }],
    discountTotal: add(t.discountTotal, amount),
  };
}

export async function runSteps(base: CartTotals): Promise<CartTotals> {
  let t = base;
  for (const s of steps) t = await s.run(t);
  const total = add(sub(t.subtotal, t.discountTotal), t.shipping?.amount ?? zero(t.currency), t.tax?.amount ?? zero(t.currency));
  return { ...t, total: total.amount < 0 ? zero(t.currency) : total };
}

export const emptyTotals = (cartId: string, currency: string, context: CartTotals['context']): CartTotals => ({
  cartId,
  currency,
  lines: [],
  subtotal: zero(currency),
  discounts: [],
  discountTotal: zero(currency),
  shipping: null,
  tax: null,
  total: zero(currency),
  issues: [],
  context,
});

export const lineSubtotal = (unit: number, qty: number, currency: string) => money(unit * qty, currency);
export const sumLines = (lines: TotalsLine[], currency: string) => sum(lines.map((l) => l.subtotal), currency);
