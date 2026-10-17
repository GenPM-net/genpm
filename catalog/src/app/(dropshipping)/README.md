# @core/kit-dropshipping

[![genpm](https://api.genpm.net/v1/badge/@core/kit-dropshipping.svg)](https://genpm.net/p/@core/kit-dropshipping) ![license](https://img.shields.io/badge/license-MIT-blue)

> Dropshipping kit for Next.js: supplier import, margin rules, product landings, order forwarding and exceptions

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/app/(dropshipping)`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/kit-dropshipping
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/kit-dropshipping`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/kit-dropshipping with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Dropshipping on top of @core/kit-store and @core/kit-landing (kit-cms arrives once through both): connect suppliers,
import products with their cost and a price from margin rules (@core/pricing), single-product landings at `/p/<slug>`
with direct "buy now" to Stripe, automatic or approved forwarding of paid orders to the supplier, tracking sync,
exceptions for what cannot be automated and an estimated profit widget. Logic lives in @core/suppliers and @core/pricing.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/app/(dropshipping)/AGENTS.md` and can do them for you):

1. @core/kit-store and @core/kit-landing must be integrated first (follow their AGENTS.md).
2. Add the lines of `_templates/genpm.md` to the project's `src/genpm/*.ts` (it says which file and where): imports in
   `commerce.ts` (pricing, suppliers and `_lib/purchase`, which registers the server `purchase` event when imported)
   and the admin resources and widgets.
3. Migrations for @core/suppliers and @core/pricing.
4. Create a price rule (Admin → Price rules) before importing anything; imports fail without one.
5. Start with the `manual` adapter if there are no API credentials: Admin → Suppliers → new supplier (`config`:
   `orderEmail`, `shipsFrom` as a 2-letter country code) → "Import products from CSV". Version 1.0 ships only the
   `manual` adapter; API adapters (CJ, AliExpress) will come as separate packages and will read their credentials from
   environment variables, never from the supplier config.
6. Products are imported as drafts: review texts, images (third-party rights) and prices, then activate them.
7. Add `<DeliveryNotice product={p} />` to `src/app/(store)/products/[slug]/page.tsx` next to the add-to-cart form.
8. The person runs `npx tsx "src/app/(dropshipping)/_scripts/setup-schedules.ts"`; `/api/cron` must run every minute.
9. Verify in Stripe test mode: buy from `/p/<slug>`, the order appears in Supplier orders as pending approval, approve
   it, the supplier receives the order, add tracking, the customer receives the "shipped" email.

## What's inside

Paths are relative to `src/app/(dropshipping)`.

- `_templates/genpm.md` — the exact lines this kit adds to the project's `src/genpm/*.ts` (generated, always current).
- `p/[slug]/page.tsx` — product landing: blocks of the landing with the same slug (optional), "buy now" form and delivery notice.
- `_lib/actions.ts` — `buyNow` server action (single-product cart, country, Stripe Checkout, attribution with consent).
- `_lib/purchase.ts` — server `purchase` event on `paid` (Meta CAPI / TikTok / GA4 MP, only with consent).
- `_components/delivery-notice.tsx` — real delivery time, origin country, duties and returns, shown before payment.
- `_components/track-view.tsx` — client `ViewContent` event on `/p/<slug>` (only with marketing consent).
- `_lib/widgets.ts` — profit (7 days, estimated), supplier orders queue, open exceptions.
- `_scripts/setup-schedules.ts` — schedules cost/stock sync (6 h) and tracking (12 h).

## At a glance

- **GenPM dependencies** (installed with it): [@core/kit-store](https://genpm.net/p/@core/kit-store), [@core/kit-landing](https://genpm.net/p/@core/kit-landing), [@core/suppliers](https://genpm.net/p/@core/suppliers), [@core/pricing](https://genpm.net/p/@core/pricing)
- **npm dependencies** (proposed, never installed without asking): `next`, `react`
- **Environment variables** (added to `.env.example`): `PAYMENT_FEE_BPS`, `PAYMENT_FEE_FIXED`, `SUPPLIERS_SYNC_CRON`, `SUPPLIERS_TRACKING_CRON`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/app/(dropshipping)`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
