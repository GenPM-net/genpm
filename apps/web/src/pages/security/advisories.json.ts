import type { APIRoute } from 'astro';
import { registryFetch } from '../../lib/registry.js';

export const GET: APIRoute = async () => {
  const res = await registryFetch('/v1/advisories/feed').catch(() => null);
  return new Response(res?.ok ? await res.text() : '{"advisories":[]}', {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
    },
  });
};
