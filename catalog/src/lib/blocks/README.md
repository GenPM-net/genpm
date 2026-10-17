# @core/blocks

[![genpm](https://api.genpm.net/v1/badge/@core/blocks.svg)](https://genpm.net/p/@core/blocks) ![license](https://img.shields.io/badge/license-MIT-blue)

> Page builder blocks: 15 accessible sections (hero, pricing, FAQ with JSON-LD…), admin editor and registry for more

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/blocks`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/blocks
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/blocks`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/blocks with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Page sections that editors combine from the admin: hero, features, benefits, testimonials, logos, pricing, FAQ (with
FAQPage JSON-LD), call to action, gallery, video, stats, comparison, guarantee, rich text and form. Each block is a
zod schema + editor fields + a React component. Other packages and kits add their own blocks (product grid, latest
posts…) to the same registry. Blocks are stored as JSON inside @core/content entries; no tables of its own.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/blocks/AGENTS.md` and can do them for you):

1. Create `src/genpm/blocks.ts`: `export const blocks = createBlockRegistry([...coreBlocks /*, kit blocks */]);`
2. Add a field to a content collection: schema `blocks: blocks.schema`, admin field `blocks.field('blocks', 'Sections')`.
3. Admin: compute `blockMeta(blocks)` on the server and pass it to the client component that renders
   `<AdminApp renderers={{ blocks: blocksRenderer(meta), /* richText, media… */ }} />` (never import the registry in client code).
4. Page (server component):
   ```tsx
   const media = await loadBlockMedia(page.data.blocks, blocks);
   return <RenderBlocks blocks={page.data.blocks} registry={blocks} media={media}
     renderForm={(key) => <Form formKey={key} />} embeds={hasConsent('marketing') ? 'iframe' : 'link'} />;
   ```
5. Styles: import `src/lib/ui/ui.css` then `src/lib/blocks/blocks.css` in the root layout.
6. Verify: a page with every block passes axe and has one `h1`; a block with an unknown type renders nothing and warns in dev.

## What's inside

Paths are relative to `src/lib/blocks`.

- `index.ts` — `defineBlock`, `createBlockRegistry`, `coreBlocks` (and each block), `RenderBlocks`, `collectMediaIds`.
- `core/*.ts` — one file per block. `parts.ts` — `Section`, `Heading`, `Img`, `CtaLink`, `JsonLd` for new blocks.
- `media.ts` — `loadBlockMedia(blocks, registry)` (server: one query to @core/media).
- `editor.ts` — `'use client'`: `blocksRenderer(blockMeta(registry))` for `AdminApp`. `blocks.css` — styles on @core/ui tokens.

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db), [@core/contracts](https://genpm.net/p/@core/contracts), [@core/rich-text](https://genpm.net/p/@core/rich-text), [@core/media](https://genpm.net/p/@core/media), [@core/ui](https://genpm.net/p/@core/ui), [@core/admin](https://genpm.net/p/@core/admin)
- **npm dependencies** (proposed, never installed without asking): `react`, `zod`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/blocks`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
