// Rutas y utilidades puras del blog (sin registro: las importa también el bloque "Últimos posts").
export const BLOG_PATH = '/blog';
export const PER_PAGE = 10;
export const postPath = (p: { slug: string }) => `${BLOG_PATH}/${p.slug}`;

/** Página pedida en `?page=` (1 si falta o no es válida). */
export function pageParam(sp: Record<string, string | string[] | undefined>): number {
  const v = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  return Number.isInteger(v) && v > 0 && v < 10_000 ? v : 1;
}

export const formatDate = (d: Date | null, locale = 'en') =>
  d ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(d) : '';
