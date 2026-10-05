// Vuelta del IdP (V10-02): el registry canjea el code, verifica el id_token y vincula la identidad a esta cuenta.
import type { APIRoute } from 'astro';
import { registryFetch } from '../../../lib/registry.js';

export const GET: APIRoute = async ({ url, locals, redirect }) => {
  if (!locals.session) return redirect('/login', 302);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) return redirect('/settings/sso?error=idp', 302);
  const res = await registryFetch('/v1/auth/sso/callback', {
    method: 'POST',
    token: locals.session.token,
    body: { code, state },
  });
  if (!res.ok) return redirect(`/settings/sso?error=${res.status === 403 ? 'denied' : 'failed'}`, 302);
  const { org } = (await res.json()) as { org: string | null };
  return redirect(`/settings/sso?linked=${encodeURIComponent(org ?? '')}`, 302);
};
