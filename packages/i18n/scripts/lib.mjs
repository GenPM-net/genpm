// Utilidades compartidas por los scripts de @genpm/i18n.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, TYPE } from '@formatjs/icu-messageformat-parser';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const LOCALES_DIR = join(ROOT, 'locales');
export const SOURCE = 'en';
/** Nivel 1: claves faltantes rompen el build. Nivel 2: aviso + fallback (i18n §2, §6). */
export const TIER1 = ['en', 'es', 'pt-BR'];
export const TIER2 = ['fr', 'de', 'ja', 'zh-CN', 'ko'];

export function locales() {
  return readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

export function namespaces(locale = SOURCE) {
  return readdirSync(join(LOCALES_DIR, locale))
    .filter((f) => f.endsWith('.json') && !f.endsWith('.meta.json'))
    .map((f) => f.slice(0, -5))
    .sort();
}

export function readCatalog(locale, ns) {
  const p = join(LOCALES_DIR, locale, `${ns}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

/** Aplana `{a:{b:"x"}}` → `{ "a.b": "x" }`. */
export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (v && typeof v === 'object') flatten(v, key, out);
  }
  return out;
}

/** Parámetros de un mensaje ICU con su tipo TS. */
export function paramsOf(message) {
  const params = new Map();
  const walk = (els) => {
    for (const el of els) {
      switch (el.type) {
        case TYPE.argument:
          if (!params.has(el.value)) params.set(el.value, 'string | number');
          break;
        case TYPE.number:
        case TYPE.plural:
          params.set(el.value, 'number');
          break;
        case TYPE.date:
        case TYPE.time:
          params.set(el.value, 'Date | number');
          break;
        case TYPE.select:
          params.set(el.value, 'string');
          break;
      }
      if (el.options) for (const opt of Object.values(el.options)) walk(opt.value);
      if (el.children) walk(el.children);
    }
  };
  walk(parse(message, { ignoreTag: true }));
  return params;
}
