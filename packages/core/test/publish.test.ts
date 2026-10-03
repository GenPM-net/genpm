// D3-A-06: `genpm publish` valida en local, exige árbol limpio y que el tag esté en el remoto con el mismo SHA.
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { publish } from '../src/author.js';

const git = (cwd: string, ...a: string[]) =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'init.defaultBranch=main', ...a], { cwd })
    .toString()
    .trim();

async function packageRepo() {
  const bare = await mkdtemp(join(tmpdir(), 'genpm-bare-'));
  git(bare, 'init', '-q', '--bare');
  const dir = await mkdtemp(join(tmpdir(), 'genpm-pkg-'));
  git(dir, 'init', '-q');
  await writeFile(
    join(dir, 'genpm.json'),
    JSON.stringify({
      n: '@acme/kit',
      v: '1.0.0',
      d: 'src/lib/kit',
      r: 'https://github.com/acme/kit',
      l: 'MIT',
      s: 'kit',
    }),
  );
  await writeFile(join(dir, 'AGENTS.md'), '# kit\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'init');
  git(dir, 'tag', 'v1.0.0');
  git(dir, 'remote', 'add', 'origin', bare);
  return { dir, bare };
}

describe('publish (author)', () => {
  it('requires the tag to be pushed, then posts coordinates (never the manifest)', async () => {
    const { dir } = await packageRepo();
    const bodies: unknown[] = [];
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response(
        JSON.stringify({
          manifest: { n: '@acme/kit', v: '1.0.0', c: 'x' },
          scan: { status: 'passed', findings: [] },
          warnings: [],
          url: 'https://genpm.net/p/@acme/kit',
        }),
        { status: 201 },
      );
    }) as unknown as typeof fetch;
    const opts = { cwd: dir, registry: 'http://localhost:8787', token: 'gpm_x', fetchImpl };
    await expect(publish(opts)).rejects.toMatchObject({ code: 'E_REF_NOT_PUSHED' });
    git(dir, 'push', '-q', 'origin', 'main', '--tags');
    const r = await publish(opts);
    expect(r.url).toBe('https://genpm.net/p/@acme/kit');
    expect(bodies[0]).toEqual({
      name: '@acme/kit',
      version: '1.0.0',
      repo: 'https://github.com/acme/kit',
      ref: 'v1.0.0',
      manifestPath: 'genpm.json',
    });
    await writeFile(join(dir, 'dirty.ts'), 'x');
    await expect(publish(opts)).rejects.toMatchObject({ code: 'E_USAGE' });
  });
  it('refuses invalid packages before talking to the registry', async () => {
    const { dir } = await packageRepo();
    await writeFile(join(dir, 'genpm.json'), '{"n":"bad"}');
    await expect(publish({ cwd: dir, registry: 'http://localhost:8787', token: 'gpm_x' })).rejects.toMatchObject({
      code: 'E_MANIFEST_INVALID',
    });
    await writeFile(
      join(dir, 'genpm.json'),
      JSON.stringify({ n: '@acme/kit', v: '1.0.0', d: 'src/x', r: 'https://github.com/acme/kit' }),
    );
    git(dir, 'commit', '-qam', 'x');
    await expect(
      publish({ cwd: dir, registry: 'http://localhost:8787', token: 'gpm_x', ref: 'main' }),
    ).rejects.toMatchObject({ code: 'E_REF_MUTABLE' });
  });
});
