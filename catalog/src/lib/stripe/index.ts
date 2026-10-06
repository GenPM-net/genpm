// @core/stripe — API pública. Importa desde aquí; ruta del webhook en adapters/hono.ts y adapters/next.ts.
export { getStripe, Stripe, setStripe } from './client.js';
export { stripeEvents } from './schema.js';
export {
  clearStripeHandlers,
  handleStripeWebhook,
  onStripeEvent,
  type StripeEventHandler,
  type WebhookResult,
  WebhookSignatureError,
} from './webhooks.js';
