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
- `sources.ts` — `contentSitemapSource`, `contentSearchSource`. `admin.ts` — `contentAdminResource`.
- `adapters/next.ts` — `previewRoute(draftMode)`, `exitPreviewRoute(draftMode)`.

## Integration
1. Env: `CONTENT_PREVIEW_SECRET` (≥ 32 chars), optional `CONTENT_DEFAULT_LOCALE` (default `en`). Migrations as in `src/lib/db/AGENTS.md`.
2. Define the site's content in one project file imported everywhere, `src/genpm/content.ts`:
   `export const pages = defineCollection('pages', { schema: z.object({ title: z.string(), body: z.string() }) })`.
3. Read in pages: `const page = await reader(pages).get(slug, { locale, draft: isDraftMode })` (404 if null).
4. Scheduled publishing needs the @core/jobs cron endpoint running.
5. Register `contentAdminResource('pages')` in `src/genpm/admin.ts`, and the sources in `src/genpm/seo.ts` / `search.ts`.
6. Verify: create, publish, and read an entry; drafts must not appear without draft mode.

### Retrofit: make an existing site editable
Work page by page, one commit per page, without changing markup or styles:
1. List every visible literal (texts, image URLs, links) of the page.
2. Group them: one singleton per page (`home`, `about`); a collection for repeated items (testimonials, FAQs).
3. Define the schema with the current values' shape and call `seedEntry` with the current values (idempotent; it
   never overwrites editor changes), e.g. from a seed script.
4. Replace literals with typed reads; keep a fallback only where a value is optional.
5. Render before/after and compare the HTML: it must be identical.

## Conventions
- Field names in admin resources are `data.<field>`; slugs are lowercase `a-z0-9-` with up to 6 `/` segments.
- Changing a schema incompatibly requires `migrateEntries`; never edit jsonb by hand.
- Permissions: `<collection>:read|create|update|delete|publish`, `:own` for authors (owner = `authorId`).
- Public reads never pass `draft: true` unless draft mode came from a verified preview token.

## Don't
- Don't write to `content_entries` directly; publishing must go through `publish()` (validation + revision).
- Don't put secrets or personal data in content; it is public once published.
- Don't redirect previews to absolute URLs; `safePath` rejects them.
