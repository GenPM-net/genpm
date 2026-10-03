// Idioma de la web (i18n §4.4): prefijo de URL (`/` en, `/es/`, `/pt-br/`…), sin redirección automática por idioma.
import { fromUrlPrefix, LOCALES, type Locale, urlPrefix } from '@genpm/i18n';

export { LOCALES, type Locale, urlPrefix };

export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = pathname.match(/^\/([a-z]{2}(?:-[a-z]{2})?)(\/.*)?$/i);
  if (m) {
    const loc = fromUrlPrefix(m[1]!);
    if (loc) return { locale: loc, path: m[2] || '/' };
  }
  return { locale: 'en', path: pathname };
}

/** Enlace localizado: `href(locale, '/search')` → `/es/search`. */
export function href(locale: Locale, path: string): string {
  const p = urlPrefix(locale);
  return p ? (path === '/' ? p : `${p}${path}`) : path;
}

/** BCP 47 para `<html lang>` y `hreflang`. */
export function htmlLang(locale: Locale): string {
  return locale;
}
