import { describe, expect, it } from 'vitest';
import { hasBlock, upsertBlock } from './blocks.js';
import { ADAPTERS, contextOps, indexBody } from './context.js';
import { envBlockBody, updateEnvExample } from './env.js';
import { commandLine, mcpTargets, mergeMcpConfig, removeFromMcpConfig, serverConfig } from './mcp.js';
import { installCommand, missingDeps } from './npm.js';

const auth = { n: '@core/auth', v: '1.2.0', d: 'src/lib/auth' };
const db = { n: '@core/db', v: '1.0.3', d: 'src/lib/db' };

describe('managed blocks (idempotent)', () => {
  it('inserts, replaces and removes only between markers', () => {
    const user = '# Project\n\nKeep me.\n';
    const one = upsertBlock(user, 'index', 'A');
    expect(one).toBe('# Project\n\nKeep me.\n\n<!-- genpm:index:start -->\nA\n<!-- genpm:index:end -->\n');
    expect(upsertBlock(one, 'index', 'A')).toBe(one);
    const two = upsertBlock(`${one}\nAfter.\n`, 'index', 'B');
    expect(two).toContain('B\n<!-- genpm:index:end -->\n\nAfter.');
    expect(two).toContain('Keep me.');
    expect(upsertBlock(two, 'index', null)).toBe('# Project\n\nKeep me.\nAfter.\n');
    expect(upsertBlock(null, 'x', 'v')).toBe('<!-- genpm:x:start -->\nv\n<!-- genpm:x:end -->\n');
    expect(upsertBlock('only', 'x', null)).toBe('only');
    expect(upsertBlock('<!-- genpm:x:start -->\nv\n<!-- genpm:x:end -->\n', 'x', null)).toBe('');
    expect(hasBlock(one, 'index')).toBe(true);
    expect(hasBlock(null, 'index')).toBe(false);
    expect(upsertBlock('A=1\n', 'env', 'B=', 'hash')).toBe('A=1\n\n# genpm:env:start\nB=\n# genpm:env:end\n');
  });
});

describe('context adapters (architecture §7.3)', () => {
  it('builds a stable root index', () => {
    expect(indexBody([db, auth])).toBe(
      '## GenPM packages\n- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)\n- @core/db@1.0.3 → src/lib/db (rules: src/lib/db/AGENTS.md)',
    );
    expect(indexBody([])).toBeNull();
  });
  it('emits scoped rules per client', () => {
    expect(ADAPTERS.claude.packageFiles(auth, 'R')).toEqual([
      { kind: 'file', path: 'src/lib/auth/CLAUDE.md', content: '@AGENTS.md\n' },
    ]);
    const [cursor] = ADAPTERS.cursor.packageFiles(auth, '# rules');
    expect(cursor).toMatchObject({ path: '.cursor/rules/genpm-core-auth.mdc' });
    expect((cursor as { content: string }).content).toMatch(
      /^---\ndescription: .*\nglobs: src\/lib\/auth\/\*\*\nalwaysApply: false\n---\n/,
    );
    const [copilot] = ADAPTERS.copilot.packageFiles(auth, '# rules');
    expect((copilot as { content: string }).content).toMatch(/^---\napplyTo: "src\/lib\/auth\/\*\*"\n---\n/);
    expect(copilot!.path).toBe('.github/instructions/genpm-core-auth.instructions.md');
    const [ws] = ADAPTERS.windsurf.packageFiles(auth, '# rules');
    expect((ws as { content: string }).content).toMatch(/^---\ntrigger: glob\nglobs: src\/lib\/auth\/\*\*\n---\n/);
    for (const c of ['claude', 'cursor', 'copilot', 'windsurf'] as const) {
      expect(ADAPTERS[c].packagePaths(auth)).toEqual(ADAPTERS[c].packageFiles(auth, 'x').map((o) => o.path));
    }
  });
  it('always includes AGENTS.md and only detected clients', () => {
    const ops = contextOps(['cursor'], [{ ref: auth, rules: 'r' }], [auth]);
    expect(ops.map((o) => o.path)).toEqual(['AGENTS.md', '.cursor/rules/genpm-core-auth.mdc']);
  });
});

describe('MCP config writer (ADR-009)', () => {
  const stripe = { n: 'stripe', c: 'npx', a: ['-y', '@stripe/mcp'], e: ['STRIPE_SECRET_KEY'] };
  it('maps clients to project files', () => {
    expect(mcpTargets(['agents'])).toEqual(['claude']);
    expect(mcpTargets(['agents', 'claude', 'cursor', 'copilot', 'windsurf'])).toEqual(['claude', 'cursor', 'vscode']);
  });
  it('writes per-client shapes with env references', () => {
    expect(serverConfig('vscode', stripe)).toEqual({
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@stripe/mcp'],
      env: { STRIPE_SECRET_KEY: '${env:STRIPE_SECRET_KEY}' },
    });
    expect(serverConfig('claude', { n: 'r', u: 'https://mcp.x' })).toEqual({ type: 'http', url: 'https://mcp.x' });
    expect(serverConfig('vscode', { n: 'r', u: 'https://mcp.x' })).toEqual({ type: 'http', url: 'https://mcp.x' });
    expect(commandLine(stripe)).toBe('npx -y @stripe/mcp');
  });
  it('merges without destroying user config', () => {
    const user = JSON.stringify({ mcpServers: { mine: { command: 'node', args: ['x'] } }, other: true });
    const r = mergeMcpConfig(user, 'claude', [stripe, '@acme/mcp']);
    expect(r.added).toEqual(['stripe', 'acme-mcp']);
    const json = JSON.parse(r.text);
    expect(json.other).toBe(true);
    expect(json.mcpServers.mine).toEqual({ command: 'node', args: ['x'] });
    expect(mergeMcpConfig(r.text, 'claude', [stripe]).changed).toBe(false);
    const clash = mergeMcpConfig(JSON.stringify({ mcpServers: { stripe: { command: 'evil' } } }), 'claude', [stripe]);
    expect(clash).toMatchObject({ changed: false, skipped: [{ n: 'stripe', reason: 'exists_different' }] });
    expect(mergeMcpConfig('// comments\n{', 'cursor', [stripe]).changed).toBe(false);
    expect(mergeMcpConfig(null, 'vscode', [stripe]).text).toContain('"servers"');
  });
  it('removes servers', () => {
    const text = mergeMcpConfig(null, 'claude', [stripe]).text;
    expect(JSON.parse(removeFromMcpConfig(text, 'claude', ['stripe', 'nope']).text)).toEqual({ mcpServers: {} });
    expect(removeFromMcpConfig(null, 'claude', ['x']).removed).toEqual([]);
    expect(removeFromMcpConfig('{bad', 'claude', ['x']).removed).toEqual([]);
  });
});

describe('.env.example and npm proposal', () => {
  it('writes names only, deduplicated', () => {
    expect(
      envBlockBody([
        { n: '@b/x', e: ['A', 'B'] },
        { n: '@a/y', e: ['A'] },
      ]),
    ).toBe('# @a/y\nA=\n# @b/x\nB=');
    expect(updateEnvExample('PORT=3000\n', [{ n: '@a/y', e: ['A'] }])).toBe(
      'PORT=3000\n\n# genpm:env:start\n# @a/y\nA=\n# genpm:env:end\n',
    );
    expect(envBlockBody([])).toBeNull();
  });
  it('proposes only missing deps with the detected manager', () => {
    expect(missingDeps({ b: '^2', a: '^1' }, { a: '^1.5' })).toEqual({ b: '^2' });
    expect(installCommand('pnpm', { b: '^2' })).toBe('pnpm add b@^2');
    expect(installCommand('npm', { b: '^2' })).toBe('npm install b@^2');
    expect(installCommand(null, { b: '^2' })).toBe('npm install b@^2');
    expect(installCommand('bun', {})).toBeNull();
  });
});
