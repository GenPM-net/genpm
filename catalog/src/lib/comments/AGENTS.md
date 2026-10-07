# @core/comments — rules for AI agents

## Purpose
Comments on anything (`entityType` + `entityId`: posts, products, pages): guests (name + email, stored only as a hash)
or signed-in users, one level of replies, optional 1–5 rating (reused by @core/reviews), moderation queue with email
alerts, bans, GDPR erasure and safe HTML rendering. Anti-spam via @core/antispam. Tables: `comments`, `comment_bans`.

## Map
- `index.ts` — public API: `postComment`, `listComments`, `moderate`, `ban`, `eraseComments`, `ratingSummary`, `commentHtml`, `commentsAdminResource`.
- `comments.ts` — logic and the `comments.notify` job. `admin.ts` — moderation queue. `schema.ts` — tables.
- `adapters/hono.ts` — `commentRoutes({ currentUser })`. `adapters/next.ts` — `commentRoute({ currentUser })` → `{ GET, POST }`.

## Integration
1. Env: optional `COMMENTS_NOTIFY_TO` (moderators, comma-separated) and `EMAIL_FROM`. Migrations as in `src/lib/db/AGENTS.md`; the @core/jobs cron must run.
2. Mount the endpoints at `/api/comments/:type/:id` with `currentUser` from @core/auth (`getUser`/`getUserFromCookieHeader`).
3. The form posts `body` (and `name`, `email` for guests, `parentId` for replies) plus the @core/antispam fields (`honeypotProps`, `_ts`).
   Show "your comment awaits moderation" when the response status is `pending`.
4. Render the list from `GET` or `listComments(type, id)`; render each body with `commentHtml(body)` (escaped; the only HTML allowed).
5. Add `commentsAdminResource` to `src/genpm/admin.ts` (permissions `comments:read`, `comments:moderate`).
6. Verify: a guest comment is pending until approved in the admin, then it is listed.

## Conventions
- Default moderation is `guests`: guests and users without an approved comment wait for approval. Use `none` only on trusted, private sites.
- Erase on request with `eraseComments({ email })` or `({ userId })`; delete user comments when the account is deleted.
- Show ratings only from `ratingSummary` (approved comments).

## Don't
- Don't store or show guest emails; don't render comment bodies as Markdown/HTML.
- Don't auto-approve guests to "increase engagement".
- Don't expose `pending`, `spam` or `deleted` comments in public endpoints.
