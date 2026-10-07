// POST /api/checkout {email, locale?} → {url}; GET /api/checkout/status?session_id=… → estado para la página de éxito.
import { z } from 'zod';
import { getCart } from '../../cart/index.ts';
import { CheckoutError, getCheckoutStatus, startCheckout } from '../index.ts';

export type CurrentUserId = (req: Request) => Promise<string | null>;
export type CheckoutPaths = { success: string; cancel: string };

const Body = z.object({ email: z.string().max(254), locale: z.string().max(10).optional() });

export async function handleStartCheckout(req: Request, currentUserId: CurrentUserId, paths: CheckoutPaths): Promise<Response> {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const cart = await getCart(req.headers.get('cookie'), await currentUserId(req));
  if (!cart) return Response.json({ error: 'empty' }, { status: 400 });
  const origin = new URL(process.env.SITE_URL ?? req.url).origin;
  try {
    const { url } = await startCheckout({ cart, email: body.data.email, locale: body.data.locale, successUrl: `${origin}${paths.success}`, cancelUrl: `${origin}${paths.cancel}` });
    return Response.json({ url });
  } catch (e) {
    if (e instanceof CheckoutError) return Response.json({ error: e.code, issues: e.issues }, { status: 400 });
    throw e;
  }
}

export async function handleCheckoutStatus(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('session_id') ?? '';
  if (!/^cs_[A-Za-z0-9_]{1,200}$/.test(id)) return Response.json({ error: 'invalid' }, { status: 400 });
  return Response.json(await getCheckoutStatus(id), { headers: { 'cache-control': 'no-store' } });
}
