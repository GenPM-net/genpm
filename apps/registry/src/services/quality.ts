// Puntuación de calidad (V02-04): combina lo que se midió al publicar (licencia, secciones de AGENTS.md, tests) con lo
// que cambia con el tiempo (escaneo, mantenimiento, verificación, descripción). Ver @genpm/manifest/quality.
import { qualityScore, type StaticQuality, staticQuality } from '@genpm/manifest';
import type { Env } from '../env.js';

const DAY = 86_400_000;

type Row = {
  id: string;
  license: string | null;
  summary: string | null;
  is_deprecated: number;
  is_verified: number | null;
  scan_status: 'pending' | 'passed' | 'flagged' | 'failed' | null;
  scan_report: string | null;
  context_excerpt: string | null;
  published_at: number | null;
  keywords: number;
};

/** Recalcula la puntuación de un paquete (o de todos los activos). Devuelve cuántos actualizó. */
export async function recomputeQuality(env: Env, packageId?: string, now = Date.now()): Promise<number> {
  // nosemgrep: semgrep.d1-prepare-no-template -- el único fragmento interpolado es el literal fijo AND p.id = ?1; el valor va por bind()
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.license, p.summary, p.is_deprecated, a.is_verified, v.scan_status, v.scan_report, v.context_excerpt,
            v.published_at, (SELECT count(*) FROM package_keywords k WHERE k.package_id = p.id) AS keywords
     FROM packages p
     LEFT JOIN package_versions v ON v.id = p.latest_version_id
     LEFT JOIN accounts a ON a.id = p.owner_id
     WHERE p.status != 'removed' ${packageId ? 'AND p.id = ?1' : ''}`,
  )
    .bind(...(packageId ? [packageId] : []))
    .all<Row>();
  const stmts: D1PreparedStatement[] = [];
  for (const r of results) {
    const report = r.scan_report ? (JSON.parse(r.scan_report) as { quality?: StaticQuality }) : {};
    // Versiones publicadas antes de V02-04: se estima con el extracto de reglas (sin dato de tests).
    const s = report.quality ?? staticQuality({ license: r.license, rules: r.context_excerpt, paths: [] });
    const q = qualityScore(s, {
      scan: r.scan_status,
      daysSinceRelease: r.published_at ? (now - r.published_at) / DAY : Number.POSITIVE_INFINITY,
      verified: r.is_verified === 1,
      summary: !!r.summary,
      keywords: Number(r.keywords),
      deprecated: r.is_deprecated === 1,
    });
    stmts.push(
      env.DB.prepare('UPDATE packages SET quality_score = ?1, quality = ?2 WHERE id = ?3').bind(
        q.score,
        JSON.stringify(q.checks.map((c) => [c.id, c.ok ? 1 : 0])),
        r.id,
      ),
    );
  }
  if (stmts.length) await env.DB.batch(stmts);
  return stmts.length;
}

/** Detalle guardado en `packages.quality` → `[{id, ok, weight}]` para la API. */
export function qualityChecks(raw: string | null): Array<{ id: string; ok: boolean }> {
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as Array<[string, number]>).map(([id, ok]) => ({ id, ok: ok === 1 }));
  } catch {
    return [];
  }
}
