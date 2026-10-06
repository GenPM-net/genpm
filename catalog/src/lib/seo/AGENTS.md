# @core/seo — rules for AI agents

## Purpose
Everything search engines and crawling agents read: page metadata with site defaults (title template, description,
canonical, hreflang, Open Graph, Twitter, robots), a sitemap index with chunks of 50,000 URLs built from any
registered `SitemapSource`, `robots.txt`, `llms.txt` and schema.org JSON-LD builders with script-safe escaping.
No tables. OG image generation is out of scope for 1.0.

## Map
- `index.ts` — public API: `buildMetadata`, `metaTags`, `SeoFieldsSchema`, `jsonLd`, `jsonLdScript`, `registerSitemapSource`, `robotsTxt`, `llmsTxt`.
- `metadata.ts`, `jsonld.ts`, `sitemap.ts`, `url.ts` (`SITE_URL` helpers).
- `adapters/hono.ts` — `seoRoutes()`. `adapters/next.ts` — `sitemapIndexRoute`, `sitemapChunkRoute`, `robotsRoute`.

## Integration
1. Env: `SITE_URL` (https). In staging set `SEO_NOINDEX=1` (noindex everywhere and `Disallow: /`).
2. Register sources in `src/genpm/seo.ts`, imported at startup:
   `registerSitemapSource(contentSitemapSource('pages', ({ slug }) => `/${slug}`))`.
3. Routes: Hono `app.route('/', seoRoutes())`. Next.js: `app/sitemap.xml/route.ts`, `app/sitemaps/[name]/[file]/route.ts`
   and `app/robots.txt/route.ts` re-exporting the handlers (see `adapters/next.ts`), each with `export const dynamic = 'force-dynamic'`
   (otherwise `next build` prerenders them and needs the database and `SITE_URL` at build time); delete Next's own `sitemap.ts`/`robots.ts` if present.
4. Pages: Next.js `export async function generateMetadata() { return buildMetadata({ title, description, path, alternates }) }`;
   other frameworks put `metaTags(await buildMetadata(...))` in `<head>`.
5. JSON-LD: `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd.product(...)) }} />`
   (`jsonLdScript` escapes it, so this is the one safe use of raw HTML).
6. Add `seo: SeoFieldsSchema` to collections that need per-entry overrides.
7. Verify: `/sitemap.xml` lists chunks, each chunk lists published URLs; page `<head>` has one canonical.

## Conventions
- One `buildMetadata` per page; don't set `<title>` or description elsewhere.
- Canonical paths are the public URL without query strings; pass `alternates` for every translated page.
- `noindex` previews, internal search results and account pages.

## Don't
- Don't add ratings, prices or availability to JSON-LD that the page doesn't show or that aren't real.
- Don't serialize JSON-LD with plain `JSON.stringify` inside a script tag.
- Don't list drafts or private pages in a sitemap source.
