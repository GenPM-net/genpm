// sitemap.xml (índice) + trozos de hasta 50 000 URLs por fuente, robots.txt y llms.txt.
import type { SitemapSource, SitemapUrl } from '../contracts/index.ts';
import { absoluteUrl, siteUrl } from './url.ts';

export const SITEMAP_CHUNK = 50_000;
const sources = new Map<string, SitemapSource>();

/** Registra una fuente (en `src/genpm/seo.ts`). */
export function registerSitemapSource(source: SitemapSource): void {
  if (!/^[a-z0-9][a-z0-9-_]{0,63}$/.test(source.name)) throw new Error(`invalid sitemap source name: ${source.name}`);
  sources.set(source.name, source);
}

/** Solo tests. */
export const clearSitemapSources = () => sources.clear();

const xml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

async function countUrls(source: SitemapSource): Promise<number> {
  let n = 0;
  for await (const _ of source.urls()) n++;
  return n;
}

/** Índice: un `<sitemap>` por trozo de cada fuente, servidos en `/sitemaps/<fuente>/<n>.xml`. */
export async function sitemapIndexXml(): Promise<string> {
  const base = siteUrl();
  const entries: string[] = [];
  for (const s of sources.values()) {
    const chunks = Math.max(1, Math.ceil((await countUrls(s)) / SITEMAP_CHUNK));
    for (let i = 0; i < chunks; i++) entries.push(`<sitemap><loc>${xml(absoluteUrl(`/sitemaps/${s.name}/${i}.xml`, base))}</loc></sitemap>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}</sitemapindex>`;
}

function urlXml(u: SitemapUrl, base: URL): string {
  const parts = [`<loc>${xml(absoluteUrl(u.loc, base))}</loc>`];
  if (u.lastmod) parts.push(`<lastmod>${u.lastmod.toISOString()}</lastmod>`);
  if (u.changefreq) parts.push(`<changefreq>${u.changefreq}</changefreq>`);
  if (u.priority !== undefined) parts.push(`<priority>${Math.min(1, Math.max(0, u.priority)).toFixed(1)}</priority>`);
  for (const [lang, href] of Object.entries(u.alternates ?? {}))
    parts.push(`<xhtml:link rel="alternate" hreflang="${xml(lang)}" href="${xml(absoluteUrl(href, base))}"/>`);
  return `<url>${parts.join('')}</url>`;
}

/** Trozo `chunk` (desde 0) de la fuente `name`, o null si no existe. */
export async function sitemapChunkXml(name: string, chunk: number): Promise<string | null> {
  const source = sources.get(name);
  if (!source || !Number.isInteger(chunk) || chunk < 0) return null;
  const base = siteUrl();
  const from = chunk * SITEMAP_CHUNK;
  const urls: string[] = [];
  let i = 0;
  for await (const u of source.urls()) {
    if (i >= from && i < from + SITEMAP_CHUNK) urls.push(urlXml(u, base));
    if (++i >= from + SITEMAP_CHUNK) break;
  }
  if (chunk > 0 && !urls.length) return null;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join('')}</urlset>`;
}

/** robots.txt. Con `SEO_NOINDEX=1` (staging) bloquea todo. */
export function robotsTxt(opts: { disallow?: string[]; extra?: string } = {}): string {
  if (process.env.SEO_NOINDEX === '1') return 'User-agent: *\nDisallow: /\n';
  const disallow = opts.disallow ?? ['/admin', '/api', '/account', '/checkout', '/cart'];
  return [
    'User-agent: *',
    ...disallow.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${absoluteUrl('/sitemap.xml')}`,
    ...(opts.extra ? ['', opts.extra] : []),
    '',
  ].join('\n');
}

export type LlmsSection = { title: string; links: Array<{ title: string; url: string; note?: string }> };

/** llms.txt (https://llmstxt.org): resumen del sitio en Markdown para agentes. */
export function llmsTxt(site: { name: string; summary?: string; details?: string; sections: LlmsSection[] }): string {
  const line = (s: string) => s.replaceAll('\n', ' ').trim();
  const out = [`# ${line(site.name)}`, ''];
  if (site.summary) out.push(`> ${line(site.summary)}`, '');
  if (site.details) out.push(site.details.trim(), '');
  for (const sec of site.sections) {
    out.push(`## ${line(sec.title)}`, '');
    for (const l of sec.links) out.push(`- [${line(l.title).replaceAll(']', '\\]')}](${absoluteUrl(l.url)})${l.note ? `: ${line(l.note)}` : ''}`);
    out.push('');
  }
  return out.join('\n');
}
