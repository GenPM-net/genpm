// Asistente de publicación web: listado de repos y diagnóstico (qué falta y genpm.json sugerido).
import { beforeAll, describe, expect, it } from 'vitest';
import { FakeGitHub } from './fake-github.js';
import { account, call } from './helpers.js';

const SHA = 'c1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

function gh() {
  return new FakeGitHub()
    .addRepo('wiz/empty-repo', {
      id: 501,
      description: 'Stripe checkout for Hono',
      license: 'MIT',
      tags: { 'v0.3.0': SHA },
      branches: { main: SHA },
      commits: { [SHA]: { 'index.ts': 'export {};\n' } },
    })
    .addRepo('wiz/ready', {
      id: 502,
      tags: {},
      branches: { main: SHA },
      commits: {
        [SHA]: {
          'genpm.json': JSON.stringify({ $: 1, n: '@wiz/ready', v: '1.2.0', d: 'src/lib/ready' }),
          'AGENTS.md': '# rules\n',
        },
      },
    })
    .addRepo('wiz/secret', { id: 503, private: true, tags: {}, branches: { main: SHA }, commits: { [SHA]: {} } })
    .addRepo('wizorg/tools', { id: 504, tags: {}, branches: { main: SHA }, commits: { [SHA]: {} } })
    .addRepo('stranger/x', { id: 505, tags: {}, branches: { main: SHA }, commits: { [SHA]: {} } });
}

type Check = {
  manifest: { status: string };
  rules: { path: string; status: string };
  license: string | null;
  tags: string[];
  suggested: Record<string, unknown>;
};

const auth = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });
let token = '';
beforeAll(async () => {
  token = (await account({ login: 'wiz', orgs: [{ login: 'wizorg', role: 'admin' }] })).token;
});

describe('GET /v1/me/repos', () => {
  it('lists public repos of the user and of orgs where they can publish', async () => {
    const res = await call('/v1/me/repos', auth(token), gh());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { owners: string[]; repos: Array<{ owner: string; name: string }> };
    expect(body.owners).toEqual(['wiz', 'wizorg']);
    const names = body.repos.map((r) => `${r.owner}/${r.name}`).sort();
    expect(names).toEqual(['wiz/empty-repo', 'wiz/ready', 'wizorg/tools']);
  });

  it('requires a session', async () => {
    expect((await call('/v1/me/repos', {}, gh())).status).toBe(401);
  });
});

describe('GET /v1/me/repos/:owner/:repo', () => {
  it('reports what is missing and suggests a manifest from the repo', async () => {
    const res = await call('/v1/me/repos/wiz/empty-repo', auth(token), gh());
    expect(res.status).toBe(200);
    const b = (await res.json()) as Check;
    expect(b.manifest.status).toBe('missing');
    expect(b.rules).toMatchObject({ path: 'AGENTS.md', status: 'missing' });
    expect(b.license).toBe('MIT');
    expect(b.tags).toEqual(['v0.3.0']);
    expect(b.suggested).toEqual({
      $: 1,
      n: '@wiz/empty-repo',
      v: '0.3.0',
      s: { en: 'Stripe checkout for Hono' },
      d: 'src/lib/empty-repo',
      x: 'AGENTS.md',
      l: 'MIT',
    });
  });

  it('returns the existing manifest when it is valid', async () => {
    const b = (await (await call('/v1/me/repos/wiz/ready', auth(token), gh())).json()) as Check;
    expect(b.manifest.status).toBe('ok');
    expect(b.rules.status).toBe('ok');
    expect(b.suggested['n']).toBe('@wiz/ready');
  });

  it('rejects private repos and owners the user cannot publish for', async () => {
    expect((await call('/v1/me/repos/wiz/secret', auth(token), gh())).status).toBe(422);
    expect((await call('/v1/me/repos/stranger/x', auth(token), gh())).status).toBe(403);
  });
});
