// Evento `purchase` de servidor (Meta CAPI, TikTok Events, GA4 MP) cuando Stripe confirma el pago, con la
// atribución y el consentimiento guardados al empezar el pago. Mismo eventId (id del pedido) que en el navegador.
import { purchaseEvent } from '@/lib/checkout';
import { onOrderEvent } from '@/lib/orders';
import { takeAttribution, trackServer } from '@/lib/pixels';

export function registerPurchaseTracking(): void {
  onOrderEvent('paid', 'dropshipping.purchase-pixel', async (order) => {
    // @core/checkout guarda en `cartId` el id de la sesión de Stripe (idempotencia del pedido).
    if (!order.cartId) return;
    const a = await takeAttribution(`checkout:${order.cartId}`);
    if (a) await trackServer(purchaseEvent(order), a);
  });
}
registerPurchaseTracking();
