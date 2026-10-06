// Tablas de @core/comments. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { index, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from '../auth/index.js';
import { primaryId, timestamps } from '../db/index.js';

export const comments = pgTable(
  'comments',
  {
    id: primaryId('cmt'),
    /** A qué se comenta: `post`, `product`, `page`… y su id. */
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    /** Respuesta a otro comentario (un solo nivel). */
    parentId: text('parent_id'),
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    /** Nombre visible (de la cuenta o del invitado). */
    authorName: text('author_name').notNull(),
    /** SHA-256 del email del invitado normalizado (para bajas RGPD y bloqueos); nunca el email en claro. */
    guestEmailHash: text('guest_email_hash'),
    body: text('body').notNull(),
    /** Valoración 1–5 opcional (la usan las reseñas). */
    rating: integer('rating'),
    status: text('status', { enum: ['pending', 'approved', 'spam', 'deleted'] })
      .notNull()
      .default('pending'),
    ...timestamps,
  },
  (t) => [
    index('comments_entity_idx').on(t.entityType, t.entityId, t.status, t.createdAt),
    index('comments_status_idx').on(t.status, t.createdAt),
    index('comments_author_idx').on(t.authorId),
  ],
);

export const commentBans = pgTable(
  'comment_bans',
  {
    id: primaryId('ban'),
    /** `user:<id>` o `email:<sha256>`. */
    subject: text('subject').notNull(),
    reason: text('reason'),
    ...timestamps,
  },
  (t) => [uniqueIndex('comment_bans_subject_idx').on(t.subject)],
);

export type Comment = typeof comments.$inferSelect;
