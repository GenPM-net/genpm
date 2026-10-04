// list (drift), remove (E_DRIFT, E_REQUIRED_BY), outdated, audit, credentials, validate, init, publish, doctor.
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { apply } from '../src/apply.js';
import { init, normalizeGitRemote, validate } from '../src/author.js';
import { getToken, pollDeviceFlow, removeToken, saveToken } from '../src/credentials.js';
import { doctor } from '../src/doctor.js';
import { audit, list, outdated, remove } from '../src/ops.js';
import { plan } from '../src/plan.js';
import { FakeRegistry, REGISTRY } from './fake-registry.js';
import { makeRepo } from './git-fixture.js';

// Directorio personal ficticio, distinto del proyecto: findRoot nunca acepta el propio ~ como proyecto.
const TEST_HOME = join(tmpdir(), 'genpm-test-home');

let reg: FakeRegistry;
let cacheDir: string;
let project: string;
let repos: Record<string, Awaited<ReturnType<typeof makeRepo>>>;

beforeAll(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'genpm-ocache-'));
  repos = {
    db: await makeRepo({ 'AGENTS.md': '# db', 'index.ts': 'export const db = 1;\n' }),
    auth: await makeRepo({ 'AGENTS.md': '# auth', 'index.ts': 'export const auth = 1;\n' }),
  };
});

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), 'genpm-oproj-'));
  await writeFile(join(project, 'package.json'), '{}');
  await writeFile(join(project, 'CLAUDE.md'), '# app\n');
  reg = new FakeRegistry()
    .add({ n: '@core/db', v: '1.0.3', r: repos.db!.url, c: repos.db!.sha, d: 'src/lib/db', e: ['DATABASE_URL'] })
    .add({
      n: '@core/auth',
      v: '1.2.0',
      r: repos.auth!.url,
      c: repos.auth!.sha,
      d: 'src/lib/auth',
      g: { '@core/db': '^1.0.0' },
      e: ['AUTH_SECRET'],
    });
});

const common = () => ({
  cwd: project,
  registry: REGISTRY,
  fetchImpl: reg.fetch as typeof fetch,
  fetch: { cacheDir, allowFileProtocol: true },
  home: TEST_HOME,
});
const install = async (spec: string) =>
  apply(await plan({ specs: [spec], ...common() }), { allowMcp: false, installNpmDeps: false, by: 'cli' });

describe('list & remove', () => {
  it('reports drift and blocks removal of modified code (E_DRIFT with fix)', async () => {
    await install('@core/auth');
    expect((await list(common())).map((p) => [p.n, p.drift])).toEqual([
      ['@core/auth', { modified: [], deleted: [], added: [] }],
      ['@core/db', { modified: [], deleted: [], added: [] }],
    ]);
    await writeFile(join(project, 'src/lib/auth/index.ts'), 'export const auth = 2;\n');
    await writeFile(join(project, 'src/lib/auth/extra.ts'), 'x');
    const [authPkg] = await list(common());
    expect(authPkg!.drift).toEqual({ modified: ['index.ts'], deleted: [], added: ['extra.ts'] });
    await expect(remove({ ...common(), name: '@core/auth' })).rejects.toMatchObject({
      code: 'E_DRIFT',
      fix: 'Use --keep-code to keep your code, or --force to delete it anyway.',
    });
    await expect(remove({ ...common(), name: '@core/auth', client: 'mcp' })).rejects.toMatchObject({
      fix: 'Ask the user; retry with keepCode:true to keep their modified code',
    });
    const kept = await remove({ ...common(), name: '@core/auth', keepCode: true });
    expect(kept.keptCode).toBe(true);
    expect(await readFile(join(project, 'src/lib/auth/index.ts'), 'utf8')).toBe('export const auth = 2;\n');
    expect(await readFile(join(project, 'genpm.lock'), 'utf8')).not.toContain('@core/auth');
  });

  it('refuses to remove a dependency still required (E_REQUIRED_BY) and cleans context on remove', async () => {
    await install('@core/auth');
    await expect(remove({ ...common(), name: '@core/db' })).rejects.toMatchObject({ code: 'E_REQUIRED_BY' });
    const r = await remove({ ...common(), name: '@core/auth' });
    expect(r.deleted).toContain('src/lib/auth');
    await expect(stat(join(project, 'src/lib/auth'))).rejects.toThrow();
    const claude = await readFile(join(project, 'CLAUDE.md'), 'utf8');
    expect(claude).toContain('@core/db@1.0.3');
    expect(claude).not.toContain('@core/auth');
    expect(await readFile(join(project, '.env.example'), 'utf8')).toBe(
      '# genpm:env:start\n# @core/db\nDATABASE_URL=\n# genpm:env:end\n',
    );
    await remove({ ...common(), name: '@core/db' });
    expect(await readFile(join(project, 'CLAUDE.md'), 'utf8')).toBe('# app\n');
    await expect(stat(join(project, '.env.example'))).rejects.toThrow(); // vacío tras quitar el último paquete: se borra
    await expect(remove({ ...common(), name: '@core/db' })).rejects.toMatchObject({ code: 'E_NOT_FOUND' });
  });
});

describe('outdated & audit', () => {
  it('compares the lock with the latest versions', async () => {
    await install('@core/db');
    reg.add({ n: '@core/db', v: '2.0.0', r: repos.db!.url, c: repos.db!.sha, d: 'src/lib/db' });
    expect(await outdated(common())).toEqual([{ n: '@core/db', v: '1.0.3', latest: '2.0.0', kind: 'major', drift: 0 }]);
  });
  it('detects tampering of the lock / files index', async () => {
    await install('@core/db');
    const offline = {
      ...common(),
      fetchImpl: (async () => {
        throw new TypeError('offline');
      }) as unknown as typeof fetch,
    };
    expect((await audit(offline)).findings).toEqual([]);
    const idx = join(project, '.genpm/files/core__db.json');
    const j = JSON.parse(await readFile(idx, 'utf8'));
    j.f['index.ts'] = 'sha256-AAAA';
    await writeFile(idx, JSON.stringify(j));
    const report = await audit(offline);
    expect(report.ok).toBe(false);
    expect(report.findings[0]).toMatchObject({ n: '@core/db', kind: 'tamper', severity: 'high' });
  });
});

describe('credentials (security §4.2)', () => {
  it('stores tokens with 0600, prefers GENPM_TOKEN and refuses insecure files', async () => {
    const home = await mkdtemp(join(tmpdir(), 'genpm-cred-'));
    const path = await saveToken('https://api.genpm.net', { token: 'gpm_x', expiresAt: null, handle: 'me' }, home);
    if (process.platform !== 'win32') expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(await getToken('https://api.genpm.net', { env: {}, home })).toBe('gpm_x');
    expect(await getToken('https://api.genpm.net', { env: { GENPM_TOKEN: 'gpm_ci' }, home })).toBe('gpm_ci');
    expect(await getToken('https://other', { env: {}, home })).toBeNull();
    if (process.platform !== 'win32') {
      await chmod(path, 0o644);
      await expect(getToken('https://api.genpm.net', { env: {}, home })).rejects.toMatchObject({
        code: 'E_INSECURE_PERMS',
      });
      await chmod(path, 0o600);
    }
    expect(await removeToken('https://api.genpm.net', home)).toBe(true);
    expect(await removeToken('https://api.genpm.net', home)).toBe(false);
    await saveToken(
      'https://api.genpm.net',
      { token: 'gpm_old', expiresAt: '2000-01-01T00:00:00Z', handle: 'me' },
      home,
    );
    expect(await getToken('https://api.genpm.net', { env: {}, home })).toBeNull();
  });
  it('polls the device flow until GitHub returns a token', async () => {
    const answers = [
      { error: 'authorization_pending' },
      { error: 'slow_down', interval: 1 },
      { access_token: 'gho_ok' },
    ];
    const fetchImpl = (async () => new Response(JSON.stringify(answers.shift()))) as unknown as typeof fetch;
    let t = 0;
    const token = await pollDeviceFlow(
      'cid',
      {
        device_code: 'd',
        user_code: 'U',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 0,
      },
      { fetchImpl, sleep: async () => {}, now: () => t++ },
    );
    expect(token).toBe('gho_ok');
    const denied = (async () => new Response(JSON.stringify({ error: 'access_denied' }))) as unknown as typeof fetch;
    await expect(
      pollDeviceFlow(
        'cid',
        { device_code: 'd', user_code: 'U', verification_uri: '', expires_in: 900, interval: 0 },
        { fetchImpl: denied, sleep: async () => {} },
      ),
    ).rejects.toMatchObject({ code: 'E_AUTH' });
  });
});

describe('author: init & validate', () => {
  it('scaffolds a package that validates', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genpm-author-'));
    await writeFile(join(dir, 'LICENSE'), 'MIT License\n\nCopyright');
    await writeFile(join(dir, 'index.ts'), 'export {};\n');
    const r = await init({
      cwd: dir,
      answers: { n: '@acme/kit', s: 'Acme kit', d: 'src/lib/kit', k: ['kit'] },
      workflow: true,
    });
    expect(r.written).toEqual(['genpm.json', 'AGENTS.md', '.genpmignore', '.github/workflows/genpm-publish.yml']);
    expect(JSON.parse(await readFile(join(dir, 'genpm.json'), 'utf8'))).toEqual({
      $: 1,
      n: '@acme/kit',
      v: '0.1.0',
      s: { en: 'Acme kit' },
      d: 'src/lib/kit',
      x: 'AGENTS.md',
      l: 'MIT',
      k: ['kit'],
    });
    await expect(init({ cwd: dir, answers: { n: '@acme/kit', d: 'src/x' } })).rejects.toMatchObject({
      code: 'E_DEST_CONFLICT',
    });
    const v = await validate({ cwd: dir });
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
    expect(v.fileList).toEqual(['AGENTS.md', 'LICENSE', 'index.ts']);
    expect(v.rulesTokens).toBeGreaterThan(0);
  });
  it('reports schema errors, missing rules, secrets, autorun and symlinks', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genpm-author2-'));
    expect((await validate({ cwd: dir })).errors[0]?.code).toBe('E_MANIFEST_INVALID');
    await writeFile(join(dir, 'genpm.json'), '{"n":"@a/b","v":"1.0.0","d":"../x"}');
    expect((await validate({ cwd: dir })).errors[0]?.code).toBe('E_PATH_UNSAFE');
    await writeFile(join(dir, 'genpm.json'), '{"n":"@a/b","v":"1.0.0","d":"src/x","x":"RULES.md"}');
    await writeFile(join(dir, 'package.json'), '{"scripts":{"postinstall":"x"}}');
    await writeFile(join(dir, 'k.ts'), 'const k = "AKIAABCDEFGHIJKLMNOP";');
    const { symlink } = await import('node:fs/promises');
    await symlink('/etc/passwd', join(dir, 'link'));
    const v = await validate({ cwd: dir });
    expect(v.ok).toBe(false);
    expect(v.errors.map((e) => e.code).sort()).toEqual(['E_CONTEXT_MISSING', 'autorun', 'path.symlink', 'secret']);
  });
  it('normalizes git remotes to GitHub https URLs', () => {
    expect(normalizeGitRemote('git@github.com:genpm-net/auth.git')).toBe('https://github.com/genpm-net/auth');
    expect(normalizeGitRemote('https://github.com/genpm-net/auth.git')).toBe('https://github.com/genpm-net/auth');
    expect(normalizeGitRemote('ssh://git@github.com/genpm-net/auth')).toBe('https://github.com/genpm-net/auth');
    expect(normalizeGitRemote('https://gitlab.com/a/b')).toBeNull();
  });
});

describe('doctor', () => {
  it('checks node, git, project, clients, lock, registry and login', async () => {
    await install('@core/db');
    const health = (async () => new Response('{"ok":true}')) as unknown as typeof fetch;
    const checks = await doctor({
      cwd: project,
      registry: REGISTRY,
      home: TEST_HOME,
      fetchImpl: health,
      locale: { locale: 'es', source: 'LANG' },
    });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.status]));
    expect(byId).toMatchObject({
      node: 'ok',
      git: 'ok',
      language: 'ok',
      project: 'ok',
      clients: 'ok',
      lock: 'ok',
      registry: 'ok',
      login: 'warn',
    });
    await mkdir(join(project, 'tmp'), { recursive: true });
    const down = (async () => {
      throw new TypeError('down');
    }) as unknown as typeof fetch;
    const c2 = await doctor({ cwd: join(project, 'tmp'), registry: REGISTRY, home: TEST_HOME, fetchImpl: down });
    expect(c2.find((c) => c.id === 'registry')?.status).toBe('fail');
  });
});
