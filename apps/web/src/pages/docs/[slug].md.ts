// Superficie para agentes: cada página de docs en Markdown (web-ui-spec §5.5, §5.13).
import type { APIRoute } from 'astro';
import { docPage } from '../../lib/docs.js';

export const GET: APIRoute = ({ params, locals }) => {
  const page = docPage(locals.locale, String(params.slug), locals.t);
  if (!page) return new Response('Not found', { status: 404 });
  return new Response(`# ${page.title}\n\n${page.body}`, {
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
};
