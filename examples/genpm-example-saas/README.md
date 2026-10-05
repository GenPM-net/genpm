# genpm-example-saas

An end-to-end example of [GenPM](https://github.com/GenPM-net/genpm): a small SaaS backend (Hono + Drizzle) built from
the five `@core/*` seed packages, installed with `genpm add` and wired together following each package's `AGENTS.md`.

| Package | Version | Lands in | What it gives the app |
|---|---|---|---|
| `@core/db` | 1.0.0 | `src/lib/db` | Drizzle client, per-module schemas, ULID ids, transactions |
| `@core/auth` | 1.1.0 | `src/lib/auth` | Cookie sessions + GitHub/Google OAuth |
| `@core/billing` | 1.0.1 | `src/lib/billing` | Stripe checkout, portal, idempotent webhooks, `hasEntitlement` (+ Stripe MCP server) |
| `@core/email` | 1.0.1 | `src/lib/email` | Typed React Email templates (Resend / SMTP / console) |
| `@core/ai` | 1.0.1 | `src/lib/ai` | Streaming chat with the AI SDK and per-user usage log |

Everything under `src/lib/` is vendored code you own: it is in this repo's history, pinned in `genpm.lock` to a 40-char
commit SHA, and its AI rules sit next to it (`AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*.mdc`).

## How it was built

```bash
git init && npm init -y
genpm add @core/billing -y --mcp --install-deps     # pulls @core/auth and @core/db as GenPM dependencies
genpm add @core/email@1.0.0 @core/ai -y --install-deps
genpm update @core/email                            # 1.0.0 → 1.0.1, three-way merge with local edits
```

Each step is a commit, so `git log` shows exactly what GenPM wrote. Then, by hand (as the rules ask):

- deleted the Next.js adapters (`src/lib/*/adapters/next.ts`) because this app uses Hono — `genpm list` reports them as
  local drift, which is expected;
- `src/app.ts` mounts the routes: `/auth/*`, `/api/me`, `/billing/*`, `/api/pro` (gated by `hasEntitlement`), `/ai/chat`
  (logged-in users only), and sends the welcome email on the first login;
- `npm run db:generate` produced `drizzle/` from every module's `schema.ts`;
- `src/db.ts` uses PGlite when `DATABASE_URL` starts with `pglite:` so the app runs with no external services.

## Run it

```bash
npm ci
cp .env.example .env            # fill what you need; see each src/lib/*/AGENTS.md
npm test                        # 5 smoke tests on PGlite: auth, billing, email, AI (mock model)
DATABASE_URL=pglite:memory GITHUB_CLIENT_ID=… GITHUB_CLIENT_SECRET=… AUTH_SECRET=… npm run dev
```

With a real Postgres: set `DATABASE_URL=postgres://…` and run `npm run db:migrate` first.

## Check it with genpm

```bash
genpm list        # installed packages and local drift
genpm audit       # files hash, registry signatures, advisories, yanked versions
genpm outdated
genpm info @core/billing   # manifest, deps, env vars, MCP server and AI rules
```

CI (`.github/workflows/ci.yml`, active once this folder is its own repo) runs the tests and these checks against the
production registry on every push and weekly.

> **Registry signatures.** This example was generated in a sandbox that could not reach `api.genpm.net`, against a local
> registry serving the same seed commits (same SHAs, same files) signed with the development key. Before relying on
> `genpm audit`, refresh the `sg` fields from production — commits are checked, nothing else changes:
>
> ```bash
> node scripts/relock-signatures.mjs && genpm audit
> ```

## Use it as its own repo

It lives in the GenPM monorepo under `examples/`. To publish it standalone with its history:

```bash
git subtree split --prefix examples/genpm-example-saas -b genpm-example-saas
git push git@github.com:GenPM-net/genpm-example-saas.git genpm-example-saas:main
```

The Stripe MCP server declared by `@core/billing` was written to `.mcp.json` (Claude Code) and `.cursor/mcp.json` with
consent (`--mcp`); its key is read from `STRIPE_SECRET_KEY` in your environment, never stored in the file.
