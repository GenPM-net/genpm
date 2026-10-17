# @core/comments

[![genpm](https://api.genpm.net/v1/badge/@core/comments.svg)](https://genpm.net/p/@core/comments) ![license](https://img.shields.io/badge/license-MIT-blue)

> Moderated comments on any entity: guest or user, replies, optional 1–5 ratings, bans, GDPR erasure, safe HTML

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/comments`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/comments
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/comments`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/comments with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Comments on anything (`entityType` + `entityId`: posts, products, pages): guests (name + email, stored only as a hash)
or signed-in users, one level of replies, optional 1–5 rating (reused by @core/reviews), moderation queue with email
alerts, bans, GDPR erasure and safe HTML rendering. Anti-spam via @core/antispam. Tables: `comments`, `comment_bans`.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/comments/AGENTS.md` and can do them for you):

1. Env: optional `COMMENTS_NOTIFY_TO` (moderators, comma-separated) and `EMAIL_FROM`. Migrations as in `src/lib/db/AGENTS.md`; the @core/jobs cron must run.
2. Mount the endpoints at `/api/comments/:type/:id` with `currentUser` from @core/auth (`getUser`/`getUserFromCookieHeader`).
3. The form posts `body` (and `name`, `email` for guests, `parentId` for replies) plus the @core/antispam fields (`honeypotProps`, `_ts`).
   Show "your comment awaits moderation" when the response status is `pending`.
4. Render the list from `GET` or `listComments(type, id)`; render each body with `commentHtml(body)` (escaped; the only HTML allowed).
5. Add `commentsAdminResource` to `src/genpm/admin.ts` (permissions `comments:read`, `comments:moderate`).
6. Verify: a guest comment is pending until approved in the admin, then it is listed.

## What's inside

Paths are relative to `src/lib/comments`.

- `index.ts` — public API: `postComment`, `listComments`, `moderate`, `ban`, `eraseComments`, `ratingSummary`, `commentHtml`, `commentsAdminResource`.
- `comments.ts` — logic and the `comments.notify` job. `admin.ts` — moderation queue. `schema.ts` — tables.
- `adapters/hono.ts` — `commentRoutes({ currentUser })`. `adapters/next.ts` — `commentRoute({ currentUser })` → `{ GET, POST }`.

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db), [@core/auth](https://genpm.net/p/@core/auth), [@core/antispam](https://genpm.net/p/@core/antispam), [@core/email](https://genpm.net/p/@core/email), [@core/jobs](https://genpm.net/p/@core/jobs), [@core/contracts](https://genpm.net/p/@core/contracts)
- **npm dependencies** (proposed, never installed without asking): `zod`
- **Environment variables** (added to `.env.example`): `COMMENTS_NOTIFY_TO`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/comments`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
