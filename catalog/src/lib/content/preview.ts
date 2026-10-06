// Tokens de vista previa: permiten leer borradores de una entrada concreta durante un tiempo limitado.
import { ContentError } from './registry.ts';

const enc = new TextEncoder();
const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const unb64url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0)));

function secret(given?: string): string {
  const s = given ?? process.env.CONTENT_PREVIEW_SECRET;
  if (!s || s.length < 32) throw new Error('CONTENT_PREVIEW_SECRET must be set (>= 32 chars)');
  return s;
}

async function sign(data: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data))));
}

export type PreviewClaims = { entryId: string; path: string; exp: number };

/** Token para previsualizar `entryId` en `path` (ruta relativa del sitio). Caduca en `ttlSeconds` (default 1 h). */
export async function createPreviewToken(
  entryId: string,
  path: string,
  opts: { ttlSeconds?: number; secret?: string } = {},
): Promise<string> {
  const claims: PreviewClaims = { entryId, path: safePath(path), exp: Date.now() + (opts.ttlSeconds ?? 3600) * 1000 };
  const body = b64url(enc.encode(JSON.stringify(claims)));
  return `${body}.${await sign(body, secret(opts.secret))}`;
}

export async function verifyPreviewToken(token: string | null | undefined, opts: { secret?: string } = {}): Promise<PreviewClaims> {
  const [body, sig] = (token ?? '').split('.');
  const expected = body ? await sign(body, secret(opts.secret)) : '';
  let diff = (sig ?? '').length ^ expected.length;
  for (let i = 0; i < expected.length; i++) diff |= ((sig ?? '').charCodeAt(i) || 0) ^ expected.charCodeAt(i);
  if (!body || !sig || diff !== 0) throw new ContentError('invalid_token');
  const claims = JSON.parse(unb64url(body)) as PreviewClaims;
  if (claims.exp < Date.now()) throw new ContentError('invalid_token', 'expired');
  return claims;
}

/** Solo rutas relativas del propio sitio (anti open redirect): `/blog/x`, nunca `//evil.com` ni `https://…`. */
export function safePath(path: string): string {
  if (!/^\/(?![/\\])[^\s\\]*$/.test(path) || path.includes('://')) throw new ContentError('invalid_state', `unsafe preview path: ${path}`);
  return path;
}
