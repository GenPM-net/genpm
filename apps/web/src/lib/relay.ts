// Relé de la web al registry para las islas: usa la sesión (cookie HttpOnly) y devuelve los errores ya traducidos.

import { env } from 'cloudflare:workers';
import { errorText } from '@genpm/i18n';
import type { APIContext } from 'astro';
import { registryFetch } from './registry.js';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store' },
  });

/** Llama al registry en nombre del usuario. Los POST solo se aceptan desde el propio origen (además de SameSite=Lax). */
export async function relay(
  ctx: APIContext,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const { locals, request } = ctx;
  if (!locals.session) return json({ code: 'E_AUTH', ...errorText(locals.t, 'E_AUTH') }, 401);
  if (init.method && init.method !== 'GET' && request.headers.get('origin') !== env.SITE_ORIGIN)
    return json({ code: 'E_BAD_REQUEST', ...errorText(locals.t, 'E_BAD_REQUEST', { detail: 'origin' }) }, 403);
  const res = await registryFetch(path, { ...init, token: locals.session.token, locale: locals.locale });
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.ok) return json(body, res.status);
  const code = typeof body?.['code'] === 'string' ? (body['code'] as string) : 'E_INTERNAL';
  const params = (body?.['params'] as Record<string, unknown> | undefined) ?? {};
  return json({ code, ...errorText(locals.t, code, params), issues: body?.['issues'] ?? null }, res.status);
}
