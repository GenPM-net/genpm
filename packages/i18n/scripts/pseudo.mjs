#!/usr/bin/env node
// Genera el pseudo-locale en-XA (+40 % de longitud y acentos) para detectar cortes y textos sin externalizar (i18n §6).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';
import { printAST } from '@formatjs/icu-messageformat-parser/printer.js';
import { LOCALES_DIR, namespaces, ROOT, readCatalog, SOURCE } from './lib.mjs';

const MAP = {
  a: 'å',
  b: 'ƀ',
  c: 'ç',
  d: 'ð',
  e: 'é',
  f: 'ƒ',
  g: 'ĝ',
  h: 'ĥ',
  i: 'î',
  j: 'ĵ',
  k: 'ķ',
  l: 'ļ',
  m: 'ɱ',
  n: 'ñ',
  o: 'ö',
  p: 'þ',
  r: 'ŕ',
  s: 'š',
  t: 'ţ',
  u: 'û',
  w: 'ŵ',
  y: 'ý',
  z: 'ž',
  A: 'Å',
  E: 'É',
  I: 'Î',
  O: 'Ö',
  U: 'Û',
};
// Lo que nunca se traduce queda intacto (glosario, comandos `genpm <cmd>`, flags, rutas, archivos, @scopes), igual que en
// las traducciones reales: así una captura en en-XA solo muestra sin acentos lo que de verdad falta por externalizar.
const glossary = JSON.parse(readFileSync(join(ROOT, 'glossary.json'), 'utf8')).doNotTranslate;
const COMMANDS =
  'add|search|info|list|remove|outdated|audit|doctor|init|validate|publish|yank|login|logout|whoami|mcp|cache';
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KEEP = new RegExp(
  [
    `genpm (?:${COMMANDS})\\b`,
    ...[...glossary].sort((a, b) => b.length - a.length).map(esc),
    '--[a-z][\\w-]*',
    '@[\\w-]+(?:/[\\w.-]+)?',
    '[\\w-]*(?:\\.[\\w-]+)+',
    '[A-Z][A-Z0-9_]{2,}',
  ].join('|'),
  'g',
);
const accent = (s) => {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(KEEP)) {
    out += s.slice(last, m.index).replace(/[A-Za-z]/g, (c) => MAP[c] ?? c) + m[0];
    last = m.index + m[0].length;
  }
  return out + s.slice(last).replace(/[A-Za-z]/g, (c) => MAP[c] ?? c);
};

function transform(els) {
  for (const el of els) {
    if (el.type === TYPE.literal) el.value = accent(el.value);
    if (el.options) for (const opt of Object.values(el.options)) transform(opt.value);
    if (el.children) transform(el.children);
  }
  return els;
}

function pseudo(msg) {
  const out = printAST(transform(parse(msg, { ignoreTag: true })));
  const pad = '·'.repeat(Math.ceil(msg.length * 0.4));
  return `[${out}${pad ? ` ${pad}` : ''}]`;
}

function walk(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) out[k] = typeof v === 'string' ? pseudo(v) : walk(v);
  return out;
}

mkdirSync(join(LOCALES_DIR, 'en-XA'), { recursive: true });
for (const ns of namespaces(SOURCE)) {
  writeFileSync(
    join(LOCALES_DIR, 'en-XA', `${ns}.json`),
    `${JSON.stringify(walk(readCatalog(SOURCE, ns)), null, 2)}\n`,
  );
}
console.log('✔ en-XA generated');
