// Diagnóstico de un repo: qué tiene, qué le falta y genpm.json sugerido (asistente de publicación).
import type { APIRoute } from 'astro';
import { relay } from '../../lib/relay.js';

const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export const GET: APIRoute = (ctx) => {
  const owner = ctx.url.searchParams.get('owner') ?? '';
  const repo = ctx.url.searchParams.get('repo') ?? '';
  if (!NAME.test(owner) || !NAME.test(repo)) return new Response(null, { status: 400 });
  return relay(ctx, `/v1/me/repos/${owner}/${repo}`);
};
