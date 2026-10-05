// V02-01: genpm update (merge de 3 vías, architecture §6.6) y genpm diff sobre repos fixture.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { apply } from '../src/apply.js';
import { diff } from '../src/diff.js';
import { sri } from '../src/lock.js';
import { planMerge } from '../src/merge.js';
import { list } from '../src/ops.js';
import { type PlanInput, plan } from '../src/plan.js';
import { FakeRegistry, REGISTRY } from './fake-registry.js';
import { makeRepo } from './git-fixture.js';

const TEST_HOME = join(tmpdir(), 'genpm-test-home');
let reg: FakeRegistry;
let cacheDir: string;
let project: string;
let repo: Awaited<ReturnType<typeof makeRepo>>;
let v1: string;
let v2: string;

beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'genpm-ucache-'));
  repo = await makeRepo({
    'AGENTS.md': '# rules v1\n',
    'session.ts': 'line 1\nline 2\nline 3\nline 4\nline 5\n',
    'config.ts': 'export const ttl = 1;\n',
    'legacy.ts': 'old\n',
    'untouched.ts': 'same\n',
  });
  v1 = repo.sha;
  execFileSync('git', ['rm', '-q', 'legacy.ts'], { cwd: repo.dir });
  v2 = await repo.commit({
    'AGENTS.md': '# rules v2\n',
    'session.ts': 'line 1\nline 2 upstream\nline 3\nline 4\nline 5\n',
    'config.ts': 'export const ttl = 2;\n',
    'added.ts': 'new upstream file\n',
  });
  project = await mkdtemp(join(tmpdir(), 'genpm-uproj-'));
  await writeFile(join(project, 'package.json'), JSON.stringify({ name: 'app' }));
  reg = new FakeRegistry().add({ n: '@core/auth', v: '1.0.0', r: repo.url, c: v1, d: 'src/lib/auth', s: 'auth' });
});

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  specs: ['@core/auth'],
  cwd: project,
  registry: REGISTRY,
  fetchImpl: reg.fetch as typeof fetch,
  fetch: { cacheDir, allowFileProtocol: true },
  home: TEST_HOME,
  clients: ['agents'],
  ...over,
});

const p = (rel: string) => join(project, 'src/lib/auth', rel);
const read = (rel: string) => readFile(p(rel), 'utf8');

async function installV1AndPublishV2() {
  await apply(await plan(input()), { allowMcp: false, installNpmDeps: false, by: 'cli' });
  reg.add({ n: '@core/auth', v: '1.1.0', r: repo.url, c: v2, d: 'src/lib/auth', s: 'auth' });
}

describe('genpm update (3-way)', () => {
  it('without --update an installed package in another commit stays a conflict', async () => {
    await installV1AndPublishV2();
    const pl = await plan(input());
    expect(pl.packages[0]!.action).toBe('conflict');
    expect(pl.conflicts[0]!.fix).toContain('genpm update');
  });

  it('merges local edits with upstream changes and updates lock and index', async () => {
    await installV1AndPublishV2();
    // Cambios locales: una línea que upstream no toca, y config.ts con conflicto real.
    await writeFile(p('session.ts'), 'line 1\nline 2\nline 3\nline 4 local\nline 5\n');
    await writeFile(p('config.ts'), 'export const ttl = 99;\n');
    const pl = await plan(input({ update: true }));
    expect(pl.packages[0]).toMatchObject({ action: 'update', from: '1.0.0', v: '1.1.0', d: 'src/lib/auth' });
    const r = await apply(pl, { allowMcp: false, installNpmDeps: false, by: 'cli' });
    const u = r.updated[0]!;
    expect(u).toMatchObject({ n: '@core/auth', from: '1.0.0', v: '1.1.0', conflicts: ['config.ts'] });
    expect(u.merged).toEqual(['session.ts']);
    expect(await read('session.ts')).toBe('line 1\nline 2 upstream\nline 3\nline 4 local\nline 5\n');
    const cfg = await read('config.ts');
    expect(cfg).toContain('<<<<<<< local');
    expect(cfg).toContain('>>>>>>> upstream');
    // Sin cambios locales: se sobrescribe; nuevo upstream: se crea; borrado upstream sin drift: se borra.
    expect(await read('AGENTS.md')).toBe('# rules v2\n');
    expect(await read('added.ts')).toBe('new upstream file\n');
    await expect(read('legacy.ts')).rejects.toThrow();
    expect(await read('untouched.ts')).toBe('same\n');
    const lock = JSON.parse(await readFile(join(project, 'genpm.lock'), 'utf8'));
    expect(lock.p['@core/auth']).toMatchObject({ v: '1.1.0', c: v2, d: 'src/lib/auth' });
    // Drift posterior = cambios locales frente a la versión nueva.
    const [installed] = await list({ cwd: project, home: TEST_HOME });
    expect(installed!.drift.modified.sort()).toEqual(['config.ts', 'session.ts']);
  });

  it('keeps a file removed upstream when it has local changes', async () => {
    await installV1AndPublishV2();
    await writeFile(p('legacy.ts'), 'old\nmine\n');
    const r = await apply(await plan(input({ update: true })), { allowMcp: false, installNpmDeps: false, by: 'cli' });
    expect(r.updated[0]!.orphaned).toEqual(['legacy.ts']);
    expect(await read('legacy.ts')).toBe('old\nmine\n');
  });

  it('strategy "ai" records the new version without touching files', async () => {
    await installV1AndPublishV2();
    const r = await apply(await plan(input({ update: true })), {
      allowMcp: false,
      installNpmDeps: false,
      by: 'mcp',
      strategy: 'ai',
    });
    expect(r.updated[0]!.v).toBe('1.1.0');
    expect(await read('session.ts')).toBe('line 1\nline 2\nline 3\nline 4\nline 5\n');
    const lock = JSON.parse(await readFile(join(project, 'genpm.lock'), 'utf8'));
    expect(lock.p['@core/auth'].c).toBe(v2);
  });

  it('rejects a stale plan when a file changes between plan and apply', async () => {
    await installV1AndPublishV2();
    const pl = await plan(input({ update: true }));
    await writeFile(p('session.ts'), 'edited after plan\n');
    await expect(apply(pl, { allowMcp: false, installNpmDeps: false, by: 'cli' })).rejects.toMatchObject({
      code: 'E_PLAN_STALE',
    });
  });
});

describe('genpm diff', () => {
  it('returns the upstream patch remapped to <d>, applicable with git apply', async () => {
    await installV1AndPublishV2();
    await writeFile(p('untouched.ts'), 'mine\n');
    const d = await diff({ ...input(), name: '@core/auth' });
    expect(d).toMatchObject({ n: '@core/auth', d: 'src/lib/auth', from: '1.0.0', to: '1.1.0' });
    expect(d.files.sort()).toEqual(['AGENTS.md', 'added.ts', 'config.ts', 'legacy.ts', 'session.ts']);
    expect(d.patch).toContain('diff --git a/src/lib/auth/session.ts b/src/lib/auth/session.ts');
    expect(d.patch).toContain('+line 2 upstream');
    expect(d.drift.modified).toEqual(['untouched.ts']);
    // Aplicable desde la raíz del proyecto.
    execFileSync('git', ['init', '-q'], { cwd: project });
    await writeFile(join(project, 'u.patch'), d.patch);
    execFileSync('git', ['apply', '--check', 'u.patch'], { cwd: project });
  });

  it('truncates to maxChars listing omitted files', async () => {
    await installV1AndPublishV2();
    const d = await diff({ ...input(), name: '@core/auth', maxChars: 200 });
    expect(d.omitted.length).toBeGreaterThan(0);
    expect(d.patch.length).toBeLessThanOrEqual(200);
  });

  it('fails for a package that is not installed', async () => {
    await expect(diff({ ...input(), name: '@core/nope' })).rejects.toMatchObject({ code: 'E_NOT_FOUND' });
  });
});

describe('planMerge', () => {
  const b = (s: string) => Buffer.from(s);
  it('covers every outcome', async () => {
    const r = await planMerge({
      base: new Map([
        ['same.ts', b('a')],
        ['gone.ts', b('g')],
        ['user-deleted.ts', b('u')],
      ]),
      theirs: new Map([
        ['same.ts', b('a')],
        ['user-deleted.ts', b('u')],
      ]),
      ours: new Map([
        ['same.ts', b('a-local')],
        ['gone.ts', b('g')],
      ]),
      registered: { 'same.ts': sri('a'), 'gone.ts': sri('g'), 'user-deleted.ts': sri('u') },
    });
    expect(r.outcomes).toEqual([
      { rel: 'gone.ts', kind: 'delete' },
      { rel: 'same.ts', kind: 'keep' },
      { rel: 'user-deleted.ts', kind: 'stay-deleted' },
    ]);
    expect(r.deletes).toEqual(['gone.ts']);
    expect(Object.keys(r.index).sort()).toEqual(['same.ts', 'user-deleted.ts']);
  });
  it('treats binary files modified on both sides as a conflict and keeps the local copy', async () => {
    const r = await planMerge({
      base: new Map([['img.png', Buffer.from([0, 1])]]),
      theirs: new Map([['img.png', Buffer.from([0, 2])]]),
      ours: new Map([['img.png', Buffer.from([0, 3])]]),
      registered: { 'img.png': sri(Buffer.from([0, 1])) },
    });
    expect(r.outcomes).toEqual([{ rel: 'img.png', kind: 'binary-conflict' }]);
    expect(r.writes.size).toBe(0);
  });
});
