# @core/discounts — rules for AI agents

## Purpose
Discount codes and automatic discounts for @core/cart: percent, fixed amount or free shipping; optional scope by
product or category slugs, minimum order, start/end dates, total and per-customer usage limits, first-order-only and
combinability (non-combinable ones compete: the biggest wins). Registers the `discounts` (100) and `free-shipping`
(250) totals steps and records redemptions inside the transaction that creates/pays the order (`onOrderPaidTx` of
@core/orders), with the discount row locked. Limits count recorded redemptions plus open payments carrying the code
(`pendingCodeUses` of @core/cart, fed by @core/checkout). If a limit was exceeded anyway (the customer already paid),
the order is kept, the redemption recorded and a `discount_over_limit` event is added to the order timeline for review.
Tables: `discounts`, `discount_redemptions`.

## Map
- `index.ts` — public API: `upsertDiscount`, `DiscountInput`, `discountsStep`, `freeShippingStep`, `recordRedemptions`, `discountsAdminResource`.
- `discounts.ts` — validation, application and the redemption handler (registered on import). `admin.ts` — admin resource.

## Integration
1. Migrations as in `src/lib/db/AGENTS.md`. Import this module at startup (it registers its steps and handler).
2. Cart page: a code field calling `PUT /api/cart/codes {codes: [code]}` (@core/cart); show `totals.discounts` and any `invalid_code` issues.
3. Pass the customer email to `computeTotals(cart, { email })` once known so per-customer and first-order limits apply.
4. Add `discountsAdminResource` to `src/genpm/admin.ts` (permissions `discounts:read|update`).
5. Verify: create `TEN` (10 %), apply it, the total drops and each line shows its share.

## Conventions
- Codes are stored uppercase (`A–Z 0–9 _ -`); values: percent 1–100, fixed in minor units.
- Deleting a discount deactivates it (redemption history stays).
- Free-shipping adjustments carry their `code` (amount 0), so they count towards usage limits.
- Check the order timeline (`discount_over_limit`) when a usage-limited campaign ends.
- Prefer automatic discounts for store-wide sales; codes for campaigns.

## Don't
- Don't show a "was" price or a percentage off that isn't real: in the EU a price reduction must refer to the lowest
  price of the previous 30 days (Omnibus Directive). Use @core/pricing's price history for compare-at prices.
- Don't apply discounts on the client or trust discount amounts sent by the browser.
- Don't create fake urgency (countdowns that reset, "only today" when it isn't).
