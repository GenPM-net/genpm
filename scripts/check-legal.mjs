#!/usr/bin/env node
// Bloquea el despliegue a producción si faltan los datos del titular exigidos por la LSSI-CE (art. 10) y el RGPD
// (art. 13): apps/web/src/content/legal/owner.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const owner = JSON.parse(readFileSync(join(import.meta.dirname, '../apps/web/src/content/legal/owner.json'), 'utf8'));
const missing = ['name', 'nif', 'address', 'city', 'email'].filter((k) => !String(owner[k] ?? '').trim());
if (missing.length) {
  console.error(`✖ Legal: faltan datos del titular en apps/web/src/content/legal/owner.json: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('✔ Legal: datos del titular completos');
