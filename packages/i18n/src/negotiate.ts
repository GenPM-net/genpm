// Negociación de idioma (i18n §3). Sin I/O: las fuentes (flag, env, .genpmrc, Intl) se pasan como argumentos.

import { DEFAULT_LOCALE, LOCALES, type Locale, PSEUDO } from './locales.js';

/** Normaliza `es_ES.UTF-8`, `pt-br`, `zh_Hans_CN` → BCP 47 aproximado. */
export function normalizeTag(tag: string): string {
  const base = tag.split('.')[0]!.split('@')[0]!.replace(/_/g, '-');
  if (base === 'C' || base === 'POSIX') return 'en';
  const parts = base.split('-').filter(Boolean);
  return parts
    .map((p, i) => {
      if (i === 0) return p.toLowerCase();
      if (p.length === 4) return p[0]!.toUpperCase() + p.slice(1).toLowerCase();
      return p.toUpperCase();
    })
    .join('-');
}

/** Encuentra el locale soportado más cercano a una etiqueta, o `null`. */
export function match(tag: string, supported: readonly string[] = LOCALES): string | null {
  const t = normalizeTag(tag);
  if (!t) return null;
  if (t === PSEUDO && supported.includes(PSEUDO)) return PSEUDO;
  if (supported.includes(t)) return t;
  const [lang, ...rest] = t.split('-');
  // zh-Hans/zh-Hans-CN/zh-SG → zh-CN; pt/pt-PT → pt-BR (único portugués soportado).
  if (lang === 'zh') {
    // Chino tradicional (Hant/TW/HK/MO) no recibe simplificado: mejor inglés que el sistema de escritura equivocado.
    const traditional = rest.some((p) => ['Hant', 'TW', 'HK', 'MO'].includes(p));
    return !traditional && supported.includes('zh-CN') ? 'zh-CN' : null;
  }
  const sameLang = supported.find((s) => s.split('-')[0] === lang);
  return sameLang ?? null;
}

/** `Accept-Language: es-MX,es;q=0.9,en;q=0.8` → mejor locale soportado. */
export function negotiateAcceptLanguage(
  header: string | null | undefined,
  supported: readonly string[] = LOCALES,
): Locale {
  if (!header) return DEFAULT_LOCALE;
  const ranked = header
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(';');
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const quality = q ? Number(q.slice(2)) : 1;
      return { tag: tag!.trim(), quality: Number.isFinite(quality) ? quality : 0, i };
    })
    .filter((x) => x.tag && x.tag !== '*' && x.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.i - b.i);
  for (const { tag } of ranked) {
    const m = match(tag, supported);
    if (m) return m as Locale;
  }
  return DEFAULT_LOCALE;
}

export type CliLocaleSources = {
  flag?: string | undefined;
  env?: Record<string, string | undefined>;
  rcLang?: string | undefined;
  /** `Intl.DateTimeFormat().resolvedOptions().locale` del sistema. */
  system?: string | undefined;
};

export type LocaleSource =
  | 'flag'
  | 'GENPM_LANG'
  | '.genpmrc'
  | 'LC_ALL'
  | 'LC_MESSAGES'
  | 'LANG'
  | 'system'
  | 'default';

/** `--lang` → `GENPM_LANG` → `.genpmrc lang=` → `LC_ALL`/`LC_MESSAGES`/`LANG` → SO → `en`. */
export function resolveCliLocale(src: CliLocaleSources): { locale: Locale; source: LocaleSource } {
  const env = src.env ?? {};
  const candidates: Array<[LocaleSource, string | undefined]> = [
    ['flag', src.flag],
    ['GENPM_LANG', env['GENPM_LANG']],
    ['.genpmrc', src.rcLang],
    ['LC_ALL', env['LC_ALL']],
    ['LC_MESSAGES', env['LC_MESSAGES']],
    ['LANG', env['LANG']],
    ['system', src.system],
  ];
  const supported = [...LOCALES, PSEUDO];
  for (const [source, value] of candidates) {
    if (!value) continue;
    const m = match(value, supported);
    if (m) return { locale: m as Locale, source };
  }
  return { locale: DEFAULT_LOCALE, source: 'default' };
}
