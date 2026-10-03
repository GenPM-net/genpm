#!/usr/bin/env node
// QA automático de catálogos (i18n §6): claves faltantes, sintaxis ICU, paridad de parámetros, glosario y longitud.
// Nivel 1 rompe el build; nivel 2 solo avisa (usa fallback a inglés).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from '@formatjs/icu-messageformat-parser';
import { flatten, LOCALES_DIR, locales, namespaces, paramsOf, ROOT, readCatalog, SOURCE, TIER1 } from './lib.mjs';

const glossary = JSON.parse(readFileSync(join(ROOT, 'glossary.json'), 'utf8'));
const errors = [];
const warnings = [];

for (const ns of namespaces(SOURCE)) {
  const source = flatten(readCatalog(SOURCE, ns));
  const meta = existsSync(join(LOCALES_DIR, SOURCE, `${ns}.meta.json`))
    ? flatten(JSON.parse(readFileSync(join(LOCALES_DIR, SOURCE, `${ns}.meta.json`), 'utf8')))
    : {};
  for (const [key, msg] of Object.entries(source)) {
    try {
      parse(msg, { ignoreTag: true });
    } catch (e) {
      errors.push(`en/${ns}: ${key}: invalid ICU (${e.message})`);
    }
  }
  for (const loc of locales().filter((l) => l !== SOURCE && l !== 'en-XA')) {
    const tier1 = TIER1.includes(loc);
    const report = (msg) => (tier1 ? errors : warnings).push(`${loc}/${ns}: ${msg}`);
    const cat = readCatalog(loc, ns);
    if (!cat) {
      report('missing catalog');
      continue;
    }
    const flat = flatten(cat);
    for (const [key, msg] of Object.entries(source)) {
      const tr = flat[key];
      if (tr === undefined) {
        report(`${key}: missing`);
        continue;
      }
      let trParams;
      try {
        trParams = paramsOf(tr);
      } catch (e) {
        errors.push(`${loc}/${ns}: ${key}: invalid ICU (${e.message})`);
        continue;
      }
      const srcParams = paramsOf(msg);
      const a = [...srcParams.keys()].sort().join(',');
      const b = [...trParams.keys()].sort().join(',');
      if (a !== b) errors.push(`${loc}/${ns}: ${key}: params {${b}} ≠ en {${a}}`);
      for (const term of glossary.doNotTranslate) {
        if (msg.includes(term) && !tr.includes(term))
          errors.push(`${loc}/${ns}: ${key}: glossary term "${term}" was translated or dropped`);
      }
      const max = meta[`${key}.maxLength`];
      if (typeof max === 'number' && tr.length > max) report(`${key}: ${tr.length} chars > ${max}`);
    }
    for (const key of Object.keys(flat))
      if (!(key in source)) warnings.push(`${loc}/${ns}: ${key}: unused (not in en)`);
  }
}

for (const w of warnings) console.warn(`▲ ${w}`);
for (const e of errors) console.error(`✖ ${e}`);
if (errors.length) process.exit(1);
console.log(`✔ i18n catalogs OK (${warnings.length} warnings)`);
