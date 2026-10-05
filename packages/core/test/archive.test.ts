// V03-02: si el repo desaparece, plan() instala desde el Verified Archive del registry (firma + sha256 + commit).
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply.js';
import { plan } from '../src/plan.js';
import { FakeRegistry, REGISTRY } from './fake-registry.js';
import { makeRepo } from './git-fixture.js';

async function setup() {
  const repo = await makeRepo({ 'AGENTS.md': '# kit\n', 'index.ts': 'export const kit = 1;\n' });
  // `git archive` deja el commit en el comentario pax global, igual que codeload.
  const gz = new Uint8Array(
    execFileSync('git', ['archive', '--format=tar.gz', `--prefix=kit-${repo.sha}/`, repo.sha], { cwd: repo.dir }),
  );
  const project = await mkdtemp(join(tmpdir(), 'genpm-arch-'));
  await writeFile(join(project, 'package.json'), '{"name":"app"}');
  const reg = new FakeRegistry().add({
    n: '@core/kit',
    v: '1.0.0',
    r: repo.url,
    c: repo.sha,
    d: 'src/lib/kit',
    s: 'kit',
  });
  // El repo deja de existir.
  await rm(repo.dir, { recursive: true, force: true });
  const input = {
    specs: ['@core/kit'],
    cwd: project,
    registry: REGISTRY,
    fetchImpl: reg.fetch as typeof fetch,
    fetch: { cacheDir: await mkdtemp(join(tmpdir(), 'genpm-acache-')), allowFileProtocol: true },
    home: join(tmpdir(), 'genpm-test-home'),
    clients: ['agents'],
  };
  return { repo, gz, project, reg, input };
}

describe('Verified Archive fallback', () => {
  it('installs from the signed archive when the repository is gone', async () => {
    const { repo, gz, project, reg, input } = await setup();
    reg.archives.set('@core/kit@1.0.0', { gz, c: repo.sha });
    const r = await apply(await plan(input), { allowMcp: false, installNpmDeps: false, by: 'cli' });
    expect(r.installed[0]).toMatchObject({ n: '@core/kit', c: repo.sha });
    expect(await readFile(join(project, 'src/lib/kit/index.ts'), 'utf8')).toBe('export const kit = 1;\n');
  });

  it('refuses an archive whose signed hash does not match the bytes', async () => {
    const { repo, gz, reg, input } = await setup();
    reg.archives.set('@core/kit@1.0.0', { gz, c: repo.sha, claimHash: '0'.repeat(64) });
    await expect(plan(input)).rejects.toMatchObject({ code: 'E_UPSTREAM_GIT' });
  });

  it('without an archive the original error stands', async () => {
    const { input } = await setup();
    await expect(plan(input)).rejects.toMatchObject({ code: 'E_UPSTREAM_GIT' });
  });
});
