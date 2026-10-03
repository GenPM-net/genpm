// Validación de manifiestos con detalle por campo, derivación del resuelto y normalización de entradas MCP.

import semver from 'semver';
import { DEFAULTS, SCHEMA_VERSION } from './constants.js';
import type { ErrorCode, Issue } from './errors.js';
import { type McpServerEntry, type McpServerObject, ResolvedManifest, SourceManifest } from './schema.js';

export type ValidationResult<T> = { ok: true; data: T; issues: [] } | { ok: false; code: ErrorCode; issues: Issue[] };

type ZodLikeIssue = { path: PropertyKey[]; message: string; params?: Record<string, unknown> };

function toIssues(issues: readonly ZodLikeIssue[]): { code: ErrorCode; issues: Issue[] } {
  // Una ruta insegura o una ref mutable tienen su propio código (manifest-spec §10).
  let code: ErrorCode = 'E_MANIFEST_INVALID';
  for (const i of issues) {
    const genpm = i.params?.['genpm'];
    if (genpm === 'E_PATH_UNSAFE' || genpm === 'E_REF_MUTABLE') {
      code = genpm;
      break;
    }
  }
  return { code, issues: issues.map((i) => ({ path: i.path.map(String).join('.') || '(root)', message: i.message })) };
}

export function validateSource(raw: unknown): ValidationResult<SourceManifest> {
  const r = SourceManifest.safeParse(raw);
  if (r.success) return { ok: true, data: r.data, issues: [] };
  return { ok: false, ...toIssues(r.error.issues as ZodLikeIssue[]) };
}

export function validateResolved(raw: unknown): ValidationResult<ResolvedManifest> {
  const r = ResolvedManifest.safeParse(raw);
  if (r.success) return { ok: true, data: r.data, issues: [] };
  return { ok: false, ...toIssues(r.error.issues as ZodLikeIssue[]) };
}

/** Ref por defecto cuando el autor no declara `t`: `v{v}`. */
export function defaultRef(source: Pick<SourceManifest, 'v' | 't'>): string {
  return source.t ?? `v${source.v}`;
}

/**
 * Construye el manifiesto resuelto a partir del fuente y de lo que el registry leyó de Git.
 * Mantiene las claves con valor default (`$`, `i`, `x`) para que el LLM no tenga que conocerlas (§8).
 */
export function toResolved(
  source: SourceManifest,
  at: { r: string; t: string; c: string; l: string },
): ResolvedManifest {
  const out: Record<string, unknown> = {
    ...source,
    $: SCHEMA_VERSION,
    r: at.r,
    t: at.t,
    c: at.c,
    i: source.i ?? DEFAULTS.include,
    x: source.x ?? DEFAULTS.context,
    l: at.l,
  };
  return ResolvedManifest.parse(out);
}

/** Nombre de servidor derivado de la forma abreviada: `@stripe/mcp` → `stripe-mcp`. */
export function mcpNameFromPackage(pkg: string): string {
  const scoped = pkg.match(/^@([^/]+)\/(.+)$/);
  let base = scoped ? scoped[2]! : pkg;
  if (scoped && (base === 'mcp' || base === 'server' || base === 'mcp-server')) base = scoped[1]!;
  base = base
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (base === '') return 'mcp';
  if (!base.endsWith('mcp')) base = `${base}-mcp`;
  return base.slice(0, 32).replace(/-+$/, '');
}

/** Expande la forma abreviada (manifest-spec §3.3). */
export function normalizeMcp(entry: McpServerEntry): McpServerObject {
  if (typeof entry === 'string') return { n: mcpNameFromPackage(entry), c: 'npx', a: ['-y', entry] };
  return entry;
}

/** Idioma de `s` para una superficie de un solo idioma (i18n §3): el pedido, su base, o `en`. */
export function pickSummary(s: SourceManifest['s'], locale = 'en'): string | undefined {
  if (s === undefined) return undefined;
  if (typeof s === 'string') return s;
  return s[locale] ?? s[locale.split('-')[0]!] ?? s['en'];
}

// ───────────── SemVer ─────────────

export function compareVersions(a: string, b: string): number {
  return semver.compare(a, b);
}

export function isValidRange(range: string): boolean {
  return semver.validRange(range) !== null;
}

export function satisfies(version: string, range: string): boolean {
  return semver.satisfies(version, range, { includePrerelease: false });
}

/** Versión más alta que satisface el rango (prerelease solo si el rango lo pide: api-spec §10). */
export function maxSatisfying(versions: readonly string[], range: string): string | null {
  return semver.maxSatisfying([...versions], range);
}

export function isPrerelease(version: string): boolean {
  return semver.prerelease(version) !== null;
}

export function diffKind(from: string, to: string): 'major' | 'minor' | 'patch' | 'prerelease' | null {
  const d = semver.diff(from, to);
  if (d === null) return null;
  if (d === 'major' || d === 'premajor') return 'major';
  if (d === 'minor' || d === 'preminor') return 'minor';
  if (d === 'patch' || d === 'prepatch') return 'patch';
  return 'prerelease';
}

export function parseVersionParts(v: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
} {
  const p = semver.parse(v);
  if (!p) throw new TypeError(`invalid version ${v}`);
  return {
    major: p.major,
    minor: p.minor,
    patch: p.patch,
    prerelease: p.prerelease.length ? p.prerelease.join('.') : null,
  };
}
