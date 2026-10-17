# @core/kit-store

[![genpm](https://api.genpm.net/v1/badge/@core/kit-store.svg)](https://genpm.net/p/@core/kit-store) ![license](https://img.shields.io/badge/license-MIT-blue)

> Online store kit for Next.js: catalog, cart, Stripe checkout, orders, shipping, coupons, verified reviews, accounts

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/app/(store)`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/kit-store
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/kit-store`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/kit-store with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

An online store on top of @core/kit-cms, managed from the same `/admin`: products with variants and categories,
cart, Stripe Checkout, orders (created only by the Stripe webhook), shipping zones and rates, discount codes,
verified reviews, customer orders page, transactional emails and SEO (Product JSON-LD, sitemap). Every storefront
form is a Next.js Server Action, so it works without JavaScript and never accepts prices from the browser.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/app/(store)/AGENTS.md` and can do them for you):

1. @core/kit-cms must be integrated first.
2. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CART_COOKIE_SECRET` and `ORDER_LINK_SECRET` (≥ 32 chars),
   `STORE_CURRENCY` (e.g. `EUR`), `SITE_URL`, `EMAIL_FROM`. Use Stripe test mode until the end-to-end check passes.
   If the Stripe MCP server is available and the person agrees, use it to inspect the test account (never live keys).
3. Migrations for catalog, cart, checkout, orders, shipping, discounts, reviews, comments and stripe.
4. Add every line of `_templates/genpm.md` to the project's `src/genpm/*.ts` (it says which file and where): it creates
   `src/genpm/commerce.ts` (imports that register webhooks, cart steps and the daily `store.maintenance` job), the
   product sitemap and search sources, the `productGrid` / `buyNow` blocks, and the admin resources and widgets
   (including comments, where product reviews are moderated). Then run the kit-cms `setup-schedules.ts` again.
5. Stripe webhook: endpoint `https://<site>/api/stripe/webhook` with `checkout.session.completed`,
   `checkout.session.async_payment_succeeded` and `checkout.session.expired` (refunds are started from the admin); locally `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
6. Create shipping zones and rates in the admin; put `<CartLink />` in the site header and "Shop" in the menu.
7. The person runs `npx tsx "src/app/(store)/_scripts/seed-legal.ts"`: terms, shipping, returns/withdrawal, privacy
   and cookies are created as drafts. They must complete them and have them reviewed before publishing.
8. Verify in test mode: buy with card 4242 4242 4242 4242, the webhook creates the order, the email arrives, stock
   decreases, the order page opens from the email link and not without it.

## What's inside

Paths are relative to `src/app/(store)`.

- `_templates/genpm.md` — the exact lines this kit adds to the project's `src/genpm/*.ts` (generated, always current).
- `_lib/maintenance.ts` — daily `store.maintenance` job (deletes expired carts).
- `shop/page.tsx`, `categories/[slug]`, `collections/[slug]` — listings. `products/[slug]/page.tsx` — product page.
- `cart/page.tsx` — cart, discount code, shipping country/method, totals and payment. `checkout/success` — real status.
- `orders/[number]/page.tsx` — order for its owner or with the signed email link. `account/page.tsx` — customer orders.
- `api/stripe/webhook/route.ts` — Stripe webhook (@core/stripe).
- `_lib/actions.ts` — server actions (add, update, code, shipping, checkout, review). `_lib/store.ts` — helpers.
- `_components/` — product card/grid, add to cart, `CartLink` for the header, reviews, order summary, `store.css`.
- `_blocks/products.tsx` — "Product grid" and "Buy now" blocks. `_lib/widgets.ts` — sales, orders to ship, low stock.
- `_lib/legal.ts` + `_scripts/seed-legal.ts` — legal pages as drafts pending review, with a dashboard warning.

## At a glance

- **GenPM dependencies** (installed with it): [@core/kit-cms](https://genpm.net/p/@core/kit-cms), [@core/catalog](https://genpm.net/p/@core/catalog), [@core/cart](https://genpm.net/p/@core/cart), [@core/checkout](https://genpm.net/p/@core/checkout), [@core/orders](https://genpm.net/p/@core/orders), [@core/shipping](https://genpm.net/p/@core/shipping), [@core/discounts](https://genpm.net/p/@core/discounts), [@core/reviews](https://genpm.net/p/@core/reviews)
- **npm dependencies** (proposed, never installed without asking): `next`, `react`, `zod`
- **Environment variables** (added to `.env.example`): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CART_COOKIE_SECRET`, `ORDER_LINK_SECRET`, `STORE_CURRENCY`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/app/(store)`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
