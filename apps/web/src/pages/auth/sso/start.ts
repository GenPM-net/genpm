// Inicio del SSO de una organización (V10-02): el registry firma el state (PKCE + nonce) y devuelve la URL del IdP.
import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { registryFetch } from '../../../lib/registry.js';

export const GET: APIRoute = async ({ url, locals, redirect }) => {
  if (!locals.session) return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`, 302);
  const org = url.searchParams.get('org') ?? '';
  if (!/^[A-Za-z0-9-]{1,39}$/.test(org)) return redirect('/settings/sso?error=org', 302);
  const res = await registryFetch(`/v1/auth/sso/${org}/start`, {
    method: 'POST',
    token: locals.session.token,
    body: { redirectUri: `${env.SITE_ORIGIN}/auth/sso/callback` },
  });
  if (!res.ok) return redirect('/settings/sso?error=start', 302);
  return redirect(((await res.json()) as { url: string }).url, 302);
};
