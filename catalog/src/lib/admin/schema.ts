// Tablas de @core/admin. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { primaryId } from '../db/index.js';

/** Quién cambió qué y cuándo en el panel (crear, editar, borrar, acciones). */
export const adminAudit = pgTable(
  'admin_audit',
  {
    id: primaryId('aud'),
    userId: text('user_id').notNull(),
    resource: text('resource').notNull(),
    recordId: text('record_id'),
    action: text('action').notNull(),
    /** Antes/después (recortado) para crear, editar y acciones. */
    diff: jsonb('diff').$type<{ before?: unknown; after?: unknown; input?: unknown }>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [index('admin_audit_record_idx').on(t.resource, t.recordId, t.createdAt), index('admin_audit_user_idx').on(t.userId, t.createdAt)],
);

export type AdminAudit = typeof adminAudit.$inferSelect;
