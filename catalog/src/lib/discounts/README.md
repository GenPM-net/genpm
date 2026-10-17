# @core/discounts

[![genpm](https://api.genpm.net/v1/badge/@core/discounts.svg)](https://genpm.net/p/@core/discounts) ![license](https://img.shields.io/badge/license-MIT-blue)

> Discount codes and automatic discounts: percent, fixed, free shipping, product/category scope, usage and first-order limits

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/discounts`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/discounts
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/discounts`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/discounts with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Discount codes and automatic discounts for @core/cart: percent, fixed amount or free shipping; optional scope by
product or category slugs, minimum order, start/end dates, total and per-customer usage limits, first-order-only and
combinability (non-combinable ones compete: the biggest wins). Registers the `discounts` (100) and `free-shipping`
(250) totals steps and records redemptions inside the transaction that creates/pays the order (`onOrderPaidTx` of
@core/orders), with the discount row locked. Limits count recorded redemptions plus open payments carrying the code
(`pendingCodeUses` of @core/cart, fed by @core/checkout). If a limit was exceeded anyway (the customer already paid),
the order is kept, the redemption recorded and a `discount_over_limit` event is added to the order timeline for review.
Tables: `discounts`, `discount_redemptions`.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/discounts/AGENTS.md` and can do them for you):

1. Migrations as in `src/lib/db/AGENTS.md`. Import this module at startup (it registers its steps and handler).
2. Cart page: a code field calling `PUT /api/cart/codes {codes: [code]}` (@core/cart); show `totals.discounts` and any `invalid_code` issues.
3. Pass the customer email to `computeTotals(cart, { email })` once known so per-customer and first-order limits apply.
4. Add `discountsAdminResource` to `src/genpm/admin.ts` (permissions `discounts:read|update`).
5. Verify: create `TEN` (10 %), apply it, the total drops and each line shows its share.

## What's inside

Paths are relative to `src/lib/discounts`.

- `index.ts` — public API: `upsertDiscount`, `DiscountInput`, `discountsStep`, `freeShippingStep`, `recordRedemptions`, `discountsAdminResource`.
- `discounts.ts` — validation, application and the redemption handler (registered on import). `admin.ts` — admin resource.

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db), [@core/cart](https://genpm.net/p/@core/cart), [@core/catalog](https://genpm.net/p/@core/catalog), [@core/orders](https://genpm.net/p/@core/orders), [@core/money](https://genpm.net/p/@core/money)
- **npm dependencies** (proposed, never installed without asking): `zod`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/discounts`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
