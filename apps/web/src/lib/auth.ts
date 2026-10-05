import type { AstroGlobal } from 'astro';
import { href } from './i18n.js';
import { clearSession } from './session.js';

/** Exige sesión; si no, redirige a /login conservando el destino. */
export function requireSession(Astro: AstroGlobal): Response | null {
  if (Astro.locals.session) return null;
  return toLogin(Astro);
}

/** El registry rechazó el token de la sesión (revocado o caducado): se borra la cookie y se vuelve a /login. */
export function sessionExpired(Astro: AstroGlobal): Response {
  clearSession(Astro.cookies);
  Astro.locals.session = null;
  return toLogin(Astro);
}

function toLogin(Astro: AstroGlobal): Response {
  return Astro.redirect(`${href(Astro.locals.locale, '/login')}?next=${encodeURIComponent(Astro.locals.path)}`);
}
