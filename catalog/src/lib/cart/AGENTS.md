# @core/cart — rules for AI agents

## Purpose
Carts for guests (id in an HMAC-signed HttpOnly cookie) and users (merged on login), lines per variant with stock
and quantity checks, and `computeTotals`: lines are always priced from @core/catalog in the database, unavailable
items are dropped with an `issues` entry, then registered steps run (discounts 100, shipping 200, taxes 300).
No payments or orders. Tables: `carts`, `cart_lines`.

## Map
- `index.ts` — public API: `getCart`, `getOrCreateCart`, `addLine`, `setLine`, `setDiscountCodes`, `setCartMeta`, `computeTotals`, `registerTotalsStep`, `applyOrderDiscount`, `registerPendingCodeUses`, `pendingCodeUses`, `pruneCarts`.
- `cart.ts` — operations. `totals.ts` — pipeline and types. `cookie.ts` — signed cookie.
- `adapters/hono.ts` — `cartRoutes({ currentUserId })`. `adapters/next.ts` — `cartRoute`, `cartLinesRoute`, `cartLineRoute`, `cartCodesRoute`.

## Integration
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

## Conventions
- Totals shown and charged come from `computeTotals` only; never from values sent by the browser.
- Show every `issues` entry to the customer before checkout.
- Money values are `{ amount, currency }` in minor units (@core/money).

## Don't
- Don't reserve stock in the cart (that happens when the order is created).
- Don't trust prices, discounts or totals in request bodies, and don't read the cart cookie without verifying it.
