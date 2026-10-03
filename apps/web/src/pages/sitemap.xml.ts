// sitemap.xml con alternativas por idioma (hreflang), generado desde el registry (web-ui-spec §8 SEO).
import type { APIRoute } from 'astro';
import { docPages } from '../lib/docs.js';
import { href, LOCALES } from '../lib/i18n.js';
import { registryGet, type SearchResponse } from '../lib/registry.js';

export const GET: APIRoute = async () => {
  const paths = [
    '/',
    '/search',
    '/mcp',
    '/publish',
    '/security',
    '/security/advisories',
    '/terms',
    '/privacy',
    '/cookies',
    '/legal',
    '/policy',
    '/sponsors',
    '/enterprise',
    ...docPages('en').map((d) => `/docs/${d.slug}`),
  ];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const res: { data: SearchResponse | null } = await registryGet<SearchResponse>(
      `/v1/search?sort=installs&limit=50${cursor ? `&cursor=${cursor}` : ''}`,
    );
    for (const p of res.data?.results ?? []) paths.push(`/p/${p.name}`);
    cursor = res.data?.next ?? null;
    if (!cursor) break;
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;');
  const urls = paths.map(
    (p) =>
      `<url><loc>https://genpm.net${esc(p)}</loc>${LOCALES.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="https://genpm.net${esc(href(l, p))}"/>`).join('')}</url>`,
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml', 'cache-control': 'public, max-age=3600' } });
};
