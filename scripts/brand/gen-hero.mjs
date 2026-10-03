#!/usr/bin/env node
// BR-14: hero del README. SVG animado (solo CSS, sin scripts) de una terminal ejecutando `genpm add`: GitHub lo
// sirve como imagen, pesa unos KB y no necesita GIF. Colores desde docs/design/tokens.json (superficie oscura de marca).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../..');
const tokens = JSON.parse(readFileSync(join(ROOT, 'docs/design/tokens.json'), 'utf8')).color.dark;
const C = Object.fromEntries(Object.entries(tokens).flatMap(([k, v]) => (v?.$value ? [[k, v.$value]] : [])));

const W = 760;
const LINE = 22;
const X = 28;
const TOP = 70;
const CYCLE = 12; // s
const CMD = 'genpm add @core/billing';

// [tiempo de aparición (s), segmentos [texto, color]]
const OUT = [
  [2.6, [['Resolved', C['fg-3']]]],
  [
    2.9,
    [
      ['├─ ', C['fg-3']],
      ['@core/billing', C.fg],
      ['  1.2.0  ', C['fg-3']],
      ['9f2c4e1', C.context],
    ],
  ],
  [3.1, [['│  → src/lib/billing', C['fg-2']]]],
  [
    3.3,
    [
      ['├─ ', C['fg-3']],
      ['@core/auth', C.fg],
      ['     1.2.0  ', C['fg-3']],
      ['1b9d3a0', C.context],
    ],
  ],
  [
    3.5,
    [
      ['└─ ', C['fg-3']],
      ['@core/db', C.fg],
      ['       1.0.3  ', C['fg-3']],
      ['already installed', C['fg-3']],
    ],
  ],
  [
    4.2,
    [
      ['Code   ', C.code],
      ['47 files · 112 KB → src/lib/', C['fg-2']],
    ],
  ],
  [
    4.5,
    [
      ['Rules  ', C.context],
      ['~1.4k tokens · scan passed → AGENTS.md', C['fg-2']],
    ],
  ],
  [
    4.8,
    [
      ['MCP    ', C.mcp],
      ['stripe ', C['fg-2']],
      ['(asks first)', C['fg-3']],
    ],
  ],
  [
    5.6,
    [
      ['◇ ', C['fg-3']],
      ['Inject 2 packages? ', C.fg],
      ['Yes', C.code],
    ],
  ],
  [
    6.4,
    [
      ['✔ ', C.code],
      ['Injected 2 packages in 1.8s · pinned to SHA in genpm.lock', C.fg],
    ],
  ],
];
const H = TOP + (OUT.length + 2) * LINE + 24;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (s) => `${((s / CYCLE) * 100).toFixed(2)}%`;
// Visible desde `at` hasta casi el final del ciclo; se apaga todo junto para reiniciar.
const keyframes = (name, at) =>
  `@keyframes ${name}{0%,${pct(at)}{opacity:0}${pct(at + 0.15)},${pct(CYCLE - 0.6)}{opacity:1}100%{opacity:0}}`;

const css = [];
const rows = [];
const typeEnd = 0.6 + CMD.length * 0.045;
css.push(
  `@keyframes type{0%,${pct(0.6)}{width:0}${pct(typeEnd)},${pct(CYCLE - 0.6)}{width:${CMD.length * 8.4 + 4}px}100%{width:0}}`,
  `.cmd{animation:type ${CYCLE}s steps(${CMD.length}) infinite}`,
  `@keyframes follow{0%,${pct(0.6)}{transform:translateX(-${CMD.length * 8.4}px)}${pct(typeEnd)},100%{transform:translateX(0)}}`,
  `@keyframes blink{50%{opacity:0}}.caret{animation:follow ${CYCLE}s steps(${CMD.length}) infinite,blink 1s step-end infinite}`,
  `text{font:14px 'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre}`,
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}.cmd{width:auto}.l{opacity:1!important}}',
);
OUT.forEach(([at, segs], i) => {
  css.push(keyframes(`l${i}`, at), `.l${i}{opacity:0;animation:l${i} ${CYCLE}s infinite}`);
  const tspans = segs.map(([t, color]) => `<tspan fill="${color}">${esc(t)}</tspan>`).join('');
  rows.push(`<text class="l l${i}" x="${X}" y="${TOP + (i + 2) * LINE}">${tspans}</text>`);
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="genpm add @core/billing resolves its dependencies, shows code, AI rules and MCP config, and injects two packages pinned to a commit SHA">
<style>${css.join('')}</style>
<rect width="${W}" height="${H}" rx="12" fill="${C.bg}"/>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="12" fill="none" stroke="${C.line}"/>
<circle cx="24" cy="24" r="6" fill="${C.line}"/><circle cx="44" cy="24" r="6" fill="${C.line}"/><circle cx="64" cy="24" r="6" fill="${C.line}"/>
<text x="${W / 2}" y="29" text-anchor="middle" fill="${C['fg-3']}" style="font-size:12px">your-app — zsh</text>
<line x1="0" y1="46" x2="${W}" y2="46" stroke="${C.line}"/>
<clipPath id="c"><rect class="cmd" x="${X + 20}" y="${TOP - 16}" height="22" width="0"/></clipPath>
<text x="${X}" y="${TOP}" fill="${C.code}">$</text>
<text x="${X + 20}" y="${TOP}" fill="${C.fg}" clip-path="url(#c)">${esc(CMD)}</text>
<rect class="caret" x="${X + 22 + CMD.length * 8.4}" y="${TOP - 13}" width="8" height="16" fill="${C.code}"/>
${rows.join('\n')}
</svg>
`;

const out = join(ROOT, 'docs/design/brand/readme-hero.svg');
writeFileSync(out, svg);
console.log(`✔ ${out} (${(svg.length / 1024).toFixed(1)} KB)`);
