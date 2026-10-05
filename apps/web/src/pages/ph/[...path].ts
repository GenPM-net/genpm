// Proxy de PostHog Cloud EU en el propio dominio (ADR-027): la CSP sigue en 'self' y los bloqueadores no rompen la
// analítica de quien sí la aceptó. Solo reenvía a los hosts de PostHog EU, sin cookies de genpm ni la IP del visitante.

import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

const API = 'https://eu.i.posthog.com';
const ASSETS = 'https://eu-assets.i.posthog.com';

export const ALL: APIRoute = async ({ request, params }) => {
  if (!env.POSTHOG_KEY || !['GET', 'POST'].includes(request.method)) return new Response(null, { status: 404 });
  const path = String(params.path ?? '');
  if (!/^[a-z0-9/_.-]*$/i.test(path) || path.includes('..')) return new Response(null, { status: 400 });
  const url = new URL(request.url);
  const target = `${path.startsWith('static/') || path.startsWith('array/') ? ASSETS : API}/${path}${url.search}`;
  const headers = new Headers();
  for (const h of ['content-type', 'content-encoding', 'accept', 'user-agent']) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'POST' ? request.body : undefined,
  });
  const out = new Response(res.body, res);
  out.headers.delete('set-cookie');
  return out;
};
