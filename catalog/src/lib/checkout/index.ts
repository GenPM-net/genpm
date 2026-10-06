// @core/checkout — API pública. Al importarlo registra los webhooks de Stripe y la pasarela de reembolsos.
export {
  alertJob,
  beginCheckoutEvent,
  CheckoutError,
  finalizeSession,
  getCheckoutStatus,
  purchaseEvent,
  registerCheckout,
  type StartCheckoutInput,
  startCheckout,
  stripePaymentProvider,
} from './checkout.js';
export { type CheckoutSession, checkoutSessions } from './schema.js';
