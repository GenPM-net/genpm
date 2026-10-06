// Adaptador Hono: `app.route('/', seoRoutes())` → /sitemap.xml, /sitemaps/:name/:n.xml y /robots.txt.
import { Hono } from 'hono';
import { robotsTxt, sitemapChunkXml, sitemapIndexXml } from '../index.js';

const XML = { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' };

export function seoRoutes(opts: { disallow?: string[] } = {}) {
  return new Hono()
    .get('/sitemap.xml', async (c) => c.body(await sitemapIndexXml(), 200, XML))
    .get('/sitemaps/:name/:file', async (c) => {
      const m = /^(\d{1,4})\.xml$/.exec(c.req.param('file'));
      const body = m ? await sitemapChunkXml(c.req.param('name'), Number(m[1])) : null;
      return body ? c.body(body, 200, XML) : c.notFound();
    })
    .get('/robots.txt', (c) => c.text(robotsTxt(opts)));
}
