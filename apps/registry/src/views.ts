// Representaciones compacta (claves de 1 carácter, CLI --json y MCP) y larga (web) (api-spec §1, §4).

import { pickSummary, type ResolvedManifest } from '@genpm/manifest';
import type { PackageRow, VersionRow } from './db/repo.js';

/** `packages.summary` guarda el mapa de idiomas de `s` como JSON. */
export function summaryOf(raw: string | null, locale: string): string | undefined {
  if (!raw) return undefined;
  try {
    return pickSummary(JSON.parse(raw) as ResolvedManifest['s'], locale);
  } catch {
    return raw;
  }
}

export function manifestOf(v: VersionRow): ResolvedManifest {
  return JSON.parse(v.manifest) as ResolvedManifest;
}

/**
 * Manifiesto resuelto con `sg` adjunto (forma compacta). Se entrega íntegro (con `s` en todos sus idiomas)
 * porque la firma cubre la forma canónica completa; el cliente elige el idioma al mostrarlo.
 */
export function compactManifest(v: VersionRow, _locale?: string): ResolvedManifest {
  const out: Record<string, unknown> = { ...manifestOf(v) };
  if (v.signature) out['sg'] = v.signature;
  return out as ResolvedManifest;
}

/** Manifiesto en forma larga para la web y humanos. */
export function longManifest(v: VersionRow, locale: string) {
  const m = manifestOf(v);
  return {
    schema: m.$,
    name: m.n,
    version: m.v,
    summary: pickSummary(m.s, locale) ?? null,
    repo: m.r,
    ref: m.t,
    commit: m.c,
    dest: m.d,
    include: m.i,
    context: m.x,
    license: m.l,
    keywords: m.k ?? [],
    genpmDependencies: m.g ?? {},
    npmDependencies: m.p ?? {},
    env: m.e ?? [],
    mcp: m.m ?? [],
    signature: v.signature,
  };
}

export const iso = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : null);

export function compactSearchRow(p: PackageRow & { is_verified: number }, keywords: string[], locale: string) {
  return {
    n: p.full_name,
    v: p.latest_version!,
    s: summaryOf(p.summary, locale) ?? '',
    k: keywords,
    i: p.installs_30d,
    m: p.has_mcp,
    vf: p.is_verified,
  };
}

export function longSearchRow(
  p: PackageRow & { is_verified: number; publisher: string; rel?: number },
  keywords: string[],
  locale: string,
) {
  return {
    name: p.full_name,
    version: p.latest_version,
    summary: summaryOf(p.summary, locale) ?? null,
    keywords,
    installs30d: p.installs_30d,
    hasMcp: p.has_mcp === 1,
    publisher: { handle: p.publisher, verified: p.is_verified === 1 },
    license: p.license,
    updatedAt: iso(p.updated_at),
    featured: p.is_featured === 1,
    score: p.rel === undefined ? null : Math.round(-p.rel * 100) / 100,
  };
}
