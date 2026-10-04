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

// Archivos estáticos que no tienen versión por idioma.
const UNLOCALIZED = /^\/(?:schema|install\.sh|install\.ps1|llms[^/]*\.txt|\.well-known)(?:[/?#.]|$)/;

/**
 * Enlaces internos del HTML de un Markdown propio (docs, legal) al idioma actual: `/privacy` → `/es/privacy`.
 * `renderMarkdown` los devuelve absolutos (`https://genpm.net/…`); quedan relativos para que funcionen en staging.
 * Respeta los que ya llevan idioma y los archivos estáticos.
 */
export function localizeLinks(html: string, locale: Locale): string {
  return html.replace(/href="(?:https:\/\/genpm\.net)?(\/(?!\/)[^"]*)"/g, (_, path: string) => {
    if (UNLOCALIZED.test(path) || splitLocale(path).locale !== 'en' || path.startsWith('/en/')) return `href="${path}"`;
    return `href="${href(locale, path)}"`;
  });
}
