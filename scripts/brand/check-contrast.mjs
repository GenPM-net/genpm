#!/usr/bin/env node
// BR-13: valida el contraste WCAG 2.x de todos los pares de tokens, claros y oscuros (branding §8.2).
// Texto ≥ 4.5:1 (AA) · señales gráficas y bordes de control ≥ 3:1 (AA no textual, WCAG 1.4.11).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const c = JSON.parse(readFileSync(join(ROOT, 'docs/design/tokens.json'), 'utf8')).color;
const v = (path) => path.split('.').reduce((o, k) => o[k], c).$value;

function luminance(hex) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const TEXT = 4.5;
const GRAPHIC = 3;
const pairs = [];
for (const bg of ['paper', 'wash']) {
  for (const fg of ['ink', 'ink-2', 'ink-3', 'code-ink', 'context', 'mcp', 'warning', 'danger'])
    pairs.push({ fg, bg, min: TEXT, kind: 'text' });
  pairs.push({ fg: 'code', bg, min: GRAPHIC, kind: 'graphic' });
}
pairs.push({ fg: 'paper', bg: 'ink', min: TEXT, kind: 'text' }); // botón primario
pairs.push({ fg: 'ink', bg: 'code', min: TEXT, kind: 'text' }); // badge de versión
pairs.push({ fg: 'paper', bg: 'mcp', min: TEXT, kind: 'text' }); // badge mcp
for (const bg of ['dark.bg', 'dark.surface']) {
  for (const fg of [
    'dark.fg',
    'dark.fg-2',
    'dark.fg-3',
    'dark.code',
    'dark.context',
    'dark.mcp',
    'dark.warning',
    'dark.danger',
  ])
    pairs.push({ fg, bg, min: TEXT, kind: 'text' });
}

/**
 * Excepciones pendientes de decisión de diseño (branding §8.2 mide contrastes sobre `paper`). Mientras sigan aquí,
 * la web NO debe usar estos pares: texto `mcp` y señal `code` sobre `wash` (p. ej. dentro de bloques de comandos).
 * Propuesta: oscurecer `mcp` a #087584 (5.0:1 sobre wash) y `code` a #549800 (3.3:1). Decide: fundador/diseño.
 */
const KNOWN_EXCEPTIONS = new Set();

let failed = 0;
for (const p of pairs) {
  const ratio = contrast(v(p.fg), v(p.bg));
  const key = `${p.fg} on ${p.bg}`;
  const ok = ratio >= p.min;
  const excepted = !ok && KNOWN_EXCEPTIONS.has(key);
  if (!ok && !excepted) failed++;
  if (!ok || process.argv.includes('--verbose')) {
    console.log(
      `${ok ? '✔' : excepted ? '▲' : '✖'} ${key}: ${ratio.toFixed(2)}:1 (${p.kind} ≥ ${p.min})${excepted ? ' — known exception, avoid this pair' : ''}`,
    );
  }
}
for (const key of KNOWN_EXCEPTIONS) {
  const [fg, bg] = key.split(' on ');
  const p = pairs.find((x) => x.fg === fg && x.bg === bg);
  if (p && contrast(v(p.fg), v(p.bg)) >= p.min) console.log(`▲ ${key} now passes: remove it from KNOWN_EXCEPTIONS`);
}
if (failed) {
  console.error(`✖ ${failed} token pair(s) below WCAG AA`);
  process.exit(1);
}
console.log(`✔ ${pairs.length} token pairs meet WCAG AA`);
