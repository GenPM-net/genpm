// INV-3 Confinamiento (security §2): punto ÚNICO por el que pasa toda ruta de escritura (AGENTS.md).
// Valida la ruta relativa (manifest/validators), la confina a la raíz y comprueba con lstat + realpath
// cada directorio padre existente: un directorio enlazado del usuario no puede desviar la escritura.

import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';
import { checkRelativePath } from '@genpm/manifest';
import { fail } from '../errors.js';

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

async function lstatOrNull(p: string) {
  try {
    return await lstat(p);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/**
 * Devuelve la ruta absoluta de `rel` dentro de `root` o lanza `E_PATH_UNSAFE`.
 * `rel` es una ruta POSIX relativa (como en los manifiestos); nunca absoluta ni con `..`.
 */
export async function safePath(root: string, rel: string): Promise<string> {
  const problem = checkRelativePath(rel);
  if (problem) throw fail('E_PATH_UNSAFE', { path: rel, reason: problem });

  const realRoot = await realpath(root);
  const target = join(realRoot, ...rel.split('/'));
  /* v8 ignore next -- defensa en profundidad: checkRelativePath ya impide salir de la raíz */
  if (!isInside(realRoot, target)) throw fail('E_PATH_UNSAFE', { path: rel, reason: 'outside_root' });

  // Cada componente existente (padres y destino) debe ser un directorio/archivo real, nunca un enlace.
  const segments = rel.split('/');
  let current = realRoot;
  for (let i = 0; i < segments.length; i++) {
    current = join(current, segments[i]!);
    const st = await lstatOrNull(current);
    if (st === null) break;
    if (st.isSymbolicLink()) throw fail('E_PATH_UNSAFE', { path: rel, reason: 'symlink' });
    const isLast = i === segments.length - 1;
    if (!isLast && !st.isDirectory()) throw fail('E_PATH_UNSAFE', { path: rel, reason: 'not_a_directory' });
    if (isLast && !st.isDirectory() && !st.isFile()) throw fail('E_PATH_UNSAFE', { path: rel, reason: 'special_file' });
    // Defensa en profundidad (montajes, firmlinks): el lstat anterior ya rechaza los enlaces simbólicos.
    /* v8 ignore next */
    if (!isInside(realRoot, await realpath(current)))
      throw fail('E_PATH_UNSAFE', { path: rel, reason: 'outside_root' });
  }
  return target;
}

/** Igual que `safePath` pero también rechaza destinos dentro de `.git/`, `node_modules/` o `.genpm/`. */
export async function safeDestPath(
  root: string,
  rel: string,
  reserved = ['.git', 'node_modules', '.genpm'],
): Promise<string> {
  const first = rel.split('/')[0]!.toLowerCase();
  if (reserved.includes(first)) throw fail('E_PATH_UNSAFE', { path: rel, reason: 'reserved_dir' });
  return safePath(root, rel);
}
