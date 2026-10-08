// Utilidades de la tienda: rutas, formato de precios, cookies y usuario actual. No importa `@/genpm`: los bloques de la
// tienda (que el registro carga) usan este archivo, y importarlo aquí cerraría un ciclo que rompe `next start`.
import { cookies } from 'next/headers';
import { currentUser } from '@/app/(cms)/_lib/session';
import { format, type Money } from '@/lib/money';

export const productPath = (p: { slug: string }) => `/products/${p.slug}`;
export const price = (m: Money, locale = 'en') => format(m, locale);

/** Cabecera Cookie de la petición actual (para las funciones de @core/cart). */
export async function cookieHeader(): Promise<string> {
  return (await cookies())
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

export async function currentUserId(): Promise<string | null> {
  return (await currentUser())?.id ?? null;
}

/** Aplica una cabecera Set-Cookie (de @core/cart) con la API de cookies de Next. */
export async function applySetCookie(header: string | null): Promise<void> {
  if (!header) return;
  const [pair, ...attrs] = header.split(/;\s*/);
  const eq = pair!.indexOf('=');
  const opts: { path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' | 'strict' | 'none'; maxAge?: number } = {};
  for (const a of attrs) {
    const [k, v] = a.split('=');
    const key = k!.toLowerCase();
    if (key === 'path') opts.path = v ?? '/';
    else if (key === 'httponly') opts.httpOnly = true;
    else if (key === 'secure') opts.secure = true;
    else if (key === 'samesite') opts.sameSite = (v ?? 'lax').toLowerCase() as 'lax';
    else if (key === 'max-age') opts.maxAge = Number(v);
  }
  (await cookies()).set(pair!.slice(0, eq), pair!.slice(eq + 1), opts);
}

export const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
export function pageParam(sp: Record<string, string | string[] | undefined>): number {
  const v = Number(one(sp.page));
  return Number.isInteger(v) && v > 0 && v < 10_000 ? v : 1;
}
