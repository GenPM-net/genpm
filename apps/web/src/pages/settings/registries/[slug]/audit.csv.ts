// Descarga CSV de la auditoría de un registro privado (V10-04) con la sesión web; el registry exige rol admin.
import type { APIRoute } from 'astro';
import { registryFetch } from '../../../../lib/registry.js';

export const GET: APIRoute = async ({ params, locals, redirect }) => {
  const session = locals.session;
  if (!session) return redirect('/login', 302);
  const slug = params.slug ?? '';
  if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(slug)) return new Response(null, { status: 404 });
  const res = await registryFetch(`/v1/registries/${slug}/audit?format=csv`, { token: session.token });
  if (!res.ok) return new Response(null, { status: res.status === 403 ? 403 : 404 });
  return new Response(res.body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': res.headers.get('content-disposition') ?? 'attachment',
      'cache-control': 'private, no-store',
    },
  });
};
