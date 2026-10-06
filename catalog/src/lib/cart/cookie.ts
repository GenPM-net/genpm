// Cookie del carrito: `<id>.<hmac>` firmada con CART_COOKIE_SECRET, HttpOnly, SameSite=Lax.
const enc = new TextEncoder();
export const CART_COOKIE = 'cart';
export const CART_TTL_DAYS = 30;

function secret(): string {
  const s = process.env.CART_COOKIE_SECRET;
  if (!s || s.length < 32) throw new Error('CART_COOKIE_SECRET must be set (>= 32 chars)');
  return s;
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
  return btoa(String.fromCharCode(...sig)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export async function cartCookie(cartId: string, secure = process.env.NODE_ENV === 'production'): Promise<string> {
  return `${CART_COOKIE}=${cartId}.${await sign(cartId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${CART_TTL_DAYS * 86_400}${secure ? '; Secure' : ''}`;
}

export const clearCartCookie = () => `${CART_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

/** Id del carrito de la cabecera Cookie si la firma es válida. */
export async function cartIdFromCookie(cookieHeader: string | null | undefined): Promise<string | null> {
  const raw = (cookieHeader ?? '').split(/;\s*/).find((c) => c.startsWith(`${CART_COOKIE}=`))?.slice(CART_COOKIE.length + 1);
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot < 1) return null;
  const id = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = await sign(id);
  let diff = sig.length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= (sig.charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  return diff === 0 ? id : null;
}
