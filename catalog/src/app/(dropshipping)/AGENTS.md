# @core/kit-dropshipping — rules for AI agents

## Purpose
Dropshipping on top of @core/kit-store and @core/kit-landing (kit-cms arrives once through both): connect suppliers,
import products with their cost and a price from margin rules (@core/pricing), single-product landings at `/p/<slug>`
with direct "buy now" to Stripe, automatic or approved forwarding of paid orders to the supplier, tracking sync,
exceptions for what cannot be automated and an estimated profit widget. Logic lives in @core/suppliers and @core/pricing.

## Map
- `_templates/genpm.md` — the exact lines this kit adds to the project's `src/genpm/*.ts` (generated, always current).
- `p/[slug]/page.tsx` — product landing: blocks of the landing with the same slug (optional), "buy now" form and delivery notice.
- `_lib/actions.ts` — `buyNow` server action (single-product cart, country, Stripe Checkout, attribution with consent).
- `_lib/purchase.ts` — server `purchase` event on `paid` (Meta CAPI / TikTok / GA4 MP, only with consent).
- `_components/delivery-notice.tsx` — real delivery time, origin country, duties and returns, shown before payment.
- `_components/track-view.tsx` — client `ViewContent` event on `/p/<slug>` (only with marketing consent).
- `_lib/widgets.ts` — profit (7 days, estimated), supplier orders queue, open exceptions.
- `_scripts/setup-schedules.ts` — schedules cost/stock sync (6 h) and tracking (12 h).

## Integration
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

## Conventions
- Forwarding starts in approval mode; enable `autoForward` per supplier only after a few correct orders.
- Prices come from the rules and the cost; when the cost rises and the margin would be negative, the product is paused
  and an exception opens (never sell at a loss silently).
- The shop is the seller: it handles returns and the 14-day withdrawal right, whatever the supplier does.

## Don't
- Don't hide delivery times, origin country or possible import charges until after payment (EU consumer law).
- Don't scrape suppliers or automate against their terms: official APIs or the manual adapter only.
- Don't import reviews without labelling them, invent features or certifications, or use fake urgency (see kit-landing).
