// Adaptador Hono: `app.route('/api/stripe/webhook', stripeWebhookRoutes())`.
import { Hono } from 'hono';
import { handleStripeWebhook, WebhookSignatureError } from '../index.js';

export function stripeWebhookRoutes() {
  return new Hono().post('/', async (c) => {
    try {
      // Cuerpo en bruto: la firma se calcula sobre los bytes exactos.
      return c.json(await handleStripeWebhook(await c.req.text(), c.req.header('stripe-signature') ?? null));
    } catch (e) {
      if (e instanceof WebhookSignatureError) return c.json({ error: e.message }, 400);
      throw e;
    }
  });
}
