// `genpm mcp setup | add | remove` (cli-mcp-spec §A.5, §B.7): registra @genpm/mcp en el cliente IA y escribe o quita
// (consentimiento diferido) los servidores MCP que declara un paquete instalado. Merge no destructivo siempre.

import { homedir } from 'node:os';
import { join } from 'node:path';
import { normalizeMcp, verifyManifest } from '@genpm/manifest';
import { withLock } from './busy.js';
import { loadRc, registryFor } from './config.js';
import { detectClients, findRoot } from './detect.js';
import { fail } from './errors.js';
import { readTextOrNull, writeFileAtomic } from './fs/io.js';
import { safePath } from './fs/safe-path.js';
import { MCP_FILES, type McpTarget, mcpTargets, mergeMcpConfig, removeFromMcpConfig } from './inject/mcp.js';
import { keysFor } from './keys.js';
import { readLock, writeLock } from './lock.js';
import { RegistryClient } from './registry-client.js';
import { revokedKeys } from './revocation.js';
import { type InstallMethod, installMethod } from './self-update.js';

export type SetupClient = 'claude' | 'cursor' | 'vscode' | 'windsurf' | 'codex';
/** Servidor MCP local por stdio (forma que tiene siempre el servidor de GenPM). */
export type StdioEntry = { n: string; c: string; a: string[] };

/** Servidor MCP de GenPM vía npm (`@genpm/mcp`): necesita Node. */
export const GENPM_MCP: StdioEntry = { n: 'genpm', c: 'npx', a: ['-y', '@genpm/mcp'] };
/** El mismo servidor dentro del binario nativo (ADR-025): sin Node ni npx. */
export const GENPM_MCP_BINARY: StdioEntry = { n: 'genpm', c: 'genpm', a: ['mcp', 'serve'] };

/** Con el binario instalado se registra `genpm mcp serve`; desde npm/npx, `npx -y @genpm/mcp`. */
export function genpmMcpEntry(method: InstallMethod = installMethod()): StdioEntry {
  return method.kind === 'binary' ? GENPM_MCP_BINARY : GENPM_MCP;
}

/** `genpm mcp serve` / `npx -y @genpm/mcp` tal como se escribiría en una terminal. */
const commandLine = (e: StdioEntry) => [e.c, ...e.a].join(' ');

export type SetupTarget = {
  client: SetupClient;
  scope: 'project' | 'user';
  file: string | null;
  command: string | null;
  format: 'json' | 'toml' | 'command';
  /** Servidor que se registra (binario o npx). */
  entry: StdioEntry;
};

/** Dónde se registra el servidor según cliente y alcance (cli-mcp-spec §B.7). */
export function setupTarget(
  client: SetupClient,
  scope: 'project' | 'user',
  root: string,
  home = homedir(),
  entry: StdioEntry = genpmMcpEntry(),
): SetupTarget {
  switch (client) {
    case 'claude':
      return scope === 'project'
        ? { client, scope, file: join(root, '.mcp.json'), command: null, format: 'json', entry }
        : {
            client,
            scope,
            file: null,
            command: `claude mcp add genpm -- ${commandLine(entry)}`,
            format: 'command',
            entry,
          };
    case 'cursor':
      return {
        client,
        scope,
        file: scope === 'project' ? join(root, '.cursor', 'mcp.json') : join(home, '.cursor', 'mcp.json'),
        command: null,
        format: 'json',
        entry,
      };
    case 'vscode':
      return scope === 'project'
        ? { client, scope, file: join(root, '.vscode', 'mcp.json'), command: null, format: 'json', entry }
        : {
            client,
            scope,
            file: null,
            command: `code --add-mcp '${JSON.stringify({ name: 'genpm', command: entry.c, args: entry.a })}'`,
            format: 'command',
            entry,
          };
    case 'windsurf':
      return {
        client,
        scope: 'user',
        file: join(home, '.codeium', 'windsurf', 'mcp_config.json'),
        command: null,
        format: 'json',
        entry,
      };
    case 'codex':
      return { client, scope: 'user', file: join(home, '.codex', 'config.toml'), command: null, format: 'toml', entry };
  }
}

const targetKind = (c: SetupClient): McpTarget => (c === 'vscode' ? 'vscode' : c === 'claude' ? 'claude' : 'cursor');

export function codexToml(current: string | null, entry: StdioEntry = GENPM_MCP): { text: string; changed: boolean } {
  const cur = current ?? '';
  if (/^\[mcp_servers\.genpm\]/m.test(cur)) return { text: cur, changed: false };
  const args = entry.a.map((a) => JSON.stringify(a)).join(', ');
  const block = `[mcp_servers.genpm]\ncommand = ${JSON.stringify(entry.c)}\nargs = [${args}]\n`;
  return { text: cur ? `${cur.replace(/\n*$/, '\n\n')}${block}` : block, changed: true };
}

/** Calcula el cambio (para mostrarlo y pedir confirmación) sin escribir. */
export async function mcpSetupPreview(
  t: SetupTarget,
): Promise<{ before: string | null; after: string; changed: boolean }> {
  if (!t.file) return { before: null, after: t.command ?? '', changed: false };
  const before = await readTextOrNull(t.file);
  if (t.format === 'toml') {
    const r = codexToml(before, t.entry);
    return { before, after: r.text, changed: r.changed };
  }
  const r = mergeMcpConfig(before, targetKind(t.client), [t.entry]);
  return { before, after: r.text, changed: r.changed };
}

export async function mcpSetupApply(t: SetupTarget, root: string): Promise<boolean> {
  const preview = await mcpSetupPreview(t);
  if (!t.file || !preview.changed) return false;
  // Los archivos de proyecto pasan por safePath (INV-3); los de usuario son rutas fijas conocidas del cliente.
  const abs =
    t.scope === 'project'
      ? await safePath(
          root,
          t.file
            .slice(root.length + 1)
            .split('\\')
            .join('/'),
        )
      : t.file;
  await writeFileAtomic(abs, preview.after);
  return true;
}

async function manifestOf(opts: {
  cwd: string;
  name: string;
  registry?: string;
  fetchImpl?: typeof fetch;
  home?: string;
}) {
  const root = await findRoot(opts.cwd, opts.home);
  const lock = await readLock(root);
  const entry = lock.p[opts.name];
  if (!entry) throw fail('E_NOT_FOUND', { name: opts.name });
  const registry = registryFor(opts.name, await loadRc(root, opts.home), opts.registry);
  const client = new RegistryClient({ registry, fetchImpl: opts.fetchImpl });
  const remote = await client.version(opts.name, entry.v);
  const revoked = await revokedKeys({ registry, client });
  if (!remote.sg || remote.sg !== entry.sg || !(await verifyManifest(remote, remote.sg, keysFor(registry), revoked)).ok)
    throw fail('E_SIGNATURE', { name: `${opts.name}@${entry.v}` });
  return { root, lock, entry, manifest: remote };
}

/** Servidores MCP declarados por un paquete instalado (para mostrar el comando completo antes del consentimiento). */
export async function packageMcpServers(opts: {
  cwd: string;
  name: string;
  registry?: string;
  fetchImpl?: typeof fetch;
  home?: string;
}) {
  const { manifest, root } = await manifestOf(opts);
  const clients = await detectClients(root, (await loadRc(root, opts.home)).clients);
  return { servers: (manifest.m ?? []).map(normalizeMcp), targets: mcpTargets(clients).map((t) => MCP_FILES[t]) };
}

export async function mcpAdd(opts: {
  cwd: string;
  name: string;
  registry?: string;
  fetchImpl?: typeof fetch;
  home?: string;
}): Promise<{ files: string[]; servers: string[] }> {
  const { root, manifest } = await manifestOf(opts);
  const servers = manifest.m ?? [];
  if (!servers.length) return { files: [], servers: [] };
  const clients = await detectClients(root, (await loadRc(root, opts.home)).clients);
  return withLock(root, async () => {
    const files: string[] = [];
    for (const target of mcpTargets(clients)) {
      const rel = MCP_FILES[target];
      const abs = await safePath(root, rel);
      const merged = mergeMcpConfig(await readTextOrNull(abs), target, servers);
      if (merged.changed) {
        await writeFileAtomic(abs, merged.text);
        files.push(rel);
      }
    }
    const lock = await readLock(root);
    lock.p[opts.name]!.m = 1;
    await writeLock(root, lock);
    return { files, servers: servers.map((s) => normalizeMcp(s).n) };
  });
}

export async function mcpRemove(opts: {
  cwd: string;
  name: string;
  registry?: string;
  fetchImpl?: typeof fetch;
  home?: string;
}): Promise<{ files: string[]; removed: string[] }> {
  const { root, manifest } = await manifestOf(opts);
  const names = (manifest.m ?? []).map((s) => normalizeMcp(s).n);
  return withLock(root, async () => {
    const files: string[] = [];
    const removed = new Set<string>();
    for (const target of ['claude', 'cursor', 'vscode'] as const) {
      const rel = MCP_FILES[target];
      const abs = await safePath(root, rel);
      const r = removeFromMcpConfig(await readTextOrNull(abs), target, names);
      if (r.removed.length) {
        await writeFileAtomic(abs, r.text);
        files.push(rel);
        for (const n of r.removed) removed.add(n);
      }
    }
    const lock = await readLock(root);
    lock.p[opts.name]!.m = 0;
    await writeLock(root, lock);
    return { files, removed: [...removed] };
  });
}
