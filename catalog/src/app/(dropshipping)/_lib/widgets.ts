// Widgets del panel de dropshipping: rentabilidad estimada, cola de reenvío y excepciones abiertas.
import { and, count, eq, gte, inArray } from 'drizzle-orm';
import type { AdminWidget } from '@/lib/admin';
import { storeCurrency } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { format, money } from '@/lib/money';
import { orderLines, orders } from '@/lib/orders';
import { supplierExceptions, supplierOrders, supplierProducts } from '@/lib/suppliers';

/** Comisión estimada de la pasarela por pedido (por defecto 1,5 % + 0,25; ajusta con PAYMENT_FEE_BPS y PAYMENT_FEE_FIXED). */
export const paymentFee = (total: number) => Math.round((total * Number(process.env.PAYMENT_FEE_BPS ?? 150)) / 10_000) + Number(process.env.PAYMENT_FEE_FIXED ?? 25);

/** Rentabilidad de los pedidos pagados desde `from`: ingresos − coste del proveedor − comisión estimada. */
export async function profitSince(from: Date) {
  const db = getDb();
  const paid = await db
    .select({ id: orders.id, total: orders.total, refunded: orders.refundedTotal, currency: orders.currency })
    .from(orders)
    .where(and(inArray(orders.status, ['paid', 'partially_refunded']), gte(orders.createdAt, from)));
  if (!paid.length) return { orders: 0, revenue: 0, cost: 0, fees: 0, profit: 0, unknownCost: 0 };
  const lines = await db
    .select({ orderId: orderLines.orderId, quantity: orderLines.quantity, cost: supplierProducts.cost, costCurrency: supplierProducts.currency })
    .from(orderLines)
    .leftJoin(supplierProducts, eq(supplierProducts.variantId, orderLines.variantId))
    .where(inArray(orderLines.orderId, paid.map((o) => o.id)));
  let revenue = 0;
  let cost = 0;
  let fees = 0;
  let unknownCost = 0;
  for (const o of paid) {
    revenue += o.total - o.refunded;
    fees += paymentFee(o.total);
    for (const l of lines.filter((x) => x.orderId === o.id)) {
      if (l.cost == null || l.costCurrency !== o.currency) unknownCost += l.quantity;
      else cost += l.cost * l.quantity;
    }
  }
  return { orders: paid.length, revenue, cost, fees, profit: revenue - cost - fees, unknownCost };
}

export const dropshippingWidgets: AdminWidget[] = [
  {
    name: 'profit-7d',
    title: 'Profit, 7 days (estimated)',
    permission: 'orders:read',
    async load() {
      const r = await profitSince(new Date(Date.now() - 7 * 86_400_000));
      const m = (n: number) => format(money(n, storeCurrency()));
      return {
        rows: [
          { label: `Revenue (${r.orders} orders)`, value: m(r.revenue) },
          { label: 'Supplier cost', value: m(r.cost) },
          { label: 'Payment fees (est.)', value: m(r.fees) },
          { label: r.unknownCost ? `Profit (${r.unknownCost} items without cost)` : 'Profit', value: m(r.profit) },
        ],
      };
    },
  },
  {
    name: 'forwarding',
    title: 'Supplier orders',
    permission: 'suppliers:read',
    async load() {
      const rows = await getDb().select({ status: supplierOrders.status, n: count() }).from(supplierOrders).where(inArray(supplierOrders.status, ['pending_approval', 'queued', 'failed'])).groupBy(supplierOrders.status);
      return { rows: rows.map((r) => ({ label: r.status.replace('_', ' '), value: r.n, href: '/admin/supplier-orders' })) };
    },
  },
  {
    name: 'exceptions',
    title: 'Open exceptions',
    permission: 'suppliers:read',
    async load() {
      const [r] = await getDb().select({ n: count() }).from(supplierExceptions).where(eq(supplierExceptions.status, 'open'));
      return { value: r?.n ?? 0 };
    },
  },
];
