// Tablas de @core/checkout. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { integer, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import type { CartTotals } from '../cart/index.ts';
import { timestamps } from '../db/index.ts';

/**
 * Instantánea de lo que el cliente vio y aceptó al ir a pagar. El pedido se crea desde aquí (no desde el carrito
 * actual, que puede haber cambiado) y el importe cobrado por Stripe se compara con `total`.
 */
export const checkoutSessions = pgTable('checkout_sessions', {
  /** Id de la sesión de Stripe (`cs_…`). */
  id: text('id').primaryKey(),
  cartId: text('cart_id').notNull(),
  userId: text('user_id'),
  email: text('email').notNull(),
  locale: text('locale'),
  currency: text('currency').notNull(),
  total: integer('total').notNull(),
  snapshot: jsonb('snapshot').$type<CartTotals>().notNull(),
  status: text('status', { enum: ['open', 'completed', 'expired', 'refunded_out_of_stock', 'refunded_order_failed', 'amount_mismatch'] }).notNull().default('open'),
  orderId: text('order_id'),
  ...timestamps,
});

export type CheckoutSession = typeof checkoutSessions.$inferSelect;
