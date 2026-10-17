# @core/db

[![genpm](https://api.genpm.net/v1/badge/@core/db.svg)](https://genpm.net/p/@core/db) ![license](https://img.shields.io/badge/license-MIT-blue)

> Postgres with Drizzle: shared client, per-module schemas, transactions and ULID ids

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/db`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/db
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/db`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/db with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Shared Postgres access for every module: one Drizzle client, per-module schemas, transactions, ULID ids and standard
timestamps. It owns no tables itself. Not an ORM wrapper: use Drizzle's query builder directly.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/db/AGENTS.md` and can do them for you):

1. Set `DATABASE_URL` (any Postgres: local, Neon, Supabase, RDS).
2. GenPM modules import each other with `.ts` extensions: make sure `tsconfig.json` has `"allowImportingTsExtensions": true`
   (requires `"noEmit": true`, the default in Next.js, Vite and tsx projects).
3. Install the npm deps if GenPM did not: `drizzle-orm`, `postgres`, and `drizzle-kit` as a dev dependency.
4. Add scripts to `package.json`:
   `"db:generate": "drizzle-kit generate --config src/lib/db/drizzle.config.ts"`,
   `"db:migrate": "drizzle-kit migrate --config src/lib/db/drizzle.config.ts"`.
5. Run `db:generate` then `db:migrate` after installing any module that has a `schema.ts`. `drizzle-kit` reads
   `DATABASE_URL` from the environment or `.env`, not `.env.local`: run `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs migrate --config …`
   (the real entry point: with pnpm `.bin/drizzle-kit` is a shell script). Same for `tsx` scripts: `npx tsx --env-file=.env.local <script>`
   (or export the variable) when the value lives there.
6. Query from app code:
   ```ts
   import { getDb } from './lib/db/index.ts';
   const rows = await getDb().select().from(users);
   ```
7. Another driver (Neon serverless, PGlite in tests): build it with Drizzle and call `setDb(db)` once at startup.

## What's inside

Paths are relative to `src/lib/db`.

- `index.ts` — public API: `getDb`, `createDb`, `setDb`, `withTransaction`, `primaryId`, `timestamps`, `newId`, `ulid`; types `Db`, `Tx`, `Executor`.
- `client.ts` — lazy client from `DATABASE_URL` (postgres-js).
- `columns.ts` — `primaryId(prefix)` and `timestamps` column helpers.
- `drizzle.config.ts` — drizzle-kit config that collects `src/lib/*/schema.ts`.

## At a glance

- **npm dependencies** (proposed, never installed without asking): `drizzle-orm`, `postgres`
- **Environment variables** (added to `.env.example`): `DATABASE_URL`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/db`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
