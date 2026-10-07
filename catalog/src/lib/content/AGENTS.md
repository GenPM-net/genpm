# @core/content — rules for AI agents

## Purpose
Content model of the CMS: collections (pages, posts, FAQs) and singletons (home, footer, settings) defined with zod,
stored in Postgres with drafts separate from published data, revisions, scheduled publishing (@core/jobs), locales
with fallback and signed preview. Implements `ContentSource`, sitemap/search sources and `AdminResource`
(@core/contracts). No UI: @core/admin renders the editor from `contentAdminResource()`.

## Map
- `index.ts` — public API. `registry.ts` — `defineCollection`, `defineSingleton`. `entries.ts` — create, `saveDraft`,
  `publish`, `schedulePublish`, `unpublish`, `archive`, revisions, `seedEntry`, `migrateEntries`.
- `read.ts` — `getEntry`, `listEntries`, `getSingleton`, `reader(collection)` (typed). `preview.ts` — preview tokens.
  `listEntries`/`countEntries` also take nested `where` keys (`{ 'series.slug': 'basics' }`) and a `publishedAt` range
  (`publishedFrom` inclusive, `publishedBefore` exclusive): filter in SQL instead of fetching and filtering in memory.
- `sources.ts` — `contentSitemapSource`, `contentSearchSource`. `admin.ts` — `contentAdminResource`.
- `adapters/next.ts` — `previewRoute(draftMode, cookies)`, `exitPreviewRoute(draftMode)`.

## Integration
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
   already-seeded database: set it in the admin or with `saveDraft` + `publish`), e.g. from a seed script.
4. Replace literals with typed reads; keep a fallback only where a value is optional.
5. Render before/after and compare the HTML: it must be identical. Next 15 streams metadata into `<body>` for browsers
   once `generateMetadata` awaits data; set `htmlLimitedBots: /.*/` in `next.config` to keep it in `<head>` (as before).
6. Grant editors the new singletons: `defineRole` with `<singleton>:*` (e.g. `home:*`, `site_settings:*`) — the
   default `editor` role only covers the kit's collections.

## Conventions
- Field names in admin resources are `data.<field>`; slugs are lowercase `a-z0-9-` with up to 6 `/` segments.
- Changing a schema incompatibly requires `migrateEntries`; never edit jsonb by hand.
- Permissions: `<collection>:read|create|update|delete|publish`, `:own` for authors (owner = `authorId`).
- Public reads never pass `draft: true` unless draft mode came from a verified preview token.
- A preview link is not bound to its entry: Next's draft mode is browser-wide, so while it lasts (until the token
  expires, when `cookies` is passed) that browser sees the drafts of every entry of every collection. Only share
  preview links with people who may see unpublished content; `/api/exit-preview` ends it early.
- Admin `update` renames and saves the draft in one transaction: invalid data never leaves the entry renamed.

## Don't
- Don't write to `content_entries` directly; publishing must go through `publish()` (validation + revision).
- Don't put secrets or personal data in content; it is public once published.
- Don't redirect previews to absolute URLs; `safePath` rejects them.
