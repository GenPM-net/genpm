'use server';
// "Comprar ahora" desde la landing de producto: carrito con solo ese producto, país de envío y pago en Stripe.
// Guarda la atribución (con su consentimiento) para el evento `purchase` de servidor cuando se pague.
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { applySetCookie, cookieHeader, currentUserId } from '@/app/(store)/_lib/store';
import { addLine, CartError, clearCart, getCart, getOrCreateCart, setCartMeta } from '@/lib/cart';
import { CheckoutError, startCheckout } from '@/lib/checkout';
import { getDb } from '@/lib/db';
import { attributionFromRequest, saveAttribution } from '@/lib/pixels';
import { z } from 'zod';

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? '').trim().slice(0, max);

export async function buyNow(fd: FormData): Promise<void> {
  const slug = str(fd, 'slug', 200);
  const back = (code: string) => `/p/${encodeURIComponent(slug)}?buy_error=${code}#buy`;
  const country = str(fd, 'country', 2).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) redirect(back('needs_shipping'));
  const email = str(fd, 'email', 254);
  if (!z.email().safeParse(email).success) redirect(back('invalid'));
  const { cart, setCookie } = await getOrCreateCart(await cookieHeader(), await currentUserId());
  await applySetCookie(setCookie);
  try {
    // En una transacción: si el producto no está disponible, el carrito que ya tenía queda intacto.
    await getDb().transaction(async (tx) => {
      await clearCart(cart.id, tx);
      await addLine(cart.id, str(fd, 'variantId', 64), Math.min(Math.max(Number(fd.get('quantity') ?? 1) || 1, 1), 99), tx);
      await setCartMeta(cart.id, { country }, tx);
    });
  } catch (e) {
    if (e instanceof CartError) redirect(back(e.code));
    throw e;
  }
  const fresh = (await getCart(await cookieHeader(), await currentUserId())) ?? cart;
  const site = new URL(process.env.SITE_URL ?? 'http://localhost:3000').origin;
  const h = new Headers(await headers());
  h.set('cookie', (await cookies()).getAll().map((c) => `${c.name}=${c.value}`).join('; '));
  let url: string;
  try {
    const s = await startCheckout({ cart: fresh, email, successUrl: `${site}/checkout/success`, cancelUrl: `${site}/p/${encodeURIComponent(slug)}` });
    url = s.url;
    const a = attributionFromRequest(new Request(`${site}/p/${encodeURIComponent(slug)}`, { headers: h }));
    if (a.consent.analytics || a.consent.marketing) await saveAttribution(`checkout:${s.sessionId}`, a);
  } catch (e) {
    if (e instanceof CheckoutError) redirect(back(e.code));
    throw e;
  }
  redirect(url);
}
