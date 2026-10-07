# @core/kit-cms — rules for AI agents

## Purpose
Turns a Next.js (App Router) site into a self-managed one: `/admin` where non-technical people edit pages built with
blocks, images, menus, site settings, forms, redirects and users, with drafts, signed previews, scheduled publishing
and roles. Glue only: all logic lives in @core/admin, content, media, rich-text, blocks, site, seo, forms, search,
auth and rbac (the last two arrive through @core/admin). Public routes: pages created in the admin (`/[...slug]`), `/search`, `/sitemap.xml`, `/robots.txt`,
`/llms.txt`. Base for kit-blog, kit-landing and kit-store.

## Map
- `admin/[[...path]]/page.tsx` — panel (server checks session + `admin:access`). `admin/login/page.tsx` — OAuth sign-in.
- `api/admin/[...path]` — admin API. `api/media/uploads…` — uploads. `api/preview`, `api/exit-preview` — draft mode.
  `api/forms/[key]` — form posts. `api/cron` — @core/jobs. `api/search` — JSON search.
- `[...slug]/page.tsx` — pages of the `pages` collection (redirects before the 404). `search/page.tsx` — results.
- `_lib/page.tsx` — `CmsPage`, `pageMetadata`. `_lib/home.tsx` — home page from the `home` entry. `_lib/session.ts`.
- `_components/` — admin client app and the `media` / `richText` field editors.
- `_templates/genpm/*.ts` — the project's registration files. `_templates/middleware.ts` — redirects middleware.
  `_templates/layout.tsx` — root layout for a new site. `_templates/env.example` — every variable the kit and its packages read.
- `_lib/maintenance.ts` — daily `cms.maintenance` job (prunes rate limits and old jobs), loaded by `api/cron`.
- `_scripts/create-owner.ts` — gives the first signed-in user the `owner` role (and creates the default roles).
- `_scripts/setup-schedules.ts` — schedules the daily jobs of the installed kits (`cms.maintenance`, `search.reindex`,
  `store.maintenance`, `experiments.prune`) and queues the first reindex.

## Integration
1. Check Next ≥ 15.5 with App Router, `src/app` and the `@/*` → `src/*` alias. Without `src/`: install with `--dest app/(cms)` and adapt `@/` imports.
   GenPM packages import each other with `.ts` extensions: `tsconfig.json` needs `"allowImportingTsExtensions": true`
   (Next projects already have `"noEmit": true`). Works with webpack and Turbopack, no extra `next.config`.
2. Env: copy `_templates/env.example` to the project's `.env.example` (merge if it exists; Next's default `.gitignore`
   has `.env*`, so add a line `!.env.example`) and the real values to `.env.local`. Required: `DATABASE_URL`, `AUTH_SECRET`, one OAuth provider
   (`GITHUB_CLIENT_ID/SECRET` or `GOOGLE_…`), `STORAGE_*`, `EMAIL_FROM` + `RESEND_API_KEY`, `SITE_URL`,
   `CONTENT_PREVIEW_SECRET` (≥ 32 chars), `ANTISPAM_SECRET`, `CRON_SECRET`. With `STORAGE_DRIVER=local` also mount the
   storage route (`src/lib/storage/AGENTS.md`, Integration 1).
3. Mount the @core/auth routes (`app/auth/login/[provider]`, `app/auth/callback/[provider]`, `app/auth/logout`) as its AGENTS.md says.
4. Copy `_templates/genpm/*.ts` to `src/genpm/` (skip files that exist and merge by hand). These files belong to the project:
   later kits add lines to them. Copy `_templates/middleware.ts` to `src/middleware.ts` (or merge into the existing one).
5. Migrations: GenPM does not install dev tools — run `src/lib/db/AGENTS.md` steps 3–5 (`drizzle-kit` + `tsx`, the
   `db:generate` / `db:migrate` scripts), generate one migration for all packages and apply it where a database exists.
6. Schedule `GET /api/cron` every minute with `Authorization: Bearer $CRON_SECRET` (e.g. `vercel.json` crons). Once the
   database is migrated, the person runs `npx tsx "src/app/(cms)/_scripts/setup-schedules.ts"` (idempotent; it schedules
   the daily jobs of every installed kit, so run it again after adding another kit).
7. The person signs in once at `/admin/login`, then runs `npx tsx "src/app/(cms)/_scripts/create-owner.ts" <their email>`.
   Never run it for them with an email they did not give you.
8. New site: create `src/app/page.tsx` with `export { default, generateMetadata } from './(cms)/_lib/home';` and create
   the `home` page in the admin (blocks: hero, features, cta…). Existing site: follow "Retrofit" below.
9. Root layout: new site → copy `_templates/layout.tsx` to `src/app/layout.tsx`. Existing layout → import `@/lib/ui/ui.css`
   and `@/lib/blocks/blocks.css`, render menus with `getMenu('header')` / `getMenu('footer')` and the site name with
   `getSiteSettings()` (@core/site), and add `export const dynamic = 'force-dynamic'` (it reads the database; without it
   `next build` tries to prerender and fails without `DATABASE_URL`).
10. Verify: `npx tsc --noEmit` and `npx next build` pass without a database. Then, with one: sign in at `/admin`, edit a
    page, open "Preview", publish, and see the change on the public URL.
11. Delete every `src/lib/*/adapters/hono.ts` (`rm src/lib/*/adapters/hono.ts`): they import `hono`, which a Next
    project does not install, and `tsc` checks every file. Keep `adapters/next.ts`.

## Retrofit (make an existing site editable)
Follow the @core/content procedure page by page, one commit per page: inventory visible literals → a singleton per
page (or a collection when repeated) defined in `src/genpm/content.ts` → seed with the current values (`seedEntry`) →
replace literals with typed reads → compare the rendered HTML before/after (must be identical). Keep markup and design;
only the data source changes. Local images go to @core/media with their alt text. Existing routes keep priority over
`[...slug]`. Non-Next sites (static HTML, Astro, Vite): out of scope for 1.0 — say so.

## Conventions
- Page sections are blocks registered in `src/genpm/blocks.ts`; add new blocks there, never per-page components.
- Admin resources are registered in `src/genpm/admin.ts`; never write a custom admin page for a resource.
- The `pages` entry with slug `home` is `/`; other slugs map to `/<slug>`.
- Default roles: `editor` publishes pages but cannot see users or settings beyond content; `author` edits only own entries.

## Don't
- Don't invent legal texts (privacy, terms, imprint): create the pages empty with a "pending review" note for the owner.
- Don't expose `/admin` or `/api` in the sitemap, and don't remove `robots: noindex` from admin pages.
- Don't bypass `CRON_SECRET` or call `runDue()` from a public route.
- Don't grant roles or create owners from code paths reachable by visitors.
