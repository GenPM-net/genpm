// Cache API + ETag (api-spec §2). Clave canónica = URL normalizada + idioma + formato. Las respuestas con
// credenciales nunca se cachean. Publish/yank purgan /packages y /resolve del paquete.

import { sha256Hex } from '@genpm/manifest';
import type { Context, MiddlewareHandler } from 'hono';
import type { AppEnv } from './env.js';

export const CACHE = {
  immutable: 'public, max-age=31536000, immutable',
  short: 'public, max-age=60, stale-while-revalidate=300',
  search: 'public, max-age=30, stale-while-revalidate=300',
  hour: 'public, max-age=3600, stale-while-revalidate=86400',
  private: 'private, no-store',
} as const;

const ORIGIN = 'https://cache.genpm.internal';

/** Normaliza la URL: parámetros ordenados, `q` en minúsculas y con términos ordenados (api-spec §2). */
export function cacheKey(c: Context<AppEnv>, normalizeQ?: (q: string) => string): string {
  const url = new URL(c.req.url);
  const params = [...url.searchParams.entries()]
    .filter(([k]) => k !== 'client')
    .map(([k, v]) => [k, k === 'q' && normalizeQ ? normalizeQ(v) : v] as const)
    .sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y));
  const qs = new URLSearchParams(params as Array<[string, string]>).toString();
  const accept = c.req.header('accept')?.includes('application/vnd.genpm+json') ? 'c' : 'l';
  return `${ORIGIN}/${c.get('locale')}/${accept}/${c.get('tenant')?.slug ?? 'public'}${url.pathname}?${qs}`;
}

function edgeCache(): Cache | null {
  return typeof caches !== 'undefined' ? (caches as unknown as { default: Cache }).default : null;
}

/** Cabeceras que deben sobrevivir a un 304: `genpm-version` es la que usa la telemetría de resolve para contar. */
function keep(res: Response): Record<string, string> {
  const v = res.headers.get('genpm-version');
  return v ? { 'genpm-version': v } : {};
}

/** Middleware de caché para GET públicos. `ttl` decide la cabecera según la respuesta. */
export function cached(opts: {
  control: (res: Response) => string;
  key?: (c: Context<AppEnv>) => string;
}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method !== 'GET' || c.req.header('authorization')) {
      await next();
      return;
    }
    const cache = edgeCache();
    const key = new Request(opts.key ? opts.key(c) : cacheKey(c));
    const hit = cache ? await cache.match(key) : undefined;
    if (hit) {
      const etag = hit.headers.get('ETag');
      if (etag && c.req.header('if-none-match') === etag)
        return c.body(null, 304, { ETag: etag, 'Cache-Control': hit.headers.get('Cache-Control') ?? '', ...keep(hit) });
      const res = new Response(hit.body, hit);
      res.headers.set('genpm-cache', 'HIT');
      c.res = res;
      return;
    }
    await next();
    if (c.res.status !== 200) return;
    const body = await c.res.clone().arrayBuffer();
    const etag = `"${(await sha256Hex(new Uint8Array(body))).slice(0, 32)}"`;
    const control = opts.control(c.res);
    const headers = new Headers(c.res.headers);
    headers.set('ETag', etag);
    headers.set('Cache-Control', control);
    headers.delete('genpm-request-id');
    // Copia independiente para la caché: Hono re-envuelve c.res y bloquearía su stream.
    if (cache && control.startsWith('public')) {
      c.executionCtx.waitUntil(cache.put(key, new Response(body, { status: 200, headers })));
    }
    if (c.req.header('if-none-match') === etag) {
      c.res = new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': control, ...keep(c.res) } });
    } else {
      const res = new Response(body, { status: 200, headers });
      res.headers.set('genpm-cache', 'MISS');
      c.res = res;
    }
  };
}

/** Purga las entradas conocidas de un paquete tras publish/yank/deprecate. */
export async function purgePackage(c: Context<AppEnv>, fullName: string): Promise<void> {
  const cache = edgeCache();
  if (!cache) return;
  const slug = c.get('tenant')?.slug ?? 'public';
  const { LOCALES } = await import('@genpm/i18n');
  const paths = [`/v1/packages/${fullName}`, `/v1/packages/${fullName}/versions`, `/v1/resolve/${fullName}`];
  const queries = [
    '',
    'fmt=c',
    'deps=1',
    'deps=1&fmt=c',
    'range=latest',
    'deps=1&range=latest',
    'deps=1&fmt=c&range=latest',
  ];
  const deletions: Promise<boolean>[] = [];
  for (const p of paths)
    for (const q of queries)
      for (const loc of LOCALES)
        for (const accept of ['c', 'l'])
          deletions.push(cache.delete(new Request(`${ORIGIN}/${loc}/${accept}/${slug}${p}?${q}`)));
  await Promise.all(deletions);
}
