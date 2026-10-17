# @core/kit-blog

[![genpm](https://api.genpm.net/v1/badge/@core/kit-blog.svg)](https://genpm.net/p/@core/kit-blog) ![license](https://img.shields.io/badge/license-MIT-blue)

> Blog kit for Next.js: posts with authors, categories, tags, series, feeds, moderated comments and newsletter

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/app/(blog)`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/kit-blog
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/kit-blog`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/kit-blog with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

A complete blog on top of @core/kit-cms, edited in the same `/admin`: posts with rich text and cover images, author
profiles, categories, tags and series, scheduling, RSS/Atom/JSON feeds, site search, moderated comments, newsletter
with double opt-in and one-click unsubscribe, share links without third-party scripts and full SEO (BlogPosting
JSON-LD, sitemap, Open Graph). Glue and templates only: logic lives in @core/blog, comments and newsletter.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/app/(blog)/AGENTS.md` and can do them for you):

1. @core/kit-cms must be integrated first (follow its AGENTS.md if it was installed with this kit).
2. Env: `NEWSLETTER_FROM`, `NEWSLETTER_POSTAL_ADDRESS`, `NEWSLETTER_SECRET` (≥ 32 chars) and, in production,
   `RESEND_API_KEY` (see src/lib/newsletter/AGENTS.md). Explain to the person how to verify their sending domain
   (SPF, DKIM, DMARC) with their email provider; do not change their DNS yourself.
3. Migrations for @core/comments and @core/newsletter (src/lib/db/AGENTS.md).
4. Add the lines of `_templates/genpm.md` to the project's `src/genpm/*.ts` (it says which file and where): the blog
   collections, sitemap and search sources, the `latestPosts` block, and the admin resources (posts with "Create
   newsletter campaign", taxonomies, comments, newsletter) plus the pending-comments widget.
5. Add "Blog" to the header menu in Admin → Menus, and link the feeds from the site footer if wanted.
6. Verify: create an author and a post, schedule it, check it is absent from `/blog`, the feed and the sitemap until
   its time; comment as a guest (goes to moderation) and approve it; subscribe, confirm from the email and unsubscribe.
   Without an OAuth app nobody can sign in to the admin: an agent can create the author and posts with `seedEntry` /
   `createEntry` + `publish` (@core/content) from a script. Without `RESEND_API_KEY`, emails are printed to the console
   only under `next dev` (`next start` is production and refuses to send without a provider).

## What's inside

Paths are relative to `src/app/(blog)`.

- `_templates/genpm.md` — the exact lines this kit adds to the project's `src/genpm/*.ts` (generated, always current).
- `blog/page.tsx` — index (featured first, `?page=`). `blog/[slug]/page.tsx` — post.
- `blog/{category,tag,author,series}/[slug]/page.tsx` — archives (shared `_lib/archive.tsx`). `blog/archive/[year]/[month]`.
- `blog/feed.xml`, `blog/atom.xml`, `blog/feed.json` — feeds. `api/comments/[type]/[id]` — comments (type `post`).
- `newsletter/{subscribe,confirm,unsubscribe}` — routes; `newsletter/{confirmed,unsubscribed,invalid}` — pages.
- `_components/` — `PostList`, `PostCard`, `Comments`, `SubscribeForm`, `ShareLinks`, `blog.css` (the visual template).
- `_blocks/latest-posts.tsx` — "Latest posts" block for CMS pages. `_lib/campaign.ts` — "Create newsletter campaign" action.

## At a glance

- **GenPM dependencies** (installed with it): [@core/kit-cms](https://genpm.net/p/@core/kit-cms), [@core/blog](https://genpm.net/p/@core/blog), [@core/comments](https://genpm.net/p/@core/comments), [@core/newsletter](https://genpm.net/p/@core/newsletter)
- **npm dependencies** (proposed, never installed without asking): `next`, `react`, `zod`
- **Environment variables** (added to `.env.example`): `NEWSLETTER_FROM`, `NEWSLETTER_POSTAL_ADDRESS`, `NEWSLETTER_SECRET`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/app/(blog)`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
