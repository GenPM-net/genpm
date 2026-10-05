// Imagen Open Graph de cada paquete (D5-W-15): nombre, versión, resumen en inglés y capas que trae. Caché 1 día.
import type { APIRoute } from 'astro';
import { renderOg } from '../../../../lib/og.js';
import { type PackageResponse, registryGet } from '../../../../lib/registry.js';

export const GET: APIRoute = async ({ params }) => {
  const name = `${params.scope}/${params.name}`;
  if (!params.scope?.startsWith('@') || !params.name) return new Response(null, { status: 404 });
  const res = await registryGet<PackageResponse>(`/v1/packages/${name}`, 'en');
  const pkg = res.data;
  if (!pkg || pkg.status !== 'active' || !pkg.latest) return Response.redirect('https://genpm.net/og/home.png', 302);
  const m = pkg.latest;
  const chips: Array<'code' | 'context' | 'mcp'> = ['code', 'context', ...(m.mcp.length ? (['mcp'] as const) : [])];
  return renderOg(
    {
      eyebrow: `v${m.version} · ${m.license ?? ''}`.replace(/ · $/, ''),
      title: name,
      subtitle: pkg.summary ?? '',
      chips,
    },
    { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' },
  );
};
