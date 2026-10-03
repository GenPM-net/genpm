// POST desde el modal de reporte → POST /v1/reports con la sesión del usuario.
import type { APIRoute } from 'astro';
import { href } from '../lib/i18n.js';
import { registryFetch } from '../lib/registry.js';

// GET: los mensajes de error (E_INTEGRITY…) enlazan a genpm.net/report → cómo reportar.
export const GET: APIRoute = ({ locals, redirect }) => redirect(`${href(locals.locale, '/security')}#report`, 302);

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  if (!locals.session) return redirect(href(locals.locale, '/login'));
  const f = await request.formData();
  const name = String(f.get('name') ?? '');
  const res = await registryFetch('/v1/reports', {
    method: 'POST',
    token: locals.session.token,
    body: {
      name,
      version: String(f.get('version') ?? '') || undefined,
      reason: String(f.get('reason') ?? 'other'),
      details: String(f.get('details') ?? '').slice(0, 2000) || undefined,
    },
  });
  const id = res.ok ? ((await res.json()) as { id: string }).id : 'error';
  return redirect(`${href(locals.locale, `/p/${name}`)}?reported=${encodeURIComponent(id)}#security`);
};
