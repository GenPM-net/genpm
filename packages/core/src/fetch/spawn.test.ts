// INV-2: el motor solo lanza `git`, siempre con execFile (sin shell) y nunca exec/spawn con shell.
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', async (importOriginal) => {
  const m = await importOriginal<typeof import('node:child_process')>();
  return { ...m, execFile: vi.fn(m.execFile), exec: vi.fn(m.exec), spawn: vi.fn(m.spawn), execSync: vi.fn(m.execSync) };
});

describe('child processes', () => {
  it('only git via execFile without shell', async () => {
    const { makeRepo } = await import('../../test/git-fixture.js');
    const cp = await import('node:child_process');
    const repo = await makeRepo({ 'a.ts': 'x', '.gitattributes': '* filter=lfs diff=lfs merge=lfs -text\n' });
    vi.mocked(cp.execFile).mockClear();
    vi.mocked(cp.execSync).mockClear();
    const { fetchSource } = await import('./index.js');
    await fetchSource(
      { r: repo.url, c: repo.sha },
      { cacheDir: await mkdtemp(join(tmpdir(), 'genpm-c3-')), allowFileProtocol: true },
    );
    const calls = vi.mocked(cp.execFile).mock.calls;
    expect(calls.length).toBeGreaterThan(3);
    for (const call of calls) {
      expect(call[0]).toBe('git');
      expect((call[2] as { shell?: unknown }).shell).toBeUndefined();
    }
    expect(cp.exec).not.toHaveBeenCalled();
    expect(cp.spawn).not.toHaveBeenCalled();
    expect(cp.execSync).not.toHaveBeenCalled();
  });
});
