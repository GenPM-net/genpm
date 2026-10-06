// Publicar, listar, moderar y valorar. Invitados siempre a moderación; usuarios con historial aprobado, directos.
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { verifyHuman } from '../antispam/index.js';
import { type Executor, getDb } from '../db/index.js';
import { getEmailProvider } from '../email/index.js';
import { defineJob } from '../jobs/index.js';
import { type Comment, commentBans, comments } from './schema.js';

export class CommentError extends Error {
  constructor(
    readonly code: 'spam' | 'rate_limited' | 'invalid' | 'banned' | 'not_found' | 'forbidden',
    message: string = code,
  ) {
    super(message);
    this.name = 'CommentError';
  }
}

const enc = new TextEncoder();
export async function emailHash(email: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(email.trim().toLowerCase()));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ENTITY_RE = /^[a-z][a-z0-9_-]{0,31}$/;
const Input = z.object({
  entityType: z.string().regex(ENTITY_RE),
  entityId: z.string().min(1).max(64),
  parentId: z.string().max(64).optional(),
  body: z.string().trim().min(2).max(5000),
  rating: z.coerce.number().int().min(1).max(5).optional(),
});
const Guest = z.object({ name: z.string().trim().min(1).max(80), email: z.email().max(254) });

export type PostCommentInput = z.input<typeof Input> & {
  /** Usuario con sesión (de @core/auth) o datos del invitado. */
  user?: { id: string; name: string | null } | null;
  guest?: { name: string; email: string };
};

export type Moderation = 'guests' | 'all' | 'none';

/**
 * Publica un comentario. Comprueba antispam (`fields` del formulario), bloqueos y que la respuesta sea a un comentario
 * aprobado de la misma entidad. Estado inicial según `moderation`: `guests` (default) modera invitados y usuarios
 * sin ningún comentario aprobado previo.
 */
export async function postComment(
  input: PostCommentInput,
  ctx: { headers: Headers; fields: FormData | Record<string, unknown>; moderation?: Moderation; skipAntispam?: boolean },
  db: Executor = getDb(),
): Promise<Comment> {
  if (!ctx.skipAntispam) {
    const human = await verifyHuman(ctx.headers, ctx.fields, { scope: 'comments', limit: 5, windowMs: 600_000 }, db);
    if (!human.ok) throw new CommentError(human.reason === 'rate_limited' ? 'rate_limited' : 'spam');
  }
  const parsed = Input.safeParse(input);
  if (!parsed.success) throw new CommentError('invalid', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  const data = parsed.data;
  let authorName: string;
  let hash: string | null = null;
  if (input.user) {
    authorName = (input.user.name ?? '').trim().slice(0, 80) || 'Anonymous';
    if (await isBanned(`user:${input.user.id}`, db)) throw new CommentError('banned');
  } else {
    const g = Guest.safeParse(input.guest);
    if (!g.success) throw new CommentError('invalid', 'guest name and email are required');
    authorName = g.data.name;
    hash = await emailHash(g.data.email);
    if (await isBanned(`email:${hash}`, db)) throw new CommentError('banned');
  }
  if (data.parentId) {
    const [parent] = await db.select().from(comments).where(eq(comments.id, data.parentId));
    if (!parent || parent.entityType !== data.entityType || parent.entityId !== data.entityId || parent.parentId || parent.status !== 'approved')
      throw new CommentError('invalid', 'invalid parent comment');
  }
  const moderation = ctx.moderation ?? 'guests';
  let status: Comment['status'] = 'pending';
  if (moderation === 'none') status = 'approved';
  else if (moderation === 'guests' && input.user) {
    const [prev] = await db.select({ n: count() }).from(comments).where(and(eq(comments.authorId, input.user.id), eq(comments.status, 'approved')));
    if ((prev?.n ?? 0) > 0) status = 'approved';
  }
  const [row] = await db
    .insert(comments)
    .values({ ...data, rating: data.rating ?? null, parentId: data.parentId ?? null, authorId: input.user?.id ?? null, authorName, guestEmailHash: hash, status })
    .returning();
  if (status === 'pending') await notifyModeratorsJob.enqueue({ commentId: row!.id }, {}, db);
  return row!;
}

async function isBanned(subject: string, db: Executor): Promise<boolean> {
  const [b] = await db.select({ id: commentBans.id }).from(commentBans).where(eq(commentBans.subject, subject));
  return !!b;
}

export type PublicComment = Pick<Comment, 'id' | 'authorName' | 'body' | 'rating' | 'createdAt'> & { replies: Array<Pick<Comment, 'id' | 'authorName' | 'body' | 'createdAt'>> };

/** Comentarios aprobados de una entidad: los de primer nivel paginados, cada uno con sus respuestas. */
export async function listComments(
  entityType: string,
  entityId: string,
  opts: { page?: number; perPage?: number; order?: 'newest' | 'oldest' } = {},
  db: Executor = getDb(),
): Promise<{ comments: PublicComment[]; total: number }> {
  const perPage = Math.min(Math.max(opts.perPage ?? 20, 1), 100);
  const page = Math.max(opts.page ?? 1, 1);
  const base = and(eq(comments.entityType, entityType), eq(comments.entityId, entityId), eq(comments.status, 'approved'));
  const [total] = await db.select({ n: count() }).from(comments).where(and(base, isNull(comments.parentId)));
  const top = await db
    .select()
    .from(comments)
    .where(and(base, isNull(comments.parentId)))
    .orderBy(opts.order === 'oldest' ? asc(comments.createdAt) : desc(comments.createdAt), asc(comments.id))
    .limit(perPage)
    .offset((page - 1) * perPage);
  const replies = top.length
    ? await db.select().from(comments).where(and(base, inArray(comments.parentId, top.map((c) => c.id)))).orderBy(asc(comments.createdAt), asc(comments.id))
    : [];
  const pick = (c: Comment) => ({ id: c.id, authorName: c.authorName, body: c.body, createdAt: c.createdAt });
  return {
    total: total?.n ?? 0,
    comments: top.map((c) => ({ ...pick(c), rating: c.rating, replies: replies.filter((r) => r.parentId === c.id).map(pick) })),
  };
}

export type ModerationAction = 'approve' | 'spam' | 'delete' | 'restore';

/** Cambia el estado (`comments:moderate`). `restore` vuelve a `pending`. */
export async function moderate(id: string, action: ModerationAction, db: Executor = getDb()): Promise<Comment> {
  const status = { approve: 'approved', spam: 'spam', delete: 'deleted', restore: 'pending' } as const;
  const [row] = await db.update(comments).set({ status: status[action] }).where(eq(comments.id, id)).returning();
  if (!row) throw new CommentError('not_found');
  return row;
}

/** Bloquea a un usuario o a un email de invitado y marca como spam sus comentarios pendientes. */
export async function ban(target: { userId: string } | { email: string } | { commentId: string }, reason?: string, db: Executor = getDb()): Promise<void> {
  let subject: string;
  if ('commentId' in target) {
    const [c] = await db.select().from(comments).where(eq(comments.id, target.commentId));
    if (!c) throw new CommentError('not_found');
    subject = c.authorId ? `user:${c.authorId}` : `email:${c.guestEmailHash}`;
  } else subject = 'userId' in target ? `user:${target.userId}` : `email:${await emailHash(target.email)}`;
  await db.insert(commentBans).values({ subject, reason: reason ?? null }).onConflictDoNothing();
  const [kind, value] = subject.split(/:(.*)/s) as [string, string];
  await db
    .update(comments)
    .set({ status: 'spam' })
    .where(and(eq(comments.status, 'pending'), kind === 'user' ? eq(comments.authorId, value) : eq(comments.guestEmailHash, value)));
}

/** Derecho de supresión: borra todos los comentarios de un email de invitado o de un usuario. */
export async function eraseComments(target: { email: string } | { userId: string }, db: Executor = getDb()): Promise<number> {
  const where = 'email' in target ? eq(comments.guestEmailHash, await emailHash(target.email)) : eq(comments.authorId, target.userId);
  const rows = await db.delete(comments).where(where).returning({ id: comments.id });
  return rows.length;
}

export type RatingSummary = { count: number; average: number; histogram: [number, number, number, number, number] };

/** Media y distribución de valoraciones aprobadas de una entidad. */
export async function ratingSummary(entityType: string, entityId: string, db: Executor = getDb()): Promise<RatingSummary> {
  const rows = await db
    .select({ rating: comments.rating, n: count() })
    .from(comments)
    .where(and(eq(comments.entityType, entityType), eq(comments.entityId, entityId), eq(comments.status, 'approved'), sql`${comments.rating} is not null`))
    .groupBy(comments.rating);
  const histogram: RatingSummary['histogram'] = [0, 0, 0, 0, 0];
  for (const r of rows) histogram[r.rating! - 1] = r.n;
  const total = histogram.reduce((a, b) => a + b, 0);
  const sum = histogram.reduce((a, n, i) => a + n * (i + 1), 0);
  return { count: total, average: total ? Math.round((sum / total) * 100) / 100 : 0, histogram };
}

const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

/** HTML seguro de un comentario: escapado, saltos de línea y enlaces http(s) con `rel="nofollow ugc noopener"`. */
export function commentHtml(body: string): string {
  return esc(body)
    .replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"]/g, (url) => `<a href="${url}" rel="nofollow ugc noopener" target="_blank">${url}</a>`)
    .replace(/\r?\n/g, '<br>');
}

/** Aviso por email a moderación (`COMMENTS_NOTIFY_TO`) de cada comentario pendiente. */
export const notifyModeratorsJob = defineJob('comments.notify', z.object({ commentId: z.string() }), async ({ commentId }) => {
  const to = (process.env.COMMENTS_NOTIFY_TO ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const from = process.env.EMAIL_FROM;
  if (!to.length || !from) return;
  const [c] = await getDb().select().from(comments).where(eq(comments.id, commentId));
  if (!c || c.status !== 'pending') return;
  await getEmailProvider().send({
    from,
    to,
    subject: `New comment to moderate on ${c.entityType} ${c.entityId}`,
    text: `${c.authorName} wrote:\n\n${c.body}`,
    html: `<p><strong>${esc(c.authorName)}</strong> wrote:</p><p>${commentHtml(c.body)}</p>`,
  });
});
