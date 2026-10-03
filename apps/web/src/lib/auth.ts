import type { AstroGlobal } from 'astro';
import { href } from './i18n.js';

/** Exige sesión; si no, redirige a /login conservando el destino. */
export function requireSession(Astro: AstroGlobal): Response | null {
  if (Astro.locals.session) return null;
  return Astro.redirect(`${href(Astro.locals.locale, '/login')}?next=${encodeURIComponent(Astro.locals.path)}`);
}
