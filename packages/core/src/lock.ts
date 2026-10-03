// core/lock (manifest-spec §6): `genpm.lock` (una línea por paquete, firma `sg`) y `.genpm/files/<slug>.json`
// (hash SHA-256 por archivo inyectado → detección de drift e integridad `h`).

import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { en, errorText } from '@genpm/i18n';
import {
  emptyLock,
  FilesIndex,
  type LockEntry,
  type LockFile,
  parseLock,
  serializeLock,
  slugOf,
} from '@genpm/manifest';
import { fail } from './errors.js';
import { readTextOrNull, writeFileAtomic } from './fs/io.js';
import { safePath } from './fs/safe-path.js';

export const LOCK_FILE = 'genpm.lock';
export const STATE_DIR = '.genpm';

export async function readLock(root: string): Promise<LockFile> {
  const text = await readTextOrNull(join(root, LOCK_FILE));
  if (text === null) return emptyLock();
  return parseLock(text, errorText(en, 'E_LOCK_INVALID'));
}

export async function writeLock(root: string, lock: LockFile): Promise<void> {
  await writeFileAtomic(await safePath(root, LOCK_FILE), serializeLock(lock));
}

/** `sha256-<base64>` de unos bytes (formato de integridad estilo SRI). */
export function sri(data: Uint8Array | string): string {
  return `sha256-${createHash('sha256').update(data).digest('base64')}`;
}

/** `h` = sha256 de la lista ordenada `ruta\0sha256\n` del índice de archivos (manifest-spec §6). */
export function integrityOf(files: Record<string, string>): string {
  const lines = Object.keys(files)
    .sort()
    .map((p) => `${p}\0${files[p]}\n`)
    .join('');
  return sri(lines);
}

export function filesIndexPath(name: string): string {
  return `${STATE_DIR}/files/${slugOf(name)}.json`;
}

export async function readFilesIndex(root: string, name: string): Promise<FilesIndex | null> {
  const text = await readTextOrNull(join(root, ...filesIndexPath(name).split('/')));
  if (text === null) return null;
  try {
    return FilesIndex.parse(JSON.parse(text));
  } catch {
    throw fail('E_LOCK_INVALID');
  }
}

export function serializeFilesIndex(index: FilesIndex): string {
  const f: Record<string, string> = {};
  for (const k of Object.keys(index.f).sort()) f[k] = index.f[k]!;
  return `${JSON.stringify({ c: index.c, f })}\n`;
}

export async function writeFilesIndex(root: string, name: string, index: FilesIndex): Promise<void> {
  await writeFileAtomic(await safePath(root, filesIndexPath(name)), serializeFilesIndex(index));
}

export async function removeFilesIndex(root: string, name: string): Promise<void> {
  await rm(await safePath(root, filesIndexPath(name)), { force: true });
}

export type Drift = { modified: string[]; deleted: string[]; added: string[] };

/** Compara los archivos en `<d>` con los hashes registrados. `added` = archivos nuevos dentro de `d`. */
export async function driftOf(
  root: string,
  entry: Pick<LockEntry, 'd'>,
  index: FilesIndex | null,
  listDir?: (abs: string) => Promise<string[]>,
): Promise<Drift> {
  const drift: Drift = { modified: [], deleted: [], added: [] };
  if (!index) return drift;
  for (const [rel, hash] of Object.entries(index.f)) {
    let data: Buffer;
    try {
      data = await readFile(join(root, ...entry.d.split('/'), ...rel.split('/')));
    } catch {
      drift.deleted.push(rel);
      continue;
    }
    if (sri(data) !== hash) drift.modified.push(rel);
  }
  if (listDir) {
    const present = await listDir(join(root, ...entry.d.split('/')));
    for (const rel of present) if (!(rel in index.f)) drift.added.push(rel);
  }
  drift.modified.sort();
  drift.deleted.sort();
  drift.added.sort();
  return drift;
}

export function driftCount(d: Drift): number {
  return d.modified.length + d.deleted.length + d.added.length;
}

/** Ruta del candado de concurrencia (cli-mcp-spec §0). */
export const BUSY_LOCK = `${STATE_DIR}/.lock`;
