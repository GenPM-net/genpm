// Tablas de @core/stripe. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
// Misma tabla que tenía @core/billing 1.x: al pasar a billing 2.0 no hay migración de datos.
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Idempotencia: cada evento de Stripe se procesa una sola vez aunque llegue repetido. */
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
