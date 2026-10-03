#!/usr/bin/env node
// BR-12: fuente única de diseño. docs/design/tokens.json → CSS variables + tema de Tailwind v4 (@theme) +
// preset JS (para quien use Tailwind v3) + módulo TS para badges y OG images.
//   node scripts/brand/gen-tokens.mjs [--check]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tokens = JSON.parse(readFileSync(join(ROOT, 'docs/design/tokens.json'), 'utf8'));
const OUT = join(ROOT, 'apps/web/src/styles');

const flat = (group, prefix, out = {}) => {
  for (const [k, v] of Object.entries(group)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && '$value' in v) out[`${prefix}-${k}`] = v.$value;
    else if (v && typeof v === 'object') flat(v, `${prefix}-${k}`, out);
  }
  return out;
};

const colors = flat(tokens.color, 'color');
const light = Object.fromEntries(Object.entries(colors).filter(([k]) => !k.startsWith('color-dark-')));
const dark = Object.fromEntries(
  Object.entries(colors)
    .filter(([k]) => k.startsWith('color-dark-'))
    .map(([k, v]) => [k.replace('color-dark-', 'color-'), v]),
);
// En oscuro los neutros se remapean: paper→bg, wash→surface, line→line, ink→fg, ink-2→fg-2, ink-3→fg-3; code-ink→code.
const darkMap = {
  'color-paper': dark['color-bg'],
  'color-wash': dark['color-surface'],
  'color-line': dark['color-line'],
  'color-line-2': dark['color-line'],
  'color-ink': dark['color-fg'],
  'color-ink-2': dark['color-fg-2'],
  'color-ink-3': dark['color-fg-3'],
  'color-code': dark['color-code'],
  'color-code-ink': dark['color-code'],
  'color-context': dark['color-context'],
  'color-mcp': dark['color-mcp'],
  'color-warning': dark['color-warning'],
  'color-danger': dark['color-danger'],
};

const scale = tokens.font.scale;
const families = { sans: tokens.font.family.sans.$value, mono: tokens.font.family.mono.$value };
const fam = (list) => list.map((f) => (f.includes(' ') ? `"${f}"` : f)).join(', ');
const space = flat(tokens.space, 'space');
const easing = `cubic-bezier(${tokens.motion.easing.out.$value.join(', ')})`;

const lines = [];
lines.push('/* Generado por scripts/brand/gen-tokens.mjs desde docs/design/tokens.json. No editar a mano. */', '');
lines.push(':root {');
for (const [k, v] of Object.entries(light)) lines.push(`  --${k}: ${v};`);
lines.push(`  --font-sans: ${fam(families.sans)};`, `  --font-mono: ${fam(families.mono)};`);
for (const [k, v] of Object.entries(space)) lines.push(`  --${k}: ${v};`);
lines.push(
  `  --max-width: ${tokens.layout['max-width'].$value};`,
  `  --gutter: ${tokens.layout.gutter.$value};`,
  `  --gutter-sm: ${tokens.layout['gutter-sm'].$value};`,
  `  --header: ${tokens.layout.header.$value};`,
);
lines.push(`  --radius-control: ${tokens.radius.control.$value};`, `  --radius-iso: ${tokens.radius.iso.$value};`);
lines.push(
  `  --duration-fast: ${tokens.motion.duration.fast.$value};`,
  `  --duration-base: ${tokens.motion.duration.base.$value};`,
  `  --ease-out: ${easing};`,
);
for (const [name, v] of Object.entries(scale)) {
  if (name.startsWith('$')) continue;
  const s = v.$value;
  lines.push(`  --text-${name}: ${s.fontSize};`, `  --text-${name}--line-height: ${s.lineHeight ?? 1.5};`);
}
lines.push('}', '');
lines.push(':root[data-theme="dark"] {');
for (const [k, v] of Object.entries(darkMap)) if (v) lines.push(`  --${k}: ${v};`);
lines.push('}', '');
const css = `${lines.join('\n')}\n`;

// Tailwind v4: @theme con los valores literales (genera bg-ink, text-ink-2, border-line, font-mono, text-h1…).
// `--color-*: initial` elimina la paleta por defecto: solo existen los colores de la marca. Sin sombras (branding §8.4).
const theme = [
  '/* Generado por scripts/brand/gen-tokens.mjs. Tema de Tailwind v4 (importa después de "tailwindcss"). */',
  '@theme {',
  '  --color-*: initial;',
  '  --shadow-*: initial;',
  '  --inset-shadow-*: initial;',
  '  --drop-shadow-*: initial;',
];
for (const [k, v] of Object.entries(light)) theme.push(`  --${k}: ${v};`);
theme.push(`  --font-sans: ${fam(families.sans)};`, `  --font-mono: ${fam(families.mono)};`);
for (const [name, v] of Object.entries(scale)) {
  if (name.startsWith('$')) continue;
  const t = v.$value;
  theme.push(`  --text-${name}: ${t.fontSize};`, `  --text-${name}--line-height: ${t.lineHeight ?? 1.5};`);
  if (t.fontWeight) theme.push(`  --text-${name}--font-weight: ${t.fontWeight};`);
  if (t.letterSpacing) theme.push(`  --text-${name}--letter-spacing: ${t.letterSpacing};`);
}
theme.push(
  `  --radius-control: ${tokens.radius.control.$value};`,
  `  --container-page: ${tokens.layout['max-width'].$value};`,
  `  --ease-out: ${easing};`,
  '}',
  '',
);
theme.push(':root[data-theme="dark"] {');
for (const [k, v] of Object.entries(darkMap)) if (v) theme.push(`  --${k}: ${v};`);
theme.push('}', '');
const themeCss = `${theme.join('\n')}\n`;

// Preset JS (Tailwind v3) y módulo TS para Satori/badges.
const preset = `// Generado por scripts/brand/gen-tokens.mjs. Preset de Tailwind v3 (compatibilidad).
export default {
  theme: {
    extend: {
      colors: ${JSON.stringify(Object.fromEntries(Object.keys(light).map((k) => [k.replace('color-', ''), `var(--${k})`])), null, 2).replace(/\n/g, '\n      ')},
      fontFamily: { sans: ${JSON.stringify(families.sans)}, mono: ${JSON.stringify(families.mono)} },
      borderRadius: { control: 'var(--radius-control)' },
      boxShadow: {},
      maxWidth: { page: 'var(--max-width)' },
    },
  },
};
`;
const ts = `// Generado por scripts/brand/gen-tokens.mjs. Valores literales para entornos sin CSS (OG images, badges).
export const colors = ${JSON.stringify(light, null, 2)} as const;
export const darkColors = ${JSON.stringify(darkMap, null, 2)} as const;
export const fonts = ${JSON.stringify(families)} as const;
`;

const outputs = { 'tokens.css': css, 'theme.css': themeCss, 'tailwind.preset.js': preset, 'tokens.ts': ts };
if (process.argv.includes('--check')) {
  let stale = false;
  for (const [f, content] of Object.entries(outputs)) {
    const p = join(OUT, f);
    if (!existsSync(p) || readFileSync(p, 'utf8') !== content) {
      console.error(`✖ ${p} is out of date: run node scripts/brand/gen-tokens.mjs`);
      stale = true;
    }
  }
  process.exit(stale ? 1 : 0);
}
mkdirSync(OUT, { recursive: true });
for (const [f, content] of Object.entries(outputs)) writeFileSync(join(OUT, f), content);
console.log(`✔ tokens → ${OUT}`);
