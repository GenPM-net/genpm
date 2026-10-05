// D4-A-04 · INV-10 (security §8.4): dos registries con datos espejo; ningún endpoint, con ningún tipo de
// credencial, devuelve datos del otro (búsqueda, conteos, errores incluidos).
import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildSeed, FIXTURES } from '../scripts/seed-lib.mjs';
import { account, call, DEV_KEY } from './helpers.js';

// `acme` es privado (V10-01): se lee como miembro; sin serlo, el registro no existe (404).
const ACME: Record<string, string> = { 'genpm-registry': 'acme' };

beforeAll(async () => {
  // Registry público con los fixtures y registry `acme` con paquetes espejo de otro nombre y SHA.
  const pub = await buildSeed({ keyId: DEV_KEY.id, privateKey: DEV_KEY.private, publicKey: DEV_KEY.public });
  const mirror = FIXTURES.map((m) => ({
    ...m,
    n: m.n.replace('@core/', '@core/acme-'),
    c: 'a'.repeat(40),
    g: undefined,
  }));
  const acme = (await buildSeed({ keyId: DEV_KEY.id, privateKey: DEV_KEY.private, manifests: mirror, offset: 50 })).map(
    (s) => s.replace(/'reg_public'/g, "'reg_acme'").replace(/'scp_core'/g, "'scp_acme_core'"),
  );
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO registries (id, slug, owner_id, plan, is_public, isolation, created_at) VALUES ('reg_acme', 'acme', 'acc_system', 'team', 0, 'shared', 1)",
    ),
    env.DB.prepare(
      "INSERT INTO scopes (id, registry_id, name, owner_id, git_owner, created_at) VALUES ('scp_acme_core', 'reg_acme', 'core', 'acc_system', 'acme', 1)",
    ),
    ...pub.map((s) => env.DB.prepare(s)),
    ...acme.map((s) => env.DB.prepare(s)),
  ]);
  const member = await account({ login: 'acmereader' });
  await env.DB.prepare("INSERT INTO registry_members (registry_id, account_id, role) VALUES ('reg_acme', ?1, 'reader')")
    .bind(member.id)
    .run();
  ACME['authorization'] = `Bearer ${member.token}`;
});

const ENDPOINTS = [
  '/v1/search?q=drizzle',
  '/v1/search?q=core&fmt=c',
  '/v1/search',
  '/v1/featured',
  '/v1/stats',
  '/v1/scopes/@core',
  '/v1/packages/@core/db',
  '/v1/packages/@core/db/versions',
  '/v1/packages/@core/db/versions/1.0.3',
  '/v1/resolve/@core/auth?deps=1',
  '/v1/advisories?p=@core/db@1.0.3',
  '/v1/packages/@core/acme-db',
  '/v1/resolve/@core/acme-db',
  '/v1/badge/@core/acme-db.svg',
];

describe('INV-10 · tenant isolation', () => {
  for (const path of ENDPOINTS) {
    it(`public never leaks acme data: ${path}`, async () => {
      const res = await call(`${path}${path.includes('?') ? '&' : '?'}x=pub`);
      const text = await res.text();
      expect(text).not.toContain('a'.repeat(40));
      // Pedir por nombre un paquete de otro tenant responde 404 (el nombre solo aparece como eco de la petición).
      // Los badges siempre devuelven un SVG (con "not found" si el paquete no es visible en este tenant).
      if (path.includes('/badge/')) expect(text).toContain('not found');
      else if (path.includes('acme-')) expect(res.status).toBe(404);
      else expect(text).not.toContain('acme-');
    });
    it(`acme never leaks public data: ${path}`, async () => {
      const res = await call(`${path}${path.includes('?') ? '&' : '?'}x=acme`, { headers: ACME });
      const text = await res.text();
      for (const f of FIXTURES) expect(text).not.toContain(f.c);
      if (/@core\/(db|auth|billing)\b/.test(path) && !path.includes('advisories')) expect(res.status).toBe(404);
      else expect(text).not.toMatch(/"@core\/(db|auth|billing)"/);
    });
  }
  it('hides a private registry from anonymous users and non-members', async () => {
    expect((await call('/v1/search?q=core&z=1', { headers: { 'genpm-registry': 'acme' } })).status).toBe(404);
    const outsider = await account({ login: 'acmeoutsider' });
    const res = await call('/v1/stats?z=2', {
      headers: { 'genpm-registry': 'acme', authorization: `Bearer ${outsider.token}` },
    });
    expect(res.status).toBe(404);
    expect((await call('/v1/stats?z=3', { headers: ACME })).headers.get('cache-control')).toBe('private, no-store');
  });
  it('counts only the current tenant', async () => {
    const pub = (await (await call('/v1/stats?x=1')).json()) as { packages: number };
    const acme = (await (await call('/v1/stats?x=1', { headers: ACME })).json()) as { packages: number };
    expect(pub.packages).toBe(3);
    expect(acme.packages).toBe(3);
  });
  it('treats a package of another tenant as not found (404, not 403)', async () => {
    const res = await call('/v1/packages/@core/acme-db?y=1');
    expect(res.status).toBe(404);
    const cross = await call('/v1/packages/@core/db?y=1', { headers: ACME });
    expect(cross.status).toBe(404);
  });
  it('isolates authenticated reads too', async () => {
    const { token } = await account({ login: 'tenantuser' });
    const res = await call('/v1/search?q=drizzle&z=1', { headers: { ...ACME, authorization: `Bearer ${token}` } });
    expect(await res.text()).not.toMatch(/"@core\/db"/);
  });
});
