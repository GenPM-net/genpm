// Fuente de URLs para sitemap.xml: la implementan content, blog, catalog…; la consume @core/seo.

export type SitemapUrl = {
  /** Ruta absoluta del sitio (`/blog/hola`) o URL completa. */
  loc: string;
  lastmod?: Date;
  /** Versiones en otros idiomas: locale BCP 47 → ruta o URL (genera `hreflang`). */
  alternates?: Record<string, string>;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** 0.0–1.0 */
  priority?: number;
};

export type SitemapSource = {
  /** Nombre único de la fuente (`pages`, `blog`, `products`); da nombre a su trozo del índice. */
  name: string;
  urls(): AsyncIterable<SitemapUrl>;
};

export const defineSitemapSource = (source: SitemapSource): SitemapSource => source;
