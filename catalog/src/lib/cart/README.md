# @core/cart

[![genpm](https://api.genpm.net/v1/badge/@core/cart.svg)](https://genpm.net/p/@core/cart) ![license](https://img.shields.io/badge/license-MIT-blue)

> Shopping cart: signed guest cookie, merge on login, server-side prices and a pluggable totals pipeline

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/cart`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/cart
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/cart`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/cart with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Carts for guests (id in an HMAC-signed HttpOnly cookie) and users (merged on login), lines per variant with stock
and quantity checks, and `computeTotals`: lines are always priced from @core/catalog in the database, unavailable
items are dropped with an `issues` entry, then registered steps run (discounts 100, shipping 200, taxes 300).
No payments or orders. Tables: `carts`, `cart_lines`.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/cart/AGENTS.md` and can do them for you):

1. Env: `CART_COOKIE_SECRET` (≥ 32 chars). Migrations as in `src/lib/db/AGENTS.md`.
2. Mount the JSON API at `/api/cart` with `currentUserId` from @core/auth (or `async () => null` for guest-only shops).
   Calls: `GET /api/cart`, `POST /api/cart/lines {variantId, quantity}`, `PUT /api/cart/lines/:variantId {quantity}` (0 removes), `PUT /api/cart/codes {codes}`.
3. Server pages: `const cart = await getCart(cookieHeader, userId); const totals = cart && await computeTotals(cart)`.
4. Modules that change totals register a step once at startup: `registerTotalsStep({ name, order, run: (t) => … })`;
   order discounts must go through `applyOrderDiscount` so they are allocated to lines.
   Modules that open payments before the order exists (@core/checkout) register `registerPendingCodeUses` so
   usage-limited codes (@core/discounts) count in-flight payments as reserved.
5. Schedule `pruneCarts()` daily (@core/jobs; with kit-store, its `store.maintenance` job does it).
6. Verify: add a product, change its price in the admin, the cart shows the new price.

## What's inside

Paths are relative to `src/lib/cart`.

- `index.ts` — public API: `getCart`, `getOrCreateCart`, `addLine`, `setLine`, `setDiscountCodes`, `setCartMeta`, `computeTotals`, `registerTotalsStep`, `applyOrderDiscount`, `registerPendingCodeUses`, `pendingCodeUses`, `pruneCarts`.
- `cart.ts` — operations. `totals.ts` — pipeline and types. `cookie.ts` — signed cookie.
- `adapters/hono.ts` — `cartRoutes({ currentUserId })`. `adapters/next.ts` — `cartRoute`, `cartLinesRoute`, `cartLineRoute`, `cartCodesRoute`.

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db), [@core/auth](https://genpm.net/p/@core/auth), [@core/catalog](https://genpm.net/p/@core/catalog), [@core/money](https://genpm.net/p/@core/money), [@core/contracts](https://genpm.net/p/@core/contracts)
- **npm dependencies** (proposed, never installed without asking): `zod`
- **Environment variables** (added to `.env.example`): `CART_COOKIE_SECRET`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/cart`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
