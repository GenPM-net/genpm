# @core/contracts

[![genpm](https://api.genpm.net/v1/badge/@core/contracts.svg)](https://genpm.net/p/@core/contracts) ![license](https://img.shields.io/badge/license-MIT-blue)

> Shared types for GenPM modules: content, sitemap, search, admin resources, payments and tracked events

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/contracts`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/contracts
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/contracts`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/contracts with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Types and small zod schemas shared by GenPM catalog modules, so a module can consume "anything that provides content /
sitemap URLs / search documents / admin resources / payments" without importing the concrete module. No logic, no
tables, no runtime dependency besides `zod`.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/contracts/AGENTS.md` and can do them for you):

1. Usually installed as a dependency of another module; nothing to wire.
2. To expose your own data to the admin, sitemap or search, implement the type and register it in the project file
   the consuming module documents (`src/genpm/admin.ts`, `src/genpm/seo.ts`, `src/genpm/search.ts`):
   ```ts
   import { defineSitemapSource } from './lib/contracts/index.ts';
   export const projects = defineSitemapSource({ name: 'projects', async *urls() { yield { loc: '/projects' }; } });
   ```
3. Validate untrusted tracking payloads with `TrackedEventSchema.parse(body)` before forwarding them.

## What's inside

Paths are relative to `src/lib/contracts`.

- `index.ts` — public API. Import from here only.
- `content.ts` — `ContentSource`, `ContentEntry` (implemented by @core/content and CMS adapters).
- `sitemap.ts` — `SitemapSource` (consumed by @core/seo).
- `search.ts` — `SearchSource`, `SearchDocument` (consumed by @core/search).
- `admin.ts` — `AdminResource`, `AdminField` (consumed by @core/admin).
- `payment.ts` — `PaymentProvider` (implemented by @core/checkout, used by @core/orders).
- `events.ts` — `CommerceEvent`, `LeadEvent` and their zod schemas (consumed by @core/pixels).
- `money.ts` — `Money` (integer minor units + ISO 4217 code).

## At a glance

- **npm dependencies** (proposed, never installed without asking): `zod`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/contracts`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
