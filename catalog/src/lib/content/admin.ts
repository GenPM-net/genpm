// Recurso de panel (contrato AdminResource) por colección: lista, edición de borradores y acciones de publicación.
// Permisos: `<colección>:read|create|update|delete|publish`, con `:own` para autores (dueño = authorId).
import { and, count, eq, ilike, or, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AdminContext, AdminResource } from '../contracts/index.ts';
import { getDb } from '../db/index.ts';
import {
  archive,
  createEntry,
  deleteEntry,
  getEntryById,
  publish,
  renameEntry,
  restore,
  saveDraft,
  schedulePublish,
  unpublish,
  unschedule,
} from './entries.ts';
import { createPreviewToken } from './preview.ts';
import { ContentError, defaultLocale, getCollection, SINGLETON_SLUG } from './registry.ts';
import { type ContentRow, contentEntries } from './schema.ts';

export type ContentAdminRow = {
  id: string;
  slug: string;
  locale: string;
  status: ContentRow['status'];
  /** Lo que se edita: borrador si hay, si no lo publicado. */
  data: Record<string, unknown>;
  hasUnpublishedChanges: boolean;
  authorId: string | null;
  publishedAt: Date | null;
  scheduledAt: Date | null;
  updatedAt: Date;
};

const toRow = (r: ContentRow): ContentAdminRow => ({
  id: r.id,
  slug: r.slug,
  locale: r.locale,
  status: r.status,
  data: r.draft ?? r.data ?? {},
  hasUnpublishedChanges: r.draft !== null,
  authorId: r.authorId,
  publishedAt: r.publishedAt,
  scheduledAt: r.scheduledAt,
  updatedAt: r.updatedAt,
});

const Input = z.object({ slug: z.string().optional(), locale: z.string().optional(), data: z.record(z.string(), z.unknown()) });

async function assertCan(ctx: AdminContext, collection: string, action: string, row?: ContentRow): Promise<void> {
  // @core/admin resuelve `:own` pasando por ctx.can; aquí pedimos el permiso general o el propio si es el autor.
  const general = await ctx.can(`${collection}:${action}`);
  const own = row?.authorId === ctx.user.id && (await ctx.can(`${collection}:${action}:own`));
  if (!general && !own) throw new ContentError('forbidden', `forbidden: ${collection}:${action}`);
}

/**
 * Recurso del panel para una colección. Con `path`, cada entrada enlaza a su página pública y a una vista previa
 * firmada del borrador (requiere `CONTENT_PREVIEW_SECRET` y la ruta `/api/preview`).
 */
export function contentAdminResource(
  collection: string,
  opts: { path?: (entry: { slug: string; locale: string; data: Record<string, unknown> }) => string; previewRoute?: string } = {},
): AdminResource<ContentAdminRow> {
  const c = getCollection(collection);
  const load = async (id: string) => {
    const row = await getEntryById(id);
    if (row.collection !== collection) throw new ContentError('not_found', `entry ${id} not found`);
    return row;
  };
  const action = (name: string, label: string, permission: 'publish' | 'update', fn: (id: string, input: unknown) => Promise<ContentRow>, extra: Partial<{ confirm: boolean; input: z.ZodType; available: (r: ContentAdminRow) => boolean }> = {}) => ({
    name,
    label,
    permission: `${collection}:${permission}`,
    ...extra,
    async run(id: string, input: unknown, ctx: AdminContext) {
      await assertCan(ctx, collection, permission, await load(id));
      return toRow(await fn(id, input));
    },
  });
  return {
    name: collection,
    label: c.label,
    group: 'Content',
    fields: [
      ...(c.kind === 'collection' ? [{ name: 'slug', label: 'Slug', type: 'slug' as const, required: true, list: true }] : []),
      ...c.fields.map((f) => ({ ...f, name: `data.${f.name}` })),
    ],
    input: Input,
    title: (r) => String((c.titleField && r.data[c.titleField]) || (r.slug === SINGLETON_SLUG ? c.label.singular : r.slug)),
    async list(q, ctx) {
      const own = !(await ctx.can(`${collection}:read`));
      if (own && !(await ctx.can(`${collection}:read:own`))) throw new ContentError('forbidden', `forbidden: ${collection}:read`);
      const conds: SQL[] = [eq(contentEntries.collection, collection)];
      if (own) conds.push(eq(contentEntries.authorId, ctx.user.id));
      if (q.filters?.status) conds.push(sql`${contentEntries.status} = ${q.filters.status}`);
      if (q.filters?.locale) conds.push(eq(contentEntries.locale, q.filters.locale));
      if (q.search) {
        const like = `%${q.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
        conds.push(or(ilike(contentEntries.slug, like), sql`coalesce(${contentEntries.draft}, ${contentEntries.data})::text ilike ${like}`)!);
      }
      const where = and(...conds);
      const [total] = await getDb().select({ n: count() }).from(contentEntries).where(where);
      const rows = await getDb()
        .select()
        .from(contentEntries)
        .where(where)
        .orderBy(q.sort?.field === 'slug' ? (q.sort.dir === 'asc' ? contentEntries.slug : sql`${contentEntries.slug} desc`) : sql`${contentEntries.updatedAt} desc`)
        .limit(q.pageSize)
        .offset((Math.max(q.page, 1) - 1) * q.pageSize);
      return { rows: rows.map(toRow), total: total?.n ?? 0 };
    },
    async get(id, ctx) {
      const row = await load(id).catch(() => null);
      if (!row) return null;
      await assertCan(ctx, collection, 'read', row);
      return toRow(row);
    },
    async create(input, ctx) {
      await assertCan(ctx, collection, 'create');
      const i = Input.parse(input);
      return toRow(await createEntry({ collection, slug: i.slug, locale: i.locale ?? defaultLocale(), data: i.data, authorId: ctx.user.id }));
    },
    async update(id, input, ctx) {
      const row = await load(id);
      await assertCan(ctx, collection, 'update', row);
      const i = Input.parse(input);
      if (i.slug && i.slug !== row.slug && c.kind === 'collection') await renameEntry(id, i.slug);
      return toRow(await saveDraft(id, i.data));
    },
    async delete(id, ctx) {
      await assertCan(ctx, collection, 'delete', await load(id));
      await deleteEntry(id);
    },
    ...(opts.path && {
      async links(r: ContentAdminRow) {
        const path = opts.path!({ slug: r.slug, locale: r.locale, data: r.data });
        const out: Array<{ label: string; href: string }> = [];
        if (r.status === 'published') out.push({ label: 'View', href: path });
        if (process.env.CONTENT_PREVIEW_SECRET)
          out.push({ label: 'Preview', href: `${opts.previewRoute ?? '/api/preview'}?token=${encodeURIComponent(await createPreviewToken(r.id, path, { ttlSeconds: 600 }))}` });
        return out;
      },
    }),
    actions: [
      action('publish', 'Publish', 'publish', (id) => publish(id)),
      action('schedule', 'Schedule', 'publish', (id, input) => schedulePublish(id, z.object({ at: z.coerce.date() }).parse(input).at), {
        input: z.object({ at: z.coerce.date() }),
      }),
      action('unschedule', 'Cancel schedule', 'publish', (id) => unschedule(id), { available: (r) => r.scheduledAt !== null }),
      action('unpublish', 'Unpublish', 'publish', (id) => unpublish(id), { confirm: true, available: (r) => r.status === 'published' }),
      action('archive', 'Archive', 'publish', (id) => archive(id), { confirm: true, available: (r) => r.status !== 'archived' }),
      action('restore', 'Restore', 'update', (id) => restore(id), { available: (r) => r.status === 'archived' }),
    ],
  };
}
