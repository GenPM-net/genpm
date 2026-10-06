# Capa 2 · Comercio y dropshipping

> Parte del [catálogo](README.md). Catálogo, carrito, pedidos, envíos, checkout, descuentos, reseñas, precios y proveedores.
> Todo en Postgres con transacciones. Estado: planificación.

Flujo de un pedido y quién es dueño de cada paso:

```
catalog ──► cart ──(totales: discounts, shipping)──► checkout ──(Stripe webhook)──► orders ──► suppliers (dropshipping)
                                                                    │                  │
                                                              PaymentProvider     email / pixels / jobs
```

---

## `@core/catalog` — productos

**Para qué.** Productos físicos y digitales con **variantes** (talla, color…) y opciones, categorías y colecciones
(manuales o por reglas), imágenes de `media`, descripción con `rich-text`/`blocks`, campos SEO, estado
(`draft|active|archived`), inventario simple por variante (stock, "seguir vendiendo sin stock", umbral bajo) y
atributos libres.
**No incluye.** Multi-almacén, lotes, B2B con listas de precios por cliente (extensiones futuras).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/catalog` | `@core/db ^1`, `@core/money ^1`, `@core/rich-text ^1`, `@core/contracts ^1` (imágenes por id de `media`) | `zod` | `STORE_CURRENCY` | — |

**Tablas.** `products`, `product_variants` (sku, price, compareAtPrice, cost, currency, stock, weight, options jsonb),
`product_options`, `product_media`, `categories`, `product_categories`, `collections`.
**API.** `getProduct(slug)`, `listProducts({category, collection, sort, filters, page})`, `reserveStock(variantId, qty, tx)`,
`releaseStock`, implementa `SitemapSource`/`SearchSource`, `catalogResources` para `admin` (con vista de variantes en tabla).
**Reglas IA.** El precio que vale es siempre el de BD en el servidor; nunca el que llega del cliente.
**Aceptación.** Reserva concurrente de la última unidad: solo una gana (`FOR UPDATE`); variante sin stock no comprable.

---

## `@core/cart` — carrito

**Para qué.** Carrito de invitado (cookie firmada) y de usuario, fusión al iniciar sesión, líneas con precio
**recalculado siempre en servidor**, y una **tubería de totales** extensible (subtotal → descuentos → envío → impuestos
→ total) donde otros paquetes registran pasos.
**No incluye.** Pagos ni creación de pedidos.

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/cart` | `@core/db ^1`, `@core/auth ^1`, `@core/catalog ^1`, `@core/money ^1`, `@core/contracts ^1` | `zod` | `CART_COOKIE_SECRET` | — |

**Tablas.** `carts` (id, userId, currency, expiresAt), `cart_lines` (cartId, variantId, qty).
**API.** `getCart(request)`, `addLine`, `updateQty`, `removeLine`, `mergeCarts`, `computeTotals(cart)`,
`registerTotalsStep(name, fn, {after})`, `<CartProvider>`, `useCart()`, emite `add_to_cart`.
**Aceptación.** Manipular precio en la petición no cambia el total; fusión invitado→usuario suma cantidades; carritos caducados se limpian (`jobs`).

---

## `@core/orders` — pedidos y clientes

**Para qué.** Pedidos con líneas **congeladas** (snapshot de nombre, precio, impuestos), dos estados independientes:
pago (`pending → paid → partially_refunded/refunded`, o `cancelled`) y envío (`unfulfilled → partial → fulfilled → delivered`), clientes
(usuario o invitado por email), direcciones, envíos parciales (`fulfillments` con seguimiento), reembolsos vía
`PaymentProvider`, notas internas, emails transaccionales (confirmación, enviado, reembolso) y acceso del invitado a su
pedido con enlace firmado.
**No incluye.** Cobro (lo hace `checkout`), facturas fiscales con numeración legal (paquete `@core/invoices` en F6, ver C6).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/orders` | `@core/db ^1`, `@core/auth ^1`, `@core/catalog ^1`, `@core/email ^1`, `@core/jobs ^1`, `@core/money ^1`, `@core/contracts ^1` | `zod` | `ORDER_LINK_SECRET`, `ORDER_NUMBER_PREFIX` (opc.), `SITE_URL` | — |

**Tablas.** `orders` (number legible secuencial, status, email, userId, currency, totales, addresses jsonb, paymentRef,
placedAt), `order_lines`, `fulfillments`, `refunds`, `order_events` (historial).
**API.** `createOrderFromCart(cart, payment, tx)`, `transition(order, to)`, `addFulfillment`, `refund(order, amount)`,
eventos `onOrderPaid`, `onOrderShipped`, `onOrderCancelled`, `ordersResources` para `admin`.
**Reglas IA.** Estados solo vía `transition()` (valida la máquina); nunca borrar pedidos: cancelar.
**Seguridad.** IDOR: un pedido solo se ve con sesión del dueño o enlace firmado; número de pedido ≠ ID interno.
**Aceptación.** Transición ilegal lanza error; reembolso parcial cambia estado y total; email de confirmación una sola vez.

---

## `@core/shipping` — envíos

**Para qué.** Zonas (países/regiones), tarifas (fija, gratis a partir de X, por peso, por precio), estimación de entrega
(días mín./máx., también para dropshipping), y seguimiento: número + transportista con URL de seguimiento (plantillas
de Correos, SEUR, GLS, DHL, UPS, FedEx, USPS, Royal Mail y 17TRACK como genérico). Consulta automática del estado vía API de
agregadores: fase posterior.
**No incluye.** Compra de etiquetas de envío (adaptadores Shippo/EasyPost en F6).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/shipping` | `@core/db ^1`, `@core/cart ^1`, `@core/money ^1`, `@core/contracts ^1` | `zod` | — | — |

**Tablas.** `shipping_zones`, `shipping_rates`.
**API.** `ratesFor(cart, address)`, paso de totales `shipping` en `cart`, `trackingUrl(carrier, number)`, `shippingResources`.
**Aceptación.** País sin zona ⇒ no se puede pagar (mensaje claro); gratis desde X aplica tras descuentos.

---

## `@core/checkout` — pago con Stripe

**Para qué.** Del carrito al pago: validación final (stock, precios, dirección, envío), sesión de **Stripe Checkout**
con una instantánea de los totales (tabla `checkout_sessions`), Stripe Tax opcional, y en el webhook `checkout.session.completed` la creación
**idempotente** del pedido desde esa instantánea + reserva definitiva de stock en una transacción (Payment Element embebido: fase posterior). Implementa `PaymentProvider` para
reembolsos. Página de éxito que no confía en la URL (consulta el estado real).
**No incluye.** Otras pasarelas (PayPal, Mercado Pago, Redsys: adaptadores futuros del mismo contrato).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/checkout` | `@core/cart ^1`, `@core/orders ^1`, `@core/shipping ^1`, `@core/stripe ^1`, `@core/catalog ^1`, `@core/email ^1`, `@core/jobs ^1`, `@core/money ^1` | `zod`, `stripe` | `SITE_URL`, `STRIPE_TAX` (opc.), `CHECKOUT_ALERT_TO` (opc.) | (hereda Stripe de `@core/stripe`) |

**API.** `startCheckout(cart, {email, locale})`, handler del webhook registrado en `onStripeEvent`, `getCheckoutStatus(sessionId)`, emite `begin_checkout` y `purchase` (servidor).
**Reglas IA.** El pedido **solo** nace en el webhook, nunca en la redirección de éxito; los importes se envían a Stripe desde el carrito recalculado.
**Seguridad.** Sin datos de tarjeta en el servidor; webhook firmado; carrera "stock agotado tras pagar" ⇒ reembolso automático + email.
**Aceptación.** Webhook repetido ⇒ un pedido; sesión caducada libera el stock; prueba con Stripe CLI (`stripe trigger`) en CI.

---

## `@core/discounts` — cupones y descuentos

**Para qué.** Códigos de cupón y descuentos automáticos: porcentaje, importe fijo, envío gratis ("compra X lleva Y" en 1.1);
condiciones (mínimo de compra, productos/categorías, primer pedido, clientes concretos), límites de uso total y por
cliente, fechas de validez. Se aplica como paso de la tubería de totales de `cart` y se registra en el pedido.
**No incluye.** Programas de puntos/fidelización, tarjetas regalo (paquetes futuros).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/discounts` | `@core/db ^1`, `@core/cart ^1`, `@core/catalog ^1`, `@core/orders ^1`, `@core/money ^1` | `zod` | — | — |

**Tablas.** `discounts`, `discount_redemptions`.
**API.** `applyCode(cart, code)`, paso de totales `discounts`, `discountsResources`.
**Reglas IA (legal UE).** Un precio tachado o "rebaja" debe referirse al **precio más bajo de los últimos 30 días**
(Directiva Ómnibus 2019/2161); `discounts` lo consulta en `pricing`/historial de precios antes de mostrar "antes X".
**Aceptación.** Límite por cliente respetado en concurrencia; descuento repartido entre líneas sin perder céntimos (`allocate`).

---

## `@core/reviews` — reseñas de producto

**Para qué.** Reseñas = `comments` con `rating` sobre `entityType = 'product'`, más: marca de **compra verificada**
(cruce con `orders`), fotos (`media`), solicitud de reseña por email N días tras la entrega (`jobs`), media y
distribución por producto, JSON-LD `AggregateRating`, y reseñas **importadas** etiquetadas como tales.
**No incluye.** Sistema de comentarios propio (reutiliza `comments`).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/reviews` | `@core/comments ^1`, `@core/orders ^1`, `@core/catalog ^1`, `@core/jobs ^1` | — | — | — |

**Tablas.** `review_stats` (productId, count, avg, histogram) — materializada; las reseñas viven en `comments`.
**API.** `<ProductReviews productId>`, `requestReview(order)`, `productRating(productId)`, `importReviews(productId, rows, {source})`.
**Reglas IA (legal UE).** Indicar si y cómo se verifica que las reseñas proceden de compradores (Ómnibus); nunca
generar reseñas falsas ni ocultar las negativas por defecto; las importadas muestran su origen.
**Aceptación.** Solo compradores con pedido entregado obtienen "verificada"; media recalculada al moderar.

---

## `@core/pricing` — reglas de precio y margen

**Para qué.** Calcular precios de venta a partir del **coste** (clave en dropshipping): margen porcentual o fijo, por
tramos de coste, por categoría o proveedor, redondeo psicológico, precio "antes" (compare-at) honesto, conversión de
moneda del proveedor a la de la tienda, y **historial de precios** (necesario para la regla de 30 días de Ómnibus).
**No incluye.** Precios dinámicos por demanda.

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/pricing` | `@core/db ^1`, `@core/catalog ^1`, `@core/money ^1` | — | — | — |

**Tablas.** `price_rules` (ámbito, prioridad, fórmula), `price_history` (variantId, price, from, to).
**API.** `priceFromCost(cost, ctx)`, `applyRules(product)`, `lowestPrice30d(variantId)`, `pricingResources`, simulador en admin ("con estas reglas, este producto costaría…").
**Aceptación.** Cambio de coste del proveedor recalcula precio y deja historial; margen mínimo nunca negativo (alerta).

---

## `@core/suppliers` — proveedores de dropshipping

**Para qué.** Interfaz `SupplierProvider` y adaptadores para: buscar productos del proveedor, **importarlos** al
catálogo (variantes, imágenes, coste, tiempo de envío) con precio calculado por `pricing`, **sincronizar** stock y coste
periódicamente (`jobs`), **reenviar pedidos** pagados al proveedor (`onOrderPaid`), y traer el **seguimiento** a
`fulfillments`. Cola de excepciones (sin stock, dirección rechazada, coste subió más de X %) para revisión humana.
**No incluye.** Gestión de almacén propio.

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/suppliers` | `@core/catalog ^1`, `@core/orders ^1`, `@core/pricing ^1`, `@core/jobs ^1` | — | Por adaptador: `CJ_API_KEY`; `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET` | — |

**Adaptadores (orden propuesto, C5):**

| Adaptador | Cómo | Notas |
|---|---|---|
| `manual` | Importación por CSV, pedidos al proveedor por email/CSV, seguimiento introducido a mano | Funciona con cualquier proveedor desde el día 1 |
| `cj` | API de CJdropshipping | Verificar endpoints, límites y términos vigentes antes de implementar |
| `aliexpress` | API oficial de AliExpress Open Platform (dropshipping) | Requiere alta y aprobación de la app; prohibido el scraping |
| Futuros | Spocket, Zendrop, BigBuy (UE), proveedores locales | Mismo contrato |

**Tablas.** `suppliers` (adaptador, credencialRef, estado), `supplier_products` (variantId ↔ SKU del proveedor, coste,
envío estimado, lastSyncAt), `supplier_orders` (orderId, proveedor, estado, ref externa, error), `supplier_exceptions`.
**API.** `registerSupplier(adapter)`, `searchSupplier(q)`, `importProduct(supplierId, externalId)`, `syncAll()`,
`forwardOrder(order)`, `pollTracking()`, `suppliersResources` + vista "Excepciones".
**Reglas IA.** Nunca hacer scraping de webs de proveedores ni saltarse sus términos; nunca reenviar un pedido sin pago
confirmado; ante coste mayor que el precio de venta, parar y crear excepción (no vender con pérdida en silencio).
**Seguridad.** Importación por URL solo a hosts del adaptador (anti-SSRF); credenciales solo en env; descripciones e
imágenes importadas se sanean (contenido de terceros) y las imágenes se copian a `storage`, no se enlazan en caliente.
**Aceptación.** Pedido pagado ⇒ `supplier_order` creado una sola vez (idempotente); fallo del proveedor ⇒ reintento y
luego excepción; sincronización que deja precio < coste ⇒ producto pausado + alerta. Adaptadores probados con
servidores simulados (sin llamadas reales en CI).
