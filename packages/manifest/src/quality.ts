// Puntuación de calidad de un paquete (V02-04, brainstorming §4): 0–100 a partir de comprobaciones objetivas.
// Pura (sin I/O): la usan el registry (al publicar y en el cron diario), `genpm validate` y la web.

export const QUALITY_CHECKS = [
  'license',
  'rulesPurpose',
  'rulesIntegration',
  'rulesConventions',
  'tests',
  'scan',
  'maintained',
  'verified',
  'described',
] as const;
export type QualityCheck = (typeof QUALITY_CHECKS)[number];

/** Peso de cada comprobación; suman 100. */
export const QUALITY_WEIGHTS: Record<QualityCheck, number> = {
  license: 15,
  rulesPurpose: 10,
  rulesIntegration: 15,
  rulesConventions: 5,
  tests: 15,
  scan: 15,
  maintained: 10,
  verified: 5,
  described: 10,
};

/** Lo que solo se puede saber al publicar (árbol completo y reglas enteras). */
export type StaticQuality = Pick<
  Record<QualityCheck, boolean>,
  'license' | 'rulesPurpose' | 'rulesIntegration' | 'rulesConventions' | 'tests'
>;

const TEST_PATH = /(^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$|_test\.(go|py)$|(^|\/)test_[^/]+\.py$/i;

/** Secciones recomendadas del AGENTS.md (docs/writing-rules): por título de nivel 2, en cualquier idioma común. */
const SECTION = {
  purpose: /^##\s+(purpose|propósito|objetivo|finalidad|but|zweck|目的|用途|목적)\b/im,
  integration: /^##\s+(integration|integración|integração|intégration|integration|統合|集成|통합)/im,
  conventions:
    /^##\s+(conventions|convenciones|convenções|conventions|konventionen|規約|约定|규칙|don'?t|no hagas|não faça)/im,
};

export function staticQuality(input: {
  license: string | null | undefined;
  rules: string | null | undefined;
  /** Todas las rutas del paquete (relativas a `i`), incluidas las que excluye `.genpmignore`. */
  paths: Iterable<string>;
}): StaticQuality {
  const rules = input.rules ?? '';
  let tests = false;
  for (const p of input.paths) if (TEST_PATH.test(p)) tests = true;
  return {
    license: !!input.license && input.license !== 'NOASSERTION' && input.license !== 'UNLICENSED',
    rulesPurpose: SECTION.purpose.test(rules),
    rulesIntegration: SECTION.integration.test(rules),
    rulesConventions: SECTION.conventions.test(rules),
    tests,
  };
}

export type QualityReport = {
  score: number;
  checks: Array<{ id: QualityCheck; ok: boolean; weight: number }>;
};

export function qualityScore(
  s: StaticQuality,
  d: {
    scan: 'pending' | 'passed' | 'flagged' | 'failed' | null;
    /** Días desde la última versión publicada. */
    daysSinceRelease: number;
    verified: boolean;
    summary: boolean;
    keywords: number;
    deprecated: boolean;
  },
): QualityReport {
  const ok: Record<QualityCheck, boolean> = {
    ...s,
    scan: d.scan === 'passed',
    maintained: d.daysSinceRelease <= 180,
    verified: d.verified,
    described: d.summary && d.keywords > 0,
  };
  const checks = QUALITY_CHECKS.map((id) => ({ id, ok: ok[id], weight: QUALITY_WEIGHTS[id] }));
  const raw = checks.reduce((n, c) => n + (c.ok ? c.weight : 0), 0);
  // Un paquete obsoleto no compite: su puntuación se queda en 0.
  return { score: d.deprecated ? 0 : raw, checks };
}
