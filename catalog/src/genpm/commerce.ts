// kit-store: importar estos paquetes registra sus pasos y webhooks (checkout en Stripe, envío y descuentos en el
// carrito, emails del pedido, solicitudes de reseña tras la entrega).
import '@/lib/checkout';
import '@/lib/discounts';
import '@/lib/orders';
import '@/lib/reviews';
import '@/lib/shipping';
import '@/lib/pricing'; // kit-dropshipping
import '@/lib/suppliers'; // kit-dropshipping: adaptador manual y reenvío de pedidos pagados
import '@/app/(dropshipping)/_lib/purchase'; // kit-dropshipping: evento purchase de servidor
