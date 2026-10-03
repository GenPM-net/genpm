// Utilidades de disco del motor. Toda escritura reemplaza la entrada de directorio de forma atómica
// (archivo temporal + rename): nunca se escribe "a través" de un hardlink o de un archivo abierto.

import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function readTextOrNull(p: string): Promise<string | null> {
  try {
    return await readFile(p, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/** INV-4: los archivos se crean siempre con modo 0o644. */
export async function writeFileAtomic(abs: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(abs), { recursive: true });
  const tmp = `${abs}.genpm-${randomBytes(6).toString('hex')}.tmp`;
  try {
    await writeFile(tmp, data, { mode: 0o644 });
    await rename(tmp, abs);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}
