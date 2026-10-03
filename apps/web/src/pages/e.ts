// Analítica sin cookies (web-ui-spec §8): eventos propios a Analytics Engine. Sin IP ni identificadores.

import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';

const EVENTS = new Set([
  'copy_install',
  'search',
  'tab_view',
  'sponsored_impression',
  'sponsored_click',
  'mcp_setup_copy',
  'install_cli_copy',
  'publish_cta',
]);

export const POST: APIRoute = async ({ request, locals }) => {
  const body = (await request.json().catch(() => null)) as Record<string, string> | null;
  if (body && EVENTS.has(body['event'] ?? '') && env.EVENTS) {
    env.EVENTS.writeDataPoint({
      blobs: [
        body['event']!,
        String(body['pkg'] ?? body['tab'] ?? '').slice(0, 120),
        locals.locale,
        String(body['path'] ?? '').slice(0, 200),
      ],
      indexes: [body['event']!],
    });
  }
  return new Response(null, { status: 204 });
};
