// API JSON del carrito: GET (totales), POST /lines (añadir), PUT /lines/:variantId (cantidad), PUT /codes.
import { z } from 'zod';
import { addLine, CartError, computeTotals, getCart, getOrCreateCart, setDiscountCodes, setLine } from '../index.js';

export type CurrentUserId = (req: Request) => Promise<string | null>;

const STATUS = { not_found: 404, invalid: 400, unavailable: 409, insufficient_stock: 409 } as const;

async function respond(req: Request, userId: string | null, run?: (cartId: string) => Promise<void>): Promise<Response> {
  const cookie = req.headers.get('cookie');
  if (!run) {
    const cart = await getCart(cookie, userId);
    return Response.json(cart ? await computeTotals(cart) : { lines: [], issues: [] }, { headers: { 'cache-control': 'no-store' } });
  }
  const { cart, setCookie } = await getOrCreateCart(cookie, userId);
  try {
    await run(cart.id);
  } catch (e) {
    if (e instanceof CartError) return Response.json({ error: e.code, message: e.message }, { status: STATUS[e.code] });
    throw e;
  }
  const headers: Record<string, string> = { 'cache-control': 'no-store' };
  if (setCookie) headers['set-cookie'] = setCookie;
  return Response.json(await computeTotals(cart), { headers });
}

const Add = z.object({ variantId: z.string().min(1).max(64), quantity: z.number().int().min(1).max(99).default(1) });
const Qty = z.object({ quantity: z.number().int().min(0).max(99) });
const Codes = z.object({ codes: z.array(z.string().max(40)).max(5) });

async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T | Response> {
  const r = schema.safeParse(await req.json().catch(() => null));
  return r.success ? r.data : Response.json({ error: 'invalid' }, { status: 400 });
}

export const cartHandlers = (currentUserId: CurrentUserId) => ({
  get: async (req: Request) => respond(req, await currentUserId(req)),
  add: async (req: Request) => {
    const b = await body(req, Add);
    return b instanceof Response ? b : respond(req, await currentUserId(req), (id) => addLine(id, b.variantId, b.quantity));
  },
  setQuantity: async (req: Request, variantId: string) => {
    const b = await body(req, Qty);
    return b instanceof Response ? b : respond(req, await currentUserId(req), (id) => setLine(id, variantId, b.quantity));
  },
  setCodes: async (req: Request) => {
    const b = await body(req, Codes);
    return b instanceof Response ? b : respond(req, await currentUserId(req), (id) => setDiscountCodes(id, b.codes));
  },
});
