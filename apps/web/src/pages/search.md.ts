import type { APIRoute } from 'astro';
import { registryGet, type SearchResponse } from '../lib/registry.js';

export const GET: APIRoute = async ({ url }) => {
  const q = (url.searchParams.get('q') ?? '').slice(0, 100);
  const res = await registryGet<SearchResponse>(`/v1/search?${new URLSearchParams({ q, limit: '20' })}`);
  const rows = res.data?.results ?? [];
  const body = rows.length
    ? rows
        .map(
          (r) =>
            `- [${r.name}@${r.version}](https://genpm.net/p/${r.name}.md) — ${r.summary ?? ''}${r.keywords.length ? ` [${r.keywords.join(',')}]` : ''}${r.hasMcp ? ' mcp' : ''}${r.publisher.verified ? ' verified' : ''} ${r.installs30d}/30d`,
        )
        .join('\n')
    : `No packages for "${q}".`;
  return new Response(`# GenPM search: ${q}\n\n${body}\n`, {
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=60' },
  });
};
