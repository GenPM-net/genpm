// Proxy de imágenes de READMEs (CSP `img-src 'self'`): solo https, solo tipos de imagen, máx. 5 MB, caché 1 día.
import type { APIRoute } from 'astro';

const MAX = 5 * 1024 * 1024;

export const GET: APIRoute = async ({ url }) => {
  const target = url.searchParams.get('u') ?? '';
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (u.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(u.hostname))
    return new Response(null, { status: 400 });
  const res = await fetch(u, { redirect: 'follow', headers: { accept: 'image/*' } }).catch(() => null);
  const type = res?.headers.get('content-type') ?? '';
  if (!res?.ok || !/^image\/(png|jpe?g|gif|webp|avif|svg\+xml)/.test(type)) return new Response(null, { status: 404 });
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX) return new Response(null, { status: 413 });
  return new Response(buf, {
    headers: {
      'content-type': type,
      'cache-control': 'public, max-age=86400',
      // Un SVG de terceros nunca puede ejecutar scripts en nuestro origen.
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      'x-content-type-options': 'nosniff',
    },
  });
};
