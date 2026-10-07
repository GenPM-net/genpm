# Capa 2 · Marketing

> Parte del [catálogo](README.md). SEO, formularios, newsletter, bloques de página, píxeles de conversión y tests A/B.
> Estado: planificación.

---

## `@core/seo` — metadatos, sitemap y datos estructurados

**Para qué.** Todo lo que un buscador (y un LLM que rastrea) necesita: metadatos por página con valores por defecto
del sitio, canónicas, `hreflang`, Open Graph/Twitter, **sitemap.xml** (índice + trozos de 50 000 URLs) a partir de
cualquier `SitemapSource`, `robots.txt`, `llms.txt`, **JSON-LD** (Organization, WebSite+SearchAction, BreadcrumbList,
BlogPosting, Product+Offer+AggregateRating, FAQPage) e imágenes OG generadas.
**No incluye.** Auditorías SEO ni contenido.

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/seo` | `@core/contracts ^1`, `@core/site ^1` | `zod` | `SITE_URL`, `SEO_NOINDEX` (staging) | — |

La generación de imágenes OG (satori) queda fuera de la 1.0: se usa la imagen social de los ajustes o de cada entrada.

**API.** `buildMetadata(page)` (devuelve `Metadata` de Next), `<JsonLd data>`, constructores `jsonLd.product(...)`, etc.,
`sitemapHandler()`, `robotsHandler({disallow})`, `llmsTxtHandler()`, `ogImage({title, image})`, campos SEO reutilizables
(`seoFields`) que cualquier colección añade a su esquema. Registro de fuentes en `src/genpm/seo.ts`.
**Reglas IA.** No duplicar `<title>`/`description` en páginas: siempre vía `buildMetadata`; `noindex` en vistas previas y búsquedas internas.
**Aceptación.** Sitemap válido contra XSD; JSON-LD válido (validador de schema.org en CI); `hreflang` recíprocos.

---

## `@core/forms` — formularios y captación de leads

**Para qué.** Formularios definidos con zod (en código **o** desde el admin con un constructor visual de campos),
envíos guardados, notificación por email al equipo y respuesta automática al usuario, casilla de consentimiento RGPD
con texto versionado, exportación CSV y webhook saliente opcional (CRM, Zapier/Make).
**No incluye.** Encuestas con lógica condicional compleja; pagos en formularios.

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/forms` | `@core/db ^1`, `@core/email ^1`, `@core/antispam ^1`, `@core/content ^1`, `@core/jobs ^1`, `@core/contracts ^1` | `zod` | `FORMS_NOTIFY_TO`, `FORMS_WEBHOOK_SECRET` (opc.) | — |

**Tablas.** `form_submissions` (id, formKey, data jsonb, consentVersion, sourceUrl, utm jsonb, createdAt, status).
Las definiciones editables desde el admin son una colección de `content`.
**API.** `defineForm(key, schema, {notify, autoReply, webhook})`, `submitForm` (acción de servidor / handler Hono),
`<Form formKey>`, `onSubmission(formKey, handler)` (lo usan `newsletter` y kits), `AdminResource` "Envíos".
**Seguridad.** Antispam obligatorio; webhook firmado con HMAC; nada de HTML del usuario en los emails (escape).
**Aceptación.** Envío válido ⇒ fila + 2 emails; inválido ⇒ errores por campo; webhook con firma verificable; UTM capturados.

---

## `@core/newsletter` — suscriptores y envíos

**Para qué.** Altas con **doble opt-in**, bajas en un clic (cabeceras `List-Unsubscribe` y `List-Unsubscribe-Post`,
RFC 8058, exigidas por Gmail/Yahoo para envíos masivos), etiquetas/segmentos, campañas redactadas con `rich-text`,
envío por lotes con `jobs` y el proveedor de `@core/email`, y estadísticas básicas (enviados, rebotes, bajas).
**No incluye.** Automatizaciones complejas tipo "journey" ni tracking de aperturas por píxel (privacidad; opcional en F6).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/newsletter` | `@core/db ^1`, `@core/email ^1`, `@core/jobs ^1`, `@core/antispam ^1`, `@core/rich-text ^1`, `@core/contracts ^1` | `zod` | `NEWSLETTER_FROM`, `NEWSLETTER_POSTAL_ADDRESS`, `NEWSLETTER_SECRET`, `SITE_URL`, `RESEND_API_KEY` (producción) | — |

**Tablas.** `subscribers` (email normalizado, status `pending|active|unsubscribed|bounced|complained`, tags, consentimiento y fechas,
source), `newsletter_campaigns`, `newsletter_sends` (un envío por suscriptor y campaña: lotes reanudables). Las cabeceras RFC 8058
requieren un proveedor que acepte cabeceras propias: el paquete llama a la API de Resend directamente (`NewsletterSender` para otros).
**API.** `subscribe(email, {tags, source})`, `confirm(token)`, `unsubscribe(token)`, `sendCampaign(id)`,
`<SubscribeForm>`, webhook de rebotes del proveedor, `AdminResource` "Suscriptores" y "Campañas".
**Reglas IA.** Nunca importar listas sin consentimiento demostrable; todo envío lleva enlace de baja y dirección postal.
**Aceptación.** Alta sin confirmar no recibe campañas; baja de un clic con POST; envío de 10 000 en lotes reanudables.

---

## `@core/blocks` — bloques de página (page builder)

**Para qué.** Biblioteca de **secciones** combinables desde el admin: hero, características, beneficios, testimonios,
logos, precios, FAQ (con JSON-LD), CTA, galería, vídeo, contador/estadísticas, comparativa, garantía, texto enriquecido,
formulario (`forms`), y huecos para bloques de otros dominios (grid de productos, "comprar ahora", últimos posts) que
registran sus paquetes/kits. Cada bloque = esquema zod + componente React + vista previa.
**No incluye.** Editor visual WYSIWYG libre (arrastrar píxeles): son bloques con campos, más robusto y accesible.

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/blocks` | `@core/rich-text ^1`, `@core/media ^1`, `@core/ui ^1`, `@core/admin ^1`, `@core/contracts ^1`, `@core/db ^1` | `react`, `zod` | — | — |

Implementación 1.0: los bloques se guardan como JSON en un campo de `content` (`registry.schema`), por eso no depende de `content`;
el editor usa el tipo de campo `list` del admin (lista ordenable de objetos) para preguntas, planes, testimonios, etc.

**API.** `defineBlock(type, {schema, Component, icon, preview})`, tipo de campo `blocks` para `admin` (lista ordenable
con añadir/duplicar/ocultar), `<RenderBlocks blocks />`, registro de bloques extra en `src/genpm/blocks.ts`.
**Reglas IA.** Un bloque nuevo = archivo nuevo registrado; no meter condicionales por tipo en `RenderBlocks`.
**Accesibilidad.** Cada bloque pasa axe-core; jerarquía de encabezados configurable (un solo `h1` por página).
**Aceptación.** Página con los 15 bloques renderiza sin errores de hidratación; bloque desconocido se ignora con aviso en dev.

---

## `@core/pixels` — medición de conversiones con consentimiento

**Para qué.** Un único punto para enviar eventos de negocio (`CommerceEvent` y `lead`) a **GA4**, **Meta Pixel +
Conversions API** y **TikTok Pixel + Events API**: en navegador solo con consentimiento de marketing/analítica, y en
servidor para compras con deduplicación por `eventId`. Captura de UTM y `fbclid`/`ttclid` en primera parte.
**No incluye.** Dashboard de analítica (se usa el de cada plataforma); otros píxeles (adaptadores registrables).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/pixels` | `@core/consent ^1`, `@core/antispam ^1`, `@core/contracts ^1`, `@core/money ^1`, `@core/db ^1` | `react` | `GA4_MEASUREMENT_ID`, `GA4_API_SECRET`, `META_PIXEL_ID`, `META_CAPI_TOKEN`, `TIKTOK_PIXEL_ID`, `TIKTOK_EVENTS_TOKEN` (todas opcionales) | — |

**API.** `track(event)` (cliente), `trackServer(event, request)`, `<PixelsScripts />` (dentro de `ConsentGate`),
`registerPixelAdapter()`. Solo se activan las plataformas con variables configuradas.
**Reglas IA.** Nunca enviar email/teléfono sin hash SHA-256 normalizado ni sin consentimiento; nunca inventar eventos.
**Seguridad/privacidad.** Tokens solo en servidor; lista de datos enviados documentada para la política de privacidad.
**Aceptación.** Sin consentimiento: 0 peticiones a terceros (Playwright); compra con mismo `eventId` en navegador y servidor.

---

## `@core/experiments` — tests A/B (fase F6)

**Para qué.** Variantes de una página o bloque con asignación estable por visitante (cookie de primera parte, solo con
consentimiento de analítica; sin él se muestra la variante de control), objetivo de conversión (`lead`, `purchase`),
reparto de tráfico y resultado con intervalo de confianza.
**No incluye.** Feature flags de producto (otro problema) ni tests multivariante.

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/experiments` | `@core/db ^1`, `@core/consent ^1`, `@core/contracts ^1` | — | — | — |

**Tablas.** `experiments`, `experiment_exposures` (agregado diario, no por visitante), `experiment_conversions`.
**API.** `getVariant(experimentKey, request)`, `recordConversion(goal)`, `<Experiment>`, `AdminResource` "Experimentos".
**Aceptación.** Asignación estable entre visitas; sin consentimiento siempre control; cálculo estadístico con tests de referencia.

Implementación 1.0: en lugar de agregados diarios se guarda un participante por experimento con un seudónimo (HMAC del
id de consentimiento, sin cookie propia) para no contar dos veces la misma persona; se borran 30 días después de parar
y los resultados quedan congelados en el experimento. `e`: `EXPERIMENTS_SECRET`. En `kit-landing`: campo `experiment` y
bloques `blocksB` por landing, conversión `lead` al enviar el formulario.
