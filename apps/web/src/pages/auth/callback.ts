// Callback del OAuth web: canjea el código por un token de GitHub, que se entrega al registry (exchange) y se descarta.
// La sesión es el token de GenPM en una cookie __Host- HttpOnly/Secure/SameSite=Lax.

import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { href } from '../../lib/i18n.js';
import { registryFetch } from '../../lib/registry.js';
import { HOST_COOKIE, STATE_COOKIE, setSession } from '../../lib/session.js';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const saved = cookies.get(STATE_COOKIE)?.json() as { state: string; next: string; lang: string } | undefined;
  cookies.delete(STATE_COOKIE, HOST_COOKIE);
  const code = url.searchParams.get('code');
  if (!saved || !code || url.searchParams.get('state') !== saved.state) return redirect('/login?error=state');
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${env.SITE_ORIGIN}/auth/callback`,
    }),
  }).catch(() => null);
  const gh = res?.ok ? ((await res.json()) as { access_token?: string; error?: string }) : null;
  if (!gh?.access_token) {
    // Solo el código de error de GitHub (p. ej. incorrect_client_credentials), nunca el código ni el secreto.
    console.warn('oauth_exchange_failed', { status: res?.status ?? 0, error: gh?.error ?? null });
    return redirect('/login?error=github');
  }
  const ex = await registryFetch('/v1/auth/github/exchange', {
    method: 'POST',
    body: { githubToken: gh.access_token, name: 'web' },
  });
  if (!ex.ok) return redirect('/login?error=registry');
  const body = (await ex.json()) as { token: string; account: { handle: string } };
  setSession(cookies, { token: body.token, handle: body.account.handle });
  return redirect(href((saved.lang ?? 'en') as 'en', saved.next));
};
