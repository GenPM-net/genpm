# @core/kit-cms

[![genpm](https://api.genpm.net/v1/badge/@core/kit-cms.svg)](https://genpm.net/p/@core/kit-cms) ![license](https://img.shields.io/badge/license-MIT-blue)

> Self-managed website kit for Next.js: /admin to edit pages with blocks, media, menus, settings, forms and users

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/app/(cms)`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/kit-cms
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/kit-cms`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/kit-cms with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Turns a Next.js (App Router) site into a self-managed one: `/admin` where non-technical people edit pages built with
blocks, images, menus, site settings, forms, redirects and users, with drafts, signed previews, scheduled publishing
and roles. Glue only: all logic lives in @core/admin, content, media, rich-text, blocks, site, seo, forms, search,
auth and rbac (the last two arrive through @core/admin). Public routes: pages created in the admin (`/[...slug]`), `/search`, `/sitemap.xml`, `/robots.txt`,
`/llms.txt`. Base for kit-blog, kit-landing and kit-store.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/app/(cms)/AGENTS.md` and can do them for you):

1. Check Next ≥ 15.5 with App Router, `src/app` and the `@/*` → `src/*` alias. Without `src/`: install with `--dest app/(cms)` and adapt `@/` imports.
   GenPM packages import each other with `.ts` extensions: `tsconfig.json` needs `"allowImportingTsExtensions": true`
   (Next projects already have `"noEmit": true`). Works with webpack and Turbopack. In `next.config` set
   `htmlLimitedBots: /.*/`: metadata comes from the database, and without it Next 15 streams `<title>`, description and
   canonical into `<body>` for every client except a few bots (Lighthouse, link previews and some crawlers miss them).
   Next 16: `create-next-app` turns on `cacheComponents`, which this kit does not support yet (pages read the database
   per request and routes use `export const dynamic`): set `cacheComponents: false` and remove `partialPrefetching`.
2. Env: `genpm add` already wrote a `genpm:env` block with bare variable names to `.env.example`; replace that block
   with `_templates/env.example` (every variable, optional ones and defaults; Next's default `.gitignore`
   has `.env*`, so add a line `!.env.example`) and the real values to `.env.local`. Required: `DATABASE_URL`, `AUTH_SECRET`, one OAuth provider
   (`GITHUB_CLIENT_ID/SECRET` or `GOOGLE_…`), `STORAGE_*`, `EMAIL_FROM` + `RESEND_API_KEY`, `SITE_URL`,
   `CONTENT_PREVIEW_SECRET` (≥ 32 chars), `ANTISPAM_SECRET`, `CRON_SECRET`. With `STORAGE_DRIVER=local` also mount the
   storage route (`src/lib/storage/AGENTS.md`, Integration 1).
3. Mount the @core/auth routes (`app/auth/login/[provider]`, `app/auth/callback/[provider]`, `app/auth/logout`) as its AGENTS.md says.
4. Copy `_templates/genpm/*.ts` to `src/genpm/` (skip files that exist and merge by hand). These files belong to the project:
   later kits add lines to them. Copy `_templates/middleware.ts` to `src/middleware.ts` (or merge into the existing one);
   on Next 16 copy it to `src/proxy.ts`, rename the function to `proxy` and remove `runtime` from `config`.
5. Migrations: GenPM does not install dev tools — run `src/lib/db/AGENTS.md` steps 3–5 (`drizzle-kit` + `tsx`, the
   `db:generate` / `db:migrate` scripts), generate one migration for all packages and apply it where a database exists.
6. Schedule `GET /api/cron` every minute with `Authorization: Bearer $CRON_SECRET` (e.g. `vercel.json` crons). Once the
   database is migrated, the person runs `npx tsx "src/app/(cms)/_scripts/setup-schedules.ts"` (idempotent; it schedules
   the daily jobs of every installed kit, so run it again after adding another kit).
7. The person signs in once at `/admin/login` (it needs a real OAuth app: create one with the callback
   `<SITE_URL>/auth/callback/github` — there is no password or dev login), then runs `npx tsx "src/app/(cms)/_scripts/create-owner.ts" <their email>`.
   Never run it for them with an email they did not give you.
8. New site: create `src/app/page.tsx` with `export { default, generateMetadata } from './(cms)/_lib/home';` and create
   the `home` page in the admin (blocks: hero, features, cta…). Existing site: follow "Retrofit" below.
9. Root layout: new site → copy `_templates/layout.tsx` to `src/app/layout.tsx` (`<html lang>` comes from
   `CONTENT_DEFAULT_LOCALE`; translate built-in form and UI texts with their `labels` props). Existing layout → import `@/lib/ui/ui.css`
   and `@/lib/blocks/blocks.css`, render menus with `getMenu('header')` / `getMenu('footer')` and the site name with
   `getSiteSettings()` (@core/site), and add `export const dynamic = 'force-dynamic'` (it reads the database; without it
   `next build` tries to prerender and fails without `DATABASE_URL`).
10. Verify: `npx tsc --noEmit` and `npx next build` pass without a database. Then, with one: sign in at `/admin`, edit a
    page, open "Preview", publish, and see the change on the public URL.
11. Delete every `src/lib/*/adapters/hono.ts` (`rm src/lib/*/adapters/hono.ts`): they import `hono`, which a Next
    project does not install, and `tsc` checks every file. Keep `adapters/next.ts`. `genpm list` then shows those
    packages with "1 file changed": that is this deletion, expected.

## What's inside

Paths are relative to `src/app/(cms)`.

- `admin/[[...path]]/page.tsx` — panel (server checks session + `admin:access`). `admin/login/page.tsx` — OAuth sign-in.
- `api/admin/[...path]` — admin API. `api/media/uploads…` — uploads. `api/preview`, `api/exit-preview` — draft mode.
  `api/forms/[key]` — form posts. `api/cron` — @core/jobs. `api/search` — JSON search.
- `[...slug]/page.tsx` — pages of the `pages` collection (redirects before the 404). `search/page.tsx` — results.
- `_lib/page.tsx` — `CmsPage`, `pageMetadata`. `_lib/home.tsx` — home page from the `home` entry. `_lib/session.ts`.
- `_components/` — admin client app, the `media` / `richText` field editors and `SiteChrome` (hides the site header and
  footer on `/admin`).
- `_templates/genpm/*.ts` — the project's registration files. `_templates/middleware.ts` — redirects middleware.
  `_templates/layout.tsx` — root layout for a new site. `_templates/env.example` — every variable the kit and its packages read.
- `_lib/maintenance.ts` — daily `cms.maintenance` job (prunes rate limits and old jobs), loaded by `api/cron`.
- `_scripts/create-owner.ts` — gives the first signed-in user the `owner` role (and creates the default roles).
- `_scripts/setup-schedules.ts` — schedules the daily jobs of the installed kits (`cms.maintenance`, `search.reindex`,
  `store.maintenance`, `experiments.prune`) and queues the first reindex.

## At a glance

- **GenPM dependencies** (installed with it): [@core/admin](https://genpm.net/p/@core/admin), [@core/content](https://genpm.net/p/@core/content), [@core/media](https://genpm.net/p/@core/media), [@core/rich-text](https://genpm.net/p/@core/rich-text), [@core/blocks](https://genpm.net/p/@core/blocks), [@core/site](https://genpm.net/p/@core/site), [@core/seo](https://genpm.net/p/@core/seo), [@core/forms](https://genpm.net/p/@core/forms), [@core/search](https://genpm.net/p/@core/search)
- **npm dependencies** (proposed, never installed without asking): `next`, `react`, `zod`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/app/(cms)`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
