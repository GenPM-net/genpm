// Tablas de @core/content. Las recoge drizzle-kit vía src/lib/db/drizzle.config.ts.
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '../db/index.js';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/**
 * Una fila por (colección, slug, idioma). `data` es lo publicado (lo que ve el público) y `draft` los cambios sin
 * publicar: editar una página publicada no cambia la web hasta volver a publicar. Las traducciones comparten `groupId`.
 */
export const contentEntries = pgTable(
  'content_entries',
  {
    id: primaryId('ent'),
    collection: text('collection').notNull(),
    slug: text('slug').notNull(),
    locale: text('locale').notNull(),
    groupId: text('group_id').notNull(),
    status: text('status', { enum: ['draft', 'scheduled', 'published', 'archived'] })
      .notNull()
      .default('draft'),
    data: jsonb('data').$type<Record<string, unknown>>(),
    draft: jsonb('draft').$type<Record<string, unknown>>(),
    authorId: text('author_id'),
    publishedAt: ts('published_at'),
    scheduledAt: ts('scheduled_at'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('content_entries_slug_idx').on(t.collection, t.slug, t.locale),
    index('content_entries_list_idx').on(t.collection, t.locale, t.status),
    index('content_entries_group_idx').on(t.groupId),
  ],
);

/** Historial: una revisión por publicación (y al restaurar). */
export const contentRevisions = pgTable(
  'content_revisions',
  {
    id: primaryId('rev'),
    entryId: text('entry_id')
      .notNull()
      .references(() => contentEntries.id, { onDelete: 'cascade' }),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    authorId: text('author_id'),
    message: text('message'),
    ...timestamps,
  },
  (t) => [index('content_revisions_entry_idx').on(t.entryId, t.createdAt)],
);

export type ContentRow = typeof contentEntries.$inferSelect;
export type ContentRevision = typeof contentRevisions.$inferSelect;
