import { readFileSync } from 'node:fs';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import golden from '../fixtures/golden.json' with { type: 'json' };

const schema = JSON.parse(readFileSync(new URL('../schema/v1/genpm.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
const validate = ajv.compile(schema);

// Reglas que JSON Schema no puede expresar (rutas seguras, refs de rama, una sola línea): solo las aplica zod.
const ZOD_ONLY = new Set([
  'dest-traversal',
  'dest-absolute',
  'dest-git',
  'dest-github',
  'dest-windows',
  'dest-deep',
  'context-escapes-include',
  'branch-ref',
  'summary-multiline',
]);

describe('JSON Schema generated from zod (manifest-spec §9)', () => {
  it('has the published $id', () => {
    expect(schema.$id).toBe('https://genpm.net/schema/v1/genpm.json');
    expect(schema.required).toEqual(['n', 'v', 'd']);
  });
  for (const c of golden.source.valid) {
    it(`accepts ${c.name}`, () => {
      expect(validate(c.input), JSON.stringify(validate.errors)).toBe(true);
    });
  }
  for (const c of golden.source.invalid.filter((c) => !ZOD_ONLY.has(c.name))) {
    it(`rejects ${c.name}`, () => {
      expect(validate(c.input)).toBe(false);
    });
  }
});
