// Escritura: borradores, publicación, programación, archivo, revisiones y migraciones de datos.
import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { type Executor, getDb, newId, withTransaction } from '../db/index.js';
import { defineJob } from '../jobs/index.js';
import { z } from 'zod';
import {
  assertSlug,
  ContentError,
  defaultLocale,
  getCollection,
  SINGLETON_SLUG,
  validateData,
} from './registry.js';
import { type ContentRevision, type ContentRow, contentEntries, contentRevisions } from './schema.js';

type Actor = { authorId?: string | null };

export type CreateEntryInput = { collection: string; slug?: string; locale?: string; data: unknown; translationOf?: string } & Actor;

async function byId(id: string, db: Executor): Promise<ContentRow> {
  const [row] = await db.select().from(contentEntries).where(eq(contentEntries.id, id));
  if (!row) throw new ContentError('not_found', `entry ${id} not found`);
  return row;
}

export const getEntryById = (id: string, db: Executor = getDb()) => byId(id, db);

/** Crea una entrada en borrador. Para singletons el slug es siempre `_`. */
export async function createEntry(input: CreateEntryInput, db: Executor = getDb()): Promise<ContentRow> {
  const c = getCollection(input.collection);
  const slug = assertSlug(c.kind === 'singleton' ? SINGLETON_SLUG : (input.slug ?? ''));
  const locale = c.localized ? (input.locale ?? defaultLocale()) : defaultLocale();
  const draft = validateData(c, input.data, true);
  let groupId = newId('grp');
  if (input.translationOf) {
    const source = await byId(input.translationOf, db);
    if (source.collection !== c.name) throw new ContentError('invalid_state', 'translation of another collection');
    groupId = source.groupId;
  }
  const [row] = await db
    .insert(contentEntries)
    .values({ collection: c.name, slug, locale, groupId, draft, authorId: input.authorId ?? null })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new ContentError('slug_taken', `${c.name}/${slug} (${locale}) already exists`);
  return row;
}

/** Guarda cambios sin publicar (validación parcial: se permiten borradores incompletos). */
export async function saveDraft(id: string, data: unknown, db: Executor = getDb()): Promise<ContentRow> {
  const row = await byId(id, db);
  const draft = validateData(getCollection(row.collection), data, true);
  const [updated] = await db.update(contentEntries).set({ draft }).where(eq(contentEntries.id, id)).returning();
  return updated!;
}

/** Cambia el slug (comprueba que no esté ocupado en ese idioma). */
export async function renameEntry(id: string, slug: string, db: Executor = getDb()): Promise<ContentRow> {
  const row = await byId(id, db);
  if (getCollection(row.collection).kind === 'singleton') throw new ContentError('invalid_state', 'singletons have no slug');
  assertSlug(slug);
  try {
    const [updated] = await db.update(contentEntries).set({ slug }).where(eq(contentEntries.id, id)).returning();
    return updated!;
  } catch {
    throw new ContentError('slug_taken', `${row.collection}/${slug} already exists`);
  }
}

/** Publica el borrador (o republica lo publicado) con validación completa y deja revisión. */
export async function publish(
  id: string,
  opts: Actor & { message?: string; now?: Date } = {},
  db: Executor = getDb(),
): Promise<ContentRow> {
  return tx(db, async (t) => {
    const row = await byId(id, t);
    if (row.status === 'archived') throw new ContentError('invalid_state', 'archived entries must be restored first');
    const data = validateData(getCollection(row.collection), row.draft ?? row.data ?? {}, false);
    const now = opts.now ?? new Date();
    const [updated] = await t
      .update(contentEntries)
      .set({ data, draft: null, status: 'published', scheduledAt: null, publishedAt: row.publishedAt ?? now })
      .where(eq(contentEntries.id, id))
      .returning();
    await t.insert(contentRevisions).values({ entryId: id, data, authorId: opts.authorId ?? null, message: opts.message ?? null });
    return updated!;
  });
}

/** Tarea que publica las entradas programadas (requiere el cron de @core/jobs). */
export const publishScheduledJob = defineJob(
  'content.publish-scheduled',
  z.object({ entryId: z.string() }),
  async ({ entryId }) => {
    const row = await getEntryById(entryId).catch(() => null);
    // Desprogramada, reprogramada a más tarde o ya publicada: no hace nada (idempotente).
    if (!row?.scheduledAt || row.scheduledAt.getTime() > Date.now() + 1000) return;
    await publish(entryId, { message: 'scheduled' });
  },
);

/**
 * Programa la publicación del borrador actual para `at`. Una entrada ya publicada sigue visible con su versión
 * actual (`status` = published) hasta esa hora; una nueva queda `scheduled` (invisible).
 */
export async function schedulePublish(id: string, at: Date, db: Executor = getDb()): Promise<ContentRow> {
  if (at.getTime() <= Date.now()) throw new ContentError('invalid_state', 'schedule date must be in the future');
  const row = await byId(id, db);
  if (row.status === 'archived') throw new ContentError('invalid_state', 'archived entries must be restored first');
  validateData(getCollection(row.collection), row.draft ?? row.data ?? {}, false);
  const [updated] = await db
    .update(contentEntries)
    .set({ status: row.status === 'published' ? 'published' : 'scheduled', scheduledAt: at })
    .where(eq(contentEntries.id, id))
    .returning();
  await publishScheduledJob.enqueue({ entryId: id }, { runAt: at, dedupeKey: `content.publish:${id}:${at.getTime()}` }, db);
  return updated!;
}

export async function unschedule(id: string, db: Executor = getDb()): Promise<ContentRow> {
  const row = await byId(id, db);
  const [updated] = await db
    .update(contentEntries)
    .set({ scheduledAt: null, status: row.status === 'scheduled' ? 'draft' : row.status })
    .where(eq(contentEntries.id, id))
    .returning();
  return updated!;
}

/** Retira de la web: lo publicado vuelve a ser borrador. */
export async function unpublish(id: string, db: Executor = getDb()): Promise<ContentRow> {
  const row = await byId(id, db);
  const [updated] = await db
    .update(contentEntries)
    .set({ status: 'draft', draft: row.draft ?? row.data, data: null, scheduledAt: null })
    .where(eq(contentEntries.id, id))
    .returning();
  return updated!;
}

export async function archive(id: string, db: Executor = getDb()): Promise<ContentRow> {
  await byId(id, db);
  const [updated] = await db
    .update(contentEntries)
    .set({ status: 'archived', scheduledAt: null })
    .where(eq(contentEntries.id, id))
    .returning();
  return updated!;
}

/** Saca del archivo como borrador. */
export async function restore(id: string, db: Executor = getDb()): Promise<ContentRow> {
  const row = await byId(id, db);
  if (row.status !== 'archived') return row;
  const [updated] = await db
    .update(contentEntries)
    .set({ status: 'draft', draft: row.draft ?? row.data, data: null })
    .where(eq(contentEntries.id, id))
    .returning();
  return updated!;
}

export async function deleteEntry(id: string, db: Executor = getDb()): Promise<void> {
  await db.delete(contentEntries).where(eq(contentEntries.id, id));
}

export async function listRevisions(entryId: string, db: Executor = getDb()): Promise<ContentRevision[]> {
  return db.select().from(contentRevisions).where(eq(contentRevisions.entryId, entryId)).orderBy(desc(contentRevisions.createdAt), desc(contentRevisions.id));
}

/** Copia una revisión al borrador (hay que publicar después). */
export async function restoreRevision(revisionId: string, db: Executor = getDb()): Promise<ContentRow> {
  const [rev] = await db.select().from(contentRevisions).where(eq(contentRevisions.id, revisionId));
  if (!rev) throw new ContentError('not_found', `revision ${revisionId} not found`);
  return saveDraft(rev.entryId, rev.data, db);
}

/**
 * Crea y publica una entrada si no existe (idempotente). Para semillas y para el modo retrofit: guarda los textos
 * actuales de una página como contenido sin pisar lo que el editor haya cambiado después.
 */
export async function seedEntry(
  input: Omit<CreateEntryInput, 'translationOf'>,
  db: Executor = getDb(),
): Promise<ContentRow> {
  const c = getCollection(input.collection);
  const slug = c.kind === 'singleton' ? SINGLETON_SLUG : (input.slug ?? '');
  const locale = c.localized ? (input.locale ?? defaultLocale()) : defaultLocale();
  const [existing] = await db
    .select()
    .from(contentEntries)
    .where(and(eq(contentEntries.collection, c.name), eq(contentEntries.slug, slug), eq(contentEntries.locale, locale)));
  if (existing) return existing;
  const row = await createEntry({ ...input, slug, locale }, db);
  return publish(row.id, { authorId: input.authorId, message: 'seed' }, db);
}

/**
 * Migra los datos de una colección tras cambiar su esquema: aplica `fn` a `data` y `draft` de cada entrada en
 * lotes, y valida el resultado con el esquema nuevo.
 */
export async function migrateEntries(
  collection: string,
  fn: (data: Record<string, unknown>) => Record<string, unknown>,
  db: Executor = getDb(),
): Promise<number> {
  const c = getCollection(collection);
  let n = 0;
  let after = '';
  for (;;) {
    const batch = await db
      .select()
      .from(contentEntries)
      .where(and(eq(contentEntries.collection, collection), gt(contentEntries.id, after)))
      .orderBy(asc(contentEntries.id))
      .limit(200);
    for (const r of batch) {
      await db
        .update(contentEntries)
        .set({
          data: r.data ? validateData(c, fn(r.data), false) : null,
          draft: r.draft ? validateData(c, fn(r.draft), true) : null,
        })
        .where(eq(contentEntries.id, r.id));
      n++;
    }
    if (batch.length < 200) break;
    after = batch.at(-1)!.id;
  }
  return n;
}

function tx<T>(db: Executor, fn: (t: Executor) => Promise<T>): Promise<T> {
  return 'rollback' in db ? fn(db) : withTransaction((t) => fn(t), db as Parameters<typeof withTransaction>[1]);
}
