'use server';
// Acciones de servidor de la tienda: funcionan sin JavaScript (formularios HTML) y nunca aceptan precios del cliente:
// el carrito guarda variantes y cantidades; los importes los calcula el servidor (@core/cart, @core/checkout).
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { currentUser } from '@/app/(cms)/_lib/session';
import { addLine, CartError, getCart, getOrCreateCart, setCartMeta, setDiscountCodes, setLine } from '@/lib/cart';
import { CheckoutError, startCheckout } from '@/lib/checkout';
import { postReview } from '@/lib/reviews';
import { applySetCookie, cookieHeader, currentUserId } from './store';

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? '').trim().slice(0, max);
const back = (path: string, params: Record<string, string>) => `${path}?${new URLSearchParams(params)}`;
/** Ruta local del mismo sitio (sin `//host` ni `/\\host`), sin query; si no, `fallback`. */
const localPath = (p: string, fallback: string) => {
  const path = p.split(/[?#]/)[0]!;
  return /^\/(?![/\\])/.test(path) && !path.includes('\\') ? path : fallback;
};

async function cart() {
  const { cart: c, setCookie } = await getOrCreateCart(await cookieHeader(), await currentUserId());
  await applySetCookie(setCookie);
  return c;
}

export async function addToCart(fd: FormData): Promise<void> {
  const variantId = str(fd, 'variantId', 64);
  const quantity = Math.min(Math.max(Number(fd.get('quantity') ?? 1) || 1, 1), 99);
  const from = str(fd, 'from', 300);
  try {
    await addLine((await cart()).id, variantId, quantity);
  } catch (e) {
    if (e instanceof CartError) redirect(back(localPath(from, '/shop'), { cart_error: e.code }));
    throw e;
  }
  redirect('/cart?added=1');
}

export async function updateLine(fd: FormData): Promise<void> {
  const c = await getCart(await cookieHeader(), await currentUserId());
  if (c) {
    const quantity = Math.min(Math.max(Math.floor(Number(fd.get('quantity'))) || 0, 0), 99);
    try {
      await setLine(c.id, str(fd, 'variantId', 64), quantity);
    } catch (e) {
      if (!(e instanceof CartError)) throw e;
      redirect(back('/cart', { cart_error: e.code }));
    }
  }
  redirect('/cart');
}

export async function applyCode(fd: FormData): Promise<void> {
  const c = await cart();
  const code = str(fd, 'code', 40);
  await setDiscountCodes(c.id, code ? [code] : []);
  redirect('/cart');
}

export async function setShipping(fd: FormData): Promise<void> {
  const c = await cart();
  const country = str(fd, 'country', 2).toUpperCase();
  const rate = str(fd, 'shippingRateId', 64);
  await setCartMeta(c.id, { ...(/^[A-Z]{2}$/.test(country) && { country }), ...(rate && { shippingRateId: rate }) });
  redirect('/cart');
}

/** Crea la sesión de Stripe Checkout con los totales del servidor y redirige a Stripe. */
export async function checkout(fd: FormData): Promise<void> {
  const c = await getCart(await cookieHeader(), await currentUserId());
  if (!c) redirect('/cart');
  const site = new URL(process.env.SITE_URL ?? 'http://localhost:3000').origin;
  let url: string;
  try {
    ({ url } = await startCheckout({ cart: c, email: str(fd, 'email', 254), successUrl: `${site}/checkout/success`, cancelUrl: `${site}/cart` }));
  } catch (e) {
    if (e instanceof CheckoutError) redirect(back('/cart', { checkout_error: e.code }));
    throw e;
  }
  redirect(url);
}

/** Reseña de producto (moderada; se marca "compra verificada" si hay un pedido entregado). */
export async function submitReview(fd: FormData): Promise<void> {
  const productId = str(fd, 'productId', 64);
  const slug = str(fd, 'slug', 200);
  const user = await currentUser();
  try {
    const r = await postReview(
      {
        productId,
        rating: Number(fd.get('rating')),
        body: str(fd, 'body', 5000),
        ...(user ? { user: { id: user.id, name: user.name ?? null } } : { guest: { name: str(fd, 'name', 80), email: str(fd, 'email', 254) } }),
      },
      { headers: await headers(), fields: fd },
    );
    redirect(back(`/products/${encodeURIComponent(slug)}`, { review: r.status }) + '#reviews');
  } catch (e) {
    const code = (e as { code?: string }).code ?? ((e as Error).name === 'ZodError' ? 'invalid' : null);
    if (!code) throw e;
    redirect(back(`/products/${encodeURIComponent(slug)}`, { review: code }) + '#reviews');
  }
}

