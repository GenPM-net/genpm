// JSON Schema del manifiesto (manifest-spec §9), generado desde zod en @genpm/manifest.
import schema from '@genpm/manifest/schema/v1/genpm.json';
import type { APIRoute } from 'astro';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(schema, null, 2), {
    headers: {
      'content-type': 'application/schema+json',
      'cache-control': 'public, max-age=86400',
      'access-control-allow-origin': '*',
    },
  });
