// Un único endpoint de webhooks para toda la app: verifica la firma, registra el evento (idempotencia) y lo reparte
// a los manejadores de cada módulo (billing, checkout…) dentro de la misma transacción.
import type Stripe from 'stripe';
import { type Executor, withTransaction } from '../db/index.ts';
import { getStripe } from './client.ts';
import { stripeEvents } from './schema.ts';

export type StripeEventHandler = (event: Stripe.Event, tx: Executor) => Promise<void>;

const handlers = new Map<string, StripeEventHandler[]>();

/**
 * Registra un manejador para uno o varios tipos de evento (`checkout.session.completed`…). Debe ser idempotente y usar
 * `tx` para escribir: si lanza, se deshace todo y Stripe reintenta.
 */
export function onStripeEvent(types: Stripe.Event.Type | Stripe.Event.Type[], handler: StripeEventHandler): void {
  for (const t of [types].flat()) handlers.set(t, [...(handlers.get(t) ?? []), handler]);
}

/** Solo tests. */
export const clearStripeHandlers = () => handlers.clear();

export class WebhookSignatureError extends Error {}

export type WebhookResult = { received: true; duplicate: boolean; type: string; handled: number };

export async function handleStripeWebhook(rawBody: string, signature: string | null): Promise<WebhookResult> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  if (!signature) throw new WebhookSignatureError('missing stripe-signature header');
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(rawBody, signature, secret);
  } catch {
    throw new WebhookSignatureError('invalid signature');
  }
  return withTransaction(async (tx) => {
    const inserted = await tx.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning({ id: stripeEvents.id });
    if (inserted.length === 0) return { received: true, duplicate: true, type: event.type, handled: 0 };
    const list = handlers.get(event.type) ?? [];
    for (const h of list) await h(event, tx);
    return { received: true, duplicate: false, type: event.type, handled: list.length };
  });
}
