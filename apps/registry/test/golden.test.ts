// D1-G-04: los fixtures golden validan igual en Workers que en Node (packages/manifest/src/schema.test.ts).

import { canonicalize, manifestHash, validateResolved, validateSource } from '@genpm/manifest';
import golden from '@genpm/manifest/fixtures/golden.json';
import { describe, expect, it } from 'vitest';

describe('golden fixtures in workerd', () => {
  for (const c of golden.source.valid)
    it(`source valid: ${c.name}`, () => expect(validateSource(c.input).ok).toBe(true));
  for (const c of golden.source.invalid) {
    it(`source invalid: ${c.name}`, () => {
      const r = validateSource(c.input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe(c.code);
    });
  }
  for (const c of golden.resolved.valid) {
    it(`resolved valid: ${c.name}`, async () => {
      expect(validateResolved(c.input).ok).toBe(true);
      expect(canonicalize(c.input)).toBe(c.canonical);
      expect(await manifestHash(c.input)).toMatch(/^[0-9a-f]{64}$/);
    });
  }
  for (const c of golden.resolved.invalid) {
    it(`resolved invalid: ${c.name}`, () => {
      const r = validateResolved(c.input);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe(c.code);
    });
  }
});
