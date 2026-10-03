#!/usr/bin/env node
// Genera src/keys.gen.ts (claves y parámetros tipados desde locales/en) y src/catalogs.gen.ts (cargadores estáticos).
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { flatten, locales, namespaces, paramsOf, ROOT, readCatalog, SOURCE } from './lib.mjs';

const nss = namespaces(SOURCE);
const lines = [
  '// Generado por scripts/gen.mjs desde locales/en. No editar a mano.',
  '',
  'export interface MessageParams {',
];
for (const ns of nss) {
  const flat = flatten(readCatalog(SOURCE, ns));
  for (const [key, msg] of Object.entries(flat)) {
    const params = paramsOf(msg);
    const shape = params.size
      ? `{ ${[...params].map(([p, t]) => `${/^[a-zA-Z_]\w*$/.test(p) ? p : JSON.stringify(p)}: ${t}`).join('; ')} }`
      : 'undefined';
    lines.push(`  ${JSON.stringify(`${ns}.${key}`)}: ${shape};`);
  }
}
lines.push(
  '}',
  '',
  'export type MessageKey = keyof MessageParams;',
  '',
  `export const NAMESPACES = ${JSON.stringify(nss)} as const;`,
  '',
  'export type Namespace = (typeof NAMESPACES)[number];',
  '',
);
writeFileSync(join(ROOT, 'src/keys.gen.ts'), lines.join('\n'));

const cat = [
  '// Generado por scripts/gen.mjs. No editar a mano.',
  '// `en` va empaquetado; el resto de idiomas se carga bajo demanda (i18n §4.1).',
  '',
];
for (const ns of nss) cat.push(`import en_${ns} from '../locales/en/${ns}.json' with { type: 'json' };`);
cat.push('', 'export type Catalog = Record<string, unknown>;', '', 'export const EN: Record<string, Catalog> = {');
for (const ns of nss) cat.push(`  ${ns}: en_${ns},`);
cat.push('};', '', 'export const LOADERS: Record<string, Record<string, () => Promise<Catalog>>> = {');
for (const loc of locales().filter((l) => l !== SOURCE)) {
  cat.push(`  ${JSON.stringify(loc)}: {`);
  for (const ns of namespaces(loc)) {
    cat.push(
      `    ${ns}: () => import('../locales/${loc}/${ns}.json', { with: { type: 'json' } }).then((m) => m.default as Catalog),`,
    );
  }
  cat.push('  },');
}
cat.push('};', '');
writeFileSync(join(ROOT, 'src/catalogs.gen.ts'), cat.join('\n'));
