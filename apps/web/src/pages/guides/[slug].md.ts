// Superficie para agentes: cada guía en Markdown, igual que /docs/<slug>.md.
import type { APIRoute } from 'astro';
import { guidePage } from '../../lib/guides.js';

export const GET: APIRoute = ({ params, locals }) => {
  const page = guidePage(locals.locale, String(params.slug));
  if (!page) return new Response('Not found', { status: 404 });
  return new Response(`# ${page.title}\n\n> ${page.description}\n\n${page.body}`, {
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
};
