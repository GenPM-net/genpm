# @core/kit-store — rules for AI agents

## Purpose
An online store on top of @core/kit-cms, managed from the same `/admin`: products with variants and categories,
cart, Stripe Checkout, orders (created only by the Stripe webhook), shipping zones and rates, discount codes,
verified reviews, customer orders page, transactional emails and SEO (Product JSON-LD, sitemap). Every storefront
form is a Next.js Server Action, so it works without JavaScript and never accepts prices from the browser.

## Map
- `shop/page.tsx`, `categories/[slug]`, `collections/[slug]` — listings. `products/[slug]/page.tsx` — product page.
- `cart/page.tsx` — cart, discount code, shipping country/method, totals and payment. `checkout/success` — real status.
- `orders/[number]/page.tsx` — order for its owner or with the signed email link. `account/page.tsx` — customer orders.
- `api/stripe/webhook/route.ts` — Stripe webhook (@core/stripe).
- `_lib/actions.ts` — server actions (add, update, code, shipping, checkout, review). `_lib/store.ts` — helpers.
- `_components/` — product card/grid, add to cart, `CartLink` for the header, reviews, order summary, `store.css`.
- `_blocks/products.tsx` — "Product grid" and "Buy now" blocks. `_lib/widgets.ts` — sales, orders to ship, low stock.
- `_lib/legal.ts` + `_scripts/seed-legal.ts` — legal pages as drafts pending review, with a dashboard warning.

## Integration
1. @core/kit-cms must be integrated first.
2. Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CART_COOKIE_SECRET` and `ORDER_LINK_SECRET` (≥ 32 chars),
   `STORE_CURRENCY` (e.g. `EUR`), `SITE_URL`, `EMAIL_FROM`. Use Stripe test mode until the end-to-end check passes.
   If the Stripe MCP server is available and the person agrees, use it to inspect the test account (never live keys).
3. Migrations for catalog, cart, checkout, orders, shipping, discounts, reviews, comments and stripe.
4. Add the lines marked `// kit-store` to the registration files: `src/genpm/commerce.ts` (imports that register
   webhooks and cart steps) imported from `src/genpm/index.ts`; `productSitemapSource()` in `seo.ts`;
   `productSearchSource()` in `search.ts`; `productGrid`, `buyNow` in `blocks.ts`; in `admin.ts`
   `...catalogAdminResources()`, `ordersAdminResource`, `...shippingAdminResources()`, `discountsAdminResource`,
   `...storeWidgets` and `legalPagesWidget`.
5. Stripe webhook: endpoint `https://<site>/api/stripe/webhook` with `checkout.session.completed`,
   `checkout.session.async_payment_succeeded` and `checkout.session.expired` (refunds are started from the admin); locally `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
6. Create shipping zones and rates in the admin; put `<CartLink />` in the site header and "Shop" in the menu.
7. The person runs `npx tsx "src/app/(store)/_scripts/seed-legal.ts"`: terms, shipping, returns/withdrawal, privacy
   and cookies are created as drafts. They must complete them and have them reviewed before publishing.
8. Verify in test mode: buy with card 4242 4242 4242 4242, the webhook creates the order, the email arrives, stock
   decreases, the order page opens from the email link and not without it.

## Conventions
- Prices are integers in minor units; the client only sends variant ids, quantities, codes and the shipping choice.
- Orders exist only after Stripe confirms payment (webhook), never from the success page.
- The "before" price is hidden: in the EU it must be the lowest price of the previous 30 days (Omnibus directive).
  With @core/pricing installed, show it only through `honestCompareAt`.

## Don't
- Don't publish legal pages the person has not reviewed, and never present generated legal text as final.
- Don't show fake reviews, ratings, stock counts or countdowns; review JSON-LD only with real approved reviews.
- Don't expose order pages without the owner session or the signed token; don't put tokens in analytics.
