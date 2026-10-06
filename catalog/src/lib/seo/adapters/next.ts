// Adaptador Next.js (route handlers):
//   app/sitemap.xml/route.ts                 → export { sitemapIndexRoute as GET } from '@/lib/seo/adapters/next';
//   app/sitemaps/[name]/[file]/route.ts      → export { sitemapChunkRoute as GET } from '@/lib/seo/adapters/next';
//   app/robots.txt/route.ts                  → export { robotsRoute as GET } from '@/lib/seo/adapters/next';
// Metadatos: `export async function generateMetadata() { return buildMetadata({ title, path }) }`.
import { robotsTxt, sitemapChunkXml, sitemapIndexXml } from '../index.ts';

const XML = { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' };

export async function sitemapIndexRoute(): Promise<Response> {
  return new Response(await sitemapIndexXml(), { headers: XML });
}

export async function sitemapChunkRoute(_req: Request, ctx: { params: Promise<{ name: string; file: string }> }): Promise<Response> {
  const { name, file } = await ctx.params;
  const m = /^(\d{1,4})\.xml$/.exec(file);
  const body = m ? await sitemapChunkXml(name, Number(m[1])) : null;
  return body ? new Response(body, { headers: XML }) : new Response('Not found', { status: 404 });
}

export function robotsRoute(): Response {
  return new Response(robotsTxt(), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
