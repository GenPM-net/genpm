// Tablas de @core/cart. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from '../auth/index.js';
import { productVariants } from '../catalog/index.js';
import { primaryId, timestamps } from '../db/index.js';

export const carts = pgTable(
  'carts',
  {
    id: primaryId('crt'),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    currency: text('currency').notNull(),
    /** Códigos introducidos por el cliente (los valida @core/discounts al calcular). */
    discountCodes: jsonb('discount_codes').$type<string[]>().notNull().default([]),
    /** Datos que eligen otros pasos (tarifa de envío, país…). */
    meta: jsonb('meta').$type<Record<string, string>>().notNull().default({}),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    ...timestamps,
  },
  (t) => [index('carts_user_idx').on(t.userId), index('carts_expires_idx').on(t.expiresAt)],
);

export const cartLines = pgTable(
  'cart_lines',
  {
    cartId: text('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    variantId: text('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.cartId, t.variantId] })],
);

export type Cart = typeof carts.$inferSelect;
