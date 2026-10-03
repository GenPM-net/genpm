// Sesión web (web-ui-spec §8, security §5): cookie `__Host-` HttpOnly, Secure, SameSite=Lax con el token del registry.
import type { AstroCookies } from 'astro';

export const SESSION_COOKIE = '__Host-genpm_session';
export const STATE_COOKIE = '__Host-genpm_oauth';

export function setSession(cookies: AstroCookies, value: { token: string; handle: string }, days = 30): void {
  cookies.set(SESSION_COOKIE, btoa(JSON.stringify(value)), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: days * 86_400,
  });
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}
