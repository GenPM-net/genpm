// Importar estos paquetes registra sus pasos y webhooks (checkout en Stripe, envío y descuentos en el
// carrito, emails del pedido, solicitudes de reseña tras la entrega).
import '@/lib/checkout'; // kit-store
import '@/lib/discounts'; // kit-store
import '@/lib/orders'; // kit-store
import '@/lib/reviews'; // kit-store
import '@/lib/shipping'; // kit-store
import '@/app/(store)/_lib/maintenance'; // kit-store: carritos caducados (store.maintenance)
import '@/lib/pricing'; // kit-dropshipping
import '@/lib/suppliers'; // kit-dropshipping: adaptador manual y reenvío de pedidos pagados
import '@/app/(dropshipping)/_lib/purchase'; // kit-dropshipping: evento purchase de servidor
