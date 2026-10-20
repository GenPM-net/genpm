---
title: Suscripciones con Stripe en Next.js
section: Guías
order: 71
---
Checkout, portal del cliente, webhooks idempotentes y un `hasEntitlement(user, 'pro')`: la parte de cualquier SaaS que nadie quiere reescribir. `@core/billing` la trae como código fuente que es tuyo.

## 1. Instala

```bash
npx @genpm-net/cli add @core/billing
```

Trae lo que necesita: `@core/stripe` (un único endpoint de webhooks con firma verificada), `@core/auth` (quién paga) y `@core/db`. Si ya seguiste [Login con GitHub en Next.js](/es/docs/nextjs-github-login), solo se añaden los módulos nuevos.

El paquete declara el servidor MCP oficial de Stripe. GenPM te pregunta antes de añadirlo; con él, tu agente puede leer tus productos y precios reales en vez de inventarse ids.

## 2. Claves y precios

```bash
# .env.local (modo test mientras desarrollas)
STRIPE_SECRET_KEY=sk_test_…
STRIPE_WEBHOOK_SECRET=whsec_…
```

Asocia cada precio de Stripe con lo que desbloquea en `src/lib/billing/plans.ts`:

```ts
FEATURES_BY_PRICE['price_123'] = ['pro'];
```

Después genera y aplica las migraciones como dice `src/lib/db/AGENTS.md`.

## 3. Rutas

Crea `app/billing/checkout/route.ts`, `app/billing/portal/route.ts` y `app/billing/webhook/route.ts`, cada una exportando `checkoutRoute`, `portalRoute` o `webhookRoute` como `POST` desde `@/lib/billing/adapters/next`.

En Stripe, apunta un webhook a `<tu dominio>/billing/webhook` con `checkout.session.completed` y `customer.subscription.created|updated|deleted`. En local:

```bash
stripe listen --forward-to localhost:3000/billing/webhook
```

## 4. Vende y limita

- Botón de mejorar plan: `POST /billing/checkout` con `{ priceId }` devuelve `{ url }`; redirige el navegador ahí.
- Limitar una función: `if (!(await hasEntitlement(user, 'pro'))) …`
- "Gestionar suscripción": `POST /billing/portal`.

El estado de la suscripción se lee de tu base de datos, sincronizada por el webhook, así que las páginas nunca esperan a Stripe. Cada evento se procesa una sola vez aunque Stripe lo envíe dos veces.

**¿Empiezas de cero?** La [plantilla saas-starter](https://github.com/GenPM-net/saas-starter) ya trae login con GitHub, suscripciones con Stripe y email montados con GenPM.
