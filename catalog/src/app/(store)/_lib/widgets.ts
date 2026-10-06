// Widgets del panel: ventas, pedidos por enviar y stock bajo.
import { and, count, eq, gte, inArray, sum } from 'drizzle-orm';
import type { AdminWidget } from '@/lib/admin';
import { lowStockVariants, storeCurrency } from '@/lib/catalog';
import { getDb } from '@/lib/db';
import { format, money } from '@/lib/money';
import { orders } from '@/lib/orders';

const PAID = ['paid', 'partially_refunded'] as const;

async function salesSince(from: Date) {
  const [r] = await getDb()
    .select({ total: sum(orders.total), n: count() })
    .from(orders)
    .where(and(inArray(orders.status, [...PAID]), gte(orders.createdAt, from)));
  return { total: Number(r?.total ?? 0), n: r?.n ?? 0 };
}

const startOfToday = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export const storeWidgets: AdminWidget[] = [
  {
    name: 'sales',
    title: 'Sales (today / 7 days)',
    permission: 'orders:read',
    async load() {
      const [today, week] = await Promise.all([salesSince(startOfToday()), salesSince(new Date(Date.now() - 7 * 86_400_000))]);
      const c = storeCurrency();
      return { rows: [{ label: `Today (${today.n} orders)`, value: format(money(today.total, c)) }, { label: `7 days (${week.n} orders)`, value: format(money(week.total, c)) }] };
    },
  },
  {
    name: 'to-ship',
    title: 'Orders to ship',
    permission: 'orders:read',
    async load() {
      const [r] = await getDb()
        .select({ n: count() })
        .from(orders)
        .where(and(inArray(orders.status, [...PAID]), eq(orders.fulfillmentStatus, 'unfulfilled')));
      return { value: r?.n ?? 0 };
    },
  },
  {
    name: 'low-stock',
    title: 'Low stock',
    permission: 'products:read',
    async load() {
      const rows = await lowStockVariants();
      return { rows: rows.slice(0, 10).map((v) => ({ label: `${v.product}${v.title ? ` · ${v.title}` : ''}`, value: v.stock })) };
    },
  },
];
