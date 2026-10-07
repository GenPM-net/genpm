// Metadatos de página con valores por defecto del sitio. Devuelve un objeto compatible con `Metadata` de Next.js
// (sin importar `next`) y, para otros frameworks, `metaTags()` genera las etiquetas.
import { z } from 'zod';
import type { AdminField } from '../contracts/index.ts';
import { getSiteSettings, type SiteSettings } from '../site/index.ts';
import { absoluteUrl, siteUrl } from './url.ts';

/** Campos SEO que cualquier colección puede añadir a su esquema: `schema: Page.extend({ seo: SeoFieldsSchema })`. */
export const SeoFieldsSchema = z
  .object({
    title: z.string().max(70).optional(),
    description: z.string().max(170).optional(),
    image: z.string().max(500).optional(),
    noindex: z.boolean().optional(),
  })
  .default({});

export const seoAdminFields: AdminField[] = [
  { name: 'seo.title', label: 'SEO title (≤ 70)', type: 'text' },
  { name: 'seo.description', label: 'SEO description (≤ 170)', type: 'textarea' },
  { name: 'seo.image', label: 'Social image (URL or path)', type: 'text' },
  { name: 'seo.noindex', label: 'Hide from search engines', type: 'boolean' },
];

export type PageSeo = {
  title?: string;
  description?: string;
  /** Ruta canónica de la página (`/blog/x`). */
  path: string;
  /** Imagen social (URL o ruta). Por defecto la de los ajustes. */
  image?: string;
  locale?: string;
  /** Versiones en otros idiomas: locale → ruta. Genera `hreflang` (incluye `x-default` con el idioma por defecto). */
  alternates?: Record<string, string>;
  defaultLocale?: string;
  type?: 'website' | 'article' | 'product';
  publishedTime?: Date;
  modifiedTime?: Date;
  noindex?: boolean;
};

export type SeoMetadata = {
  title: string;
  description?: string;
  alternates: { canonical: string; languages?: Record<string, string> };
  openGraph: {
    title: string;
    description?: string;
    url: string;
    siteName?: string;
    locale?: string;
    type: 'website' | 'article';
    images?: Array<{ url: string }>;
    publishedTime?: string;
    modifiedTime?: string;
  };
  twitter: { card: 'summary' | 'summary_large_image'; title: string; description?: string; images?: string[] };
  robots?: { index: boolean; follow: boolean };
};

/** Une la página con los ajustes del sitio: título `Página · Sitio`, imagen y descripción por defecto. */
export function buildMetadataWith(page: PageSeo, settings: SiteSettings | null, base: URL = siteUrl()): SeoMetadata {
  const name = settings?.name;
  const title = page.title ? (name && page.title !== name ? `${page.title} · ${name}` : page.title) : (name ?? '');
  const description = page.description ?? settings?.tagline;
  const canonical = absoluteUrl(page.path, base);
  const image = page.image ?? settings?.ogImage;
  const languages = page.alternates
    ? Object.fromEntries([
        ...Object.entries(page.alternates).map(([l, p]) => [l, absoluteUrl(p, base)]),
        ...(page.defaultLocale && page.alternates[page.defaultLocale] ? [['x-default', absoluteUrl(page.alternates[page.defaultLocale]!, base)]] : []),
      ])
    : undefined;
  const noindex = page.noindex || process.env.SEO_NOINDEX === '1';
  return {
    title,
    ...(description && { description }),
    alternates: { canonical, ...(languages && { languages }) },
    openGraph: {
      title,
      ...(description && { description }),
      url: canonical,
      ...(name && { siteName: name }),
      ...(page.locale && { locale: page.locale.replace('-', '_') }),
      type: page.type === 'article' ? 'article' : 'website',
      ...(image && { images: [{ url: absoluteUrl(image, base) }] }),
      ...(page.publishedTime && { publishedTime: page.publishedTime.toISOString() }),
      ...(page.modifiedTime && { modifiedTime: page.modifiedTime.toISOString() }),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      ...(description && { description }),
      ...(image && { images: [absoluteUrl(image, base)] }),
    },
    ...(noindex && { robots: { index: false, follow: true } }),
  };
}

/** Como `buildMetadataWith`, leyendo los ajustes publicados de @core/site. */
export async function buildMetadata(page: PageSeo): Promise<SeoMetadata> {
  return buildMetadataWith(page, await getSiteSettings({ locale: page.locale }));
}

const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** Etiquetas `<title>`/`<meta>`/`<link>` en HTML para frameworks sin API de metadatos (Hono JSX, plantillas). */
export function metaTags(m: SeoMetadata): string {
  const tags = [`<title>${esc(m.title)}</title>`, `<link rel="canonical" href="${esc(m.alternates.canonical)}">`];
  const meta = (attr: 'name' | 'property', key: string, value?: string) => value && tags.push(`<meta ${attr}="${key}" content="${esc(value)}">`);
  meta('name', 'description', m.description);
  for (const [lang, href] of Object.entries(m.alternates.languages ?? {})) tags.push(`<link rel="alternate" hreflang="${esc(lang)}" href="${esc(href)}">`);
  meta('property', 'og:title', m.openGraph.title);
  meta('property', 'og:description', m.openGraph.description);
  meta('property', 'og:url', m.openGraph.url);
  meta('property', 'og:site_name', m.openGraph.siteName);
  meta('property', 'og:locale', m.openGraph.locale);
  meta('property', 'og:type', m.openGraph.type);
  for (const i of m.openGraph.images ?? []) meta('property', 'og:image', i.url);
  meta('name', 'twitter:card', m.twitter.card);
  if (m.robots) meta('name', 'robots', `${m.robots.index ? 'index' : 'noindex'}, ${m.robots.follow ? 'follow' : 'nofollow'}`);
  return tags.join('\n');
}
