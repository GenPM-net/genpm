// Webhook de Stripe: pedidos, reembolsos y suscripciones (@core/stripe). Importa @/genpm para registrar los handlers.
import '@/genpm';

export { stripeWebhookRoute as POST } from '@/lib/stripe/adapters/next';
export const dynamic = 'force-dynamic';
