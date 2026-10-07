# `@core/kit-dropshipping` — tienda de dropshipping con landings

> Parte del [catálogo](../README.md) · Fase F5 · Estado: planificación.
> Prompt de aceptación: *"Quiero montar mi tienda de dropshipping con landing para mi producto ganador, con genpm"*.

## 1. Qué obtiene el usuario

Todo `kit-store` + todo `kit-landing`, más lo específico del dropshipping: conectar proveedores, **importar productos**
con su coste y calcular el precio con reglas de margen, **landings de producto único** con botón de compra directa,
**reenvío automático** de pedidos pagados al proveedor, seguimiento sincronizado, y un panel de excepciones para lo que
no puede automatizarse.

## 2. Manifiesto

| Campo | Valor |
|---|---|
| `d` | `src/app/(dropshipping)` |
| `g` | `@core/kit-store`, `@core/kit-landing`, `@core/suppliers`, `@core/pricing` |
| `p` | — |
| `e` | Las del adaptador elegido (`CJ_API_KEY`, `ALIEXPRESS_APP_KEY`, `ALIEXPRESS_APP_SECRET`…) |
| `m` | Stripe (heredado) |

`kit-cms` llega dos veces por el grafo (vía store y vía landing) y se instala **una**: es la prueba de fuego del
principio "kits que contienen kits" (README §2.6).

## 3. Qué contiene

**Admin:**

| Vista | Función |
|---|---|
| Proveedores | Conectar adaptador (`manual`, `cj`, `aliexpress`), probar credenciales, estado de sincronización |
| Importar | Buscar en el proveedor o pegar ID/URL permitido → vista previa con coste, envío, variantes → precio calculado por reglas → importar como borrador |
| Reglas de precio | Simulador de `pricing` (coste → precio → margen) por categoría/proveedor |
| Reenvío de pedidos | Cola: pendientes, enviados al proveedor, con error; modo automático o "aprobar antes de enviar" |
| Excepciones | Sin stock, coste subió, dirección rechazada, seguimiento atascado; cada una con acción sugerida |
| Rentabilidad | Por pedido y producto: precio − coste − envío − comisión Stripe (estimada) − descuentos |

**Público:**

| Ruta | Función |
|---|---|
| `/p/[slug]` | **Landing de producto único**: bloques de `kit-landing` + bloque "comprar ahora" (variantes + checkout directo, sin pasar por carrito) |
| Ficha de producto | Plazo de entrega **real** del proveedor visible antes de comprar |

**Trabajos programados (`jobs`):** sincronizar stock/coste (cada 6 h por defecto), reenviar pedidos (al pagar, con
reintentos), consultar seguimiento (cada 12 h), recalcular precios cuando cambia el coste.

**Eventos de píxeles:** `view_item` en landing, `begin_checkout`, `purchase` en servidor (CAPI/Events API), todo con consentimiento.

## 4. Reglas del `AGENTS.md` (las que más importan en este kit)

- **Transparencia legal (UE/España):** plazo de entrega real, país de envío, gestión de devoluciones (¿al proveedor o
  a la tienda?) y posibles aranceles/IVA de importación visibles **antes** del pago; el vendedor es la tienda, no el proveedor.
- Nada de reseñas falsas ni importadas sin etiquetar; nada de urgencia falsa (ver `kit-landing`).
- Nunca vender con pérdida en silencio: si coste ≥ precio, el producto se pausa y se crea una excepción.
- Nunca scraping ni automatización contra los términos del proveedor: solo APIs oficiales o el adaptador manual.
- Imágenes y textos importados son de terceros: revisar derechos de uso; el agente reescribe descripciones si el usuario lo pide, sin inventar características ni certificaciones.

## 5. Integración

1. Requiere `kit-store` y `kit-landing` integrados (el agente sigue sus `AGENTS.md` primero).
2. Elegir adaptador; empezar por `manual` si no hay credenciales de API.
3. Definir reglas de precio y moneda; importar un producto de prueba.
4. Crear su landing `/p/[slug]` y hacer una compra en modo test: el pedido debe aparecer en "Reenvío" (modo aprobación por defecto).
5. Activar el cron de `jobs` en el hosting.

## 6. Implementación 1.0 (notas)

- Código en `catalog/src/app/(dropshipping)`; líneas `// kit-dropshipping` en `catalog/src/genpm`.
- El test `dropshipping.test.tsx` recorre importar (CSV, adaptador manual) → activar → `/p/[slug]` → compra (Stripe
  simulado) → webhook duplicado = un pedido y un reenvío → aprobación → email al proveedor → seguimiento → email
  "enviado" → rentabilidad.
- Importación desde el panel como acciones de `@core/suppliers` ("Importar CSV", "Importar por id" si el adaptador
  tiene `getProduct`). Vista previa antes de importar: los productos entran como borradores.
- Simulador de reglas de precio y rentabilidad por producto: pendiente para 1.1 (hoy: widget de rentabilidad a 7 días).
- Adaptador CJ: hecho (CAT-DRP-03, `@core/suppliers` 1.2.0). AliExpress: CAT-DRP-05, pendiente de que se apruebe la app (CAT-DRP-04).

## 7. Aceptación específica

- Recorrido completo con proveedor simulado: importar → landing → compra test → pedido reenviado una sola vez →
  seguimiento recibido → email "enviado" al cliente.
- Subida de coste del 30 % ⇒ precio recalculado según reglas o pausa + excepción si deja margen negativo.
- Sin credenciales: el adaptador `manual` permite operar toda la tienda (CSV de importación y exportación de pedidos).
- Prueba de agente desde `create-next-app` vacío con el prompt de arriba en < 45 min (es el kit más grande).
