// Validadores puros (manifest-spec §3–§4, security §8.2). Devuelven un motivo en inglés estable o `null` si es válido.
// Los motivos son identificadores de máquina (no texto de interfaz): la CLI los traduce vía @genpm/i18n.

import { LIMITS, NAME_RE, SCOPE_RE, SHA_RE, VERSION_RE } from './constants.js';

export type PathProblem =
  | 'empty'
  | 'too_long'
  | 'too_deep'
  | 'absolute'
  | 'home'
  | 'backslash'
  | 'colon'
  | 'control_char'
  | 'invisible_char'
  | 'not_nfc'
  | 'empty_segment'
  | 'dot_segment'
  | 'dotdot_segment'
  | 'encoded_traversal'
  | 'reserved_dir'
  | 'windows_reserved'
  | 'trailing_dot_or_space';

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\..*)?$/i;
// Bidi (Trojan Source), zero-width, BOM, Unicode Tags y otros invisibles.
const INVISIBLE = /[\u00AD\u061C\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\u{E0000}-\u{E007F}]/u;
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;
/** Directorios a los que nunca se puede inyectar (comparación sin distinguir mayúsculas: APFS/NTFS). */
const RESERVED_PREFIXES = ['.git', 'node_modules', '.genpm'];
const RESERVED_EXACT = ['.github', '.vscode', '.cursor'];

function decodePercent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Comprueba una ruta relativa POSIX de un solo archivo o directorio (sin I/O).
 * Base de `checkDest` y de `core/fs/safePath`.
 */
export function checkRelativePath(
  p: string,
  opts: { maxLength?: number; maxSegments?: number } = {},
): PathProblem | null {
  const maxLength = opts.maxLength ?? Number.POSITIVE_INFINITY;
  const maxSegments = opts.maxSegments ?? Number.POSITIVE_INFINITY;
  if (p.length === 0) return 'empty';
  if (p.length > maxLength) return 'too_long';
  if (CONTROL.test(p)) return 'control_char';
  if (INVISIBLE.test(p)) return 'invisible_char';
  if (p.includes('\\')) return 'backslash';
  if (p.includes(':')) return 'colon';
  if (p.startsWith('/')) return 'absolute';
  if (p.startsWith('~')) return 'home';
  if (p !== p.normalize('NFC')) return 'not_nfc';
  const segments = p.split('/');
  if (segments.length > maxSegments) return 'too_deep';
  for (const seg of segments) {
    if (seg === '') return 'empty_segment';
    if (seg === '.') return 'dot_segment';
    if (seg === '..') return 'dotdot_segment';
    const decoded = decodePercent(seg);
    if (decoded !== seg && (decoded === '.' || decoded === '..' || /[/\\]/.test(decoded))) return 'encoded_traversal';
    if (WINDOWS_RESERVED.test(seg)) return 'windows_reserved';
    if (/[. ]$/.test(seg)) return 'trailing_dot_or_space';
  }
  return null;
}

/** Ruta destino `d` (manifest-spec §4). */
export function checkDest(d: string): PathProblem | null {
  const problem = checkRelativePath(d, { maxLength: LIMITS.pathLength, maxSegments: LIMITS.pathSegments });
  if (problem) return problem;
  const lower = d.toLowerCase();
  const first = lower.split('/')[0]!;
  if (RESERVED_PREFIXES.includes(first)) return 'reserved_dir';
  if (RESERVED_EXACT.includes(lower)) return 'reserved_dir';
  return null;
}

/** Subdirectorio `i` del repo: `.` o una ruta relativa segura. */
export function checkInclude(i: string): PathProblem | null {
  if (i === '.') return null;
  return checkRelativePath(i, { maxLength: LIMITS.pathLength });
}

/** Archivo de reglas `x`, relativo a `i`: no puede salir de `i`. */
export function checkContextPath(x: string): PathProblem | null {
  return checkRelativePath(x, { maxLength: LIMITS.pathLength });
}

export function isValidName(n: string): boolean {
  return NAME_RE.test(n);
}

export function isValidScope(scope: string): boolean {
  return SCOPE_RE.test(scope);
}

export function parseName(n: string): { scope: string; name: string } | null {
  if (!NAME_RE.test(n)) return null;
  const slash = n.indexOf('/');
  return { scope: n.slice(1, slash), name: n.slice(slash + 1) };
}

/** `@core/auth` → `core__auth` (manifest-spec §6.2). */
export function slugOf(n: string): string {
  return n.replace(/^@/, '').replace('/', '__');
}

export function isValidVersion(v: string): boolean {
  return VERSION_RE.test(v);
}

export function isSha(s: string): boolean {
  return SHA_RE.test(s);
}

/**
 * Nombres que casi siempre son ramas. El registry verifica el tipo real contra GitHub (api-spec §4.5 paso 4);
 * esta lista es la primera barrera en el cliente y en `genpm validate`.
 */
export const BRANCH_LIKE_REFS = [
  'HEAD',
  'main',
  'master',
  'trunk',
  'develop',
  'development',
  'dev',
  'default',
  'stable',
  'staging',
  'production',
  'prod',
  'next',
  'canary',
  'nightly',
  'gh-pages',
  'latest',
] as const;

export type RefProblem = 'empty' | 'too_long' | 'branch' | 'invalid_format' | 'short_sha';

/** Ref `t`: nombre de tag Git válido o SHA de 40/64 hex. Nunca una rama. */
export function checkRef(t: string): RefProblem | null {
  if (t.length === 0) return 'empty';
  if (t.length > LIMITS.refLength) return 'too_long';
  if (SHA_RE.test(t)) return null;
  if (/^[0-9a-f]{7,39}$/.test(t)) return 'short_sha';
  if (t.startsWith('refs/heads/') || t.startsWith('origin/')) return 'branch';
  const bare = t.startsWith('refs/tags/') ? t.slice('refs/tags/'.length) : t;
  if ((BRANCH_LIKE_REFS as readonly string[]).includes(bare)) return 'branch';
  if (/^(feature|feat|fix|bugfix|hotfix|release|chore)\//.test(bare)) return 'branch';
  // git check-ref-format
  if (
    bare.length === 0 ||
    bare.startsWith('-') ||
    bare.startsWith('/') ||
    bare.endsWith('/') ||
    bare.endsWith('.') ||
    bare.endsWith('.lock') ||
    bare.includes('..') ||
    bare.includes('@{') ||
    bare.includes('//') ||
    bare === '@' ||
    /[\u0000-\u0020\u007F~^:?*[\\]/.test(bare) ||
    bare.split('/').some((seg) => seg.startsWith('.'))
  ) {
    return 'invalid_format';
  }
  return null;
}

/** `true` si `t` es un SHA completo (instalación anclada sin resolver tag). */
export function isImmutableRef(t: string): boolean {
  return checkRef(t) === null;
}
