// @genpm/i18n — createT(locale, namespaces) → t(key, params). Sin I/O (i18n §4.1).

import { IntlMessageFormat } from 'intl-messageformat';
import { type Catalog, EN, LOADERS } from './catalogs.gen.js';
import type { MessageKey, MessageParams, Namespace } from './keys.gen.js';
import { DEFAULT_LOCALE, fallbackChain } from './locales.js';

export * as format from './format.js';
export type { MessageKey, MessageParams, Namespace } from './keys.gen.js';
export { NAMESPACES } from './keys.gen.js';
export * from './locales.js';
export * from './negotiate.js';

type Args<K extends MessageKey> = MessageParams[K] extends undefined ? [] : [MessageParams[K]];

export interface Translator {
  readonly locale: string;
  t<K extends MessageKey>(key: K, ...args: Args<K>): string;
  /** Traducción sin tipado estático (claves calculadas, p. ej. `errors.${code}.fix`). */
  raw(key: string, params?: Record<string, unknown>): string;
  has(key: string): boolean;
}

type Catalogs = Record<string, Record<string, Catalog>>;

function lookup(catalog: Catalog | undefined, path: string[]): string | undefined {
  let node: unknown = catalog;
  for (const p of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[p];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Crea un traductor a partir de catálogos ya cargados (síncrono: web, registry, tests). */
export function createTSync(locale: string, catalogs: Catalogs): Translator {
  const chain = fallbackChain(locale);
  const cache = new Map<string, IntlMessageFormat | string>();

  function resolve(key: string): { msg: string; loc: string } | undefined {
    const [ns, ...path] = key.split('.');
    for (const loc of chain) {
      const msg = lookup(catalogs[loc]?.[ns!], path);
      if (msg !== undefined) return { msg, loc };
    }
    return undefined;
  }

  function raw(key: string, params?: Record<string, unknown>): string {
    let compiled = cache.get(key);
    if (compiled === undefined) {
      const found = resolve(key);
      if (!found) return key;
      try {
        compiled = new IntlMessageFormat(found.msg, found.loc === 'en-XA' ? 'en' : found.loc, undefined, {
          ignoreTag: true,
        });
      } catch {
        compiled = found.msg;
      }
      cache.set(key, compiled);
    }
    if (typeof compiled === 'string') return compiled;
    return String(compiled.format(params as Record<string, string | number | Date>));
  }

  return {
    locale,
    raw,
    t: (key, ...args) => raw(key, args[0] as Record<string, unknown> | undefined),
    has: (key) => resolve(key) !== undefined,
  };
}

/** Carga los namespaces del idioma (y su cadena de fallback) bajo demanda; `en` ya va empaquetado. */
export async function loadCatalogs(locale: string, namespaces?: readonly Namespace[]): Promise<Catalogs> {
  const catalogs: Catalogs = { en: EN };
  for (const loc of fallbackChain(locale)) {
    if (loc === 'en') continue;
    const loaders = LOADERS[loc];
    if (!loaders) continue;
    const entries = await Promise.all(
      Object.entries(loaders)
        .filter(([ns]) => !namespaces || (namespaces as readonly string[]).includes(ns))
        .map(async ([ns, load]) => [ns, await load()] as const),
    );
    catalogs[loc] = Object.fromEntries(entries);
  }
  return catalogs;
}

export async function createT(locale: string = DEFAULT_LOCALE, namespaces?: readonly Namespace[]): Promise<Translator> {
  return createTSync(locale, await loadCatalogs(locale, namespaces));
}

/** Traductor inglés síncrono (MCP, `--json`, logs): los textos para máquinas y LLMs siempre van en inglés. */
export const en: Translator = createTSync('en', { en: EN });

/** `message` y `fix` de un código `E_*` en el idioma del traductor. */
export function errorText(
  tr: Translator,
  code: string,
  params?: Record<string, unknown>,
): { message: string; fix: string } {
  return { message: tr.raw(`errors.${code}.message`, params), fix: tr.raw(`errors.${code}.fix`, params) };
}
