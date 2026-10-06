// Tablas de @core/discounts. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '../db/index.js';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const discounts = pgTable('discounts', {
  id: primaryId('dsc'),
  /** Código en mayúsculas; null = descuento automático. */
  code: text('code').unique(),
  name: text('name').notNull(),
  type: text('type', { enum: ['percent', 'fixed', 'free_shipping'] }).notNull(),
  /** `percent`: 1–100. `fixed`: unidades menores. `free_shipping`: 0. */
  value: integer('value').notNull().default(0),
  minSubtotal: integer('min_subtotal'),
  /** Solo estos productos/categorías (slugs); vacío = todo el carrito. */
  productSlugs: jsonb('product_slugs').$type<string[]>().notNull().default([]),
  categorySlugs: jsonb('category_slugs').$type<string[]>().notNull().default([]),
  firstOrderOnly: boolean('first_order_only').notNull().default(false),
  usageLimit: integer('usage_limit'),
  perCustomerLimit: integer('per_customer_limit'),
  /** Se puede sumar a otros descuentos combinables; si no, compite y gana el mayor. */
  combinable: boolean('combinable').notNull().default(false),
  startsAt: ts('starts_at'),
  endsAt: ts('ends_at'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
});

export const discountRedemptions = pgTable(
  'discount_redemptions',
  {
    id: primaryId('dre'),
    discountId: text('discount_id')
      .notNull()
      .references(() => discounts.id, { onDelete: 'cascade' }),
    orderId: text('order_id').notNull(),
    email: text('email').notNull(),
    userId: text('user_id'),
    amount: integer('amount').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('discount_redemptions_order_idx').on(t.discountId, t.orderId), index('discount_redemptions_email_idx').on(t.discountId, t.email)],
);

export type Discount = typeof discounts.$inferSelect;
