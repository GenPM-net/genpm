---
title: Stripe subscriptions in Next.js
section: Guides
order: 71
---
Checkout, the customer portal, idempotent webhooks and a `hasEntitlement(user, 'pro')` check: the part of every SaaS that nobody wants to rewrite. `@core/billing` brings it as source code you own.

## 1. Install

```bash
npx @genpm-net/cli add @core/billing
```

It pulls what it needs: `@core/stripe` (one signature-verified webhook endpoint), `@core/auth` (who is paying) and `@core/db`. If you already followed [Add GitHub login to Next.js](/docs/nextjs-github-login), only the new modules are added.

The package declares Stripe's official MCP server. GenPM asks before adding it; with it, your agent can read your real products and prices instead of guessing ids.

## 2. Keys and prices

```bash
# .env.local (test mode while you develop)
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
```

Map each Stripe price to the features it unlocks in `src/lib/billing/plans.ts`:

```ts
FEATURES_BY_PRICE['price_123'] = ['pro'];
```

Then generate and apply migrations as in `src/lib/db/AGENTS.md`.

## 3. Routes

Create `app/billing/checkout/route.ts`, `app/billing/portal/route.ts` and `app/billing/webhook/route.ts`, each exporting `checkoutRoute`, `portalRoute` or `webhookRoute` as `POST` from `@/lib/billing/adapters/next`.

In Stripe, point a webhook to `<your origin>/billing/webhook` with `checkout.session.completed` and `customer.subscription.created|updated|deleted`. Locally:

```bash
stripe listen --forward-to localhost:3000/billing/webhook
```

## 4. Sell and gate

- Upgrade button: `POST /billing/checkout` with `{ priceId }` returns `{ url }`; send the browser there.
- Gate a feature: `if (!(await hasEntitlement(user, 'pro'))) …`
- "Manage subscription": `POST /billing/portal`.

Subscription state is read from your database, kept in sync by the webhook, so pages never wait on Stripe. Each event is processed once even if Stripe delivers it twice.

**Starting from scratch?** The [saas-starter template](https://github.com/GenPM-net/saas-starter) already has GitHub login, Stripe subscriptions and email wired with GenPM.
