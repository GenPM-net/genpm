# @core/blog — rules for AI agents

## Purpose
Blog domain built only from @core/content collections (`posts`, `authors`, `categories`, `tags`, `series`; no tables of
its own): filtered and paginated listings, a post with its relations resolved, related posts, monthly archive, series
order, RSS 2.0 / Atom / JSON Feed, sitemap and search sources and admin resources. No routes or templates (those
come from the app or @core/kit-blog), no comments or newsletter (separate modules).

## Map
- `index.ts` — public API: `listPosts`, `getPost`, `relatedPosts`, `archive`, `postsInMonth`, `rssFeed`, `atomFeed`, `jsonFeed`, `blogSitemapSource`, `blogSearchSource`, `blogAdminResources`.
- `collections.ts` — schemas (`PostSchema` uses `RichTextSchema`). `posts.ts` — reads. `feeds.ts` — feeds. `sources.ts` — sitemap/search/admin.

## Integration
1. Import this module at startup (it registers the collections) and set `SITE_URL`.
2. Routes (Next.js example): `/blog` → `listPosts({ page, locale })`; `/blog/[slug]` → `getPost(slug, { locale, draft })`
   (404 when null) + `relatedPosts(post)`; `/blog/category/[slug]` → `listPosts({ category })`; same for `tag`, `author`, `series`.
3. Feeds: `/blog/feed.xml` → `rssFeed({ title, description })` (`application/rss+xml`), `/blog/atom.xml`, `/blog/feed.json`.
4. Register `blogSitemapSource()` in `src/genpm/seo.ts` (it includes `/blog`; pass `{ index: false }` or another path
   if the blog index lives elsewhere), `blogSearchSource()` in `src/genpm/search.ts` and `...blogAdminResources()` in `src/genpm/admin.ts`.
5. Render the body with `<RichText doc={post.data.body} />` (@core/rich-text) and add `jsonLd.article(...)` (@core/seo).
6. Verify: publish a post, it appears in `/blog`, the feed and the sitemap; a scheduled post does not.

## Conventions
- Relations are slugs: create the author/category/tag entries with the same slug.
- `membersOnly` posts: the page must hide the body unless the user is entitled; feeds and search only expose the excerpt.
- Paths default to `/blog/<slug>`; pass your own `path`/`postPath` if the blog lives elsewhere.

## Don't
- Don't query `content_entries` directly for posts; use `listPosts` (it respects publication and locale fallback).
- Don't put the full body of members-only posts in feeds, search or meta descriptions.
