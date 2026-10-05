import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { checkFormToken } from '../lib/form-token.js';
import { href } from '../lib/i18n.js';
import { registryFetch } from '../lib/registry.js';

// Lead de sponsors/enterprise. Spam (honeypot, token de tiempo o Turnstile fallidos): se responde como si hubiera ido
// bien para no dar pistas, pero no se guarda nada. Errores reales: vuelta al formulario con ?error=email|server.
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const f = await request.formData();
  const kind = f.get('kind') === 'enterprise' ? 'enterprise' : 'sponsor';
  const page = href(locals.locale, kind === 'enterprise' ? '/enterprise' : '/sponsors');
  const thanks = `${href(locals.locale, '/thanks')}?k=${kind}`;
  if (f.get('website') || !(await checkFormToken(f.get('t')))) return redirect(thanks, 303);
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
    if (!v.success) return redirect(thanks, 303);
  }
  const details: Record<string, string> = {};
  for (const k of ['message', 'size', 'ide']) if (f.get(k)) details[k] = String(f.get(k)).slice(0, 500);
  const res = await registryFetch('/v1/leads', {
    method: 'POST',
    body: {
      kind,
      email: String(f.get('email') ?? '').trim(),
      company: String(f.get('company') ?? '') || undefined,
      details,
    },
  }).catch(() => null);
  if (res?.ok) return redirect(thanks, 303);
  return redirect(`${page}?error=${res?.status === 400 ? 'email' : 'server'}#form`, 303);
};
