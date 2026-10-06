# `@core/kit-store` — tienda online

> Parte del [catálogo](../README.md) · Fase F4 · Estado: planificación.
> Prompt de aceptación: *"Monta una tienda online con pagos en mi web con genpm"*.

## 1. Qué obtiene el usuario

Una tienda completa sobre el mismo `/admin`: productos con variantes, categorías y colecciones, carrito, checkout con
Stripe, pedidos y envíos, cupones, reseñas verificadas, área de cliente, emails transaccionales, SEO de producto y
páginas legales de comercio electrónico preparadas para revisar.

## 2. Manifiesto

| Campo | Valor |
|---|---|
| `d` | `src/app/(store)` |
| `g` | `@core/kit-cms`, `@core/catalog`, `@core/cart`, `@core/checkout`, `@core/orders`, `@core/shipping`, `@core/discounts`, `@core/reviews` (8; `money`, `stripe`, `comments` transitivos) |
| `p` | — |
| `e` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `CART_COOKIE_SECRET`, `ORDER_LINK_SECRET`, `CHECKOUT_SUCCESS_URL`, `CHECKOUT_CANCEL_URL` |
| `m` | Stripe (heredado de `@core/stripe`, con consentimiento) |

Reutiliza sin repetir: todo el CMS, `comments` (reseñas), `jobs` (carritos caducados, solicitudes de reseña), `email`, `seo`, `search`.

## 3. Qué contiene

**Tienda pública:**

| Ruta | Función |
|---|---|
| `/shop` | Listado con filtros (categoría, precio, atributos) y orden |
| `/products/[slug]` | Ficha: galería, selector de variantes, precio (y "antes" solo si cumple Ómnibus), stock, envío estimado, descripción con bloques, reseñas, relacionados, JSON-LD `Product` |
| `/collections/[slug]`, `/categories/[slug]` | Listados |
| `/cart` | Carrito con cupón y estimación de envío; mini-carrito en cabecera |
| `/checkout` | Redirección a Stripe Checkout (o página con Payment Element) |
| `/checkout/success`, `/checkout/cancel` | Resultado consultando el estado real |
| `/orders/[number]` | Pedido de invitado con enlace firmado |
| `/account`, `/account/orders`, `/account/addresses` | Área de cliente (`auth`) |
| `/api/stripe/webhook` | Webhook de `@core/stripe` |

**Admin:** productos (con variantes), categorías, colecciones, pedidos (vista personalizada con línea de tiempo,
reembolso, marcar enviado con seguimiento), clientes, envíos, descuentos, reseñas; widgets de ventas hoy/7 días, pedidos
pendientes de enviar, stock bajo.

**Emails:** confirmación, enviado (con seguimiento), reembolso, carrito abandonado (solo con consentimiento de
marketing), solicitud de reseña. Plantillas en `@core/email`, textos editables como singletons.

**Páginas legales (plantillas marcadas "revisar con un profesional"):** términos de venta, envíos, devoluciones y
**derecho de desistimiento de 14 días** (UE), privacidad, cookies; formulario de desistimiento. El agente nunca las da
por válidas: deja aviso en el dashboard hasta que el usuario las marque como revisadas.

## 4. Integración (resumen del `AGENTS.md`)

1. Requiere `kit-cms`.
2. Configurar Stripe (con el MCP de Stripe, si el usuario consiente, el agente consulta productos/precios reales y la cuenta en modo test).
3. Migraciones de comercio; registrar recursos, fuentes de sitemap/búsqueda y bloques "grid de productos"/"comprar ahora".
4. Configurar zonas de envío y moneda de la tienda.
5. Verificar en modo test: compra con tarjeta de prueba, webhook recibido, pedido creado, email enviado, stock descontado.

## 5. Aceptación específica

- Compra completa en modo test con `stripe listen` en CI (e2e Playwright).
- Manipular precio, cantidad o descuento desde el cliente no altera el importe cobrado.
- Webhook duplicado ⇒ un pedido; última unidad comprada a la vez por dos clientes ⇒ uno recibe reembolso automático.
- Pedido de invitado inaccesible sin enlace firmado.
- Lighthouse ≥ 90 en ficha de producto móvil.
