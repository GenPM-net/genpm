// Adaptador Next.js (route handlers). Con `currentUserId = async () => (await getUser(await cookies()))?.id ?? null`:
//   app/api/cart/route.ts                     → export const { GET } = cartRoute(currentUserId);
//   app/api/cart/lines/route.ts               → export const { POST } = cartLinesRoute(currentUserId);
//   app/api/cart/lines/[variantId]/route.ts   → export const { PUT } = cartLineRoute(currentUserId);
//   app/api/cart/codes/route.ts               → export const { PUT } = cartCodesRoute(currentUserId);
import { type CurrentUserId, cartHandlers } from './http.js';

export const cartRoute = (u: CurrentUserId) => ({ GET: cartHandlers(u).get });
export const cartLinesRoute = (u: CurrentUserId) => ({ POST: cartHandlers(u).add });
export const cartLineRoute = (u: CurrentUserId) => ({
  PUT: async (req: Request, ctx: { params: Promise<{ variantId: string }> }) => cartHandlers(u).setQuantity(req, (await ctx.params).variantId),
});
export const cartCodesRoute = (u: CurrentUserId) => ({ PUT: cartHandlers(u).setCodes });
