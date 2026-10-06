// Comentarios de los posts (@core/comments). Solo el tipo `post`: otros kits montan sus propias entidades.
import { commentRoute } from '@/lib/comments/adapters/next';
import { getUserFromCookieHeader } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const route = commentRoute({ currentUser: (req) => getUserFromCookieHeader(req.headers.get('cookie')), moderation: 'guests' });
type Ctx = { params: Promise<{ type: string; id: string }> };
const onlyPosts = (fn: (req: Request, ctx: Ctx) => Promise<Response>) => async (req: Request, ctx: Ctx) =>
  (await ctx.params).type === 'post' ? fn(req, ctx) : Response.json({ error: 'not_found' }, { status: 404 });

export const GET = onlyPosts(route.GET);
export const POST = onlyPosts(route.POST);
