import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { href } from '../lib/i18n.js';
import { registryFetch } from '../lib/registry.js';

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const f = await request.formData();
  // Turnstile (web-ui-spec §8): sin token válido el lead se descarta en silencio.
  if (env.TURNSTILE_SECRET_KEY) {
    const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: String(f.get('cf-turnstile-response') ?? ''),
        remoteip: request.headers.get('cf-connecting-ip') ?? '',
      }),
    })
      .then((r) => r.json() as Promise<{ success: boolean }>)
      .catch(() => ({ success: false }));
    if (!v.success) return redirect(`${href(locals.locale, '/sponsors')}?sent=1`);
  }
  const kind = f.get('kind') === 'enterprise' ? 'enterprise' : 'sponsor';
  const details: Record<string, string> = {};
  for (const k of ['message', 'size', 'ide']) if (f.get(k)) details[k] = String(f.get(k)).slice(0, 500);
  await registryFetch('/v1/leads', {
    method: 'POST',
    body: {
      kind,
      email: String(f.get('email') ?? ''),
      company: String(f.get('company') ?? '') || undefined,
      details,
      ...(f.get('website') ? { website: String(f.get('website')) } : {}),
    },
  }).catch(() => null);
  return redirect(`${href(locals.locale, kind === 'enterprise' ? '/enterprise' : '/sponsors')}?sent=1`);
};
