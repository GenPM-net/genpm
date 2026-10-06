// Lectura pública (ContentSource): solo lo publicado, salvo `draft: true` (vista previa autorizada).
import { and, asc, count, desc, eq, inArray, notExists, or, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { z } from 'zod';
import type { ContentEntry, ContentListQuery, ContentReadOptions, ContentSource } from '../contracts/index.js';
import { type Executor, getDb } from '../db/index.js';
import { type Collection, defaultLocale, getCollection, SINGLETON_SLUG } from './registry.js';
import { type ContentRow, contentEntries } from './schema.js';

function toEntry<D>(row: ContentRow, draft: boolean): ContentEntry<D> | null {
  const data = draft ? (row.draft ?? row.data) : row.data;
  if (!data) return null;
  return {
    id: row.id,
    collection: row.collection,
    slug: row.slug,
    locale: row.locale,
    status: row.status,
    data: data as D,
    publishedAt: row.publishedAt,
    updatedAt: row.updatedAt,
  };
}

const visible = (draft: boolean | undefined) =>
  draft ? inArray(contentEntries.status, ['draft', 'scheduled', 'published']) : eq(contentEntries.status, 'published');

/** Idiomas a probar en orden: el pedido y, si la colección es multilingüe, el de por defecto. */
function locales(c: Collection, locale: string | undefined): string[] {
  const def = defaultLocale();
  if (!c.localized) return [def];
  return locale && locale !== def ? [locale, def] : [def];
}

export async function getEntry<D = Record<string, unknown>>(
  collection: string,
  slug: string,
  opts: ContentReadOptions = {},
  db: Executor = getDb(),
): Promise<ContentEntry<D> | null> {
  const c = getCollection(collection);
  for (const locale of locales(c, opts.locale)) {
    const [row] = await db
      .select()
      .from(contentEntries)
      .where(
        and(
          eq(contentEntries.collection, collection),
          eq(contentEntries.slug, slug),
          eq(contentEntries.locale, locale),
          visible(opts.draft),
        ),
      );
    const entry = row ? toEntry<D>(row, !!opts.draft) : null;
    if (entry) return entry;
  }
  return null;
}

const FIELD_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/;

function orderOf(orderBy: string | undefined): SQL {
  const key = orderBy ?? '-publishedAt';
  const dir = key.startsWith('-') ? desc : asc;
  const field = key.replace(/^-/, '');
  if (field === 'publishedAt') return dir(contentEntries.publishedAt);
  if (field === 'updatedAt') return dir(contentEntries.updatedAt);
  if (field === 'slug') return dir(contentEntries.slug);
  if (!FIELD_RE.test(field)) throw new Error(`invalid orderBy: ${orderBy}`);
  return dir(sql`${contentEntries.data} ->> ${field}`);
}

/**
 * Lista entradas visibles de una colección en un idioma (con fallback al idioma por defecto si no hay ninguna
 * traducida). `where` compara por igualdad campos de `data`.
 */
function listConditions(collection: string, query: ContentListQuery, db: Executor): SQL {
  const c = getCollection(collection);
  const conds: SQL[] = [eq(contentEntries.collection, collection), visible(query.draft)!];
  for (const [k, v] of Object.entries(query.contains ?? {})) {
    if (!FIELD_RE.test(k)) throw new Error(`invalid contains field: ${k}`);
    const col = query.draft ? sql`coalesce(${contentEntries.draft}, ${contentEntries.data})` : sql`${contentEntries.data}`;
    conds.push(sql`(${col} -> ${k}) @> ${JSON.stringify([v])}::jsonb`);
  }
  for (const [k, v] of Object.entries(query.where ?? {})) {
    if (!FIELD_RE.test(k)) throw new Error(`invalid where field: ${k}`);
    const col = query.draft ? sql`coalesce(${contentEntries.draft}, ${contentEntries.data})` : sql`${contentEntries.data}`;
    conds.push(v === null ? sql`${col} ->> ${k} is null` : sql`${col} ->> ${k} = ${String(v)}`);
  }
  // Por cada grupo de traducciones, la versión en el idioma pedido o, si no existe visible, la del idioma por defecto.
  const [wanted, fallback] = locales(c, query.locale);
  const t = alias(contentEntries, 't');
  const translated = db
    .select({ one: sql`1` })
    .from(t)
    .where(and(eq(t.groupId, contentEntries.groupId), eq(t.locale, wanted!), query.draft ? inArray(t.status, ['draft', 'scheduled', 'published']) : eq(t.status, 'published')));
  const localeCond = fallback
    ? or(eq(contentEntries.locale, wanted!), and(eq(contentEntries.locale, fallback), notExists(translated)))!
    : eq(contentEntries.locale, wanted!);
  return and(...conds, localeCond)!;
}

export async function listEntries<D = Record<string, unknown>>(
  collection: string,
  query: ContentListQuery = {},
  db: Executor = getDb(),
): Promise<ContentEntry<D>[]> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
  const rows = await db
    .select()
    .from(contentEntries)
    .where(listConditions(collection, query, db))
    .orderBy(orderOf(query.orderBy), asc(contentEntries.id))
    .limit(limit)
    .offset(Math.max(query.offset ?? 0, 0));
  return rows.map((r) => toEntry<D>(r, !!query.draft)).filter((e): e is ContentEntry<D> => e !== null);
}

/** Total de entradas visibles con los mismos filtros que `listEntries` (para paginar). */
export async function countEntries(collection: string, query: ContentListQuery = {}, db: Executor = getDb()): Promise<number> {
  const [row] = await db.select({ n: count() }).from(contentEntries).where(listConditions(collection, query, db));
  return row?.n ?? 0;
}

export const getSingleton = <D = Record<string, unknown>>(name: string, opts?: ContentReadOptions, db?: Executor) =>
  getEntry<D>(name, SINGLETON_SLUG, opts, db);

/** `ContentSource` de este paquete (para blog, blocks, site y kits). */
export const contentSource: ContentSource = {
  getEntry: (collection, slug, opts) => getEntry(collection, slug, opts),
  listEntries: (collection, query) => listEntries(collection, query),
};

/** Lecturas tipadas por el esquema de la colección: `await reader(pages).get('about')`. */
export function reader<S extends z.ZodObject>(c: Collection<S>) {
  type D = z.infer<S>;
  return {
    get: (slug: string, opts?: ContentReadOptions) =>
      getEntry<D>(c.name, c.kind === 'singleton' ? SINGLETON_SLUG : slug, opts),
    list: (query?: ContentListQuery) => listEntries<D>(c.name, query),
    singleton: (opts?: ContentReadOptions) => getEntry<D>(c.name, SINGLETON_SLUG, opts),
  };
}
