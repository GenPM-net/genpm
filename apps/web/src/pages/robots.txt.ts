import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

// Fuera de producción (staging en workers.dev) no se indexa nada: evita contenido duplicado de genpm.net.
export const GET: APIRoute = () =>
  new Response(
    `${(
      env.ENVIRONMENT === 'production'
        ? [
            'User-agent: *',
            'Allow: /',
            'Disallow: /dashboard',
            'Disallow: /settings',
            'Disallow: /auth',
            'Sitemap: https://genpm.net/sitemap.xml',
          ]
        : ['User-agent: *', 'Disallow: /']
    ).join('\n')}\n`,
    {
      headers: { 'content-type': 'text/plain', 'cache-control': 'public, max-age=86400' },
    },
  );
