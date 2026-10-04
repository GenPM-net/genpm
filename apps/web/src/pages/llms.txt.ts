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
    '## Quick start for AI agents (nothing installed yet)',
    '',
    'When a user asks to add a feature "with genpm" (e.g. "add GitHub login with genpm"), do this in their project root (a folder with package.json or .git; never the home directory):',
    '',
    '1. Install the CLI if `genpm` is missing: `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux; Windows: `irm https://genpm.net/install.ps1 | iex`). It installs to `~/.genpm/bin/genpm`; call that path until the shell is reloaded. Or, without installing: `npx -y genpm <command>`.',
    '2. Find the package: `genpm search "<what the user wants>" --json` (e.g. `genpm search "github login" --json`). Prefer verified packages (`vf: 1`, e.g. `@core/*`).',
    '3. Show the plan, then install: `genpm add <name> --dry-run`, then `genpm add <name> --yes`. Only add `--mcp` if the user agreed to MCP config, and `--install-deps` to run their package manager. In non-interactive shells a missing `--yes` stops with E_CONFIRM_REQUIRED (nothing is written).',
    '4. Read `<install dir>/AGENTS.md` and follow its "Integration" section; ask the user for the env vars it lists (never invent values).',
    '',
    'Common intents: login/sessions/OAuth → `@core/auth` (Hono, Next.js) or `@yohangel/auth-*` (Better Auth for Next.js, React, Express, NestJS); payments/subscriptions → `@core/billing`; database → `@core/db`; transactional email → `@core/email`; AI chat → `@core/ai`. Always confirm with `genpm search`, the registry is the source of truth.',
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
