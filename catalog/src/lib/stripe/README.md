# @core/stripe

[![genpm](https://api.genpm.net/v1/badge/@core/stripe.svg)](https://genpm.net/p/@core/stripe) ![license](https://img.shields.io/badge/license-MIT-blue)

> Shared Stripe client and one idempotent, signature-verified webhook endpoint dispatching events to every module

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/stripe`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/stripe
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/stripe`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/stripe with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

The single Stripe integration point of the app: a lazily created client (`getStripe`) and ONE webhook endpoint that
verifies the signature, records each event in `stripe_events` (idempotency) and dispatches it, inside one database
transaction, to the handlers that modules register with `onStripeEvent` (@core/billing 2.x, @core/checkout…).
If a handler throws, everything rolls back and Stripe retries. No business logic here.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/stripe/AGENTS.md` and can do them for you):

1. Env: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (`whsec_…`). Migrations as in `src/lib/db/AGENTS.md`.
2. Mount the endpoint: Hono `app.route('/api/stripe/webhook', stripeWebhookRoutes())`; Next.js
   `app/api/stripe/webhook/route.ts` → `export { stripeWebhookRoute as POST } from '@/lib/stripe/adapters/next'`.
3. In Stripe, create one webhook endpoint `<origin>/api/stripe/webhook` with the events the installed modules list in
   their AGENTS.md. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Import the modules that register handlers at startup (their `index.ts` registers them on import).
5. Verify: `stripe trigger checkout.session.completed` returns 200 and a row appears in `stripe_events`.
6. Optional MCP: with consent, the agent can use Stripe's MCP server to look up products and prices in test mode.

## What's inside

Paths are relative to `src/lib/stripe`.

- `index.ts` — public API: `getStripe`, `setStripe`, `onStripeEvent`, `handleStripeWebhook`, `stripeEvents`.
- `webhooks.ts` — verification, idempotency and dispatch. `client.ts` — client. `schema.ts` — `stripe_events`.
- `adapters/hono.ts` — `stripeWebhookRoutes()`. `adapters/next.ts` — `stripeWebhookRoute`.

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db)
- **npm dependencies** (proposed, never installed without asking): `stripe`
- **Environment variables** (added to `.env.example`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- **MCP servers** (only added with your consent): `stripe`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/stripe`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
