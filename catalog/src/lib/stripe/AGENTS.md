# @core/stripe — rules for AI agents

## Purpose
The single Stripe integration point of the app: a lazily created client (`getStripe`) and ONE webhook endpoint that
verifies the signature, records each event in `stripe_events` (idempotency) and dispatches it, inside one database
transaction, to the handlers that modules register with `onStripeEvent` (@core/billing 2.x, @core/checkout…).
If a handler throws, everything rolls back and Stripe retries. No business logic here.

## Map
- `index.ts` — public API: `getStripe`, `setStripe`, `onStripeEvent`, `handleStripeWebhook`, `stripeEvents`.
- `webhooks.ts` — verification, idempotency and dispatch. `client.ts` — client. `schema.ts` — `stripe_events`.
- `adapters/hono.ts` — `stripeWebhookRoutes()`. `adapters/next.ts` — `stripeWebhookRoute`.

## Integration
1. Env: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (`whsec_…`). Migrations as in `src/lib/db/AGENTS.md`.
2. Mount the endpoint: Hono `app.route('/api/stripe/webhook', stripeWebhookRoutes())`; Next.js
   `app/api/stripe/webhook/route.ts` → `export { stripeWebhookRoute as POST } from '@/lib/stripe/adapters/next'`.
3. In Stripe, create one webhook endpoint `<origin>/api/stripe/webhook` with the events the installed modules list in
   their AGENTS.md. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
4. Import the modules that register handlers at startup (their `index.ts` registers them on import).
5. Verify: `stripe trigger checkout.session.completed` returns 200 and a row appears in `stripe_events`.
6. Optional MCP: with consent, the agent can use Stripe's MCP server to look up products and prices in test mode.

## Conventions
- Handlers write only through the `tx` they receive and must be idempotent.
- Read the current object from the API when order matters (events can arrive out of order).
- @core/billing 1.x also defines `stripe_events`; upgrade it to 2.x before installing this module.

## Don't
- Don't create more webhook endpoints or call `constructEvent` elsewhere.
- Don't parse the webhook body as JSON before verification; the signature covers the raw bytes.
- Don't log full event payloads, card data or keys.
