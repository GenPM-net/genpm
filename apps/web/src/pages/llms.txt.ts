// /llms.txt (web-ui-spec §5.13): qué es GenPM, leyenda de claves, reglas para agentes y top paquetes con su .md.
import { AGENT_RULES, LEGEND } from '@genpm/manifest';
import type { APIRoute } from 'astro';
import { docPages } from '../lib/docs.js';
import { registryGet, type SearchResponse } from '../lib/registry.js';

export const GET: APIRoute = async () => {
  const top = await registryGet<SearchResponse>('/v1/search?sort=installs&limit=30');
  const lines = [
    '# GenPM',
    '',
    '> GenPM injects full source modules (code + AI rules + MCP config) into a project from immutable Git commits. Install the CLI with `curl -fsSL https://genpm.net/install.sh | sh` (Windows: `irm https://genpm.net/install.ps1 | iex`; or run it with `npx genpm`), then `genpm add <name>`. MCP server: `genpm mcp serve` (built into the binary; `npx -y @genpm/mcp` without it), set up with `genpm mcp setup`.',
    '',
    LEGEND,
    '',
    '## Rules for agents',
    AGENT_RULES,
    '',
    '## Docs',
    ...docPages('en').map((d) => `- [${d.title}](https://genpm.net/docs/${d.slug}.md)`),
    '',
    '## Packages',
    ...(top.data?.results ?? []).map(
      (p) => `- [${p.name}@${p.version}](https://genpm.net/p/${p.name}.md): ${p.summary ?? ''}`,
    ),
    '',
    '## Optional',
    '- [Search as Markdown](https://genpm.net/search.md?q=auth)',
    '- [Manifest JSON Schema](https://genpm.net/schema/v1/genpm.json)',
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  });
};
