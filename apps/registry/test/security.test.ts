// D4-A-03: tests de seguridad de la API — traversal vía d, ref de rama, typosquatting, payloads grandes, inyección FTS.
import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakeGitHub } from './fake-github.js';
import { account, call, seed, wipeScope } from './helpers.js';

const SHA = 'd'.repeat(40);

function repo(owner: string, name: string, manifest: Record<string, unknown>, extra: Record<string, string> = {}) {
  return new FakeGitHub().addRepo(`${owner}/${name}`, {
    id: 7,
    tags: { 'v1.0.0': SHA },
    branches: { main: SHA, develop: SHA },
    commits: { [SHA]: { 'genpm.json': JSON.stringify(manifest), 'AGENTS.md': '# rules\n', ...extra } },
  });
}

async function publish(token: string, body: Record<string, unknown>, gh: FakeGitHub) {
  const res = await call(
    '/v1/publish',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    gh,
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

let token: string;
beforeEach(async () => {
  await seed();
  await wipeScope('c0re');
  await wipeScope('evil');
  ({ token } = await account({
    login: `sec${Math.random().toString(36).slice(2, 7)}`,
    orgs: [
      { login: 'evil', role: 'admin' },
      { login: 'c0re', role: 'admin' },
    ],
  }));
});

describe('API security', () => {
  it.each(['../../.ssh', '/etc/cron.d', '.git/hooks', 'src/../../x', 'C:\\x', 'node_modules/x', '%2e%2e/x'])(
    'rejects d = %s',
    async (d) => {
      const r = await publish(
        token,
        { name: '@evil/x', version: '1.0.0', repo: 'https://github.com/evil/x', ref: 'v1.0.0' },
        repo('evil', 'x', { n: '@evil/x', v: '1.0.0', d }),
      );
      expect(r.status).toBe(422);
      expect(r.body['code']).toBe('E_PATH_UNSAFE');
    },
  );
  it.each(['main', 'develop', 'refs/heads/main'])('rejects branch refs: %s', async (ref) => {
    const r = await publish(
      token,
      { name: '@evil/x', version: '1.0.0', repo: 'https://github.com/evil/x', ref },
      repo('evil', 'x', { n: '@evil/x', v: '1.0.0', d: 'src/x' }),
    );
    expect(r.body['code']).toBe('E_REF_MUTABLE');
  });
  it('quarantines typosquats of popular packages from other scopes', async () => {
    await env.DB.prepare("UPDATE packages SET installs_30d = 5000 WHERE full_name = '@core/auth'").run();
    const r = await publish(
      token,
      { name: '@c0re/auth', version: '1.0.0', repo: 'https://github.com/c0re/auth', ref: 'v1.0.0' },
      repo('c0re', 'auth', { n: '@c0re/auth', v: '1.0.0', d: 'src/lib/auth' }),
    );
    expect(r.status).toBe(201);
    expect(r.body['scan']).toMatchObject({
      status: 'flagged',
      findings: [{ rule: 'typosquat', detail: '@core/auth' }],
    });
    expect((await call(`/v1/resolve/@c0re/auth?t=${Date.now()}`)).status).toBe(451);
  });
  it('rejects oversized and malformed bodies', async () => {
    const big = await call('/v1/publish', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'content-length': '20000' },
      body: 'x'.repeat(20_000),
    });
    expect(big.status).toBe(413);
    const junk = await publish(token, { name: '@evil/x', extra: 'nope' } as never, new FakeGitHub());
    expect(junk.body['code']).toBe('E_BAD_REQUEST');
    const ssrf = await publish(
      token,
      { name: '@evil/x', version: '1.0.0', repo: 'https://169.254.169.254/latest', ref: 'v1.0.0' },
      new FakeGitHub(),
    );
    expect(ssrf.body['code']).toBe('E_REPO_NOT_ALLOWED');
  });
  it('escapes FTS input and never returns SQL errors', async () => {
    for (const q of [
      '"',
      '*',
      'NEAR(a b)',
      'a OR b) --',
      '\u0000',
      "'; DROP TABLE packages; --",
      '^auth',
      'auth:*',
      '((((((',
    ]) {
      const res = await call(`/v1/search?q=${encodeURIComponent(q)}&t=${Math.random()}`);
      expect(res.status, q).toBe(200);
    }
    const count = await env.DB.prepare('SELECT count(*) AS n FROM packages').first<{ n: number }>();
    expect(count!.n).toBeGreaterThan(0);
  });
  it('sets security headers and never caches authenticated responses', async () => {
    const res = await call('/v1/me', { headers: { authorization: `Bearer ${token}` } });
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
  });
});
