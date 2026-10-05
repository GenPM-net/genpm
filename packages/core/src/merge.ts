// core/merge (architecture §6.6): merge de 3 vías de un paquete instalado y diff upstream remapeado a `<d>`.
//   base   = árbol upstream en el commit instalado (caché o re-fetch por SHA)
//   theirs = árbol upstream en el commit nuevo
//   ours   = archivos locales en <d>
// Todas las rutas pasan por safePath (INV-3) y git se invoca endurecido (INV-2, sin shell).

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fail } from './errors.js';
import { hardenedEnv, hardeningFlags } from './fetch/git.js';
import { sri } from './lock.js';

/** Contenido de un árbol: ruta relativa a `<d>` → bytes. */
export type Tree = Map<string, Buffer>;

export type MergeOutcome =
  /** `ours` sin cambios locales (o inexistente): se escribe `theirs`. */
  | { rel: string; kind: 'take' }
  /** Upstream no cambió el archivo: se conserva la versión local. */
  | { rel: string; kind: 'keep' }
  /** Ambos cambiaron y git merge-file lo resolvió sin conflicto. */
  | { rel: string; kind: 'merged' }
  /** Ambos cambiaron y quedan marcadores de conflicto estándar en el archivo. */
  | { rel: string; kind: 'conflict' }
  /** Archivo binario modificado en ambos lados: se conserva el local y se avisa. */
  | { rel: string; kind: 'binary-conflict' }
  /** Borrado upstream y sin cambios locales: se borra. */
  | { rel: string; kind: 'delete' }
  /** Borrado upstream pero modificado en local: se conserva y deja de estar gestionado. */
  | { rel: string; kind: 'orphan' }
  /** Borrado en local y sin cambios upstream: se respeta el borrado. */
  | { rel: string; kind: 'stay-deleted' };

export type MergePlan = {
  outcomes: MergeOutcome[];
  /** Contenido final de cada archivo que hay que escribir (take, merged, conflict). */
  writes: Map<string, Buffer>;
  /** Archivos a borrar. */
  deletes: string[];
  /** Índice nuevo (`.genpm/files`): hash del contenido upstream nuevo de cada archivo gestionado. */
  index: Record<string, string>;
};

function isBinary(b: Buffer): boolean {
  return b.subarray(0, 8000).includes(0);
}

const same = (a: Buffer | undefined, b: Buffer | undefined) => !!a && !!b && a.equals(b);

/**
 * Decide qué hacer con cada archivo. `registered` es el índice actual (hash de lo que GenPM escribió), así que
 * `sri(ours) === registered[rel]` significa "sin cambios locales".
 */
export async function planMerge(input: {
  base: Tree;
  theirs: Tree;
  ours: Tree;
  registered: Record<string, string>;
  /** Solo tests: implementación alternativa de `git merge-file`. */
  mergeFile?: typeof gitMergeFile;
}): Promise<MergePlan> {
  const { base, theirs, ours, registered } = input;
  const mergeFile = input.mergeFile ?? gitMergeFile;
  const outcomes: MergeOutcome[] = [];
  const writes = new Map<string, Buffer>();
  const deletes: string[] = [];
  const index: Record<string, string> = {};
  const all = [...new Set([...theirs.keys(), ...Object.keys(registered), ...base.keys()])].sort();
  for (const rel of all) {
    const t = theirs.get(rel);
    const o = ours.get(rel);
    const b = base.get(rel);
    const clean = o !== undefined && registered[rel] !== undefined && sri(o) === registered[rel];
    if (t !== undefined) {
      index[rel] = sri(t);
      if (o === undefined) {
        // Borrado en local: si upstream no lo tocó se respeta; si cambió, vuelve con la versión nueva.
        if (registered[rel] !== undefined && same(b, t)) outcomes.push({ rel, kind: 'stay-deleted' });
        else {
          writes.set(rel, t);
          outcomes.push({ rel, kind: 'take' });
        }
      } else if (clean || o.equals(t)) {
        if (!o.equals(t)) writes.set(rel, t);
        outcomes.push({ rel, kind: 'take' });
      } else if (same(b, t)) {
        outcomes.push({ rel, kind: 'keep' });
      } else if (isBinary(o) || isBinary(t) || (b && isBinary(b))) {
        outcomes.push({ rel, kind: 'binary-conflict' });
      } else {
        const r = await mergeFile(o, b ?? Buffer.alloc(0), t);
        writes.set(rel, r.content);
        outcomes.push({ rel, kind: r.conflicts ? 'conflict' : 'merged' });
      }
    } else if (registered[rel] !== undefined || b !== undefined) {
      // Ya no existe upstream.
      if (o === undefined) continue;
      if (clean || same(o, b)) {
        deletes.push(rel);
        outcomes.push({ rel, kind: 'delete' });
      } else outcomes.push({ rel, kind: 'orphan' });
    }
  }
  return { outcomes, writes, deletes, index };
}

/** `git merge-file -p` con etiquetas legibles. Devuelve el resultado y si quedaron conflictos. */
export async function gitMergeFile(
  ours: Buffer,
  base: Buffer,
  theirs: Buffer,
): Promise<{ content: Buffer; conflicts: boolean }> {
  const dir = await mkdtemp(join(tmpdir(), 'genpm-merge-'));
  try {
    const [o, b, t] = ['ours', 'base', 'theirs'].map((n) => join(dir, n)) as [string, string, string];
    await Promise.all([writeFile(o, ours), writeFile(b, base), writeFile(t, theirs)]);
    const flags = await hardeningFlags();
    return await new Promise((resolve, reject) => {
      execFile(
        'git',
        [...flags, 'merge-file', '-p', '-L', 'local', '-L', 'installed', '-L', 'upstream', o, b, t],
        { env: hardenedEnv(), encoding: 'buffer', maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: 60_000 },
        (err, stdout, stderr) => {
          // merge-file sale con el nº de conflictos (> 0) o con un código negativo (255) si falla.
          const code = err ? ((err as { code?: number | string }).code ?? 1) : 0;
          if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') return reject(fail('E_GIT_MISSING'));
          if (typeof code === 'number' && code >= 0 && code < 128)
            return resolve({ content: stdout, conflicts: code > 0 });
          reject(fail('E_UPSTREAM_GIT', { detail: stderr.toString('utf8').trim().slice(0, 300) || 'merge-file' }));
        },
      );
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Diff unificado `base..theirs` con rutas `a/<d>/…` y `b/<d>/…`, aplicable con `git apply --3way` desde la raíz del
 * proyecto. Usa `git diff --no-index` sobre dos árboles temporales.
 */
export async function unifiedDiff(base: Tree, theirs: Tree, d: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'genpm-diff-'));
  try {
    for (const [side, tree] of [
      ['a', base],
      ['b', theirs],
    ] as const) {
      await mkdir(join(dir, side, ...d.split('/')), { recursive: true });
      for (const [rel, data] of tree) {
        const abs = join(dir, side, ...d.split('/'), ...rel.split('/'));
        await mkdir(dirname(abs), { recursive: true });
        await writeFile(abs, data);
      }
    }
    const flags = await hardeningFlags();
    return await new Promise((resolve, reject) => {
      execFile(
        'git',
        [...flags, 'diff', '--no-index', '--no-color', '--no-ext-diff', '--src-prefix=', '--dst-prefix=', 'a', 'b'],
        { cwd: dir, env: hardenedEnv(), encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, windowsHide: true },
        (err, stdout, stderr) => {
          if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') return reject(fail('E_GIT_MISSING'));
          // --no-index sale con 1 cuando hay diferencias.
          const code = err ? (err as { code?: number }).code : 0;
          if (code === 0 || code === 1) return resolve(stdout.toString('utf8'));
          reject(fail('E_UPSTREAM_GIT', { detail: stderr.toString('utf8').trim().slice(0, 300) || 'diff' }));
        },
      );
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Lee un árbol de archivos de disco (rutas relativas). Los que no existen no aparecen. */
export async function readTree(baseAbs: string, rels: Iterable<string>): Promise<Tree> {
  const out: Tree = new Map();
  for (const rel of rels) {
    try {
      out.set(rel, await readFile(join(baseAbs, ...rel.split('/'))));
    } catch {
      // ausente
    }
  }
  return out;
}
