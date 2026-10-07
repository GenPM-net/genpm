# @core/db — rules for AI agents

## Purpose
Shared Postgres access for every module: one Drizzle client, per-module schemas, transactions, ULID ids and standard
timestamps. It owns no tables itself. Not an ORM wrapper: use Drizzle's query builder directly.

## Map
- `index.ts` — public API: `getDb`, `createDb`, `setDb`, `withTransaction`, `primaryId`, `timestamps`, `newId`, `ulid`; types `Db`, `Tx`, `Executor`.
- `client.ts` — lazy client from `DATABASE_URL` (postgres-js).
- `columns.ts` — `primaryId(prefix)` and `timestamps` column helpers.
- `drizzle.config.ts` — drizzle-kit config that collects `src/lib/*/schema.ts`.

## Integration
1. Set `DATABASE_URL` (any Postgres: local, Neon, Supabase, RDS).
2. GenPM modules import each other with `.ts` extensions: make sure `tsconfig.json` has `"allowImportingTsExtensions": true`
   (requires `"noEmit": true`, the default in Next.js, Vite and tsx projects).
3. Install the npm deps if GenPM did not: `drizzle-orm`, `postgres`, and `drizzle-kit` as a dev dependency.
4. Add scripts to `package.json`:
   `"db:generate": "drizzle-kit generate --config src/lib/db/drizzle.config.ts"`,
   `"db:migrate": "drizzle-kit migrate --config src/lib/db/drizzle.config.ts"`.
5. Run `db:generate` then `db:migrate` after installing any module that has a `schema.ts`. `drizzle-kit` reads
   `DATABASE_URL` from the environment or `.env`, not `.env.local`: run `node --env-file=.env.local ./node_modules/.bin/drizzle-kit migrate --config …`
   (or export the variable) when the value lives there.
6. Query from app code:
   ```ts
   import { getDb } from './lib/db/index.ts';
   const rows = await getDb().select().from(users);
   ```
7. Another driver (Neon serverless, PGlite in tests): build it with Drizzle and call `setDb(db)` once at startup.

## Conventions
- Each module defines its tables in its own `src/lib/<module>/schema.ts`. Never put tables in `src/lib/db`.
- Table names are prefixed with the module when ambiguous (`auth_sessions`, not `sessions`).
- Primary keys: `id: primaryId('<3-4 letter prefix>')`; spread `...timestamps` in every table.
- Functions that write accept an optional `Executor` (`db` or `tx`) so callers can compose them in `withTransaction`.
- Money as integer minor units; times as `timestamp with time zone`.

## Don't
- Don't edit or reference another module's tables except through that module's exported functions.
- Don't create a second client or connection pool; use `getDb()`.
- Don't log `DATABASE_URL` or query parameters that may hold secrets.
- Don't use `drizzle-kit push` against production; generate and review migrations.
