// D1-A-08: scopes reservados (security §3.2). Nadie puede reclamarlos ni publicar en ellos salvo el staff.
import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { FakeGitHub } from './fake-github.js';
import { account, call } from './helpers.js';

const SHA = 'c'.repeat(40);

function repoFor(scope: string, gitOwner: string) {
  const manifest = { n: `@${scope}/kit`, v: '1.0.0', d: 'src/lib/kit' };
  return new FakeGitHub().addRepo(`${gitOwner}/kit`, {
    id: 99,
    tags: { 'v1.0.0': SHA },
    commits: { [SHA]: { 'genpm.json': JSON.stringify(manifest), 'AGENTS.md': '# kit\n' } },
  });
}

async function publish(token: string, scope: string, gitOwner: string) {
  const res = await call(
    '/v1/publish',
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `@${scope}/kit`,
        version: '1.0.0',
        repo: `https://github.com/${gitOwner}/kit`,
        ref: 'v1.0.0',
      }),
    },
    repoFor(scope, gitOwner),
  );
  return { status: res.status, code: ((await res.json()) as { code?: string }).code };
}

describe('reserved scopes', () => {
  it('are seeded with the system account', async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM scopes WHERE is_reserved = 1 AND owner_id = 'acc_system' ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual(
      expect.arrayContaining([
        'admin',
        'core',
        'genpm',
        'genpm-dev',
        'genpm-net',
        'genpmhq',
        'github',
        'npm',
        'official',
        'registry',
        'security',
      ]),
    );
    const sys = await env.DB.prepare("SELECT github_id FROM accounts WHERE id = 'acc_system'").first<{
      github_id: number | null;
    }>();
    expect(sys?.github_id).toBeNull();
  });

  it('cannot be auto-claimed by the GitHub user or org of the same name (the real `genpm` user is not ours)', async () => {
    const squatter = await account({ login: 'genpm', orgs: [{ login: 'genpm-net', role: 'admin' }] });
    expect(await publish(squatter.token, 'genpm', 'genpm')).toEqual({ status: 403, code: 'E_FORBIDDEN_SCOPE' });
    expect(await publish(squatter.token, 'genpm-net', 'genpm-net')).toEqual({ status: 403, code: 'E_FORBIDDEN_SCOPE' });
    expect(await publish(squatter.token, 'core', 'genpm-net')).toEqual({ status: 403, code: 'E_FORBIDDEN_SCOPE' });
  });

  it('allow staff to publish from the official org', async () => {
    const staff = await account({ login: 'maintainer', staff: true });
    expect(await publish(staff.token, 'official', 'genpm-net')).toEqual({ status: 201, code: undefined });
  });
});
