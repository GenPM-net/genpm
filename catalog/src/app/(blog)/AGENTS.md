# @core/kit-blog — rules for AI agents

## Purpose
A complete blog on top of @core/kit-cms, edited in the same `/admin`: posts with rich text and cover images, author
profiles, categories, tags and series, scheduling, RSS/Atom/JSON feeds, site search, moderated comments, newsletter
with double opt-in and one-click unsubscribe, share links without third-party scripts and full SEO (BlogPosting
JSON-LD, sitemap, Open Graph). Glue and templates only: logic lives in @core/blog, comments and newsletter.

## Map
- `_templates/genpm.md` — the exact lines this kit adds to the project's `src/genpm/*.ts` (generated, always current).
- `blog/page.tsx` — index (featured first, `?page=`). `blog/[slug]/page.tsx` — post.
- `blog/{category,tag,author,series}/[slug]/page.tsx` — archives (shared `_lib/archive.tsx`). `blog/archive/[year]/[month]`.
- `blog/feed.xml`, `blog/atom.xml`, `blog/feed.json` — feeds. `api/comments/[type]/[id]` — comments (type `post`).
- `newsletter/{subscribe,confirm,unsubscribe}` — routes; `newsletter/{confirmed,unsubscribed,invalid}` — pages.
- `_components/` — `PostList`, `PostCard`, `Comments`, `SubscribeForm`, `ShareLinks`, `blog.css` (the visual template).
- `_blocks/latest-posts.tsx` — "Latest posts" block for CMS pages. `_lib/campaign.ts` — "Create newsletter campaign" action.

## Integration
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

## Conventions
- Posts reference authors, categories, tags and series by slug; renaming a slug breaks links, so prefer editing names.
- `membersOnly` posts show only the excerpt here; with @core/billing, decide access with `hasEntitlement` in `blog/[slug]/page.tsx`.
- The templates in `_components` belong to the project after installation: adapt markup and `blog.css` freely.

## Don't
- Don't add third-party share or comment widgets (scripts and cookies without consent); keep plain links.
- Don't import subscriber lists without demonstrable consent, and never remove the unsubscribe link or postal address.
- Don't publish comments from guests without moderation unless the owner asks for it (`moderation: 'guests'`).
