# @core/content

[![genpm](https://api.genpm.net/v1/badge/@core/content.svg)](https://genpm.net/p/@core/content) ![license](https://img.shields.io/badge/license-MIT-blue)

> Headless CMS core: typed collections and singletons with drafts, revisions, scheduling, locales and preview

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/content`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/content
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/content`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/content with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Content model of the CMS: collections (pages, posts, FAQs) and singletons (home, footer, settings) defined with zod,
stored in Postgres with drafts separate from published data, revisions, scheduled publishing (@core/jobs), locales
with fallback and signed preview. Implements `ContentSource`, sitemap/search sources and `AdminResource`
(@core/contracts). No UI: @core/admin renders the editor from `contentAdminResource()`.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/content/AGENTS.md` and can do them for you):

1. Env: `CONTENT_PREVIEW_SECRET` (≥ 32 chars), optional `CONTENT_DEFAULT_LOCALE` (default `en`). Migrations as in `src/lib/db/AGENTS.md`.
2. Define the site's content in one project file imported everywhere, `src/genpm/content.ts`:
   `export const pages = defineCollection('pages', { schema: z.object({ title: z.string(), body: z.string() }) })`.
3. Read in pages: `const page = await reader(pages).get(slug, { locale, draft: isDraftMode })` (404 if null).
4. Preview: `app/api/preview/route.ts` with `export const GET = previewRoute(draftMode, cookies)` (both from
   `next/headers`) and `app/api/exit-preview/route.ts` with `export const GET = exitPreviewRoute(draftMode)`.
   Passing `cookies` makes Next's draft-mode cookie expire with the token (admin links: 600 s); without it, draft mode
   lasts the whole browser session.
5. Scheduled publishing needs the @core/jobs cron endpoint running.
6. Register `contentAdminResource('pages')` in `src/genpm/admin.ts`, and the sources in `src/genpm/seo.ts` / `search.ts`.
7. Verify: create, publish, and read an entry; drafts must not appear without draft mode.

### Retrofit: make an existing site editable
Work page by page, one commit per page, without changing markup or styles:
1. List every visible literal (texts, image URLs, links) of the page.
2. Group them: one singleton per page (`home`, `about`). Repeated items of one page (features, prices, FAQs) are a
   `list` field inside that singleton (ordered, one edit screen); use a collection only when the items have their own
   pages or are shared by several pages.
3. Define the schema with the current values' shape and call `seedEntry` with the current values (idempotent; it
   only creates, so it never overwrites editor changes — and a field added later to the seed does not reach an
   already-seeded database: set it in the admin or with `saveDraft` + `publish`) from a seed script, e.g.
   `src/genpm/seed.ts` (`import './content'; await seedEntry({ collection: 'home', data: {…} }); …`) run with
   `npx tsx --env-file=.env.local src/genpm/seed.ts` and kept as an npm script (`cms:seed`).
4. Replace literals with typed reads; keep a fallback only where a value is optional.
5. Render before/after and compare the HTML: it must be identical. Next 15 streams metadata into `<body>` for browsers
   once `generateMetadata` awaits data; `htmlLimitedBots: /.*/` in `next.config` (kit-cms Integration 1) keeps it in `<head>`.
6. Grant editors the new singletons: `defineRole` with `<singleton>:*` (e.g. `home:*`, `site_settings:*`) — the
   default `editor` role only covers the kit's collections.
7. Make the pages findable again: register each singleton's URL in `src/genpm/seo.ts` (a `defineSitemapSource` that
   yields the page paths) and in `src/genpm/search.ts` (`contentSearchSource('<singleton>', { path: () => '/<page>' })`,
   one per singleton, each with its own `type`); otherwise `/sitemap.xml` and `/search` miss them.

## What's inside

Paths are relative to `src/lib/content`.

- `index.ts` — public API. `registry.ts` — `defineCollection`, `defineSingleton`. `entries.ts` — create, `saveDraft`,
  `publish`, `schedulePublish`, `unpublish`, `archive`, revisions, `seedEntry`, `migrateEntries`.
- `read.ts` — `getEntry`, `listEntries`, `getSingleton`, `reader(collection)` (typed). `preview.ts` — preview tokens.
  `listEntries`/`countEntries` also take nested `where` keys (`{ 'series.slug': 'basics' }`) and a `publishedAt` range
  (`publishedFrom` inclusive, `publishedBefore` exclusive): filter in SQL instead of fetching and filtering in memory.
- `sources.ts` — `contentSitemapSource`, `contentSearchSource`. `admin.ts` — `contentAdminResource`.
- `adapters/next.ts` — `previewRoute(draftMode, cookies)`, `exitPreviewRoute(draftMode)`.

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db), [@core/jobs](https://genpm.net/p/@core/jobs), [@core/contracts](https://genpm.net/p/@core/contracts)
- **npm dependencies** (proposed, never installed without asking): `zod`
- **Environment variables** (added to `.env.example`): `CONTENT_PREVIEW_SECRET`, `CONTENT_DEFAULT_LOCALE`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/content`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
