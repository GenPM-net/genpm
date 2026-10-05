// core/detect: raíz del proyecto, clientes IA instalados y package manager (architecture §7.3, §7.6).

import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, parse, resolve, sep } from 'node:path';
import { fail } from './errors.js';
import { exists, readTextOrNull } from './fs/io.js';

export const CLIENTS = ['agents', 'claude', 'cursor', 'copilot', 'windsurf'] as const;
export type Client = (typeof CLIENTS)[number];
export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

const ROOT_MARKERS = ['genpm.lock', '.git', 'package.json'] as const;

/**
 * Busca la raíz hacia arriba desde `cwd` por prioridad de marcador: `genpm.lock` → `.git` → `package.json`.
 * Nunca devuelve el directorio personal ni nada por encima: hay quien versiona `~` con git (dotfiles), y escribir
 * `src/`, AGENTS.md o la config MCP global de Cursor ahí sería un desastre. Fuera de `~` (CI, /srv) sube hasta la
 * raíz del disco.
 */
export async function findRoot(cwd: string, home = homedir()): Promise<string> {
  const start = resolve(cwd);
  const stop = parse(start).root;
  const homeDir = resolve(home);
  const insideHome = start === homeDir || start.startsWith(`${homeDir}${sep}`);
  for (const marker of ROOT_MARKERS) {
    let dir = start;
    while (true) {
      if (insideHome && dir === homeDir) break;
      if (await exists(join(dir, marker))) return dir;
      if (dir === stop) break;
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw fail('E_NOT_A_PROJECT', { path: start });
}

/** Señales de detección por cliente (architecture §7.3). `agents` siempre está activo. */
const SIGNALS: Record<Exclude<Client, 'agents'>, string[]> = {
  // `.mcp.json` en la raíz es la config MCP de proyecto de Claude Code (la que escribe `genpm mcp setup --client claude`).
  claude: ['CLAUDE.md', '.claude', '.mcp.json'],
  cursor: ['.cursor', '.cursorrules'],
  copilot: ['.github/copilot-instructions.md', '.vscode'],
  windsurf: ['.windsurf', '.windsurfrules'],
};

/** Cliente de IA a partir del `clientInfo.name` del handshake MCP ('claude-code', 'cursor-vscode', 'Visual Studio Code'…). */
export function clientFromAgent(name: string | undefined | null): Client | null {
  if (!name) return null;
  if (/claude/i.test(name)) return 'claude';
  if (/cursor/i.test(name)) return 'cursor';
  if (/windsurf|codeium/i.test(name)) return 'windsurf';
  if (/copilot|visual studio code|vscode/i.test(name)) return 'copilot';
  return null;
}

export function isClient(s: string): s is Client {
  return (CLIENTS as readonly string[]).includes(s);
}

export async function detectClients(root: string, override?: readonly string[]): Promise<Client[]> {
  if (override?.length) {
    const list = override.filter(isClient);
    return ['agents', ...list.filter((c) => c !== 'agents')];
  }
  const found: Client[] = ['agents'];
  for (const [client, signals] of Object.entries(SIGNALS) as Array<[Client, string[]]>) {
    for (const s of signals) {
      if (await exists(join(root, s))) {
        found.push(client);
        break;
      }
    }
  }
  return found;
}

const LOCKFILES: Array<[string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

export async function detectPackageManager(root: string): Promise<PackageManager | null> {
  for (const [file, pm] of LOCKFILES) if (await exists(join(root, file))) return pm;
  const pkg = await readTextOrNull(join(root, 'package.json'));
  if (pkg) {
    try {
      const field = (JSON.parse(pkg) as { packageManager?: string }).packageManager;
      const name = field?.split('@')[0];
      if (name === 'pnpm' || name === 'npm' || name === 'yarn' || name === 'bun') return name;
    } catch {
      // package.json inválido: el proyecto decide; no es asunto de GenPM.
    }
    return 'npm';
  }
  return null;
}

/** Dependencias declaradas en package.json (para omitir rangos npm ya satisfechos). */
export async function readPackageDeps(root: string): Promise<Record<string, string>> {
  const pkg = await readTextOrNull(join(root, 'package.json'));
  if (!pkg) return {};
  try {
    const j = JSON.parse(pkg) as Record<string, Record<string, string> | undefined>;
    return { ...j['peerDependencies'], ...j['devDependencies'], ...j['dependencies'] };
  } catch {
    return {};
  }
}

/** `true` si el directorio no existe o está vacío. */
export async function isEmptyDir(p: string): Promise<boolean> {
  try {
    return (await readdir(p)).length === 0;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw e;
  }
}

export type Detection = { root: string; clients: Client[]; packageManager: PackageManager | null };

export async function detect(
  cwd: string,
  opts: { clients?: readonly string[]; home?: string } = {},
): Promise<Detection> {
  const root = await findRoot(cwd, opts.home);
  return { root, clients: await detectClients(root, opts.clients), packageManager: await detectPackageManager(root) };
}
