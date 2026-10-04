import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apply } from '../src/apply.js';
import {
  codexToml,
  GENPM_MCP_BINARY,
  genpmMcpEntry,
  mcpAdd,
  mcpRemove,
  mcpSetupApply,
  mcpSetupPreview,
  setupTarget,
} from '../src/mcp-ops.js';
import { plan } from '../src/plan.js';
import { FakeRegistry, REGISTRY } from './fake-registry.js';
import { makeRepo } from './git-fixture.js';

// Directorio personal ficticio, distinto del proyecto: findRoot nunca acepta el propio ~ como proyecto.
const TEST_HOME = join(tmpdir(), 'genpm-test-home');

describe('genpm mcp add/remove (deferred consent)', () => {
  it('writes and removes the servers declared by an installed package', async () => {
    const project = await mkdtemp(join(tmpdir(), 'genpm-mcpops-'));
    await writeFile(join(project, 'package.json'), '{}');
    await writeFile(join(project, 'CLAUDE.md'), '');
    await mkdir(join(project, '.vscode'));
    const repo = await makeRepo({ 'AGENTS.md': '# b', 'index.ts': 'x' });
    const reg = new FakeRegistry().add({
      n: '@core/billing',
      v: '1.0.0',
      r: repo.url,
      c: repo.sha,
      d: 'src/lib/billing',
      m: [{ n: 'stripe', c: 'npx', a: ['-y', '@stripe/mcp'], e: ['STRIPE_SECRET_KEY'] }],
    });
    const common = { cwd: project, registry: REGISTRY, fetchImpl: reg.fetch as typeof fetch, home: TEST_HOME };
    await apply(
      await plan({
        ...common,
        specs: ['@core/billing'],
        fetch: { allowFileProtocol: true, cacheDir: await mkdtemp(join(tmpdir(), 'c-')) },
      }),
      { allowMcp: false, installNpmDeps: false, by: 'cli' },
    );
    const added = await mcpAdd({ ...common, name: '@core/billing' });
    expect(added).toEqual({ files: ['.mcp.json', '.vscode/mcp.json'], servers: ['stripe'] });
    expect(await readFile(join(project, 'genpm.lock'), 'utf8')).toContain('"m":1');
    const removed = await mcpRemove({ ...common, name: '@core/billing' });
    expect(removed).toEqual({ files: ['.mcp.json', '.vscode/mcp.json'], removed: ['stripe'] });
    expect(JSON.parse(await readFile(join(project, '.mcp.json'), 'utf8'))).toEqual({ mcpServers: {} });
    await expect(mcpAdd({ ...common, name: '@core/nope' })).rejects.toMatchObject({ code: 'E_NOT_FOUND' });
  });
});

describe('genpm mcp setup', () => {
  it('computes targets per client and scope and merges non-destructively', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genpm-setup-'));
    const home = await mkdtemp(join(tmpdir(), 'genpm-sethome-'));
    expect(setupTarget('claude', 'user', root, home)).toMatchObject({
      file: null,
      command: 'claude mcp add genpm -- npx -y @genpm/mcp',
    });
    expect(setupTarget('windsurf', 'project', root, home).file).toBe(
      join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    );
    const vs = setupTarget('vscode', 'project', root, home);
    expect(await mcpSetupApply(vs, root)).toBe(true);
    expect(JSON.parse(await readFile(join(root, '.vscode/mcp.json'), 'utf8'))).toEqual({
      servers: { genpm: { type: 'stdio', command: 'npx', args: ['-y', '@genpm/mcp'] } },
    });
    expect((await mcpSetupPreview(vs)).changed).toBe(false);
    // Gemini CLI: .gemini/settings.json guarda más ajustes; se añade `genpm` sin tocar el resto.
    const gem = setupTarget('gemini', 'project', root, home);
    expect(gem.file).toBe(join(root, '.gemini', 'settings.json'));
    await mkdir(join(root, '.gemini'), { recursive: true });
    await writeFile(join(root, '.gemini/settings.json'), JSON.stringify({ theme: 'Dracula' }));
    expect(await mcpSetupApply(gem, root)).toBe(true);
    expect(JSON.parse(await readFile(join(root, '.gemini/settings.json'), 'utf8'))).toEqual({
      theme: 'Dracula',
      mcpServers: { genpm: { command: 'npx', args: ['-y', '@genpm/mcp'] } },
    });
    expect(setupTarget('gemini', 'user', root, home).file).toBe(join(home, '.gemini', 'settings.json'));
    const codex = setupTarget('codex', 'user', root, home);
    await mkdir(join(home, '.codex'), { recursive: true });
    await writeFile(join(home, '.codex/config.toml'), 'model = "x"\n');
    expect(await mcpSetupApply(codex, root)).toBe(true);
    expect(await readFile(join(home, '.codex/config.toml'), 'utf8')).toBe(
      'model = "x"\n\n[mcp_servers.genpm]\ncommand = "npx"\nargs = ["-y", "@genpm/mcp"]\n',
    );
    expect(codexToml('[mcp_servers.genpm]\n').changed).toBe(false);
  });

  it('registers `genpm mcp serve` when GenPM runs as the native binary (no Node, ADR-025)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'genpm-setup-'));
    const home = await mkdtemp(join(tmpdir(), 'genpm-sethome-'));
    expect(genpmMcpEntry({ kind: 'binary', target: 'linux-x64', path: '/x/genpm' })).toBe(GENPM_MCP_BINARY);
    expect(genpmMcpEntry({ kind: 'npm', command: 'npm i -g @genpm/cli@latest' }).c).toBe('npx');
    const bin = GENPM_MCP_BINARY;
    expect(setupTarget('claude', 'user', root, home, bin).command).toBe('claude mcp add genpm -- genpm mcp serve');
    expect(setupTarget('vscode', 'user', root, home, bin).command).toBe(
      `code --add-mcp '{"name":"genpm","command":"genpm","args":["mcp","serve"]}'`,
    );
    const cursor = setupTarget('cursor', 'project', root, home, bin);
    expect(await mcpSetupApply(cursor, root)).toBe(true);
    expect(JSON.parse(await readFile(join(root, '.cursor/mcp.json'), 'utf8'))).toEqual({
      mcpServers: { genpm: { command: 'genpm', args: ['mcp', 'serve'] } },
    });
    expect(codexToml(null, bin).text).toBe('[mcp_servers.genpm]\ncommand = "genpm"\nargs = ["mcp", "serve"]\n');
  });
});
