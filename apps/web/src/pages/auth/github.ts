// Inicio del OAuth web flow de GitHub (D5-W-12): `state` aleatorio en cookie __Host- para evitar CSRF.

import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { HOST_COOKIE, STATE_COOKIE } from '../../lib/session.js';

export const GET: APIRoute = ({ url, cookies, redirect }) => {
  if (!env.GITHUB_OAUTH_CLIENT_ID) return redirect('/login?error=config');
  const state = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const next = url.searchParams.get('next') ?? '/dashboard';
  const lang = url.searchParams.get('lang') ?? 'en';
  cookies.set(
    STATE_COOKIE,
    JSON.stringify({ state, next: next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard', lang }),
    { ...HOST_COOKIE, maxAge: 600 },
  );
  const p = new URLSearchParams({
    client_id: env.GITHUB_OAUTH_CLIENT_ID,
    scope: 'read:user read:org',
    state,
    redirect_uri: `${env.SITE_ORIGIN}/auth/callback`,
    allow_signup: 'true',
  });
  return redirect(`https://github.com/login/oauth/authorize?${p}`);
};
