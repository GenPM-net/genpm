// Panel: descuentos con su número de usos.
import { count, desc, eq, ilike, or } from 'drizzle-orm';
import type { AdminContext, AdminResource } from '../contracts/index.js';
import { getDb } from '../db/index.js';
import { DiscountInput, upsertDiscount } from './discounts.js';
import { type Discount, discountRedemptions, discounts } from './schema.js';

type Row = Discount & { uses: number };

class DiscountsForbidden extends Error {
  readonly code = 'forbidden';
}
async function need(ctx: AdminContext, action: 'read' | 'update') {
  if (!(await ctx.can(`discounts:${action}`))) throw new DiscountsForbidden(`forbidden: discounts:${action}`);
}
async function withUses(d: Discount): Promise<Row> {
  const [r] = await getDb().select({ n: count() }).from(discountRedemptions).where(eq(discountRedemptions.discountId, d.id));
  return { ...d, uses: r?.n ?? 0 };
}

export const discountsAdminResource: AdminResource<Row> = {
  name: 'discounts',
  label: { singular: 'Discount', plural: 'Discounts' },
  group: 'Store',
  fields: [
    { name: 'name', label: 'Name', type: 'text', required: true, list: true },
    { name: 'code', label: 'Code (empty = automatic)', type: 'text', list: true },
    { name: 'type', label: 'Type', type: 'select', required: true, list: true, options: [{ value: 'percent', label: '% off' }, { value: 'fixed', label: 'Amount off' }, { value: 'free_shipping', label: 'Free shipping' }] },
    { name: 'value', label: 'Value (% or cents)', type: 'number', list: true },
    { name: 'minSubtotal', label: 'Minimum order', type: 'money' },
    { name: 'productSlugs', label: 'Only products (slugs)', type: 'json' },
    { name: 'categorySlugs', label: 'Only categories (slugs)', type: 'json' },
    { name: 'firstOrderOnly', label: 'First order only', type: 'boolean' },
    { name: 'usageLimit', label: 'Total uses', type: 'number' },
    { name: 'perCustomerLimit', label: 'Uses per customer', type: 'number' },
    { name: 'combinable', label: 'Combines with other discounts', type: 'boolean' },
    { name: 'startsAt', label: 'Starts', type: 'datetime' },
    { name: 'endsAt', label: 'Ends', type: 'datetime' },
    { name: 'active', label: 'Active', type: 'boolean', list: true },
    { name: 'uses', label: 'Uses', type: 'number', readOnly: true, list: true },
  ],
  input: DiscountInput,
  title: (d) => d.code ?? d.name,
  async list(q, ctx) {
    await need(ctx, 'read');
    const where = q.search ? or(ilike(discounts.name, `%${q.search.replace(/[%_\\]/g, '')}%`), ilike(discounts.code, `%${q.search.replace(/[%_\\]/g, '')}%`)) : undefined;
    const [total] = await getDb().select({ n: count() }).from(discounts).where(where);
    const rows = await getDb().select().from(discounts).where(where).orderBy(desc(discounts.createdAt)).limit(q.pageSize).offset((Math.max(q.page, 1) - 1) * q.pageSize);
    return { rows: await Promise.all(rows.map(withUses)), total: total?.n ?? 0 };
  },
  async get(id, ctx) {
    await need(ctx, 'read');
    const [d] = await getDb().select().from(discounts).where(eq(discounts.id, id));
    return d ? withUses(d) : null;
  },
  async create(input, ctx) {
    await need(ctx, 'update');
    return withUses(await upsertDiscount(input as never));
  },
  async update(id, input, ctx) {
    await need(ctx, 'update');
    return withUses(await upsertDiscount(input as never, id));
  },
  async delete(id, ctx) {
    await need(ctx, 'update');
    await getDb().update(discounts).set({ active: false }).where(eq(discounts.id, id));
  },
};
