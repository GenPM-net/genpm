// @core/seo — API pública. Importa desde aquí; rutas de sitemap y robots en adapters/.
export { jsonLd, jsonLdScript } from './jsonld.ts';
export {
  buildMetadata,
  buildMetadataWith,
  metaTags,
  type PageSeo,
  SeoFieldsSchema,
  type SeoMetadata,
  seoAdminFields,
} from './metadata.ts';
export {
  clearSitemapSources,
  type LlmsSection,
  llmsTxt,
  registerSitemapSource,
  robotsTxt,
  SITEMAP_CHUNK,
  sitemapChunkXml,
  sitemapIndexXml,
} from './sitemap.ts';
export { absoluteUrl, siteUrl } from './url.ts';
