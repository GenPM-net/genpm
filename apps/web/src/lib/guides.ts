// Guías (/guides): artículos largos en inglés que arrancan de un fallo concreto y acaban en el módulo que lo trae
// resuelto. Mismo mecanismo que lib/docs.ts (Markdown del repo por idioma, fallback a inglés), colección aparte:
// la documentación describe GenPM, una guía resuelve un problema de quien quizá nunca instale GenPM.
const files = import.meta.glob('../content/guides/*/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

export type GuidePage = {
  slug: string;
  locale: string;
  title: string;
  /** Resumen en una frase: meta description, tarjeta del índice y subtítulo de la imagen OG. */
  description: string;
  /** El paquete del registro que trae el problema resuelto (`@core/stripe`). */
  pkg: string;
  published: string;
  updated: string;
  order: number;
  body: string;
  translated: boolean;
};

function parse(path: string, raw: string): GuidePage {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = Object.fromEntries(
    (m?.[1] ?? '').split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()]),
  );
  const [, locale, file] = path.match(/\/guides\/([^/]+)\/([^/]+)\.md$/)!;
  const published = meta['published'] ?? '2026-11-13';
  return {
    slug: file!,
    locale: locale!,
    title: meta['title'] ?? file!,
    description: meta['description'] ?? '',
    pkg: meta['pkg'] ?? '',
    published,
    updated: meta['updated'] ?? published,
    order: Number(meta['order'] ?? 99),
    body: m?.[2] ?? raw,
    translated: true,
  };
}

const ALL = Object.entries(files).map(([p, raw]) => parse(p, raw));

/** Las guías en inglés son la fuente: una traducción las sustituye, y si no existe se sirve el inglés con aviso. */
export function guidePages(locale: string): GuidePage[] {
  return ALL.filter((g) => g.locale === 'en')
    .map((g) => ALL.find((x) => x.locale === locale && x.slug === g.slug) ?? { ...g, translated: locale === 'en' })
    .sort((a, b) => a.order - b.order);
}

export function guidePage(locale: string, slug: string): GuidePage | null {
  return guidePages(locale).find((g) => g.slug === slug) ?? null;
}
