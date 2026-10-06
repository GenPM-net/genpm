import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { seedEntry } from '../content/index.ts';
import * as contentSchema from '../content/schema.ts';
import { defineSitemapSource } from '../contracts/index.ts';
import { testDb } from '../db/__fixtures__/pglite.ts';
import * as jobsSchema from '../jobs/schema.ts';
import type { SiteSettings } from '../site/index.ts';
import * as siteSchema from '../site/schema.ts';
import { seoRoutes } from './adapters/hono.ts';
import { robotsRoute, sitemapChunkRoute, sitemapIndexRoute } from './adapters/next.ts';
import {
  buildMetadata,
  buildMetadataWith,
  clearSitemapSources,
  jsonLd,
  jsonLdScript,
  llmsTxt,
  metaTags,
  registerSitemapSource,
  robotsTxt,
  SeoFieldsSchema,
  sitemapChunkXml,
  sitemapIndexXml,
  siteUrl,
} from './index.ts';

const settings: SiteSettings = {
  name: 'Tazas Co',
  tagline: 'Handmade mugs',
  ogImage: '/og.png',
  logo: '/logo.png',
  social: [{ platform: 'instagram', url: 'https://instagram.com/tazas' }],
  legal: {},
};

beforeEach(() => {
  process.env.SITE_URL = 'https://tazas.example';
  delete process.env.SEO_NOINDEX;
  clearSitemapSources();
});

describe('metadata', () => {
  it('fills defaults from site settings and builds canonical, hreflang and social tags', () => {
    const m = buildMetadataWith(
      { title: 'About', path: '/about', locale: 'es-ES', alternates: { en: '/about', es: '/es/sobre' }, defaultLocale: 'en' },
      settings,
    );
    expect(m.title).toBe('About · Tazas Co');
    expect(m.description).toBe('Handmade mugs');
    expect(m.alternates).toEqual({
      canonical: 'https://tazas.example/about',
      languages: { en: 'https://tazas.example/about', es: 'https://tazas.example/es/sobre', 'x-default': 'https://tazas.example/about' },
    });
    expect(m.openGraph).toMatchObject({ locale: 'es_ES', siteName: 'Tazas Co', images: [{ url: 'https://tazas.example/og.png' }] });
    expect(m.twitter.card).toBe('summary_large_image');
    expect(m.robots).toBeUndefined();
    expect(buildMetadataWith({ path: '/', noindex: true }, null).robots).toEqual({ index: false, follow: true });
  });

  it('SEO_NOINDEX blocks indexing everywhere (staging)', () => {
    process.env.SEO_NOINDEX = '1';
    expect(buildMetadataWith({ path: '/' }, settings).robots?.index).toBe(false);
    expect(robotsTxt()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('metaTags escapes values', () => {
    const html = metaTags(buildMetadataWith({ title: '"><script>x</script>', path: '/x' }, settings));
    expect(html).not.toContain('<script>');
    expect(html).toContain('<link rel="canonical" href="https://tazas.example/x">');
  });

  it('requires an https SITE_URL', () => {
    expect(() => siteUrl({ SITE_URL: 'http://tazas.example' })).toThrow(/https/);
    expect(siteUrl({ SITE_URL: 'http://localhost:3000' }).host).toBe('localhost:3000');
  });

  it('SeoFieldsSchema limits lengths', () => {
    expect(SeoFieldsSchema.parse(undefined)).toEqual({});
    expect(SeoFieldsSchema.safeParse({ title: 'x'.repeat(71) }).success).toBe(false);
  });

  it('buildMetadata reads published site settings', async () => {
    await testDb(contentSchema, jobsSchema, siteSchema);
    await seedEntry({ collection: 'site_settings', data: { name: 'From DB' } });
    expect((await buildMetadata({ title: 'Home', path: '/' })).title).toBe('Home · From DB');
  });
});

describe('JSON-LD', () => {
  it('escapes script-breaking characters', () => {
    const s = jsonLdScript(jsonLd.faq([{ question: '</script><script>alert(1)</script>', answer: 'a & b' }]));
    expect(s).not.toContain('</script>');
    expect(JSON.parse(s).mainEntity[0].name).toBe('</script><script>alert(1)</script>');
  });

  it('products use decimal prices per currency and only real ratings', () => {
    const base = { name: 'Mug', path: '/products/mug', availability: 'InStock' as const };
    const eur = jsonLd.product({ ...base, price: { amount: 1999, currency: 'EUR' }, rating: { average: 4.66, count: 3 } });
    expect(eur.offers).toMatchObject({ price: '19.99', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' });
    expect(eur.aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: '4.7', reviewCount: 3 });
    const jpy = jsonLd.product({ ...base, price: { amount: 1500, currency: 'JPY' }, rating: { average: 0, count: 0 } });
    expect((jpy.offers as { price: string }).price).toBe('1500');
    expect(jpy.aggregateRating).toBeUndefined();
  });

  it('organization, website with search and breadcrumbs', () => {
    expect(jsonLd.organization(settings)).toMatchObject({ '@type': 'Organization', logo: 'https://tazas.example/logo.png', sameAs: ['https://instagram.com/tazas'] });
    expect(jsonLd.website(settings, '/search?q=').potentialAction).toMatchObject({ target: 'https://tazas.example/search?q={search_term_string}' });
    expect(jsonLd.breadcrumbs([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }]).itemListElement).toHaveLength(2);
  });
});

describe('sitemaps', () => {
  it('index lists one chunk per 50k URLs; chunks carry lastmod and hreflang and escape XML', async () => {
    registerSitemapSource(
      defineSitemapSource({
        name: 'pages',
        async *urls() {
          yield { loc: '/a&b', lastmod: new Date('2026-01-01T00:00:00Z'), alternates: { es: '/es/a' }, priority: 0.8 };
        },
      }),
    );
    registerSitemapSource(defineSitemapSource({ name: 'products', async *urls() { for (let i = 0; i < 50_001; i++) yield { loc: `/p/${i}` }; } }));
    const index = await sitemapIndexXml();
    expect(index.match(/<sitemap>/g)).toHaveLength(3);
    expect(index).toContain('https://tazas.example/sitemaps/products/1.xml');
    const pages = await sitemapChunkXml('pages', 0);
    expect(pages).toContain('<loc>https://tazas.example/a&amp;b</loc>');
    expect(pages).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>');
    expect(pages).toContain('<xhtml:link rel="alternate" hreflang="es" href="https://tazas.example/es/a"/>');
    expect((await sitemapChunkXml('products', 1))?.match(/<url>/g)).toHaveLength(1);
    expect(await sitemapChunkXml('products', 2)).toBeNull();
    expect(await sitemapChunkXml('nope', 0)).toBeNull();
    expect(() => registerSitemapSource({ name: '../x', async *urls() {} })).toThrow();
  });

  it('robots and llms.txt', () => {
    expect(robotsTxt()).toContain('Disallow: /admin\n');
    expect(robotsTxt()).toContain('Sitemap: https://tazas.example/sitemap.xml');
    const txt = llmsTxt({ name: 'Tazas Co', summary: 'Mugs\nmade by hand', sections: [{ title: 'Shop', links: [{ title: 'All [mugs]', url: '/shop', note: 'catalog' }] }] });
    expect(txt).toBe('# Tazas Co\n\n> Mugs made by hand\n\n## Shop\n\n- [All [mugs\\]](https://tazas.example/shop): catalog\n');
  });

  it('Hono and Next routes serve XML and text', async () => {
    registerSitemapSource(defineSitemapSource({ name: 'pages', async *urls() { yield { loc: '/' }; } }));
    const app = new Hono().route('/', seoRoutes());
    expect((await app.request('/sitemap.xml')).headers.get('content-type')).toContain('application/xml');
    expect((await app.request('/sitemaps/pages/0.xml')).status).toBe(200);
    expect((await app.request('/sitemaps/pages/x.xml')).status).toBe(404);
    expect(await (await app.request('/robots.txt')).text()).toContain('Sitemap:');
    expect((await sitemapIndexRoute()).status).toBe(200);
    const ctx = (name: string, file: string) => ({ params: Promise.resolve({ name, file }) });
    expect((await sitemapChunkRoute(new Request('http://x'), ctx('pages', '0.xml'))).status).toBe(200);
    expect((await sitemapChunkRoute(new Request('http://x'), ctx('pages', '../0.xml'))).status).toBe(404);
    expect(await robotsRoute().text()).toContain('User-agent');
  });
});
