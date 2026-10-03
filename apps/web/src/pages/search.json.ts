// Proxy de búsqueda compacta para la paleta ⌘K (mismo origen: CSP connect-src 'self').
import type { APIRoute } from 'astro';
import { registryFetch } from '../lib/registry.js';

export const GET: APIRoute = async ({ url, locals }) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 100);
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 5) || 5, 20);
  const p = new URLSearchParams({ fmt: 'c', limit: String(limit), sort: q ? 'relevance' : 'installs' });
  if (q) p.set('q', q);
  const res = await registryFetch(`/v1/search?${p}`, { locale: locals.locale }).catch(() => null);
  const body = res?.ok ? await res.text() : '{"r":[],"nx":null}';
  return new Response(body, { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=30' } });
};
