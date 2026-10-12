// D2-G-02 / D2-G-03 y tests de invariantes INV-1…INV-5 (security §2) sobre plan() + apply().
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { revocationPayload, signBytes } from '@genpm/manifest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apply } from '../src/apply.js';
import { type PlanInput, plan } from '../src/plan.js';
import { FakeRegistry, REGISTRY } from './fake-registry.js';
import { makeRepo } from './git-fixture.js';

// Directorio personal ficticio, distinto del proyecto: findRoot nunca acepta el propio ~ como proyecto.
const TEST_HOME = join(tmpdir(), 'genpm-test-home');

const DB_RULES = '# @core/db — rules for agents\n\n## Purpose\nDrizzle client.\n';
const AUTH_RULES = '# @core/auth — rules for agents\n\n## Purpose\nSessions.\n';
let reg: FakeRegistry;
let cacheDir: string;
let dbRepo: Awaited<ReturnType<typeof makeRepo>>;
let authRepo: Awaited<ReturnType<typeof makeRepo>>;
let project: string;

beforeAll(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'genpm-icache-'));
  dbRepo = await makeRepo({
    'genpm.json': '{}',
    'AGENTS.md': DB_RULES,
    'index.ts': 'export const db = 1;\n',
    'schema/users.ts': 'export {};\n',
    'tests/db.test.ts': 'x',
    '.genpmignore': 'tests/\n',
    'bin.sh': { content: '#!/bin/sh\n', mode: 0o755 },
  });
  authRepo = await makeRepo({
    'AGENTS.md': AUTH_RULES,
    'index.ts': 'export const auth = 1;\n',
    'session.ts': 'export {};\n',
  });
});

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'genpm-proj-'));
  await writeFile(join(project, 'package.json'), JSON.stringify({ name: 'app', dependencies: { postgres: '^3.4.0' } }));
  await writeFile(join(project, 'pnpm-lock.yaml'), '');
  await mkdir(join(project, '.cursor'));
  await writeFile(join(project, 'CLAUDE.md'), '# My app\n\nOwn notes.\n');
  reg = new FakeRegistry()
    .add({
      n: '@core/db',
      v: '1.0.3',
      r: dbRepo.url,
      c: dbRepo.sha,
      d: 'src/lib/db',
      s: 'db',
      p: { 'drizzle-orm': '^0.44.0', postgres: '^3.4.0' },
      e: ['DATABASE_URL'],
    })
    .add({
      n: '@core/auth',
      v: '1.2.0',
      r: authRepo.url,
      c: authRepo.sha,
      d: 'src/lib/auth',
      s: 'auth',
      g: { '@core/db': '^1.0.0' },
      p: { arctic: '^3.0.0' },
      e: ['AUTH_SECRET'],
      m: [{ n: 'stripe', c: 'npx', a: ['-y', '@stripe/mcp'], e: ['STRIPE_SECRET_KEY'] }],
    });
});

const input = (over: Partial<PlanInput> = {}): PlanInput => ({
  specs: ['@core/auth'],
  cwd: project,
  registry: REGISTRY,
  fetchImpl: reg.fetch as typeof fetch,
  fetch: { cacheDir, allowFileProtocol: true },
  home: TEST_HOME,
  ...over,
});

const read = (p: string) => readFile(join(project, p), 'utf8');

describe('plan()', () => {
  it('resolves deps, previews rules, proposes npm/env/MCP and writes nothing', async () => {
    const p = await plan(input());
    expect(p.root).toBe(project);
    expect(p.packages.map((x) => [x.n, x.role, x.action, x.d])).toEqual([
      ['@core/auth', 'root', 'install', 'src/lib/auth'],
      ['@core/db', 'dep', 'install', 'src/lib/db'],
    ]);
    expect(p.packages[1]!.files).toBe(4); // AGENTS.md, index.ts, schema/users.ts, bin.sh (tests/ ignorado)
    expect(p.rulesPreview.map((r) => r.n)).toEqual(['@core/auth', '@core/db']);
    expect(p.npm).toEqual({
      manager: 'pnpm',
      add: { arctic: '^3.0.0', 'drizzle-orm': '^0.44.0' },
      command: 'pnpm add arctic@^3.0.0 drizzle-orm@^0.44.0',
    });
    expect(p.env).toEqual(['AUTH_SECRET', 'DATABASE_URL']);
    expect(p.mcp).toEqual([
      {
        n: 'stripe',
        command: 'npx -y @stripe/mcp',
        env: ['STRIPE_SECRET_KEY'],
        targets: ['.mcp.json', '.cursor/mcp.json'],
        from: '@core/auth',
      },
    ]);
    expect(p.context.map((c) => c.file)).toContain('.cursor/rules/genpm-core-auth.mdc');
    expect(p.conflicts).toEqual([]);
    expect(p.warnings.map((w) => w.code)).toContain('W_PERM_EXECUTABLE');
    expect(p.id).toMatch(/^[0-9a-f]{16}$/);
    expect((await readdir(project)).sort()).toEqual(['.cursor', 'CLAUDE.md', 'package.json', 'pnpm-lock.yaml']);
    expect(reg.requests[0]).toContain('/v1/resolve/@core/auth?range=latest&fmt=c&client=cli&deps=1');
  });

  it('lists an MCP server declared by several packages once (one consent question)', async () => {
    const stripe = { n: 'stripe', c: 'npx', a: ['-y', '@stripe/mcp'], e: ['STRIPE_SECRET_KEY'] };
    reg = new FakeRegistry()
      .add({ n: '@core/db', v: '1.0.3', r: dbRepo.url, c: dbRepo.sha, d: 'src/lib/db', s: 'db', m: [stripe] })
      .add({
        n: '@core/auth',
        v: '1.2.0',
        r: authRepo.url,
        c: authRepo.sha,
        d: 'src/lib/auth',
        s: 'auth',
        g: { '@core/db': '^1.0.0' },
        m: [{ ...stripe, e: ['STRIPE_SECRET_KEY', 'STRIPE_ACCOUNT'] }],
      });
    const p = await plan(input());
    expect(p.mcp.map((m) => [m.n, m.from, m.env])).toEqual([
      ['stripe', '@core/auth', ['STRIPE_SECRET_KEY', 'STRIPE_ACCOUNT']],
    ]);
  });

  it('rejects direct specs without an immutable ref with E_REF_MUTABLE (cli-mcp-spec §A.4)', async () => {
    for (const spec of ['gh:genpm-net/db', 'gh:genpm-net/db#main'])
      await expect(plan(input({ specs: [spec] }))).rejects.toMatchObject({ code: 'E_REF_MUTABLE' });
    await expect(plan(input({ specs: ['core/db'] }))).rejects.toMatchObject({ code: 'E_USAGE' });
    expect(reg.requests).toEqual([]);
  });
});

describe('apply() · D2-G-02', () => {
  it('installs code, context, env and lock; MCP only with consent (INV-5)', async () => {
    const p = await plan(input());
    const r = await apply(p, { allowMcp: false, installNpmDeps: false, by: 'cli' });
    expect(r.installed.map((x) => x.n)).toEqual(['@core/auth', '@core/db']);
    expect(await read('src/lib/db/index.ts')).toBe('export const db = 1;\n');
    expect(await read('src/lib/db/AGENTS.md')).toBe(DB_RULES);
    await expect(stat(join(project, 'src/lib/db/tests'))).rejects.toThrow();
    await expect(stat(join(project, 'src/lib/db/genpm.json'))).rejects.toThrow();
    // INV-4: sin bits de ejecución aunque el origen los tuviera
    if (process.platform !== 'win32') expect((await stat(join(project, 'src/lib/db/bin.sh'))).mode & 0o777).toBe(0o644);
    expect(await read('src/lib/auth/CLAUDE.md')).toBe('@AGENTS.md\n');
    expect(await read('CLAUDE.md')).toContain('Own notes.');
    expect(await read('CLAUDE.md')).toContain('- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)');
    expect(await read('AGENTS.md')).toContain('<!-- genpm:index:start -->');
    expect(await read('.cursor/rules/genpm-core-auth.mdc')).toContain('globs: src/lib/auth/**');
    expect(await read('.env.example')).toBe(
      '# genpm:env:start\n# @core/auth\nAUTH_SECRET=\n# @core/db\nDATABASE_URL=\n# genpm:env:end\n',
    );
    await expect(stat(join(project, '.mcp.json'))).rejects.toThrow();
    expect(r.mcpWritten).toEqual([]);
    const lock = await read('genpm.lock');
    expect(lock.split('\n')[0]).toBe('{"$":1,');
    expect(lock).toContain(
      `"@core/auth":{"v":"1.2.0","r":"${authRepo.url}","t":"v1.2.0","c":"${authRepo.sha}","d":"src/lib/auth","x":"AGENTS.md","h":"sha256-`,
    );
    expect(lock).toMatch(/"sg":"dev1:/);
    const files = JSON.parse(await read('.genpm/files/core__db.json')) as { c: string; f: Record<string, string> };
    expect(files.c).toBe(dbRepo.sha);
    expect(Object.keys(files.f).sort()).toEqual(['AGENTS.md', 'bin.sh', 'index.ts', 'schema/users.ts']);
    expect(await read('.genpm/.gitignore')).toContain('tmp/');
    expect(r.next).toContain('Run pnpm add arctic@^3.0.0 drizzle-orm@^0.44.0');
  });

  it('writes MCP config after consent with env references, never values', async () => {
    const r = await apply(await plan(input()), { allowMcp: true, installNpmDeps: false, by: 'mcp' });
    expect(r.mcpWritten.sort()).toEqual(['.cursor/mcp.json', '.mcp.json']);
    expect(JSON.parse(await read('.mcp.json'))).toEqual({
      mcpServers: {
        stripe: { command: 'npx', args: ['-y', '@stripe/mcp'], env: { STRIPE_SECRET_KEY: '${STRIPE_SECRET_KEY}' } },
      },
    });
    expect(JSON.parse(await read('.cursor/mcp.json')).mcpServers.stripe.env.STRIPE_SECRET_KEY).toBe(
      '${env:STRIPE_SECRET_KEY}',
    );
    expect(await read('genpm.lock')).toMatch(/"@core\/auth":\{[^\n]*"m":1,"by":"mcp"/);
  });

  it('remove undoes everything it added: MCP servers, emptied files and the lock', async () => {
    // Caso real (2026-10-04): tras `genpm remove` quedaban .mcp.json, CLAUDE.md y .env.example vacíos y genpm.lock.
    await writeFile(join(project, '.cursor/mcp.json'), JSON.stringify({ mcpServers: { mine: { url: 'https://x' } } }));
    await apply(await plan(input()), { allowMcp: true, installNpmDeps: false, by: 'cli' });
    const { remove } = await import('../src/ops.js');
    const common = { cwd: project, registry: REGISTRY, fetchImpl: reg.fetch as typeof fetch, home: TEST_HOME };
    const r = await remove({ ...common, name: '@core/auth' });
    expect(r.mcpServers).toEqual(['stripe']);
    expect(r.next).toEqual([]);
    await remove({ ...common, name: '@core/db' });
    // Lo creado solo por GenPM desaparece; lo del usuario queda intacto.
    for (const gone of ['.mcp.json', 'genpm.lock', '.env.example', 'AGENTS.md'])
      await expect(stat(join(project, gone))).rejects.toThrow();
    expect(JSON.parse(await read('.cursor/mcp.json'))).toEqual({ mcpServers: { mine: { url: 'https://x' } } });
    expect(await read('CLAUDE.md')).toBe('# My app\n\nOwn notes.\n');
  });

  it('is idempotent: re-adding skips', async () => {
    await apply(await plan(input()), { allowMcp: false, installNpmDeps: false, by: 'cli' });
    const again = await plan(input());
    expect(again.packages.map((p) => p.action)).toEqual(['skip', 'skip']);
    const r = await apply(again, { allowMcp: false, installNpmDeps: false, by: 'cli' });
    expect(r.installed).toEqual([]);
  });

  it('reuses an installed dependency that satisfies the range', async () => {
    await apply(await plan(input({ specs: ['@core/db'] })), { allowMcp: false, installNpmDeps: false, by: 'cli' });
    const p = await plan(input());
    expect(p.packages.find((x) => x.n === '@core/db')?.action).toBe('skip');
    expect(reg.requests.filter((u) => u.includes('/resolve')).at(-1)).toContain('installed=%40core%2Fdb%401.0.3');
  });

  it('reports conflicts instead of overwriting user code; --force backs up first', async () => {
    await mkdir(join(project, 'src/lib/auth'), { recursive: true });
    await writeFile(join(project, 'src/lib/auth/mine.ts'), 'user code');
    const p = await plan(input());
    expect(p.conflicts).toEqual([
      {
        code: 'E_DEST_CONFLICT',
        n: '@core/auth',
        path: 'src/lib/auth',
        detail: 'src/lib/auth exists and is not empty',
        fix: 'Use --dest <dir> or --force (backs up first).',
      },
    ]);
    await expect(apply(p, { allowMcp: false, installNpmDeps: false, by: 'cli' })).rejects.toMatchObject({
      code: 'E_DEST_CONFLICT',
    });
    expect(await read('src/lib/auth/mine.ts')).toBe('user code');
    const forced = await plan(input({ force: true }));
    expect(forced.conflicts).toEqual([]);
    await apply(forced, { allowMcp: false, installNpmDeps: false, by: 'cli' });
    const backups = await readdir(join(project, '.genpm/backup'));
    expect(await readFile(join(project, '.genpm/backup', backups[0]!, 'src/lib/auth/mine.ts'), 'utf8')).toBe(
      'user code',
    );
  });

  it('supports --dest for a single package', async () => {
    await apply(await plan(input({ specs: ['@core/db'], dest: 'packages/db' })), {
      allowMcp: false,
      installNpmDeps: false,
      by: 'cli',
    });
    expect(await read('packages/db/index.ts')).toBe('export const db = 1;\n');
    expect(await read('genpm.lock')).toContain('"d":"packages/db"');
    await expect(plan(input({ specs: ['@core/db', '@core/auth'], dest: 'x' }))).rejects.toMatchObject({
      code: 'E_USAGE',
    });
    await expect(plan(input({ specs: ['@core/db'], dest: '../outside' }))).rejects.toMatchObject({
      code: 'E_PATH_UNSAFE',
    });
  });

  it('fails with E_PLAN_STALE if the project changed after plan()', async () => {
    const p = await plan(input());
    await mkdir(join(project, 'src/lib/db'), { recursive: true });
    await writeFile(join(project, 'src/lib/db/x.ts'), 'x');
    await expect(apply(p, { allowMcp: false, installNpmDeps: false, by: 'cli' })).rejects.toMatchObject({
      code: 'E_PLAN_STALE',
    });
  });

  it('fails with E_BUSY while another process holds the lock', async () => {
    await mkdir(join(project, '.genpm'), { recursive: true });
    await writeFile(join(project, '.genpm/.lock'), JSON.stringify({ pid: process.pid, ts: Date.now() }));
    await expect(
      apply(await plan(input()), { allowMcp: false, installNpmDeps: false, by: 'cli' }),
    ).rejects.toMatchObject({ code: 'E_BUSY' });
  });
});

describe('rollback · D2-G-03', () => {
  for (const step of ['staged:@core/auth', 'copied:@core/auth', 'copied:@core/db', 'context', 'env', 'mcp', 'lock']) {
    it(`a failure after "${step}" leaves the disk identical`, async () => {
      const snapshot = async () => {
        const out: Record<string, string> = {};
        const walk = async (dir: string, rel = '') => {
          for (const e of await readdir(dir, { withFileTypes: true })) {
            const r = rel ? `${rel}/${e.name}` : e.name;
            if (e.isDirectory()) await walk(join(dir, e.name), r);
            else out[r] = await readFile(join(dir, e.name), 'utf8');
          }
        };
        await walk(project);
        return out;
      };
      const before = await snapshot();
      const p = await plan(input());
      await expect(
        apply(p, {
          allowMcp: true,
          installNpmDeps: false,
          by: 'cli',
          onStep: (s) => {
            if (s === step) throw new Error('injected failure');
          },
        }),
      ).rejects.toThrow('injected failure');
      const after = await snapshot();
      delete after['.genpm/.gitignore'];
      expect(after).toEqual(before);
      expect((await readdir(project)).filter((f) => f !== '.genpm').sort()).toEqual([
        '.cursor',
        'CLAUDE.md',
        'package.json',
        'pnpm-lock.yaml',
      ]);
    });
  }
});

describe('INV-8 signatures', () => {
  it('rejects a manifest altered in transit', async () => {
    reg.tamper = (m) => {
      if (m.n === '@core/db') m.c = 'f'.repeat(40);
    };
    await expect(plan(input())).rejects.toMatchObject({ code: 'E_SIGNATURE' });
  });
  it('rejects unsigned manifests and dev keys against non-local registries', async () => {
    reg.tamper = (m) => {
      delete m.sg;
    };
    await expect(plan(input())).rejects.toMatchObject({ code: 'E_SIGNATURE' });
    reg.tamper = null;
    await expect(plan(input({ registry: 'https://api.genpm.net' }))).rejects.toMatchObject({ code: 'E_SIGNATURE' });
  });
  it('rejects manifests signed with a key revoked by the root-signed list (D6-S-08)', async () => {
    const kp = (await webcrypto.subtle.generateKey({ name: 'Ed25519' }, true, [
      'sign',
      'verify',
    ])) as webcrypto.CryptoKeyPair;
    const rootPub = Buffer.from(await webcrypto.subtle.exportKey('raw', kp.publicKey)).toString('base64url');
    const base = { v: 1 as const, issuedAt: Date.now(), revoked: ['dev1'] };
    reg.revocation = { ...base, sig: await signBytes(kp.privateKey, revocationPayload(base)) };
    process.env['GENPM_ROOT_PUBLIC_KEY'] = rootPub;
    try {
      await expect(plan(input())).rejects.toMatchObject({ code: 'E_SIGNATURE', details: { reason: 'revoked_key' } });
      // El registry deja de servir la lista: la revocación ya conocida sigue aplicándose.
      reg.revocation = null;
      await expect(plan(input())).rejects.toMatchObject({ code: 'E_SIGNATURE' });
    } finally {
      delete process.env['GENPM_ROOT_PUBLIC_KEY'];
    }
    await expect(plan(input())).resolves.toBeTruthy();
  });
  it('refreshes only the lock signature when the registry re-signed the same commit (key rotation)', async () => {
    await apply(await plan(input({ specs: ['@core/db'] })), { allowMcp: false, installNpmDeps: false, by: 'cli' });
    const current = await read('genpm.lock');
    const sg = current.match(/"sg":"([^"]+)"/)![1]!;
    const stale = `old1:${'A'.repeat(86)}`;
    await writeFile(join(project, 'genpm.lock'), current.replace(sg, stale));
    const before = await read('src/lib/db/index.ts');
    const p = await plan(input({ specs: ['@core/db'] }));
    expect(p.resign).toEqual(['@core/db']);
    expect(p.packages.every((x) => x.action === 'skip')).toBe(true);
    const r = await apply(p, { allowMcp: false, installNpmDeps: false, by: 'cli' });
    expect(r.installed).toEqual([]);
    expect(await read('genpm.lock')).toContain(`"sg":"${sg}"`);
    expect(await read('src/lib/db/index.ts')).toBe(before);
    expect((await plan(input({ specs: ['@core/db'] }))).resign).toEqual([]);
  });
  it('refuses quarantined packages', async () => {
    reg.scan['@core/db'] = 'flagged';
    await expect(plan(input())).rejects.toMatchObject({ code: 'E_QUARANTINED' });
  });
});

describe('client-side scan (security §3.1, double verification)', () => {
  it('aborts on autorun files, secrets and symlinks unless explicitly allowed', async () => {
    const evil = await makeRepo({ 'AGENTS.md': '# x', 'package.json': '{"scripts":{"postinstall":"node x"}}' });
    reg.add({ n: '@evil/a', v: '1.0.0', r: evil.url, c: evil.sha, d: 'src/a' });
    await expect(plan(input({ specs: ['@evil/a'] }))).rejects.toMatchObject({ code: 'E_AUTORUN_FILE' });
    const allowed = await plan(input({ specs: ['@evil/a'], allowAutorun: true }));
    expect(allowed.warnings.map((w) => w.code)).toContain('W_AUTORUN_ALLOWED');
    const secret = await makeRepo({ 'k.ts': 'const k = "AKIAABCDEFGHIJKLMNOP";' });
    reg.add({ n: '@evil/b', v: '1.0.0', r: secret.url, c: secret.sha, d: 'src/b' });
    await expect(plan(input({ specs: ['@evil/b'] }))).rejects.toMatchObject({ code: 'E_SCAN_FAILED' });
    const link = await makeRepo({ 'x.ts': 'x', l: { content: '', symlink: '../../../etc' } });
    reg.add({ n: '@evil/c', v: '1.0.0', r: link.url, c: link.sha, d: 'src/c' });
    await expect(plan(input({ specs: ['@evil/c'] }))).rejects.toMatchObject({ code: 'E_PATH_UNSAFE' });
  });
  it('rejects unsafe destinations coming from the registry (INV-3)', async () => {
    reg.add({ n: '@evil/d', v: '1.0.0', r: dbRepo.url, c: dbRepo.sha, d: '../../.ssh' });
    await expect(plan(input({ specs: ['@evil/d'] }))).rejects.toMatchObject({ code: 'E_PATH_UNSAFE' });
    reg.add({ n: '@evil/e', v: '1.0.0', r: dbRepo.url, c: dbRepo.sha, d: '.git/hooks' });
    await expect(plan(input({ specs: ['@evil/e'] }))).rejects.toMatchObject({ code: 'E_PATH_UNSAFE' });
  });
  it('rejects every destination of the security §8.2 corpus end to end (D6-S-02)', async () => {
    const corpus = [
      '../x',
      '..\\x',
      '%2e%2e/x',
      'src/../../x',
      '/etc/x',
      'C:\\x',
      '\\\\server\\share',
      '~/x',
      'src/\u0000x',
      'src/CON',
      'src/aux.ts',
      'src/x.',
      'src/x ',
      'src/e\u0301',
      `src/${'a'.repeat(300)}`,
    ];
    for (const [i, d] of corpus.entries()) {
      reg.add({ n: `@evil/d${i}`, v: '1.0.0', r: dbRepo.url, c: dbRepo.sha, d });
      await expect(plan(input({ specs: [`@evil/d${i}`] })), JSON.stringify(d)).rejects.toMatchObject({
        code: 'E_PATH_UNSAFE',
      });
    }
    expect(await readdir(project)).not.toContain('src');
  });
  it('rejects unsafe file names inside the package tree (reserved, NFD, trailing dot)', async () => {
    for (const [i, name] of ['lib/aux.ts', 'lib/e\u0301.ts', 'lib/x.'].entries()) {
      const repo = await makeRepo({ 'AGENTS.md': '# x' });
      // El nombre se mete en el \u00e1rbol con plumbing: el disco (APFS/NTFS) o core.precomposeunicode lo alterar\u00edan.
      const git = (args: string[], stdin?: string) =>
        execFileSync(
          'git',
          [
            '-c',
            'core.precomposeunicode=false',
            '-c',
            'core.protectNTFS=false',
            '-c',
            'user.name=t',
            '-c',
            'user.email=t@t',
            ...args,
          ],
          {
            cwd: repo.dir,
            input: stdin,
          },
        )
          .toString()
          .trim();
      const blob = git(['hash-object', '-w', '--stdin'], 'x');
      git(['update-index', '--add', '--cacheinfo', `100644,${blob},${name}`]);
      const sha = git(['commit-tree', git(['write-tree']), '-p', 'HEAD', '-m', 'evil']);
      git(['update-ref', 'HEAD', sha]);
      expect(git(['ls-tree', '-r', '-z', '--name-only', sha]).split('\0')).toContain(name);
      reg.add({ n: `@evil/t${i}`, v: '1.0.0', r: repo.url, c: sha, d: `src/t${i}` });
      await expect(plan(input({ specs: [`@evil/t${i}`] })), name).rejects.toMatchObject({ code: 'E_PATH_UNSAFE' });
    }
  });
});
