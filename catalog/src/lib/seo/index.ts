// @core/seo — API pública. Importa desde aquí; rutas de sitemap y robots en adapters/.
export { jsonLd, jsonLdScript } from './jsonld.js';
export {
  buildMetadata,
  buildMetadataWith,
  metaTags,
  type PageSeo,
  SeoFieldsSchema,
  type SeoMetadata,
  seoAdminFields,
} from './metadata.js';
export {
  clearSitemapSources,
  type LlmsSection,
  llmsTxt,
  registerSitemapSource,
  robotsTxt,
  SITEMAP_CHUNK,
  sitemapChunkXml,
  sitemapIndexXml,
} from './sitemap.js';
export { absoluteUrl, siteUrl } from './url.js';
