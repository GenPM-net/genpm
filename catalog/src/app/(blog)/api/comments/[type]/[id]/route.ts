// Comentarios de los posts (@core/comments). Solo el tipo `post` y solo posts publicados: otros kits montan sus propias entidades.
import { and, eq } from 'drizzle-orm';
import { commentRoute } from '@/lib/comments/adapters/next';
import { getUserFromCookieHeader } from '@/lib/auth';
import { contentEntries } from '@/lib/content';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const route = commentRoute({ currentUser: (req) => getUserFromCookieHeader(req.headers.get('cookie')), moderation: 'guests' });
type Ctx = { params: Promise<{ type: string; id: string }> };
const isPublishedPost = async (id: string) =>
  (await getDb().select({ id: contentEntries.id }).from(contentEntries).where(and(eq(contentEntries.id, id), eq(contentEntries.collection, 'posts'), eq(contentEntries.status, 'published')))).length > 0;
const onlyPosts = (fn: (req: Request, ctx: Ctx) => Promise<Response>) => async (req: Request, ctx: Ctx) => {
  const { type, id } = await ctx.params;
  return type === 'post' && (await isPublishedPost(id)) ? fn(req, ctx) : Response.json({ error: 'not_found' }, { status: 404 });
};

export const GET = onlyPosts(route.GET);
export const POST = onlyPosts(route.POST);
