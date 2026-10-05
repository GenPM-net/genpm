// D3-B-09 / D3-B-11: salida humana y --json de los comandos, NO_COLOR/no-TTY (E_CONFIRM_REQUIRED) y exit codes.
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { __setFetchTestDefaults } from '@genpm/core';
import { exitCode } from '@genpm/manifest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeRegistry, REGISTRY } from '../../core/test/fake-registry.js';
import { makeRepo } from '../../core/test/git-fixture.js';
import { main } from '../src/main.js';

let reg: FakeRegistry;
let project: string;
let home: string;
const realFetch = globalThis.fetch;
let repos: Record<string, Awaited<ReturnType<typeof makeRepo>>>;

beforeAll(async () => {
  __setFetchTestDefaults({ allowFileProtocol: true, cacheDir: await mkdtemp(join(tmpdir(), 'genpm-clicache-')) });
  repos = {
    db: await makeRepo({ 'AGENTS.md': '# @core/db rules\n', 'index.ts': 'export const db = 1;\n' }),
    auth: await makeRepo({ 'AGENTS.md': '# @core/auth rules\n', 'index.ts': 'export const auth = 1;\n' }),
  };
});
afterAll(() => {
  globalThis.fetch = realFetch;
  __setFetchTestDefaults({});
});

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'genpm-cli-'));
  home = await mkdtemp(join(tmpdir(), 'genpm-clihome-'));
  await writeFile(join(project, 'package.json'), '{"name":"app"}');
  await writeFile(join(project, 'pnpm-lock.yaml'), '');
  await mkdir(join(project, '.cursor'));
  reg = new FakeRegistry()
    .add({
      n: '@core/db',
      v: '1.0.3',
      r: repos.db!.url,
      c: repos.db!.sha,
      d: 'src/lib/db',
      s: { en: 'Drizzle client', es: 'Cliente Drizzle' },
      p: { 'drizzle-orm': '^0.44.0' },
      e: ['DATABASE_URL'],
    })
    .add({
      n: '@core/auth',
      v: '1.2.0',
      r: repos.auth!.url,
      c: repos.auth!.sha,
      d: 'src/lib/auth',
      s: 'Sessions + OAuth',
      g: { '@core/db': '^1.0.0' },
      e: ['AUTH_SECRET'],
      m: [{ n: 'stripe', c: 'npx', a: ['-y', '@stripe/mcp'], e: ['STRIPE_SECRET_KEY'] }],
    });
  globalThis.fetch = reg.fetch as typeof fetch;
});

async function cli(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const o = process.stdout.write.bind(process.stdout);
  const e = process.stderr.write.bind(process.stderr);
  process.stdout.write = ((s: string) => {
    out.push(String(s));
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((s: string) => {
    err.push(String(s));
    return true;
  }) as typeof process.stderr.write;
  const env = { ...process.env };
  process.env['HOME'] = home;
  process.env['GENPM_REGISTRY'] = REGISTRY;
  process.env['NO_COLOR'] = '1';
  process.env['GENPM_LANG'] = 'en';
  delete process.env['GENPM_TOKEN'];
  process.exitCode = 0;
  try {
    await main([...args, '--cwd', project]);
  } finally {
    process.stdout.write = o;
    process.stderr.write = e;
    process.env = env;
  }
  const code = process.exitCode ?? 0;
  process.exitCode = 0;
  const norm = (s: string) =>
    s
      .replaceAll(project, '<project>')
      .replaceAll(repos.db!.sha, '<db-sha>')
      .replaceAll(repos.auth!.sha, '<auth-sha>')
      .replaceAll(repos.db!.sha.slice(0, 7), '<db7>')
      .replaceAll(repos.auth!.sha.slice(0, 7), '<auth7>')
      .replace(/in \d+(\.\d)?s/g, 'in <t>s')
      .replace(/"durationMs":\d+/g, '"durationMs":0')
      .replace(/"id":"[0-9a-f]{16}"/g, '"id":"<plan>"')
      .replaceAll(repos.db!.url, '<db-repo>')
      .replaceAll(repos.auth!.url, '<auth-repo>');
  return { stdout: norm(out.join('')), stderr: norm(err.join('')), code };
}

describe('genpm add', () => {
  it('prints the plan on --dry-run without writing', async () => {
    const r = await cli('add', '@core/auth', '--dry-run');
    expect(r.code).toBe(0);
    // Una simulación no suma al contador de instalaciones (ADR-027).
    expect(reg.requests.filter((u) => u.startsWith('/v1/resolve/')).at(-1)).toContain('client=none');
    expect(r.stdout).toMatchSnapshot();
    expect(await readFile(join(project, 'genpm.lock'), 'utf8').catch(() => null)).toBeNull();
  });
  it('requires confirmation when not interactive (E_CONFIRM_REQUIRED, exit 2)', async () => {
    const r = await cli('add', '@core/auth');
    expect(r.code).toBe(2);
    expect(r.stderr).toContain('E_CONFIRM_REQUIRED');
    expect(r.stderr).toContain('--yes');
  });
  it('installs with --yes, never MCP or npm without their own flags', async () => {
    const r = await cli('add', '@core/auth', '--yes');
    expect(r.code).toBe(0);
    expect(r.stdout).toMatchSnapshot();
    await expect(readFile(join(project, '.mcp.json'), 'utf8')).rejects.toThrow();
  });
  it('emits a single JSON line with --json', async () => {
    const r = await cli('add', '@core/auth', '--json', '--yes', '--mcp');
    expect(r.code).toBe(0);
    expect(r.stdout.trim().split('\n')).toHaveLength(1);
    const j = JSON.parse(r.stdout);
    expect(j.ok).toBe(true);
    expect(j.result.mcpWritten).toEqual(['.cursor/mcp.json']);
    expect(j.plan.packages.map((p: { n: string }) => p.n)).toEqual(['@core/auth', '@core/db']);
  });
  it('reports conflicts with exit 4 and a fix', async () => {
    await mkdir(join(project, 'src/lib/db'), { recursive: true });
    await writeFile(join(project, 'src/lib/db/mine.ts'), 'x');
    const r = await cli('add', '@core/db', '--yes');
    expect(r.code).toBe(4);
    expect(r.stderr).toMatchSnapshot();
    const j = await cli('add', '@core/db', '--yes', '--json');
    expect(JSON.parse(j.stdout).error).toMatchObject({
      code: 'E_DEST_CONFLICT',
      fix: 'Use --dest <dir> or --force (backs up first).',
    });
  });
  it('translates human output with --lang es but keeps --json in English', async () => {
    const r = await cli('add', '@core/db', '--dry-run', '--lang', 'es');
    expect(r.stdout).toContain('Resuelto');
    const j = await cli('add', '@core/nope', '--json', '--lang', 'es');
    expect(j.code).toBe(3);
    expect(JSON.parse(j.stdout).error.message).toBe('@core/nope was not found.');
  });
  it('translates errors without params too (E_AUTH)', async () => {
    const r = await cli('publish', '--lang', 'es');
    expect(r.code).toBe(exitCode('E_AUTH'));
    expect(r.stderr).toContain('No has iniciado sesión');
    expect(r.stderr).toContain('genpm login');
  });
});

describe('genpm compose (V03-05)', () => {
  it('lists recipes and installs every package of one with the add flow', async () => {
    reg.recipes['saas-starter'] = { summary: 'DB + auth', p: ['@core/db', '@core/auth'] };
    const ls = await cli('compose', '--list');
    expect(ls.stdout).toContain('saas-starter');
    expect(ls.stdout).toContain('@core/db @core/auth');
    const dry = await cli('compose', 'saas-starter', '--dry-run');
    expect(dry.code).toBe(0);
    expect(dry.stdout).toContain('genpm compose saas-starter → @core/db @core/auth');
    const r = await cli('compose', 'saas-starter', '--yes', '--json');
    expect(r.code).toBe(0);
    const out = JSON.parse(r.stdout) as { result: { installed: Array<{ n: string }> } };
    expect(out.result.installed.map((x) => x.n).sort()).toEqual(['@core/auth', '@core/db']);
  });
  it('accepts a local recipe file and rejects invalid ones', async () => {
    await writeFile(join(project, 'stack.json'), JSON.stringify({ name: 'stack', p: ['@core/db'] }));
    expect((await cli('compose', './stack.json', '--dry-run')).stdout).toContain('genpm compose stack → @core/db');
    await writeFile(join(project, 'bad.json'), JSON.stringify({ name: 'bad', p: ['gh:x/y#v1'] }));
    const bad = await cli('compose', './bad.json', '--dry-run');
    expect(bad.code).not.toBe(0);
    expect(bad.stderr).toContain('E_MANIFEST_INVALID');
  });
});

describe('genpm update and diff', () => {
  it('shows the upstream diff, merges local edits and exits 4 on conflicts', async () => {
    expect((await cli('add', '@core/auth', '--yes')).code).toBe(0);
    const sha = await repos.auth!.commit({
      'AGENTS.md': '# @core/auth rules\n',
      'index.ts': 'export const auth = 2;\n',
      'extra.ts': 'export {};\n',
    });
    reg.add({ n: '@core/auth', v: '1.3.0', r: repos.auth!.url, c: sha, d: 'src/lib/auth', s: 'Sessions + OAuth' });
    const d = await cli('diff', '@core/auth');
    expect(d.code).toBe(0);
    expect(d.stdout).toContain('diff --git a/src/lib/auth/index.ts b/src/lib/auth/index.ts');
    expect(d.stdout).toContain('+export const auth = 2;');
    expect(d.stderr).toContain('@core/auth 1.2.0 → 1.3.0');
    // Conflicto: la misma línea cambiada en local y upstream.
    await writeFile(join(project, 'src/lib/auth/index.ts'), 'export const auth = 99;\n');
    const dry = await cli('update', '@core/auth', '--dry-run');
    expect(dry.stdout).toContain('1.2.0 → 1.3.0');
    expect(dry.stdout).toContain('Dry run');
    const u = await cli('update', '@core/auth', '--yes');
    expect(u.code).toBe(4);
    expect(u.stdout).toContain('Updated @core/auth 1.2.0 → 1.3.0');
    expect(u.stdout).toContain('src/lib/auth/index.ts');
    expect(await readFile(join(project, 'src/lib/auth/extra.ts'), 'utf8')).toBe('export {};\n');
    expect(await readFile(join(project, 'src/lib/auth/index.ts'), 'utf8')).toContain('<<<<<<< local');
    expect((await cli('update', '@core/auth', '--yes')).stdout).toContain('Everything is up to date.');
    expect((await cli('update', '@core/nope', '--yes')).stderr).toContain('E_NOT_FOUND');
  });
});

describe('other commands', () => {
  it('search', async () => {
    const r = await cli('search', 'auth');
    expect(r.stdout).toMatchSnapshot();
    const j = await cli('search', 'auth', '--json');
    expect(JSON.parse(j.stdout).r[0].n).toBe('@core/auth');
  });
  it('list, outdated, remove with drift', async () => {
    await cli('add', '@core/auth', '--yes');
    await writeFile(join(project, 'src/lib/auth/index.ts'), 'changed');
    const l = await cli('list');
    expect(l.stdout).toMatchSnapshot();
    expect(JSON.parse((await cli('list', '--json')).stdout)[0]).toMatchObject({
      n: '@core/auth',
      drift: { modified: ['index.ts'] },
    });
    const rm = await cli('remove', '@core/auth');
    expect(rm.code).toBe(4);
    expect(rm.stderr).toContain('E_DRIFT');
    expect((await cli('remove', '@core/auth', '--keep-code')).code).toBe(0);
    expect((await cli('outdated', '--json')).stdout).toBe('{"o":[]}\n');
  });
  it('outdated --exit-code exits with 4 when there are newer versions', async () => {
    await cli('add', '@core/db', '--yes');
    expect((await cli('outdated', '--exit-code')).code).toBe(0);
    reg.add({ n: '@core/db', v: '2.0.0', r: repos.db!.url, c: repos.db!.sha, d: 'src/lib/db' });
    const r = await cli('outdated', '--exit-code');
    expect(r.code).toBe(4);
    expect(r.stdout).toContain('1.0.3 → 2.0.0');
    expect(r.stdout).toContain('major');
    expect(JSON.parse((await cli('outdated', '--json')).stdout)).toEqual({
      o: [{ n: '@core/db', v: '1.0.3', latest: '2.0.0', kind: 'major', drift: 0 }],
    });
  });
  it('info prints the manifest and rules', async () => {
    const r = await cli('info', '@core/db');
    expect(r.stdout).toMatchSnapshot();
    expect((await cli('info', '@core/db', '--rules')).stdout).toBe('# @core/db rules\n');
    expect(JSON.parse((await cli('info', '@core/db', '--json')).stdout).legend).toMatch(/^genpm keys:/);
  });
  it('audit and doctor', async () => {
    await cli('add', '@core/db', '--yes');
    const a = await cli('audit', '--json');
    expect(JSON.parse(a.stdout)).toEqual({ ok: true, findings: [] });
    const d = await cli('doctor', '--json');
    expect(JSON.parse(d.stdout).checks.map((c: { id: string }) => c.id)).toEqual([
      'node',
      'git',
      'language',
      'project',
      'clients',
      'package-manager',
      'lock',
      'registry',
      'login',
    ]);
  });
  it('init + validate for authors', async () => {
    const i = await cli('init', '--yes');
    expect(i.code).toBe(0);
    const v = await cli('validate', '--json');
    expect(JSON.parse(v.stdout)).toMatchObject({ ok: true, errors: [] });
  });
  it('whoami without a token and mcp setup in the project', async () => {
    expect((await cli('whoami')).stdout).toBe('Not logged in. Run genpm login.\n');
    const s = await cli('mcp', 'setup', '--client', 'cursor', '--yes', '--json');
    expect(JSON.parse(s.stdout).results[0]).toMatchObject({ client: 'cursor', written: true });
    expect(JSON.parse(await readFile(join(project, '.cursor/mcp.json'), 'utf8'))).toEqual({
      mcpServers: { genpm: { command: 'npx', args: ['-y', '@genpm-net/mcp'] } },
    });
    const s2 = await cli('mcp', 'setup', '--client', 'claude', '--scope', 'user', '--json');
    expect(JSON.parse(s2.stdout).results[0].command).toBe('claude mcp add genpm -- npx -y @genpm-net/mcp');
  });
  it('upgrade --check reports a newer release; upgrading an npm/npx install points to its package manager', async () => {
    const regFetch = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) =>
      String(input) === 'https://github.com/genpm-net/genpm-releases/releases/latest'
        ? new Response(null, { status: 302, headers: { location: '/genpm-net/genpm/releases/tag/v99.0.0' } })
        : regFetch(input, init)) as typeof fetch;
    try {
      const c = await cli('upgrade', '--check', '--json');
      expect(JSON.parse(c.stdout)).toMatchObject({
        ok: true,
        latest: '99.0.0',
        upToDate: false,
        method: expect.stringMatching(/^(npm|npx)$/),
      });
      expect((await cli('upgrade', '--check')).stdout).toMatch(/genpm 99\.0\.0 is available .*Run genpm upgrade/);
      const u = await cli('upgrade', '--json');
      expect(u.code).toBe(8);
      expect(JSON.parse(u.stdout).error).toMatchObject({
        code: 'E_UPGRADE_UNSUPPORTED',
        fix: expect.stringContaining('@genpm-net/cli@latest'),
      });
    } finally {
      globalThis.fetch = regFetch;
    }
  });
});
