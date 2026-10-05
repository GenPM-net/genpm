import { describe, expect, it } from 'vitest';
import { PolicySchema, policyViolation } from './policy.js';

describe('policyViolation (ENT-03)', () => {
  const p = PolicySchema.parse({
    allow: ['@corp/*', '@core/auth'],
    requireScan: true,
    denyLicenses: ['AGPL-3.0'],
    allowDirect: false,
  });
  it('allows listed packages with a passed scan and an allowed license', () => {
    expect(policyViolation(p, { n: '@corp/api', l: 'MIT', scan: 'passed' })).toBeNull();
    expect(policyViolation(p, { n: '@core/auth', l: 'MIT', scan: 'passed' })).toBeNull();
  });
  it('rejects the rest with a reason', () => {
    expect(policyViolation(p, { n: '@core/db', l: 'MIT', scan: 'passed' })).toMatch(/allowed packages/);
    expect(policyViolation(p, { n: '@corp/api', l: 'MIT', scan: 'pending' })).toMatch(/pending/);
    expect(policyViolation(p, { n: '@corp/api', l: 'agpl-3.0', scan: 'passed' })).toMatch(/license/);
    expect(policyViolation(p, { n: '@corp/api', direct: true })).toMatch(/direct/);
    expect(policyViolation({}, { n: '@x/y', direct: true })).toBeNull();
  });
  it('validates patterns', () => {
    expect(PolicySchema.safeParse({ allow: ['corp'] }).success).toBe(false);
    expect(PolicySchema.safeParse({ allow: ['*'] }).success).toBe(true);
  });
});
