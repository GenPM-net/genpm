# @core/<name> — rules for AI agents

<!-- Keep this file under ~1,500 tokens. It is loaded only when the agent works inside this folder. -->

## Purpose
One or two sentences: what this module does and what it deliberately does not do.

## Map
- `index.ts` — public API. Import from here only.
- `schema.ts` — Drizzle tables owned by this module (if any).
- `adapters/hono.ts`, `adapters/next.ts` — framework glue.

## Integration
Numbered steps the agent follows to wire the module into the app:
1. Environment variables to set (names only; see `.env.example`).
2. Migrations to generate and apply.
3. Routes or middleware to mount, with a minimal snippet for Hono and for Next.js.
4. How to verify it works (a test or a curl).

## Conventions
- Naming, error handling, where new code goes.

## Don't
- Things the agent must never do (edit other modules' tables, log secrets, hardcode keys…).
