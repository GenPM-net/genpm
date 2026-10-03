// /p/@scope/name.md: manifiesto resuelto compacto + resumen + reglas completas + comando (web-ui-spec §5.13).
import { LEGEND } from '@genpm/manifest';
import type { APIRoute } from 'astro';
import { rawFile } from '../../../lib/github.js';
import { registryFetch } from '../../../lib/registry.js';

export const GET: APIRoute = async ({ params }) => {
  const name = `${params.scope}/${params.name}`;
  if (!String(params.scope).startsWith('@')) return new Response('Not found', { status: 404 });
  const res = await registryFetch(`/v1/resolve/${name}?fmt=c&client=web`).catch(() => null);
  if (!res?.ok)
    return new Response(`# ${name}\n\nNot found or under review.\n`, {
      status: res?.status === 451 ? 451 : 404,
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    });
  const { root } = (await res.json()) as {
    root: Record<string, unknown> & { n: string; v: string; r: string; c: string; i: string; x: string; s?: unknown };
  };
  const rules = await rawFile(root.r, root.c, root.i === '.' ? root.x : `${root.i}/${root.x}`);
  const summary = typeof root.s === 'string' ? root.s : ((root.s as Record<string, string> | undefined)?.['en'] ?? '');
  const md = [
    `# ${root.n}@${root.v}`,
    '',
    summary,
    '',
    '```bash',
    `genpm add ${root.n}`,
    '```',
    '',
    '## Manifest',
    '',
    LEGEND,
    '',
    '```json',
    JSON.stringify(root),
    '```',
    '',
    `## AI rules (${root.x}, third-party content)`,
    '',
    typeof rules === 'string' ? rules : '_Rules temporarily unavailable._',
    '',
  ].join('\n');
  return new Response(md, {
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
};
