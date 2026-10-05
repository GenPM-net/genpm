// core/diff (cli-mcp-spec `genpm diff`, `genpm_diff`): diff upstream entre el commit instalado y el nuevo, remapeado
// a `<d>`, más el drift local. Reutiliza plan() en modo `update`: firma (INV-8), descarga por SHA (INV-1) y escaneo.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findRoot } from './detect.js';
import { fail } from './errors.js';
import { fetchSource, sourcePath } from './fetch/index.js';
import { safeDestPath } from './fs/safe-path.js';
import { driftOf, readFilesIndex, readLock } from './lock.js';
import { readTree, type Tree, unifiedDiff } from './merge.js';
import { type PlanInput, plan, planInternal } from './plan.js';

export type DiffInput = Omit<PlanInput, 'specs' | 'update' | 'dest' | 'force'> & {
  name: string;
  /** Rango o versión destino (por defecto `latest`). */
  to?: string;
  /** Límite aproximado del parche en caracteres (el MCP lo usa para no desbordar el contexto). */
  maxChars?: number;
};

export type DiffResult = {
  n: string;
  d: string;
  from: string;
  to: string;
  /** Diff unificado `a/<d>/…` → `b/<d>/…`, aplicable con `git apply --3way` desde la raíz del proyecto. */
  patch: string;
  /** Archivos cambiados upstream (relativos a `<d>`). */
  files: string[];
  /** Archivos cuyo diff no cabe en `maxChars` y se omiten del parche. */
  omitted: string[];
  /** Cambios locales respecto a lo instalado. */
  drift: { modified: string[]; deleted: string[]; added: string[] };
};

async function treeOf(
  src: Awaited<ReturnType<typeof fetchSource>>,
  i: string,
  x: string,
  rels: string[],
  rules: string | null,
): Promise<Tree> {
  const tree = await readTree(join(src.dir, ...(i === '.' ? [] : i.split('/'))), rels);
  if (rules !== null && x !== 'AGENTS.md') tree.set('AGENTS.md', Buffer.from(rules));
  return tree;
}

/** Separa un diff de git en bloques por archivo (`diff --git …`). */
function splitPatch(patch: string): Array<{ file: string; text: string }> {
  const parts = patch.split(/^(?=diff --git )/m).filter(Boolean);
  // Con prefijos vacíos git usa `a/` o `b/` según el lado que exista (archivo nuevo ⇒ `b/`, borrado ⇒ `a/`).
  return parts.map((text) => ({ file: text.match(/^diff --git [ab]\/(\S+)/)?.[1] ?? '', text }));
}

export async function diff(input: DiffInput): Promise<DiffResult> {
  const root = await findRoot(input.cwd, input.home);
  const lock = await readLock(root);
  const prev = lock.p[input.name];
  if (!prev) throw fail('E_NOT_FOUND', { name: input.name });
  const pl = await plan({ ...input, specs: [`${input.name}@${input.to ?? 'latest'}`], update: true });
  const internal = planInternal(pl)!;
  const it = internal.items.find((i) => i.manifest.n === input.name);
  const index = await readFilesIndex(root, input.name);
  const drift = await driftOf(root, prev, index);
  if (!it || it.action !== 'update') {
    return { n: input.name, d: prev.d, from: prev.v, to: prev.v, patch: '', files: [], omitted: [], drift };
  }
  const m = it.manifest;
  const theirs = await treeOf(
    it.source!,
    m.i,
    m.x,
    it.files.map((f) => f.path),
    it.rules,
  );
  const baseSrc = await fetchSource(
    { r: prev.r, c: prev.c, i: m.i },
    { ...input.fetch, fetchImpl: input.fetchImpl ?? input.fetch?.fetchImpl },
  );
  const baseRules =
    prev.x !== 'AGENTS.md' ? await readFile(sourcePath(baseSrc, m.i, prev.x), 'utf8').catch(() => null) : null;
  const base = await treeOf(
    baseSrc,
    m.i,
    prev.x,
    Object.keys(index?.f ?? {}).filter((r) => r !== 'AGENTS.md' || prev.x === 'AGENTS.md'),
    baseRules,
  );
  await safeDestPath(root, prev.d);
  const full = await unifiedDiff(base, theirs, prev.d);
  const blocks = splitPatch(full);
  const files = blocks.map((b) => b.file.slice(prev.d.length + 1)).filter(Boolean);
  let patch = full;
  const omitted: string[] = [];
  if (input.maxChars && full.length > input.maxChars) {
    patch = '';
    for (const b of blocks) {
      if (patch.length + b.text.length <= input.maxChars) patch += b.text;
      else omitted.push(b.file.slice(prev.d.length + 1));
    }
  }
  return { n: m.n, d: prev.d, from: prev.v, to: m.v, patch, files, omitted, drift };
}
