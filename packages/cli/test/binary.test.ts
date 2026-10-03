// Smoke del binario nativo (ADR-025): ejecuta el ejecutable compilado con Bun —no el código fuente sobre Node— contra un
// registry local, para detectar diferencias de runtime (Ed25519, fetch, git, fs, prompts) en cada plataforma del CI.
// Solo corre con GENPM_BINARY=<ruta al binario>; release.yml lo lanza en macOS, Linux y Windows.
import { execFile, spawn } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchSource, repoCacheKey } from '@genpm/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeRegistry } from '../../core/test/fake-registry.js';
import { makeRepo } from '../../core/test/git-fixture.js';

const BINARY = process.env['GENPM_BINARY'];
const REPO = 'https://github.com/genpm-smoke/db';

let server: Server;
let registry: string;
let cache: string;
let sha: string;

/** Ejecuta el binario sin heredar la configuración del usuario ni del CI. */
function genpm(cwd: string, ...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(
      BINARY!,
      args,
      {
        cwd,
        env: {
          PATH: process.env['PATH'],
          SystemRoot: process.env['SystemRoot'],
          HOME: cwd,
          USERPROFILE: cwd,
          GENPM_REGISTRY: registry,
          GENPM_CACHE_DIR: cache,
          GENPM_TELEMETRY: '0',
          GENPM_LANG: 'en',
          NO_COLOR: '1',
        },
      },
      (err, stdout, stderr) =>
        resolve({
          code: err ? ((err as { code?: number }).code ?? 1) : 0,
          stdout: String(stdout),
          stderr: String(stderr),
        }),
    );
  });
}

describe.skipIf(!BINARY)('standalone binary', () => {
  beforeAll(async () => {
    const repo = await makeRepo({ 'AGENTS.md': '# @smoke/db rules\n', 'index.ts': 'export const db = 1;\n' });
    sha = repo.sha;
    // La caché se siembra desde el repo local: el binario (que rechaza file://) instala sin red, como tras un fetch real.
    cache = await mkdtemp(join(tmpdir(), 'genpm-bincache-'));
    const seed = await fetchSource({ r: repo.url, c: sha }, { allowFileProtocol: true, cacheDir: cache });
    await cp(seed.dir, join(cache, repoCacheKey(REPO), sha), { recursive: true });

    const reg = new FakeRegistry().add({
      n: '@smoke/db',
      v: '1.0.0',
      r: REPO,
      c: sha,
      d: 'src/lib/db',
      s: 'Smoke test package',
      e: ['DATABASE_URL'],
    });
    server = createServer(async (req, res) => {
      const r = await reg.fetch(`http://127.0.0.1${req.url}`);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
    const addr = server.address();
    registry = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
  });
  afterAll(() => new Promise<void>((ok) => (server ? server.close(() => ok()) : ok())));

  it('prints its version and identifies itself in doctor', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genpm-bin-'));
    const { version } = JSON.parse(await readFile(join(import.meta.dirname, '..', 'package.json'), 'utf8'));
    expect((await genpm(dir, '--version')).stdout.trim()).toBe(version);
    const d = await genpm(dir, 'doctor', '--json');
    expect(JSON.parse(d.stdout).checks[0]).toMatchObject({ id: 'runtime', status: 'ok' });
  });

  it('translates help into other languages', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genpm-bin-'));
    expect((await genpm(dir, '--help', '--lang', 'es')).stdout).toMatch(/Busca en el registry/);
  });

  it('searches, verifies signatures and installs a package', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genpm-bin-'));
    await writeFile(join(dir, 'package.json'), '{"name":"app"}');
    const s = await genpm(dir, 'search', 'smoke', '--json');
    expect(JSON.parse(s.stdout).r[0]).toMatchObject({ n: '@smoke/db' });
    const i = await genpm(dir, 'info', '@smoke/db', '--json');
    expect(JSON.parse(i.stdout)).toMatchObject({ manifest: { n: '@smoke/db', c: sha } });
    const a = await genpm(dir, 'add', '@smoke/db', '--yes', '--json');
    expect(a.code, a.stdout + a.stderr).toBe(0);
    expect(await readFile(join(dir, 'src/lib/db/index.ts'), 'utf8')).toBe('export const db = 1;\n');
    expect(await readFile(join(dir, 'genpm.lock'), 'utf8')).toContain(sha);
    const au = await genpm(dir, 'audit', '--json');
    expect(JSON.parse(au.stdout)).toEqual({ ok: true, findings: [] });
  });

  it('upgrade --check works without Node installed', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genpm-bin-'));
    const u = await genpm(dir, 'upgrade', '--check', '--json');
    // Sin releases publicados (repo privado) GitHub responde 404: se acepta E_NETWORK, nunca un fallo del runtime.
    const out = JSON.parse(u.stdout);
    expect(out.ok ? out.method : out.error.code).toMatch(/^(binary|E_NETWORK)$/);
  });

  it('serves MCP over stdio without Node (genpm mcp serve)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'genpm-bin-'));
    const child = spawn(BINARY!, ['mcp', 'serve'], {
      cwd: dir,
      env: {
        PATH: process.env['PATH'],
        SystemRoot: process.env['SystemRoot'],
        HOME: dir,
        USERPROFILE: dir,
        GENPM_REGISTRY: registry,
        GENPM_TELEMETRY: '0',
      },
    });
    let out = '';
    const reply = (id: number) =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`no MCP reply ${id}: ${out}`)), 15_000);
        const check = () => {
          for (const l of out.split('\n')) {
            if (!l.trim()) continue;
            const msg = JSON.parse(l) as { id?: number };
            if (msg.id === id) {
              clearTimeout(timer);
              child.stdout.off('data', onData);
              resolve(msg as Record<string, unknown>);
              return;
            }
          }
        };
        const onData = (d: Buffer) => {
          out += d.toString();
          check();
        };
        child.stdout.on('data', onData);
        check();
      });
    const send = (m: unknown) => child.stdin.write(`${JSON.stringify(m)}\n`);
    try {
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } },
      });
      expect(await reply(1)).toMatchObject({ result: { serverInfo: { name: 'genpm' } } });
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
      const tools = (await reply(2)) as { result: { tools: Array<{ name: string }> } };
      expect(tools.result.tools.map((t) => t.name)).toContain('genpm_add');
    } finally {
      child.kill();
    }
  });
});
