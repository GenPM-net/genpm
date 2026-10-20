// V03-01: trusted publishing con OIDC de GitHub Actions (security §4.2). V03-03: GitLab CI.
import { env } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { __resetJwks } from '../src/services/oidc.js';
import { FakeGitHub } from './fake-github.js';
import { account, call, wipeScope } from './helpers.js';

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const SHA2 = 'b1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const RULES = '# @acme/auth\n\n## Purpose\nx\n';
let keys: CryptoKeyPair;
let jwk: JsonWebKey;

function fake(): FakeGitHub {
  const manifest = { n: '@acme/auth', v: '1.0.0', d: 'src/lib/auth', s: 'Acme', l: 'MIT' };
  const g = new FakeGitHub().addRepo('acme/auth', {
    id: 42,
    license: 'MIT',
    tags: { 'v1.0.0': SHA, 'v2.0.0': SHA2 },
    commits: {
      [SHA]: { 'genpm.json': JSON.stringify(manifest), 'AGENTS.md': RULES, 'index.ts': 'export {};\n' },
      [SHA2]: { 'genpm.json': JSON.stringify({ ...manifest, v: '2.0.0' }), 'AGENTS.md': RULES, 'index.ts': '1;\n' },
    },
  });
  const gl = { n: '@acme/glib', v: '1.0.0', d: 'src/lib/glib', s: 'GitLab lib', l: 'MIT' };
  g.addGitlab('acme-group/sub/glib', {
    id: 7001,
    license: 'mit',
    tags: { 'v1.0.0': SHA, 'v1.1.0': SHA2 },
    branches: { main: SHA2 },
    commits: {
      [SHA]: { 'genpm.json': JSON.stringify(gl), 'AGENTS.md': RULES, 'index.ts': 'export {};\n' },
      [SHA2]: { 'genpm.json': JSON.stringify({ ...gl, v: '1.1.0' }), 'AGENTS.md': RULES, 'index.ts': '2;\n' },
    },
  });
  g.addGitlab('acme-group/secret', { id: 7002, private: true, tags: {}, commits: {} });
  g.gitlabDiffs['acme-group/sub/glib'] = [
    {
      old_path: 'index.ts',
      new_path: 'index.ts',
      new_file: false,
      deleted_file: false,
      renamed_file: false,
      diff: '@@ -1 +1 @@\n-export {};\n+2;\n',
    },
  ];
  g.jwks = [{ ...jwk, kid: 'k1', alg: 'RS256', use: 'sig' } as JsonWebKey];
  return g;
}

const b64 = (o: unknown) =>
  btoa(typeof o === 'string' ? o : JSON.stringify(o))
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

async function jwt(over: Record<string, unknown> = {}, signer = keys.privateKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', kid: 'k1', typ: 'JWT' });
  const body = b64({
    iss: 'https://token.actions.githubusercontent.com',
    aud: 'genpm',
    sub: 'repo:acme/auth:ref:refs/tags/v2.0.0',
    exp: now + 300,
    iat: now,
    repository: 'acme/auth',
    repository_id: '42',
    repository_owner: 'acme',
    job_workflow_ref: 'acme/auth/.github/workflows/release.yml@refs/tags/v2.0.0',
    ref: 'refs/tags/v2.0.0',
    ...over,
  });
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signer, new TextEncoder().encode(`${head}.${body}`)),
  );
  return `${head}.${body}.${b64(String.fromCharCode(...sig))}`;
}

const req = (token: string | null, body?: unknown, method = 'POST') => ({
  method,
  headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

let admin: string;
beforeAll(async () => {
  keys = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  jwk = (await crypto.subtle.exportKey('jwk', keys.publicKey)) as JsonWebKey;
});
beforeEach(async () => {
  __resetJwks();
  await wipeScope('acme');
  ({ token: admin } = await account({
    login: `adm${Math.random().toString(36).slice(2, 7)}`,
    orgs: [{ login: 'acme', role: 'admin' }],
  }));
  // Primera publicación con el token personal: reclama @acme.
  const r = await call(
    '/v1/publish',
    req(admin, { name: '@acme/auth', version: '1.0.0', repo: 'https://github.com/acme/auth', ref: 'v1.0.0' }),
    fake(),
  );
  expect(r.status).toBe(201);
});

// El canje tiene su propio límite por IP (10/min): cada bloque de tests usa una IP distinta.
let ip = '10.0.0.1';
const exchange = async (token: string) => {
  const r = req(null, { token });
  return call('/v1/auth/oidc/exchange', { ...r, headers: { ...r.headers, 'cf-connecting-ip': ip } }, fake());
};

describe('trusted publishing', () => {
  it('scope admins authorize a repo and Actions publishes with a short-lived token', async () => {
    const add = await call(
      '/v1/scopes/@acme/trusted-publishers',
      req(admin, { repository: 'acme/auth', workflow: '.github/workflows/release.yml' }),
      fake(),
    );
    expect(add.status).toBe(201);
    const list = (await (await call('/v1/scopes/@acme/trusted-publishers', req(admin, undefined, 'GET'))).json()) as {
      publishers: Array<{ repository: string }>;
    };
    expect(list.publishers.map((p) => p.repository)).toEqual(['acme/auth']);

    const ex = await exchange(await jwt());
    expect(ex.status).toBe(200);
    const { token, scopes, expiresAt } = (await ex.json()) as { token: string; scopes: string[]; expiresAt: string };
    expect(scopes).toEqual(['@acme']);
    expect(Date.parse(expiresAt) - Date.now()).toBeLessThanOrEqual(15 * 60_000);
    const pub = await call(
      '/v1/publish',
      req(token, { name: '@acme/auth', version: '2.0.0', repo: 'https://github.com/acme/auth', ref: 'v2.0.0' }),
      fake(),
    );
    expect(pub.status).toBe(201);
    // Fuera de su scope o desde otro repo, el token no sirve.
    const other = await call(
      '/v1/publish',
      req(token, { name: '@other/x', version: '1.0.0', repo: 'https://github.com/other/x', ref: 'v1.0.0' }),
      fake(),
    );
    expect(((await other.json()) as { code: string }).code).toBe('E_FORBIDDEN_SCOPE');
    const audit = await env.DB.prepare("SELECT count(*) AS n FROM audit_log WHERE action = 'auth.oidc'").first<{
      n: number;
    }>();
    expect(audit!.n).toBeGreaterThan(0);
  });

  it('rejects tokens that do not match the authorization or are not genuine', async () => {
    await call(
      '/v1/scopes/@acme/trusted-publishers',
      req(admin, { repository: 'acme/auth', workflow: '.github/workflows/release.yml' }),
      fake(),
    );
    const other = (await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    for (const t of [
      await jwt({ job_workflow_ref: 'acme/auth/.github/workflows/other.yml@refs/heads/main' }),
      await jwt({ aud: 'npm' }),
      await jwt({ repository_id: '999' }),
      await jwt({ exp: Math.floor(Date.now() / 1000) - 600 }),
      await jwt({}, other.privateKey),
      'not-a-jwt-but-long-enough',
    ])
      expect((await exchange(t)).status).toBe(401);
  });

  it('only scope owners and admins manage trusted publishers', async () => {
    const outsider = (await account({ login: `out${Math.random().toString(36).slice(2, 7)}` })).token;
    expect((await call('/v1/scopes/@acme/trusted-publishers', req(outsider, undefined, 'GET'))).status).toBe(404);
    const bad = await call('/v1/scopes/@acme/trusted-publishers', req(admin, { repository: 'evil/auth' }), fake());
    expect(((await bad.json()) as { code: string }).code).toBe('E_REPO_NOT_ALLOWED');
  });
});

const gitlabClaims = (over: Record<string, unknown> = {}) => ({
  iss: 'https://gitlab.com',
  sub: 'project_path:acme-group/sub/glib:ref_type:tag:ref:v1.0.0',
  project_path: 'acme-group/sub/glib',
  project_id: '7001',
  namespace_path: 'acme-group/sub',
  ci_config_ref_uri: 'gitlab.com/acme-group/sub/glib//.gitlab-ci.yml@refs/tags/v1.0.0',
  ref: 'v1.0.0',
  ref_type: 'tag',
  pipeline_id: '99',
  repository: undefined,
  repository_id: undefined,
  ...over,
});

describe('trusted publishing from GitLab (V03-03)', () => {
  beforeEach(() => {
    ip = `10.0.1.${Math.floor(Math.random() * 250)}`;
  });
  const glPublish = (token: string, version = '1.0.0', name = '@acme/glib') =>
    call(
      '/v1/publish',
      req(token, { name, version, repo: 'https://gitlab.com/acme-group/sub/glib', ref: `v${version}` }),
      fake(),
    );
  const trust = (body: unknown) => call('/v1/scopes/@acme/trusted-publishers', req(admin, body), fake());

  it('GitLab CI publishes a public project authorized by the scope owner', async () => {
    expect(
      (await trust({ provider: 'gitlab', repository: 'acme-group/sub/glib', workflow: '.gitlab-ci.yml' })).status,
    ).toBe(201);
    const ex = await exchange(await jwt(gitlabClaims()));
    expect(ex.status).toBe(200);
    const { token, repository } = (await ex.json()) as { token: string; repository: string };
    expect(repository).toBe('gitlab.com/acme-group/sub/glib');
    const pub = await glPublish(token);
    expect(pub.status).toBe(201);
    const body = (await pub.json()) as { manifest: { r: string; c: string; l: string } };
    expect(body.manifest).toMatchObject({ r: 'https://gitlab.com/acme-group/sub/glib', c: SHA, l: 'MIT' });
    expect((await glPublish(token, '1.1.0')).status).toBe(201);

    // Diff visual entre versiones con el API de compare de GitLab.
    const cmp = await call('/v1/packages/@acme/glib/compare?from=1.0.0&to=1.1.0', {}, fake());
    expect(cmp.status).toBe(200);
    const files = ((await cmp.json()) as { files: Array<{ path: string; additions: number; deletions: number }> })
      .files;
    expect(files).toEqual([expect.objectContaining({ path: 'index.ts', additions: 1, deletions: 1 })]);

    // Un paquete de GitHub no se puede mover a GitLab.
    const moved = await glPublish(token, '1.0.0', '@acme/auth');
    expect(((await moved.json()) as { code: string }).code).toMatch(/E_REPO_CHANGED|E_NAME_MISMATCH/);
  });

  it('GitLab needs trusted publishing: personal tokens, other projects and private projects are rejected', async () => {
    const personal = await glPublish(admin);
    expect(((await personal.json()) as { code: string }).code).toBe('E_REPO_NOT_ALLOWED');
    expect((await exchange(await jwt(gitlabClaims()))).status).toBe(401);
    await trust({ provider: 'gitlab', repository: 'acme-group/sub/glib', workflow: '.gitlab-ci.yml' });
    for (const over of [
      { project_id: '9999' },
      { ci_config_ref_uri: 'gitlab.com/acme-group/sub/glib//other.yml@refs/heads/main' },
      { iss: 'https://evil.example' },
    ])
      expect((await exchange(await jwt(gitlabClaims(over)))).status).toBe(401);
    const priv = await trust({ provider: 'gitlab', repository: 'acme-group/secret' });
    expect(((await priv.json()) as { code: string }).code).toBe('E_REPO_NOT_ALLOWED');
    const bad = await trust({ provider: 'gitlab', repository: '../x' });
    expect(bad.status).toBe(400);
  }, 30_000); // runners de Windows lentos: 7,7 s en Node 22 frente a 1,5 s en Node 20
});
