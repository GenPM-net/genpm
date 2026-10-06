# @core/checkout — rules for AI agents

## Purpose
Pays a @core/cart with Stripe Checkout (hosted page: no card data on your server). `startCheckout` recomputes totals,
blocks carts with issues or without shipping, sends server prices, a one-off coupon for the computed discounts and
the chosen shipping rate, and stores a snapshot. The order (@core/orders) is created ONLY in the Stripe webhook,
idempotently, from that snapshot after checking the charged amount; if the order can never be created (stock ran
out, a variant was withdrawn, invalid address…), the payment is refunded automatically, the customer and the team
are told and the webhook still answers 2xx (transient errors are rethrown so Stripe retries). Open sessions reserve
the discount codes they carry (`registerPendingCodeUses` of @core/cart); if a concurrent checkout took the last use,
the new session is expired and `startCheckout` throws `issues`. Also registers Stripe as the refund provider for the admin.

## Map
- `index.ts` — public API: `startCheckout`, `getCheckoutStatus`, `finalizeSession`, `stripePaymentProvider`, `beginCheckoutEvent`, `purchaseEvent`.
- `checkout.ts` — logic and webhook handlers (registered on import). `schema.ts` — `checkout_sessions`.
- `adapters/hono.ts` — `checkoutRoutes({ currentUserId })`. `adapters/next.ts` — `checkoutRoute`, `checkoutStatusRoute`.

## Integration
1. Install and wire @core/stripe (one webhook endpoint) with events `checkout.session.completed`,
   `checkout.session.async_payment_succeeded` and `checkout.session.expired`. Env: `SITE_URL`, `EMAIL_FROM`,
   optional `CHECKOUT_ALERT_TO` (team alerts) and `STRIPE_TAX=1` (Stripe Tax; configure it in Stripe first).
2. Import this module and @core/shipping at startup. Migrations as in `src/lib/db/AGENTS.md`; the @core/jobs cron must run.
3. Cart page → ask country and shipping rate (`setCartMeta`), then `POST /api/checkout {email}` → redirect to `url`.
4. Success page `/checkout/success?session_id=…`: poll `GET /api/checkout/status` until `paid` (show the order number),
   `refunded` (sold out or order could not be created) or keep "processing" — never trust the URL alone.
5. Verify locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`, pay with card 4242 4242 4242 4242, an order appears.

## Conventions
- Amounts always come from `computeTotals`; the snapshot is what the customer saw and paid.
- Show delivery estimate, total with shipping and taxes, and legal links before redirecting to Stripe.
- Use `purchaseEvent(order)` (same `eventId` in browser and server) for @core/pixels.

## Don't
- Don't create or mark orders paid from the success redirect or from client calls.
- Don't send prices, discounts or shipping amounts from the browser to Stripe.
- Don't log card data, full webhook payloads or Stripe keys.
