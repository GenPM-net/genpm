// Tablas de @core/antispam. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** Ventanas fijas de límite de frecuencia. `key` es un hash: nunca se guarda la IP ni el email en claro. */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    windowStart: timestamp('window_start', { withTimezone: true, mode: 'date' }).notNull(),
    count: integer('count').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => [index('rate_limits_expires_idx').on(t.expiresAt)],
);
