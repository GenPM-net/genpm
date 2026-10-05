import type { AstroCookies } from 'astro';
import { describe, expect, it } from 'vitest';
import { clearSession, SESSION_COOKIE, setSession } from './session.js';

function fakeCookies() {
  const calls: Array<{ op: 'set' | 'delete'; name: string; options: Record<string, unknown> }> = [];
  const cookies = {
    set: (name: string, _value: string, options: Record<string, unknown>) => calls.push({ op: 'set', name, options }),
    delete: (name: string, options: Record<string, unknown>) => calls.push({ op: 'delete', name, options }),
  } as unknown as AstroCookies;
  return { cookies, calls };
}

describe('cookie de sesión __Host-', () => {
  it('se crea con Secure, HttpOnly y Path=/', () => {
    const { cookies, calls } = fakeCookies();
    setSession(cookies, { token: 'gpm_x', handle: 'yohangel' });
    expect(calls[0]).toMatchObject({
      op: 'set',
      name: SESSION_COOKIE,
      options: { secure: true, httpOnly: true, path: '/' },
    });
  });

  it('se borra con Secure y Path=/: sin ellos el navegador ignora el borrado y la sesión sobrevive al logout', () => {
    const { cookies, calls } = fakeCookies();
    clearSession(cookies);
    expect(calls[0]).toMatchObject({ op: 'delete', name: SESSION_COOKIE, options: { secure: true, path: '/' } });
    expect(calls[0]?.options).not.toHaveProperty('domain');
  });
});
