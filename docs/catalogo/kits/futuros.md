# Kits futuros (F6+)

> Parte del [catálogo](../README.md). Ideas priorizables por demanda (búsquedas sin resultados del panel de analítica,
> V011-10). Cada fila muestra que un kit nuevo es **sobre todo reutilización**: lo nuevo suele ser 1–2 paquetes.

| Kit | Para quién | Reutiliza | Paquetes nuevos |
|---|---|---|---|
| `kit-membership` (cursos / contenido de pago) | Creadores, formadores | `kit-blog`, `billing`, `rbac`, `content`, `newsletter` | `courses` (lecciones, progreso, certificados), `drip` (liberación programada) |
| `kit-booking` (reservas y citas) | Peluquerías, clínicas, consultores | `kit-cms`, `checkout`, `orders`, `email`, `jobs` | `availability` (horarios, festivos, zonas horarias), `bookings` |
| `kit-directory` (directorio / marketplace de anuncios) | Nichos locales | `kit-cms`, `search`, `forms`, `reviews`, `billing` (anuncios destacados) | `listings`, `geo` (mapas, distancia con PostGIS) |
| `kit-docs` (documentación técnica) | Proyectos open source, SaaS | `content`, `search`, `seo`, `rich-text` | `docs-nav` (versiones, barra lateral), MDX opcional |
| `kit-portfolio` | Freelancers, agencias | `kit-cms`, `blocks`, `forms` | — (solo plantilla + colección `projects`) |
| `kit-events` (eventos y entradas) | Organizadores | `kit-store` (entradas = producto digital), `orders`, `email` | `tickets` (QR, check-in) |
| `kit-restaurant` (carta y pedidos para recoger) | Hostelería | `kit-store`, `blocks`, `site` | `menu` (alérgenos UE obligatorios), `pickup-slots` |
| `kit-saas` | Fundadores SaaS | Semillas `db`, `auth`, `billing`, `email`, `ai` + `kit-landing` + `kit-blog` | `teams` (multi-tenant con invitaciones) |
| Kits Astro (`kit-*-astro`) | Sitios de contenido estáticos/híbridos | Todas las capas 1–2 sin cambios | Solo rutas y componentes Astro |

**Adaptadores previstos** (mismo contrato, sin kit nuevo): pasarelas PayPal/Mercado Pago/Redsys para `checkout`;
etiquetas de envío Shippo/EasyPost para `shipping`; Meilisearch/Typesense para `search`; Payload y Keystatic para
`content`; más proveedores para `suppliers` (Spocket, Zendrop, BigBuy).

**Criterio para aceptar un kit nuevo:** ≥ 70 % de sus piezas ya existen; si no, primero se planifican las piezas de
capa 2 que falten como paquetes reutilizables.
