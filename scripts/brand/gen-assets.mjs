#!/usr/bin/env node
// Genera los activos de marca (branding §8.1, §12): wordmark `genpm▍` e isotipo `g▍` en SVG con el texto convertido
// a trazos (JetBrains Mono ExtraBold, tracking −5 %), favicon (.ico 16/32, icon.svg), apple-touch-icon 180 y avatar.
// Uso: node scripts/brand/gen-assets.mjs   → docs/design/brand/ (y copia los de la web a apps/web/public/ si existe)
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import opentype from 'opentype.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs/design/brand');
const tokens = JSON.parse(readFileSync(join(ROOT, 'docs/design/tokens.json'), 'utf8'));
const C = { ink: tokens.color.ink.$value, paper: tokens.color.paper.$value, code: tokens.color.code.$value };

const fontFile = join(ROOT, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-800-normal.woff');
const buf = readFileSync(fontFile);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const SIZE = 100;
const TRACK = -0.05;

/** Path de un texto con tracking, devolviendo d y caja. */
function textPath(text, x, y) {
  const p = font.getPath(text, x, y, SIZE, { letterSpacing: TRACK, kerning: true });
  const bb = p.getBoundingBox();
  return { d: pathData(p.commands), bb, advance: font.getAdvanceWidth(text, SIZE, { letterSpacing: TRACK }) };
}

/** Caret de bloque ▍ como en el manual (genpm-identidad.html): 0.42em × 0.78em, 0.04em bajo la línea base. */
function caret(x, baseline, height = 0.78) {
  const h = height * SIZE;
  return { x, y: baseline + 0.04 * SIZE - h, w: 0.42 * SIZE, h };
}

function wordmark({ fg, caretColor, bg }) {
  const baseline = SIZE;
  const t = textPath('genpm', 0, baseline);
  const cr = caret(t.advance + SIZE * 0.04, baseline);
  const pad = SIZE * 0.18;
  const minX = Math.min(t.bb.x1, 0) - pad;
  const minY = Math.min(t.bb.y1, cr.y) - pad;
  const maxX = cr.x + cr.w + pad;
  const maxY = Math.max(t.bb.y2, cr.y + cr.h) + pad;
  const w = +(maxX - minX).toFixed(2);
  const h = +(maxY - minY).toFixed(2);
  const rect = bg
    ? `<rect x="${minX.toFixed(2)}" y="${minY.toFixed(2)}" width="${w}" height="${h}" fill="${bg}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(2)} ${minY.toFixed(2)} ${w} ${h}" width="${Math.round(w * 2)}" height="${Math.round(h * 2)}" role="img" aria-label="genpm"><title>genpm</title>${rect}<path d="${t.d}" fill="${fg}"/><rect x="${cr.x.toFixed(2)}" y="${cr.y.toFixed(2)}" width="${cr.w.toFixed(2)}" height="${cr.h.toFixed(2)}" fill="${caretColor}"/></svg>\n`;
}

function isotype({ withCaret = true, glyph = C.paper, caretColor = C.code, bg = C.ink, size = 512 } = {}) {
  const S = 100;
  const t = textPath('g', 0, 0);
  const cr = caret(t.advance + SIZE * 0.04, 0, 0.7);
  const contentW = withCaret ? cr.x + cr.w : t.bb.x2;
  const top = Math.min(t.bb.y1, withCaret ? cr.y : t.bb.y1);
  const bottom = Math.max(t.bb.y2, withCaret ? cr.y + cr.h : t.bb.y2);
  const scale = (S * 0.62) / Math.max(contentW, bottom - top);
  const tx = (S - contentW * scale) / 2 - Math.min(0, t.bb.x1) * scale;
  const ty = (S - (bottom - top) * scale) / 2 - top * scale;
  const radius = S * 0.22;
  const caretRect = withCaret
    ? `<rect x="${cr.x.toFixed(2)}" y="${cr.y.toFixed(2)}" width="${cr.w.toFixed(2)}" height="${cr.h.toFixed(2)}" fill="${caretColor}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${size}" height="${size}" role="img" aria-label="genpm"><title>genpm</title><rect width="${S}" height="${S}" rx="${radius}" fill="${bg}"/><g transform="translate(${tx.toFixed(3)} ${ty.toFixed(3)}) scale(${scale.toFixed(5)})"><path d="${t.d}" fill="${glyph}"/>${caretRect}</g></svg>\n`;
}

function png(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

/** ICO con entradas PNG (formato admitido por todos los navegadores modernos). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...images.map((x) => x.data)]);
}

mkdirSync(OUT, { recursive: true });
const files = {
  'wordmark.svg': wordmark({ fg: C.ink, caretColor: C.code }),
  'wordmark-inverse.svg': wordmark({ fg: C.paper, caretColor: C.code, bg: C.ink }),
  'wordmark-mono-ink.svg': wordmark({ fg: C.ink, caretColor: C.ink }),
  'wordmark-mono-white.svg': wordmark({ fg: C.paper, caretColor: C.paper, bg: C.ink }),
  'isotype.svg': isotype(),
  'isotype-mono.svg': isotype({ caretColor: C.paper }),
  // A 16 px se omite el caret: solo la `g` (branding §8.1).
  'favicon.svg': isotype({ withCaret: true, size: 32 }),
  'favicon-16.svg': isotype({ withCaret: false, size: 16 }),
  'avatar.svg': isotype({ size: 400 }),
};
for (const [name, content] of Object.entries(files)) writeFileSync(join(OUT, name), content);
writeFileSync(join(OUT, 'apple-touch-icon.png'), png(isotype({ size: 180 }), 180));
writeFileSync(join(OUT, 'avatar-400.png'), png(files['avatar.svg'], 400));
writeFileSync(join(OUT, 'avatar-1000.png'), png(files['avatar.svg'], 1000));
writeFileSync(join(OUT, 'wordmark.png'), png(files['wordmark.svg'], 1200));
writeFileSync(
  join(OUT, 'favicon.ico'),
  ico([
    { size: 16, data: png(files['favicon-16.svg'], 16) },
    { size: 32, data: png(files['favicon.svg'], 32) },
  ]),
);

const web = join(ROOT, 'apps/web/public');
if (existsSync(web)) {
  for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'wordmark.svg', 'isotype.svg'])
    copyFileSync(join(OUT, f), join(web, f === 'favicon.svg' ? 'icon.svg' : f));
}
console.log(`✔ brand assets → ${OUT}`);

// ───────────── BR-10: plantilla OG 1200×630 (home y por paquete) ─────────────
const monoReg = (() => {
  const b = readFileSync(
    join(ROOT, 'node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff'),
  );
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
})();
const layer = {
  code: tokens.color.code.$value,
  context: tokens.color.context.$value,
  mcp: tokens.color.mcp.$value,
  ink2: tokens.color['ink-2'].$value,
  line: tokens.color.line.$value,
  wash: tokens.color.wash.$value,
};

/** Serializador propio: `toPathData()` de opentype.js produce NaN con algunos valores (p. ej. x = 189.6000000002). */
function pathData(commands) {
  const n = (v) => (Math.round(v * 100) / 100).toString();
  return commands
    .map((c) =>
      c.type === 'Z'
        ? 'Z'
        : c.type === 'Q'
          ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
          : c.type === 'C'
            ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`
            : `${c.type}${n(c.x)} ${n(c.y)}`,
    )
    .join('');
}

/** Ruta glifo a glifo (evita un NaN de opentype.js al reutilizar glifos en getPath con fuentes WOFF). */
function textD(f, text, x, y, size, spacing = 0) {
  const scale = size / f.unitsPerEm;
  let cx = x;
  let d = '';
  for (const ch of text) {
    const g = f.charToGlyph(ch);
    d += pathData(g.getPath(cx, y, size).commands);
    cx += g.advanceWidth * scale + spacing * size;
  }
  return d;
}

/** OG: wordmark arriba, título (nombre del paquete o lema), resumen y las tres C con texto. */
export function ogSvg({ title, subtitle, meta = '', layers = ['Code', 'Context', 'Connections'] }) {
  const W = 1200;
  const H = 630;
  const wm = textD(font, 'genpm', 72, 118, 44, TRACK);
  const wmW = font.getAdvanceWidth('genpm', 44, { letterSpacing: TRACK });
  const titleSize = title.length > 22 ? 64 : 84;
  const lines = [];
  let line = '';
  for (const word of subtitle.split(' ')) {
    if ((line + word).length > 52) {
      lines.push(line.trim());
      line = '';
    }
    line += `${word} `;
  }
  if (line.trim()) lines.push(line.trim());
  const chips = layers
    .map((l, i) => {
      const color = [layer.code, layer.context, layer.mcp][i];
      const x = 72 + i * 250;
      return `<rect x="${x}" y="520" width="226" height="44" rx="4" fill="#FFFFFF" stroke="${layer.line}"/><rect x="${x + 16}" y="537" width="10" height="10" fill="${color}"/><path d="${textD(monoReg, l, x + 38, 549, 20)}" fill="${C.ink}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#FFFFFF"/><rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${layer.line}"/><path d="${wm}" fill="${C.ink}"/><rect x="${72 + wmW + 2}" y="${118 + 2 - 34}" width="18" height="34" fill="${C.code}"/>${meta ? `<path d="${textD(monoReg, meta, 72 + wmW + 40, 114, 22)}" fill="${layer.ink2}"/>` : ''}<path d="${textD(font, title, 68, 300, titleSize, -0.04)}" fill="${C.ink}"/>${lines
    .slice(0, 2)
    .map((l, i) => `<path d="${textD(monoReg, l, 72, 380 + i * 44, 28)}" fill="${layer.ink2}"/>`)
    .join('')}${chips}</svg>\n`;
}

writeFileSync(
  join(OUT, 'og-template.svg'),
  ogSvg({
    title: '@scope/name',
    subtitle: 'One-line package summary, up to 160 characters, shown in two lines at most.',
    meta: 'v1.2.0',
  }),
);
const homeOg = ogSvg({
  title: 'Install architectures,',
  subtitle: 'not dependencies. Code, AI rules and MCP servers injected into your repo, pinned to a commit.',
});
writeFileSync(join(OUT, 'og-home.svg'), homeOg);
writeFileSync(join(OUT, 'og-home.png'), png(homeOg, 1200));
if (existsSync(web)) {
  mkdirSync(join(web, 'og'), { recursive: true });
  copyFileSync(join(OUT, 'og-home.png'), join(web, 'og/home.png'));
}
console.log('✔ OG template → og-template.svg, og-home.png');
