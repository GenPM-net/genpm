// Definición de colecciones y singletons. Cada proceso importa las mismas definiciones (p. ej. src/genpm/content.ts).
import { z } from 'zod';
import type { AdminField } from '../contracts/index.js';

export const SINGLETON_SLUG = '_';
const NAME_RE = /^[a-z][a-z0-9_]{0,47}$/;

export type CollectionOptions<S extends z.ZodObject> = {
  schema: S;
  label?: { singular: string; plural: string };
  /** Campos para el panel (@core/admin). Si faltan, se deducen del esquema. */
  fields?: AdminField[];
  /** Campo de `data` usado como título. Default `title` si existe. */
  titleField?: string;
  /** Las entradas tienen versión por idioma. Default true. */
  localized?: boolean;
};

export type Collection<S extends z.ZodObject = z.ZodObject> = {
  name: string;
  kind: 'collection' | 'singleton';
  schema: S;
  label: { singular: string; plural: string };
  fields: AdminField[];
  titleField: string | null;
  localized: boolean;
};

const registry = new Map<string, Collection>();

function register<S extends z.ZodObject>(kind: Collection['kind'], name: string, opts: CollectionOptions<S>): Collection<S> {
  if (!NAME_RE.test(name)) throw new Error(`invalid collection name: ${name}`);
  const shape = opts.schema.shape as Record<string, z.ZodType>;
  const human = name.replaceAll('_', ' ').replace(/^./, (c) => c.toUpperCase());
  const c: Collection<S> = {
    name,
    kind,
    schema: opts.schema,
    label: opts.label ?? { singular: human, plural: human },
    fields: opts.fields ?? Object.keys(shape).map((k) => ({ name: k, label: k, type: inferFieldType(shape[k]!) })),
    titleField: opts.titleField ?? ('title' in shape ? 'title' : null),
    localized: opts.localized ?? true,
  };
  registry.set(name, c as unknown as Collection);
  return c;
}

/** Colección: muchas entradas con slug (páginas, posts, FAQs). */
export const defineCollection = <S extends z.ZodObject>(name: string, opts: CollectionOptions<S>) =>
  register('collection', name, opts);

/** Singleton: una sola entrada por idioma (home, ajustes, pie de página). */
export const defineSingleton = <S extends z.ZodObject>(name: string, opts: CollectionOptions<S>) =>
  register('singleton', name, opts);

export function getCollection(name: string): Collection {
  const c = registry.get(name);
  if (!c) throw new ContentError('unknown_collection', `unknown collection: ${name} (call defineCollection first)`);
  return c;
}

export const listCollections = (): Collection[] => [...registry.values()];

/** Solo tests. */
export const clearCollections = () => registry.clear();

function inferFieldType(t: z.ZodType): AdminField['type'] {
  const def = (t as unknown as { def?: { type?: string; innerType?: z.ZodType } }).def;
  const type = def?.type;
  if ((type === 'optional' || type === 'nullable' || type === 'default') && def?.innerType) return inferFieldType(def.innerType);
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'date') return 'date';
  if (type === 'enum') return 'select';
  if (type === 'string') return 'text';
  return 'json';
}

export type ContentErrorCode =
  | 'unknown_collection'
  | 'not_found'
  | 'invalid_slug'
  | 'invalid_data'
  | 'slug_taken'
  | 'invalid_state'
  | 'invalid_token'
  | 'forbidden';

export class ContentError extends Error {
  constructor(
    readonly code: ContentErrorCode,
    message: string = code,
    readonly issues?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'ContentError';
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,5}$/;

export function assertSlug(slug: string): string {
  if (slug !== SINGLETON_SLUG && (slug.length > 200 || !SLUG_RE.test(slug)))
    throw new ContentError('invalid_slug', `invalid slug: ${JSON.stringify(slug)}`);
  return slug;
}

/** `Hola, Mundo ñandú!` → `hola-mundo-nandu`. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export const defaultLocale = () => process.env.CONTENT_DEFAULT_LOCALE ?? 'en';

export function validateData(c: Collection, data: unknown, partial: boolean): Record<string, unknown> {
  const schema = partial ? c.schema.partial() : c.schema;
  const r = schema.safeParse(data);
  if (!r.success)
    throw new ContentError(
      'invalid_data',
      `invalid ${c.name} data`,
      r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  return r.data as Record<string, unknown>;
}
