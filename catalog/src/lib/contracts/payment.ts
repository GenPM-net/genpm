// Pasarela de pago vista desde los pedidos: la implementa @core/checkout (Stripe); la consume @core/orders para
// reembolsos sin depender de Stripe.
import type { Money } from './money.ts';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded' | 'partially_refunded';

export type PaymentProvider = {
  /** `stripe`, `paypal`… Se guarda en el pedido junto a la referencia. */
  name: string;
  getPayment(paymentRef: string): Promise<{ status: PaymentStatus; amount: Money } | null>;
  /** Reembolsa `amount` (≤ lo cobrado). Debe ser idempotente por `idempotencyKey`. */
  refund(
    paymentRef: string,
    amount: Money,
    opts: { idempotencyKey: string; reason?: string },
  ): Promise<{ refundRef: string }>;
};
