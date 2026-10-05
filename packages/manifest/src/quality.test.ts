import { describe, expect, it } from 'vitest';
import { QUALITY_WEIGHTS, qualityScore, staticQuality } from './quality.js';

const RULES = "# @core/auth\n\n## Purpose\nx\n\n## Integration (do this after installing)\ny\n\n## Don't\nz\n";
const dyn = {
  scan: 'passed' as const,
  daysSinceRelease: 3,
  verified: true,
  summary: true,
  keywords: 2,
  deprecated: false,
};

describe('quality', () => {
  it('weights add up to 100', () => {
    expect(Object.values(QUALITY_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('scores a complete package 100', () => {
    const s = staticQuality({ license: 'MIT', rules: RULES, paths: ['index.ts', 'tests/auth.test.ts'] });
    expect(s).toEqual({
      license: true,
      rulesPurpose: true,
      rulesIntegration: true,
      rulesConventions: true,
      tests: true,
    });
    expect(qualityScore(s, dyn).score).toBe(100);
  });
  it('detects missing pieces and recognizes translated sections', () => {
    const s = staticQuality({ license: 'NOASSERTION', rules: '## Propósito\n\n## Integración\n', paths: ['a.ts'] });
    expect(s).toMatchObject({ license: false, rulesPurpose: true, rulesIntegration: true, tests: false });
    const r = qualityScore(s, { ...dyn, scan: 'flagged', daysSinceRelease: 400, verified: false, keywords: 0 });
    expect(r.score).toBe(25);
    expect(r.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual([
      'license',
      'rulesConventions',
      'tests',
      'scan',
      'maintained',
      'verified',
      'described',
    ]);
  });
  it('a deprecated package scores 0', () => {
    const s = staticQuality({ license: 'MIT', rules: RULES, paths: ['x.spec.ts'] });
    expect(qualityScore(s, { ...dyn, deprecated: true }).score).toBe(0);
  });
});
