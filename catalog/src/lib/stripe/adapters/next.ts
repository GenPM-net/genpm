// Adaptador Next.js: `app/api/stripe/webhook/route.ts` → `export { stripeWebhookRoute as POST } from '@/lib/stripe/adapters/next';`
import { handleStripeWebhook, WebhookSignatureError } from '../index.js';

export async function stripeWebhookRoute(req: Request): Promise<Response> {
  try {
    return Response.json(await handleStripeWebhook(await req.text(), req.headers.get('stripe-signature')));
  } catch (e) {
    if (e instanceof WebhookSignatureError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
