#!/usr/bin/env node
// BR-11: badges SVG de ejemplo (versión, installs, mcp, verified) con el mismo generador que sirve el registry.
// Requiere Node ≥ 22.6 (importa TypeScript sin compilar).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { badgeSvg } from '../../apps/registry/src/badge.ts';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs/design/badges');
mkdirSync(OUT, { recursive: true });
const badges = {
  'version.svg': badgeSvg('genpm', 'v1.2.0', 'version'),
  'installs.svg': badgeSvg('installs', '1.5k/mo', 'installs'),
  'mcp.svg': badgeSvg('genpm', 'mcp', 'mcp'),
  'verified.svg': badgeSvg('genpm', '✓ verified', 'verified'),
};
for (const [name, svg] of Object.entries(badges)) writeFileSync(join(OUT, name), `${svg}\n`);
console.log(`✔ badges → ${OUT}`);
