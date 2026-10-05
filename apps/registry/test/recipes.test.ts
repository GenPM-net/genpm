// V03-05: recetas compose (GET público, gestión solo staff).
import { beforeEach, describe, expect, it } from 'vitest';
import { account, call, json, seed } from './helpers.js';

beforeEach(async () => {
  await seed();
});

const put = (token: string, slug: string, body: unknown, method = 'PUT') =>
  call(`/v1/admin/recipes/${slug}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

describe('recipes', () => {
  it('staff curate recipes and anyone can read them, localized', async () => {
    const { token } = await account({ login: 'curator', staff: true });
    const r = await put(token, 'saas-starter', {
      s: { en: 'Database, auth and billing', es: 'Base de datos, auth y cobros' },
      p: ['@core/db', '@core/auth@^1.2', '@core/billing'],
    });
    expect(r.status).toBe(200);
    const list = await json<{ recipes: Array<{ name: string; summary: string; p: string[] }> }>('/v1/recipes', {
      headers: { 'accept-language': 'es' },
    });
    expect(list.body.recipes).toEqual([
      expect.objectContaining({ name: 'saas-starter', summary: 'Base de datos, auth y cobros' }),
    ]);
    const one = await json<{ p: string[] }>('/v1/recipes/saas-starter');
    expect(one.body.p).toEqual(['@core/db', '@core/auth@^1.2', '@core/billing']);
    expect((await json('/v1/recipes/nope-nope')).status).toBe(404);

    // Paquetes inexistentes o specs de git no se aceptan; borrar deja rastro.
    const missing = await put(token, 'broken', { p: ['@core/db', '@ghost/pkg'] });
    expect(((await missing.json()) as { code: string }).code).toBe('E_NOT_FOUND');
    const git = await put(token, 'broken', { p: ['gh:a/b#v1'] });
    expect(git.status).toBe(400);
    expect((await put(token, 'saas-starter', undefined, 'DELETE')).status).toBe(200);
    expect((await json('/v1/recipes/saas-starter')).status).toBe(404);
  });

  it('non-staff cannot manage recipes', async () => {
    const { token } = await account({ login: 'random' });
    expect((await put(token, 'mine', { p: ['@core/db'] })).status).toBe(404);
  });
});
