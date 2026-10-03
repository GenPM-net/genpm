// Selección de archivos a inyectar (manifest-spec §5.5): `.genpmignore` (sintaxis gitignore, relativa a `i`) más las
// exclusiones duras. La usan el registry (escaneo en publish), `genpm validate` y la copia del cliente.

import ignore from 'ignore';
import { ALWAYS_EXCLUDED } from './constants.js';

export type FileFilter = (path: string) => boolean;

/** Devuelve un predicado `incluido(rutaRelativaAi)`. */
export function createFileFilter(genpmignore?: string | null): FileFilter {
  const ig = ignore({ allowRelativePaths: false }).add([...ALWAYS_EXCLUDED]);
  if (genpmignore) ig.add(genpmignore);
  return (path: string) => {
    if (!path || path.startsWith('/') || path.split('/').includes('..')) return false;
    return !ig.ignores(path);
  };
}

/** Ruta dentro de `i`: `relativeToInclude('packages/auth', 'packages/auth/src/x.ts')` → `src/x.ts`. */
export function relativeToInclude(include: string, repoPath: string): string | null {
  if (include === '.' || include === '') return repoPath;
  const prefix = `${include.replace(/\/+$/, '')}/`;
  return repoPath.startsWith(prefix) ? repoPath.slice(prefix.length) : null;
}
