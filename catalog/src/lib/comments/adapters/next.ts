// Adaptador Next.js: `app/api/comments/[type]/[id]/route.ts` →
//   export const { GET, POST } = commentRoute({ currentUser: async () => getUser(await cookies()) });
import type { Moderation } from '../index.ts';
import { type CurrentUser, handleList, handlePost } from './http.ts';

type Ctx = { params: Promise<{ type: string; id: string }> };

export function commentRoute(opts: { currentUser: CurrentUser; moderation?: Moderation }) {
  return {
    GET: async (req: Request, ctx: Ctx) => {
      const { type, id } = await ctx.params;
      return handleList(req, type, id);
    },
    POST: async (req: Request, ctx: Ctx) => {
      const { type, id } = await ctx.params;
      return handlePost(req, type, id, opts);
    },
  };
}
