// Imagen Open Graph de cada guía: mismo diseño que las de paquete (lib/og.ts), con el título y el resumen.
import type { APIRoute } from 'astro';
import { guidePage } from '../../../lib/guides.js';
import { renderOg } from '../../../lib/og.js';

export const GET: APIRoute = ({ params }) => {
  const page = guidePage('en', String(params.slug));
  if (!page) return Response.redirect('https://genpm.net/og/home.png', 302);
  return renderOg(
    { eyebrow: page.pkg, title: page.title, subtitle: page.description },
    { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' },
  );
};
