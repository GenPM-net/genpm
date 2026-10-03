#!/usr/bin/env node
// Lint de literales (i18n §6 "Literales"): detecta textos visibles por humanos fuera de los catálogos
// en el CLI (packages/cli/src) y en los componentes de la web (apps/web/src).
// Excepciones: tests, líneas con `i18n-ignore`, imports, claves de catálogo y textos para LLMs del MCP (siempre inglés).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ROOT } from './lib.mjs';

const REPO = join(ROOT, '..', '..');
const TARGETS = [
  { dir: 'packages/cli/src', exts: ['.ts'], kind: 'ts' },
  { dir: 'apps/web/src', exts: ['.astro', '.tsx'], kind: 'markup' },
];

function* files(dir, exts) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p, exts);
    else if (exts.some((e) => p.endsWith(e)) && !/\.(test|spec)\.|\.gen\./.test(p)) yield p;
  }
}

// Frase: al menos dos palabras con letras (latinas o no), sin pinta de ruta, clave, flag o comando.
const PHRASE = /[\p{L}]{2,}[\s ]+[\p{L}]{2,}/u;
const NOT_UI = [
  /^[a-z0-9_.-]+$/i, // clave o identificador
  /^(genpm|npx|pnpm|npm|git|claude|yarn|bun)\s/, // comandos de ejemplo (no se traducen)
  /^--?[a-z]/, // flags
  /^https?:\/\//,
  /^[a-z-]+:[a-z]/i, // urls o protocolos
  /^\s*$/,
];

function stringLiterals(line) {
  const out = [];
  const re = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  for (let m = re.exec(line); m; m = re.exec(line)) out.push(m[2]);
  return out;
}

const problems = [];
for (const { dir, exts, kind } of TARGETS) {
  for (const file of files(join(REPO, dir), exts)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    let inFrontmatterOrScript = false;
    lines.forEach((line, i) => {
      if (line.includes('i18n-ignore') || /^\s*(import|export \* from|\/\/|\*|\/\*)/.test(line)) return;
      const where = `${relative(REPO, file)}:${i + 1}`;
      if (kind === 'markup') {
        if (/^---\s*$/.test(line) || /<script|<\/script>|<style|<\/style>/.test(line))
          inFrontmatterOrScript = !inFrontmatterOrScript;
        if (!inFrontmatterOrScript) {
          for (const m of line.matchAll(/>([^<>{}]+)</g)) {
            const text = m[1].trim();
            if (PHRASE.test(text) && !NOT_UI.some((r) => r.test(text))) problems.push(`${where}  text "${text}"`);
          }
          for (const m of line.matchAll(/\b(alt|title|aria-label|placeholder)="([^"{]+)"/g)) {
            if (PHRASE.test(m[2])) problems.push(`${where}  ${m[1]}="${m[2]}"`);
          }
        }
        return;
      }
      for (const lit of stringLiterals(line)) {
        if (PHRASE.test(lit) && !NOT_UI.some((r) => r.test(lit))) problems.push(`${where}  "${lit.slice(0, 60)}"`);
      }
    });
  }
}

for (const p of problems) console.error(`✖ hardcoded UI text: ${p}`);
if (problems.length) {
  console.error(
    `\n${problems.length} literal(s): move them to packages/i18n/locales/en/*.json (or mark the line with i18n-ignore).`,
  );
  process.exit(1);
}
console.log('✔ no hardcoded UI literals');
