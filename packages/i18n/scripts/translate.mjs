#!/usr/bin/env node
// Bot de traducción (i18n §5): completa las claves que faltan en cada idioma a partir de `en`, con el glosario y los
// comentarios de `.meta.json` como contexto, y marca lo traducido por máquina en `locales/<lang>/<ns>.meta.json`
// (`"machine": true`) hasta su revisión nativa. Usa la API de Anthropic (ANTHROPIC_API_KEY).
//   node scripts/translate.mjs [--locales es,pt-BR] [--dry-run]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { flatten, LOCALES_DIR, namespaces, ROOT, readCatalog, SOURCE, TIER1, TIER2 } from './lib.mjs';

const args = process.argv.slice(2);
const only = args.includes('--locales')
  ? args[args.indexOf('--locales') + 1].split(',')
  : [...TIER1.filter((l) => l !== 'en'), ...TIER2];
const dry = args.includes('--dry-run');
const glossary = JSON.parse(readFileSync(join(ROOT, 'glossary.json'), 'utf8'));
const MODEL = process.env.GENPM_TRANSLATE_MODEL ?? 'claude-sonnet-5-5';

function unflatten(flat) {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split('.');
    let node = out;
    for (const p of parts.slice(0, -1)) node = node[p] ??= {};
    node[parts.at(-1)] = v;
  }
  return out;
}

async function translate(locale, entries) {
  const terms = Object.entries(glossary.terms)
    .map(([en, tr]) => `${en} → ${tr[locale] ?? en}`)
    .join('\n');
  const prompt = `Translate these UI strings of GenPM (a package manager for AI-assisted development) from English to ${locale}.
Rules: keep ICU MessageFormat syntax and every {placeholder} exactly; never translate these terms: ${glossary.doNotTranslate.join(', ')}; code, commands, flags and file names stay as is; neutral, concise, gender-neutral tone${locale === 'es' ? '; neutral Latin American Spanish using tú' : ''}.
Glossary:\n${terms}
Return ONLY a JSON object with the same keys.\n\n${JSON.stringify(entries, null, 2)}`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 16000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const text = body.content.map((c) => c.text ?? '').join('');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

if (!process.env.ANTHROPIC_API_KEY && !dry) {
  console.error('ANTHROPIC_API_KEY is required (or use --dry-run to list missing keys)');
  process.exit(1);
}
for (const locale of only) {
  for (const ns of namespaces(SOURCE)) {
    const source = flatten(readCatalog(SOURCE, ns));
    const current = flatten(readCatalog(locale, ns) ?? {});
    const missing = Object.fromEntries(Object.entries(source).filter(([k]) => current[k] === undefined));
    if (!Object.keys(missing).length) continue;
    console.log(`${locale}/${ns}: ${Object.keys(missing).length} missing`);
    if (dry) continue;
    const done = await translate(locale, missing);
    const merged = { ...current, ...done };
    const ordered = Object.fromEntries(
      Object.keys(source)
        .filter((k) => merged[k] !== undefined)
        .map((k) => [k, merged[k]]),
    );
    writeFileSync(join(LOCALES_DIR, locale, `${ns}.json`), `${JSON.stringify(unflatten(ordered), null, 2)}\n`);
    const metaPath = join(LOCALES_DIR, locale, `${ns}.meta.json`);
    const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {};
    for (const k of Object.keys(done)) meta[k] = { ...(meta[k] ?? {}), machine: true };
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  }
}
