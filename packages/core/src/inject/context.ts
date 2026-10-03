// core/inject: contexto con alcance (ADR-004, architecture §7.3). Cada cliente vive en un adaptador aislado;
// los formatos de los IDEs cambian con frecuencia y así se actualizan sin tocar el resto del motor.

import { slugOf } from '@genpm/manifest';
import type { Client } from '../detect.js';
import { upsertBlock } from './blocks.js';

export type InstalledRef = { n: string; v: string; d: string };

/** Operación de contexto: archivo completo propio de GenPM o bloque gestionado dentro de un archivo del usuario. */
export type ContextOp =
  | { kind: 'file'; path: string; content: string }
  | { kind: 'block'; path: string; id: string; body: string | null };

const slugFile = (n: string) => slugOf(n).replace('__', '-');

export type ClientAdapter = {
  client: Client;
  /** Archivos por paquete. `rules` = contenido de las reglas del paquete (ya es `<d>/AGENTS.md`). */
  packageFiles(pkg: InstalledRef, rules: string): ContextOp[];
  /** Rutas de los archivos por paquete (para `remove`). */
  packagePaths(pkg: InstalledRef): string[];
  /** Bloque índice en un archivo raíz, si el cliente lo usa. */
  index?(all: InstalledRef[]): ContextOp | null;
};

export function indexBody(all: InstalledRef[]): string | null {
  if (all.length === 0) return null;
  const lines = [...all]
    .sort((a, b) => a.n.localeCompare(b.n))
    .map((p) => `- ${p.n}@${p.v} → ${p.d} (rules: ${p.d}/AGENTS.md)`);
  return ['## GenPM packages', ...lines].join('\n');
}

const sourceNote = (pkg: InstalledRef) =>
  `<!-- Managed by GenPM from ${pkg.n}@${pkg.v}. Edit ${pkg.d}/AGENTS.md instead; remove with genpm remove ${pkg.n}. -->`;

/** AGENTS.md (estándar abierto, siempre): reglas en `<d>/AGENTS.md` (las escribe la copia) + índice raíz. */
export const agents: ClientAdapter = {
  client: 'agents',
  packageFiles: () => [],
  packagePaths: () => [],
  index: (all) => ({ kind: 'block', path: 'AGENTS.md', id: 'index', body: indexBody(all) }),
};

/** Claude Code: `<d>/CLAUDE.md` importa `@AGENTS.md` (carga bajo demanda en subdirectorios) + índice en CLAUDE.md raíz. */
export const claude: ClientAdapter = {
  client: 'claude',
  packageFiles: (pkg) => [{ kind: 'file', path: `${pkg.d}/CLAUDE.md`, content: '@AGENTS.md\n' }],
  packagePaths: (pkg) => [`${pkg.d}/CLAUDE.md`],
  index: (all) => ({ kind: 'block', path: 'CLAUDE.md', id: 'index', body: indexBody(all) }),
};

/** Cursor: `.cursor/rules/genpm-<slug>.mdc` con `globs: <d>/**` y `alwaysApply: false`. */
export const cursor: ClientAdapter = {
  client: 'cursor',
  packageFiles: (pkg, rules) => [
    {
      kind: 'file',
      path: `.cursor/rules/genpm-${slugFile(pkg.n)}.mdc`,
      content: `---\ndescription: Rules for ${pkg.n} (GenPM package installed in ${pkg.d})\nglobs: ${pkg.d}/**\nalwaysApply: false\n---\n${sourceNote(pkg)}\n\n${rules.replace(/\n*$/, '\n')}`,
    },
  ],
  packagePaths: (pkg) => [`.cursor/rules/genpm-${slugFile(pkg.n)}.mdc`],
};

/** GitHub Copilot: `.github/instructions/genpm-<slug>.instructions.md` con `applyTo: "<d>/**"`. */
export const copilot: ClientAdapter = {
  client: 'copilot',
  packageFiles: (pkg, rules) => [
    {
      kind: 'file',
      path: `.github/instructions/genpm-${slugFile(pkg.n)}.instructions.md`,
      content: `---\napplyTo: "${pkg.d}/**"\n---\n${sourceNote(pkg)}\n\n${rules.replace(/\n*$/, '\n')}`,
    },
  ],
  packagePaths: (pkg) => [`.github/instructions/genpm-${slugFile(pkg.n)}.instructions.md`],
};

/** Windsurf: `.windsurf/rules/genpm-<slug>.md` con `trigger: glob` y `globs: <d>/**`. */
export const windsurf: ClientAdapter = {
  client: 'windsurf',
  packageFiles: (pkg, rules) => [
    {
      kind: 'file',
      path: `.windsurf/rules/genpm-${slugFile(pkg.n)}.md`,
      content: `---\ntrigger: glob\nglobs: ${pkg.d}/**\n---\n${sourceNote(pkg)}\n\n${rules.replace(/\n*$/, '\n')}`,
    },
  ],
  packagePaths: (pkg) => [`.windsurf/rules/genpm-${slugFile(pkg.n)}.md`],
};

export const ADAPTERS: Record<Client, ClientAdapter> = { agents, claude, cursor, copilot, windsurf };

/** Operaciones de contexto para instalar `pkgs` dado el conjunto final de paquetes instalados `all`. */
export function contextOps(
  clients: readonly Client[],
  pkgs: Array<{ ref: InstalledRef; rules: string }>,
  all: InstalledRef[],
): ContextOp[] {
  const ops: ContextOp[] = [];
  const set = new Set<Client>(['agents', ...clients]);
  for (const c of set) {
    const a = ADAPTERS[c];
    for (const p of pkgs) ops.push(...a.packageFiles(p.ref, p.rules));
    const idx = a.index?.(all);
    if (idx) ops.push(idx);
  }
  return ops;
}

/** Aplica una operación de bloque sobre el texto actual. */
export function applyBlock(current: string | null, op: Extract<ContextOp, { kind: 'block' }>): string {
  return upsertBlock(current, op.id, op.body);
}
