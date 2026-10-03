// Idiomas soportados (i18n §2).

export const TIER1 = ['en', 'es', 'pt-BR'] as const;
export const TIER2 = ['fr', 'de', 'ja', 'zh-CN', 'ko'] as const;
export const LOCALES = [...TIER1, ...TIER2] as const;
export type Locale = (typeof LOCALES)[number];
/** Pseudo-locale para QA (texto +40 % y acentos). */
export const PSEUDO = 'en-XA';

export const DEFAULT_LOCALE: Locale = 'en';

/** Locales en beta: banner "beta translation" hasta su revisión nativa. */
export function isBeta(locale: string): boolean {
  return (TIER2 as readonly string[]).includes(locale);
}

/** Prefijo de URL de la web: `/` (en), `/es/`, `/pt-br/`, `/zh-cn/`… (i18n §3). */
export function urlPrefix(locale: Locale): string {
  return locale === 'en' ? '' : `/${locale.toLowerCase()}`;
}

export function fromUrlPrefix(segment: string): Locale | null {
  const found = LOCALES.find((l) => l.toLowerCase() === segment.toLowerCase());
  return found && found !== 'en' ? found : null;
}

/** Cadena de fallback: `pt-BR → pt → en`, `es-ES → es → en`. */
export function fallbackChain(locale: string): string[] {
  const chain: string[] = [];
  const parts = locale.split('-');
  for (let i = parts.length; i > 0; i--) chain.push(parts.slice(0, i).join('-'));
  if (!chain.includes('en')) chain.push('en');
  return chain;
}
