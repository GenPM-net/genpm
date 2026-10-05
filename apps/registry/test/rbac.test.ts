// V10-01: registros privados con RBAC (api-spec §5.4).
import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';
import { FakeGitHub } from './fake-github.js';
import { account, call } from './helpers.js';

const SHA = 'c1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const RULES = '# @corp/secret\n\n## Purpose\nx\n';
const gh = () =>
  new FakeGitHub()
    .addRepo('corp/secret', {
      id: 777,
      private: true,
      license: 'MIT',
      tags: { 'v1.0.0': SHA },
      commits: {
        [SHA]: {
          'genpm.json': JSON.stringify({ n: '@corp/secret', v: '1.0.0', d: 'src/lib/secret', s: 'Internal', l: 'MIT' }),
          'AGENTS.md': RULES,
          'index.ts': 'export {};\n',
        },
      },
    })
    .addRepo('corp/oss', { id: 778, private: true, tags: { 'v1.0.0': SHA }, commits: {} });

const req = (token: string | null, body?: unknown, method = body === undefined ? 'GET' : 'POST') => ({
  method,
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

let owner: string;
let bob: string;
let outsider: string;
beforeAll(async () => {
  ({ token: owner } = await account({ login: 'corpowner', orgs: [{ login: 'corp', role: 'owner' }] }));
  // bob es miembro de la org corp (necesario para equipos) pero no del registro.
  ({ token: bob } = await account({ login: 'bob', orgs: [{ login: 'corpfriends', role: 'member' }] }));
  await env.DB.prepare(
    "INSERT INTO memberships (org_id, user_id, role, source, created_at) SELECT 'acc_org_corp', id, 'reader', 'manual', 1 FROM accounts WHERE handle = 'bob'",
  ).run();
  // bob es reader de la org: entra al registro como reader. outsider no tiene nada.
  ({ token: outsider } = await account({ login: 'outsider' }));
});

describe('private registries', () => {
  it('creates a registry that does not exist for anyone else', async () => {
    const r = await call('/v1/registries', req(owner, { slug: 'corp-int', owner: 'corp' }));
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ slug: 'corp-int', role: 'admin', url: 'https://api.genpm.net/r/corp-int' });
    expect((await call('/v1/registries', req(outsider, { slug: 'corp-x', owner: 'corp' }))).status).toBe(403);
    expect((await call('/v1/registries', req(owner, { slug: 'public', owner: 'corp' }))).status).toBe(400);
    expect((await call('/r/corp-int/v1/search?q=x')).status).toBe(404);
    expect((await call('/r/corp-int/v1/search?q=x', req(outsider))).status).toBe(404);
  });

  it('publishes private repos as internal packages, readable only by members', async () => {
    const pub = await call(
      '/r/corp-int/v1/publish',
      req(owner, { name: '@corp/secret', version: '1.0.0', repo: 'https://github.com/corp/secret', ref: 'v1.0.0' }),
      gh(),
    );
    expect(pub.status).toBe(201);
    const row = await env.DB.prepare("SELECT visibility FROM packages WHERE full_name = '@corp/secret'").first<{
      visibility: string;
    }>();
    expect(row!.visibility).toBe('internal');
    // Nada sale al registro público, ni a la caché.
    expect((await call('/v1/packages/@corp/secret')).status).toBe(404);
    const asBob = await call('/r/corp-int/v1/resolve/@corp/secret', req(bob));
    expect(asBob.status).toBe(200);
    expect(asBob.headers.get('cache-control')).toBe('private, no-store');
    expect((await call('/r/corp-int/v1/resolve/@corp/secret', req(outsider))).status).toBe(404);
    // Repos privados nunca en el registro público.
    const leak = await call(
      '/v1/publish',
      req(owner, { name: '@corp/oss', version: '1.0.0', repo: 'https://github.com/corp/oss', ref: 'v1.0.0' }),
      gh(),
    );
    expect(((await leak.json()) as { code: string }).code).toBe('E_REPO_NOT_ALLOWED');
    // Un reader no publica.
    const ro = await call(
      '/r/corp-int/v1/publish',
      req(bob, { name: '@corp/other', version: '1.0.0', repo: 'https://github.com/corp/secret', ref: 'v1.0.0' }),
      gh(),
    );
    expect(((await ro.json()) as { code: string }).code).toBe('E_FORBIDDEN_SCOPE');
  });

  it('private packages need a grant, directly or through a team', async () => {
    const set = await call('/r/corp-int/v1/packages/@corp/secret/access', req(owner, { visibility: 'private' }, 'PUT'));
    expect(set.status).toBe(200);
    expect((await call('/r/corp-int/v1/packages/@corp/secret', req(bob))).status).toBe(404);
    // Equipo backend con bob y grant de lectura al equipo.
    expect((await call('/v1/orgs/corp/teams', req(owner, { slug: 'backend' }))).status).toBe(201);
    expect((await call('/v1/orgs/corp/teams/backend/members/bob', req(owner, {}, 'PUT'))).status).toBe(200);
    expect((await call('/v1/orgs/corp/teams/backend/members/outsider', req(owner, {}, 'PUT'))).status).toBe(404);
    const grant = await call(
      '/r/corp-int/v1/packages/@corp/secret/grants',
      req(owner, { principal: 'team:corp/backend', permission: 'read' }, 'PUT'),
    );
    expect(grant.status).toBe(200);
    expect((await call('/r/corp-int/v1/packages/@corp/secret', req(bob))).status).toBe(200);
    // En los listados solo aparecen para admins.
    const search = (await (await call('/r/corp-int/v1/search?q=secret&fmt=c', req(bob))).json()) as { r: unknown[] };
    expect(search.r).toHaveLength(0);
    const adminSearch = (await (await call('/r/corp-int/v1/search?q=secret&fmt=c', req(owner))).json()) as {
      r: Array<{ n: string }>;
    };
    expect(adminSearch.r.map((x) => x.n)).toEqual(['@corp/secret']);
    // bob no administra el paquete; el dueño ve los grants y los quita.
    expect((await call('/r/corp-int/v1/packages/@corp/secret/access', req(bob))).status).toBe(403);
    const list = (await (await call('/r/corp-int/v1/packages/@corp/secret/access', req(owner))).json()) as {
      grants: unknown[];
    };
    expect(list.grants).toEqual([{ principal: 'team:corp/backend', permission: 'read' }]);
    const del = await call(
      `/r/corp-int/v1/packages/@corp/secret/grants?principal=${encodeURIComponent('team:corp/backend')}`,
      req(owner, undefined, 'DELETE'),
    );
    expect(del.status).toBe(200);
    expect((await call('/r/corp-int/v1/packages/@corp/secret', req(bob))).status).toBe(404);
  });

  it('admins manage members; members list their registries', async () => {
    expect((await call('/v1/registries/corp-int/members/outsider', req(bob, { role: 'reader' }, 'PUT'))).status).toBe(
      403,
    );
    expect((await call('/v1/registries/corp-int/members/outsider', req(owner, { role: 'reader' }, 'PUT'))).status).toBe(
      200,
    );
    expect((await call('/r/corp-int/v1/search?q=x', req(outsider))).status).toBe(200);
    const mine = (await (await call('/v1/registries', req(outsider))).json()) as {
      registries: Array<{ slug: string; role: string }>;
    };
    expect(mine.registries).toEqual([expect.objectContaining({ slug: 'corp-int', role: 'reader' })]);
    const info = (await (await call('/v1/registries/corp-int', req(owner))).json()) as {
      members: Array<{ handle: string }>;
    };
    expect(info.members.map((m) => m.handle)).toEqual(['outsider']);
    expect((await call('/v1/registries/corp-int/members/outsider', req(owner, undefined, 'DELETE'))).status).toBe(200);
    expect((await call('/r/corp-int/v1/search?q=x', req(outsider))).status).toBe(404);
    const audit = await env.DB.prepare("SELECT count(*) AS n FROM audit_log WHERE action LIKE 'registry.%'").first<{
      n: number;
    }>();
    expect(audit!.n).toBeGreaterThanOrEqual(3);
  });
});
