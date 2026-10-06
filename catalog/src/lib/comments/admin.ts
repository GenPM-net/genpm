// Recurso de panel: cola de moderación (por defecto `pending`) con aprobar, spam, borrar y bloquear al autor.
import { and, count, desc, eq, ilike, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { AdminContext, AdminResource } from '../contracts/index.js';
import { getDb } from '../db/index.js';
import { ban, CommentError, moderate } from './comments.js';
import { type Comment, comments } from './schema.js';

async function need(ctx: AdminContext, perm: string) {
  if (!(await ctx.can(perm))) throw new CommentError('forbidden', `forbidden: ${perm}`);
}

const act = (name: string, label: string, run: (id: string) => Promise<Comment>, available?: (c: Comment) => boolean, confirm = false) => ({
  name,
  label,
  permission: 'comments:moderate',
  confirm,
  available,
  async run(id: string, _input: unknown, ctx: AdminContext) {
    await need(ctx, 'comments:moderate');
    return run(id);
  },
});

export const commentsAdminResource: AdminResource<Comment> = {
  name: 'comments',
  label: { singular: 'Comment', plural: 'Comments' },
  group: 'Community',
  fields: [
    { name: 'authorName', label: 'Author', type: 'text', readOnly: true, list: true },
    { name: 'body', label: 'Comment', type: 'textarea', readOnly: true, list: true },
    { name: 'rating', label: 'Rating', type: 'number', readOnly: true },
    { name: 'entityType', label: 'On', type: 'text', readOnly: true, list: true },
    { name: 'entityId', label: 'Item', type: 'text', readOnly: true },
    { name: 'status', label: 'Status', type: 'select', readOnly: true, list: true, options: ['pending', 'approved', 'spam', 'deleted'].map((v) => ({ value: v, label: v })) },
    { name: 'createdAt', label: 'Date', type: 'datetime', readOnly: true, list: true },
  ],
  input: z.object({}),
  title: (c) => `${c.authorName}: ${c.body.slice(0, 60)}`,
  async list(q, ctx) {
    await need(ctx, 'comments:read');
    const conds: SQL[] = [sql`${comments.status} = ${q.filters?.status ?? 'pending'}`];
    if (q.filters?.entityType) conds.push(eq(comments.entityType, q.filters.entityType));
    if (q.filters?.entityId) conds.push(eq(comments.entityId, q.filters.entityId));
    if (q.search) conds.push(ilike(comments.body, `%${q.search.replace(/[%_\\]/g, (m) => `\\${m}`)}%`));
    const where = and(...conds);
    const [total] = await getDb().select({ n: count() }).from(comments).where(where);
    const rows = await getDb().select().from(comments).where(where).orderBy(desc(comments.createdAt)).limit(q.pageSize).offset((Math.max(q.page, 1) - 1) * q.pageSize);
    return { rows, total: total?.n ?? 0 };
  },
  async get(id, ctx) {
    await need(ctx, 'comments:read');
    const [row] = await getDb().select().from(comments).where(eq(comments.id, id));
    return row ?? null;
  },
  actions: [
    act('approve', 'Approve', (id) => moderate(id, 'approve'), (c) => c.status !== 'approved'),
    act('spam', 'Spam', (id) => moderate(id, 'spam'), (c) => c.status !== 'spam'),
    act('delete', 'Delete', (id) => moderate(id, 'delete'), (c) => c.status !== 'deleted', true),
    act('restore', 'Back to queue', (id) => moderate(id, 'restore'), (c) => c.status === 'spam' || c.status === 'deleted'),
    act(
      'ban',
      'Ban author',
      async (id) => {
        await ban({ commentId: id });
        return moderate(id, 'spam');
      },
      undefined,
      true,
    ),
  ],
};
