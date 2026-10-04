// Publica desde la web: mismo POST /v1/publish que `genpm publish`, con la sesión del usuario.
import type { APIRoute } from 'astro';
import { relay } from '../../lib/relay.js';

export const POST: APIRoute = async (ctx) => {
  const b = (await ctx.request.json().catch(() => null)) as Record<string, unknown> | null;
  const str = (k: string) => (typeof b?.[k] === 'string' ? (b[k] as string).slice(0, 300) : '');
  return relay(ctx, '/v1/publish', {
    method: 'POST',
    body: { name: str('name'), version: str('version'), repo: str('repo'), ref: str('ref') },
  });
};
