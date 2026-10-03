import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeRepo } from '../../test/git-fixture.js';
import { gitAtLeast, hardenedEnv, hardeningFlags, runGit } from './git.js';
import { fetchSource, gitBlobSha1, repoCacheKey, sourcePath } from './index.js';

let cacheDir: string;
beforeAll(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'genpm-cache-'));
});
afterAll(async () => {
  await rm(cacheDir, { recursive: true, force: true });
});

const opts = () => ({ cacheDir, allowFileProtocol: true });

describe('fetchSource · git by SHA (INV-1)', () => {
  it('fetches the exact commit, verifies every blob and caches it immutably', async () => {
    const repo = await makeRepo(
      { 'genpm.json': '{}', 'AGENTS.md': '# rules\n', 'src/index.ts': 'export const a = 1;\r\n' },
      { tag: 'v1.0.0' },
    );
    const first = await fetchSource({ r: repo.url, c: repo.sha }, opts());
    expect(first.via).toBe('git');
    expect(first.entries.map((e) => e.path).sort()).toEqual(['AGENTS.md', 'genpm.json', 'src/index.ts']);
    // Bytes exactos (CRLF intacto: sin conversión de fin de línea)
    expect(await readFile(sourcePath(first, '.', 'src/index.ts'), 'utf8')).toBe('export const a = 1;\r\n');
    await expect(stat(join(first.dir, '.git'))).rejects.toThrow();
    const second = await fetchSource({ r: repo.url, c: repo.sha }, opts());
    expect(second.via).toBe('cache');
    expect(second.dir).toBe(first.dir);
  });

  it('installs the commit, not whatever a moved tag points to', async () => {
    const repo = await makeRepo({ 'a.ts': 'v1' }, { tag: 'v1.0.0' });
    const v1 = repo.sha;
    await repo.commit({ 'a.ts': 'evil' });
    const res = await fetchSource({ r: repo.url, c: v1 }, opts());
    expect(await readFile(sourcePath(res, '.', 'a.ts'), 'utf8')).toBe('v1');
  });

  it('rejects unknown SHAs, short SHAs and refs', async () => {
    const repo = await makeRepo({ 'a.ts': 'x' });
    await expect(fetchSource({ r: repo.url, c: 'f'.repeat(40) }, opts())).rejects.toMatchObject({
      code: 'E_UPSTREAM_GIT',
    });
    await expect(fetchSource({ r: repo.url, c: repo.sha.slice(0, 7) }, opts())).rejects.toMatchObject({
      code: 'E_REF_MUTABLE',
    });
    await expect(fetchSource({ r: repo.url, c: 'main' }, opts())).rejects.toMatchObject({ code: 'E_REF_MUTABLE' });
  });

  it('never allows file:// outside tests and rejects plain http', async () => {
    const repo = await makeRepo({ 'a.ts': 'x' });
    await expect(fetchSource({ r: repo.url, c: repo.sha }, { cacheDir })).rejects.toMatchObject({
      code: 'E_UPSTREAM_GIT',
    });
    await expect(fetchSource({ r: 'http://example.com/a/b', c: repo.sha }, { cacheDir })).rejects.toMatchObject({
      code: 'E_UPSTREAM_GIT',
    });
  });

  it('sparse-fetches a subdirectory (i) of a monorepo', async () => {
    const repo = await makeRepo({
      'packages/auth/AGENTS.md': '# auth',
      'packages/auth/src/x.ts': 'x',
      'packages/other/y.ts': 'y',
      'README.md': 'r',
    });
    const res = await fetchSource({ r: repo.url, c: repo.sha, i: 'packages/auth' }, opts());
    expect(res.entries.map((e) => e.path).sort()).toEqual(['AGENTS.md', 'src/x.ts']);
    expect(await readFile(sourcePath(res, 'packages/auth', 'src/x.ts'), 'utf8')).toBe('x');
  });

  it('records symlinks and submodules without materializing them as links', async () => {
    const repo = await makeRepo({ 'a.ts': 'x', link: { content: '', symlink: '/etc/passwd' } });
    const res = await fetchSource({ r: repo.url, c: repo.sha }, opts());
    expect(res.entries.find((e) => e.path === 'link')).toMatchObject({ type: 'symlink' });
  });
});

describe('git hardening (INV-2)', () => {
  it('never runs filters from .gitattributes, even if the user config defines them', async () => {
    const home = await mkdtemp(join(tmpdir(), 'genpm-home-'));
    const marker = join(home, 'pwned');
    await writeFile(
      join(home, '.gitconfig'),
      `[filter "evil"]\n\tsmudge = sh -c 'touch ${marker.replaceAll('\\', '/')}; cat'\n\tclean = cat\n`,
    );
    const repo = await makeRepo({ '.gitattributes': '* filter=evil\n', 'a.ts': 'x\n' });
    const prev = process.env['HOME'];
    process.env['HOME'] = home;
    try {
      const res = await fetchSource({ r: repo.url, c: repo.sha }, opts());
      expect(res.via).toBe('git');
    } finally {
      process.env['HOME'] = prev;
    }
    await expect(stat(marker)).rejects.toThrow();
  });

  it('builds hardening flags and a minimal environment', async () => {
    const flags = (await hardeningFlags()).join(' ');
    for (const f of [
      'core.hooksPath=',
      'protocol.file.allow=never',
      'protocol.ext.allow=never',
      'submodule.recurse=false',
      'core.symlinks=false',
      'core.fsmonitor=false',
    ]) {
      expect(flags).toContain(f);
    }
    expect((await hardeningFlags({ allowFileProtocol: true })).join(' ')).toContain('protocol.file.allow=always');
    const env = hardenedEnv({ PATH: '/bin', SECRET_TOKEN: 'x', HOME: '/h' });
    expect(env).toMatchObject({
      PATH: '/bin',
      HOME: '/h',
      GIT_TERMINAL_PROMPT: '0',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_LFS_SKIP_SMUDGE: '1',
    });
    expect(env['SECRET_TOKEN']).toBeUndefined();
  });

  it('compares git versions', () => {
    expect(gitAtLeast('2.50.1')).toBe(true);
    expect(gitAtLeast('2.25.0')).toBe(true);
    expect(gitAtLeast('2.24.9')).toBe(false);
    expect(gitAtLeast(null)).toBe(false);
  });

  it('maps git failures to E_UPSTREAM_GIT', async () => {
    await expect(runGit(['definitely-not-a-command'])).rejects.toMatchObject({ code: 'E_UPSTREAM_GIT' });
  });
});

describe('tarball fallback', () => {
  it('verifies the commit recorded by git archive and extracts under i', async () => {
    const repo = await makeRepo({ 'pkg/a.ts': 'a', 'pkg/AGENTS.md': '# r', 'other.ts': 'o' });
    const { execFileSync } = await import('node:child_process');
    const tgz = execFileSync('git', ['archive', '--format=tar.gz', `--prefix=repo-${repo.sha}/`, repo.sha], {
      cwd: repo.dir,
    });
    const fetchImpl = vi.fn(async () => new Response(tgz)) as unknown as typeof fetch;
    const r = 'https://github.com/genpm-net/fixture';
    const res = await fetchSource({ r, c: repo.sha, i: 'pkg' }, { cacheDir, strategy: 'tarball', fetchImpl });
    expect(res.via).toBe('tarball');
    expect(res.entries.map((e) => e.path).sort()).toEqual(['AGENTS.md', 'a.ts']);
    expect(res.entries[0]!.sha1).toMatch(/^[0-9a-f]{40}$/);
    expect(vi.mocked(fetchImpl).mock.calls[0]![0]).toBe(
      `https://codeload.github.com/genpm-net/fixture/tar.gz/${repo.sha}`,
    );
    const other = 'e'.repeat(40);
    await expect(fetchSource({ r, c: other }, { cacheDir, strategy: 'tarball', fetchImpl })).rejects.toMatchObject({
      code: 'E_INTEGRITY',
    });
  });
});

describe('helpers', () => {
  it('derives cache keys and git blob hashes', () => {
    expect(repoCacheKey('https://github.com/genpm-net/auth')).toBe('github.com/genpm-net/auth');
    expect(repoCacheKey('file:///tmp/x')).toMatch(/^local\/[0-9a-f]{16}$/);
    expect(gitBlobSha1(new TextEncoder().encode('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });
});
