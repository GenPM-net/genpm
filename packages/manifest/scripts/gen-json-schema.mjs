#!/usr/bin/env node
// Genera schema/v1/genpm.json (manifest-spec §9) desde el esquema zod compilado en dist/.
// Lo que zod no puede expresar en JSON Schema (claves `_*`, prohibición de `c`, unicidad, oneOf c|u) se añade aquí.
// Uso: pnpm --filter @genpm/manifest build && pnpm --filter @genpm/manifest schema [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { LIMITS, LOCALE_RE, SCHEMA_URL } from '../dist/constants.js';
import { SourceManifest } from '../dist/schema.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'schema/v1/genpm.json');

const base = z.toJSONSchema(SourceManifest, { target: 'draft-2020-12', io: 'input', unrepresentable: 'any' });
const p = base.properties;

const descriptions = {
  $: 'Schema version',
  n: 'name',
  v: 'version (SemVer)',
  s: "summary (string or BCP 47 locale map that must include 'en')",
  r: 'Git repository URL',
  t: 'Git tag or 40-hex commit SHA (never a branch)',
  d: 'install dir, relative POSIX path',
  i: 'repo subdirectory to inject',
  x: 'AI rules file, relative to i',
  l: 'SPDX license expression',
  k: 'keywords',
  g: 'GenPM dependencies: { "<name>": "<semver range>" }',
  p: 'npm dependencies proposed to the user',
  e: 'required environment variable names (never values)',
  m: 'MCP servers required by the module',
};

p.$ = { const: 1 };
p.r.format = 'uri';
p.t = { ...p.t, minLength: 1, maxLength: LIMITS.refLength };
p.i = { ...p.i, default: '.' };
p.x = { ...p.x, default: 'AGENTS.md' };
p.s.oneOf = p.s.anyOf;
delete p.s.anyOf;
p.s.oneOf[1] = {
  ...p.s.oneOf[1],
  required: ['en'],
  maxProperties: LIMITS.summaryLocales,
  propertyNames: { pattern: LOCALE_RE.source },
};
p.k.uniqueItems = true;
p.e.uniqueItems = true;
p.g.maxProperties = LIMITS.genpmDeps;
p.p.maxProperties = LIMITS.npmDeps;
p.m.items.oneOf = p.m.items.anyOf;
delete p.m.items.anyOf;
p.m.items.oneOf[0].description = 'npm package run via npx';
p.m.items.oneOf[1].oneOf = [{ required: ['c'] }, { required: ['u'] }];
for (const [k, d] of Object.entries(descriptions)) p[k] = { description: d, ...p[k] };

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: SCHEMA_URL,
  title: 'GenPM package manifest (source)',
  type: 'object',
  required: base.required,
  additionalProperties: false,
  patternProperties: { '^_': {} },
  properties: p,
  not: { required: ['c'] },
};

const text = `${JSON.stringify(schema, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const current = readFileSync(out, 'utf8');
  if (current !== text) {
    console.error('schema/v1/genpm.json is out of date: run `pnpm --filter @genpm/manifest schema`');
    process.exit(1);
  }
} else {
  writeFileSync(out, text);
}
