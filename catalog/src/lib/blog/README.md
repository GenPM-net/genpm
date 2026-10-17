# @core/blog

[![genpm](https://api.genpm.net/v1/badge/@core/blog.svg)](https://genpm.net/p/@core/blog) ![license](https://img.shields.io/badge/license-MIT-blue)

> Blog domain on @core/content: posts, authors, categories, tags, series, related posts, archive and RSS/Atom/JSON feeds

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/blog`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/blog
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/blog`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/blog with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Blog domain built only from @core/content collections (`posts`, `authors`, `categories`, `tags`, `series`; no tables of
its own): filtered and paginated listings, a post with its relations resolved, related posts, monthly archive, series
order, RSS 2.0 / Atom / JSON Feed, sitemap and search sources and admin resources. No routes or templates (those
come from the app or @core/kit-blog), no comments or newsletter (separate modules).

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/blog/AGENTS.md` and can do them for you):

1. Import this module at startup (it registers the collections) and set `SITE_URL`.
2. Routes (Next.js example): `/blog` → `listPosts({ page, locale })`; `/blog/[slug]` → `getPost(slug, { locale, draft })`
   (404 when null) + `relatedPosts(post)`; `/blog/category/[slug]` → `listPosts({ category })`; same for `tag`, `author`, `series`.
3. Feeds: `/blog/feed.xml` → `rssFeed({ title, description })` (`application/rss+xml`), `/blog/atom.xml`, `/blog/feed.json`.
4. Register `blogSitemapSource()` in `src/genpm/seo.ts` (it includes `/blog`; pass `{ index: false }` or another path
   if the blog index lives elsewhere), `blogSearchSource()` in `src/genpm/search.ts` and `...blogAdminResources()` in `src/genpm/admin.ts`.
5. Render the body with `<RichText doc={post.data.body} />` (@core/rich-text) and add `jsonLd.article(...)` (@core/seo).
6. Verify: publish a post, it appears in `/blog`, the feed and the sitemap; a scheduled post does not.

## What's inside

Paths are relative to `src/lib/blog`.

- `index.ts` — public API: `listPosts`, `getPost`, `relatedPosts`, `archive`, `postsInMonth`, `rssFeed`, `atomFeed`, `jsonFeed`, `blogSitemapSource`, `blogSearchSource`, `blogAdminResources`.
- `collections.ts` — schemas (`PostSchema` uses `RichTextSchema`). `posts.ts` — reads. `feeds.ts` — feeds. `sources.ts` — sitemap/search/admin.

## At a glance

- **GenPM dependencies** (installed with it): [@core/content](https://genpm.net/p/@core/content), [@core/rich-text](https://genpm.net/p/@core/rich-text), [@core/contracts](https://genpm.net/p/@core/contracts), [@core/db](https://genpm.net/p/@core/db)
- **npm dependencies** (proposed, never installed without asking): `zod`
- **Environment variables** (added to `.env.example`): `SITE_URL`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/blog`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
