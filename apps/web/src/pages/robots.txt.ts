import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /dashboard',
      'Disallow: /settings',
      'Disallow: /auth',
      'Sitemap: https://genpm.net/sitemap.xml',
      '',
    ].join('\n'),
    {
      headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=86400' },
    },
  );
