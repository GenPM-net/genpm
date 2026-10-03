import type { APIRoute } from 'astro';
import { registryFetch } from '../lib/registry.js';
import { clearSession } from '../lib/session.js';

// POST (con verificación de origen de Astro) para que un enlace de terceros no pueda cerrar la sesión.
export const POST: APIRoute = async ({ locals, cookies, redirect }) => {
  if (locals.session)
    await registryFetch('/v1/auth/logout', { method: 'POST', token: locals.session.token }).catch(() => undefined);
  clearSession(cookies);
  return redirect('/');
};
