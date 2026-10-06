# Capa 1 · Paquetes transversales

> Parte del [catálogo](README.md). Infraestructura sin dominio de negocio: la usan varios paquetes de capa 2 y todos los kits.
> Formato de cada ficha: [README §7](README.md#7-formato-de-cada-ficha). Estado: planificación.

---

## `@core/contracts` — tipos compartidos entre piezas

**Para qué.** Solo tipos TypeScript y esquemas zod pequeños que permiten a un paquete consumir "algo que cumple un
contrato" sin depender del paquete concreto. Es la pieza que evita los imports cruzados (principio 3).
**No incluye.** Implementaciones, tablas ni dependencias en tiempo de ejecución (salvo `zod`).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/contracts` | — | `zod` | — | — |

**Contratos (v1):**

| Contrato | Forma | Lo implementan | Lo consumen |
|---|---|---|---|
| `ContentSource` | `get(collection, slugOrId, {locale, draft})`, `list(collection, query)` | `content`, adaptador Payload | `blog`, `blocks`, `site`, kits |
| `SitemapSource` | `async *urls(): {loc, lastmod, alternates}` | `content`, `blog`, `catalog` | `seo` |
| `SearchSource` | `async *documents(): {id, type, url, title, body, locale}` + `onChange` | `content`, `blog`, `catalog` | `search` |
| `AdminResource` | `{name, label, icon, group, input (zod), fields (meta UI), title, list, get, create, update, delete, actions}` (acciones: publicar, programar, reembolsar…) | `content`, `media`, `catalog`, `orders`, `forms`, … | `admin` |
| `PaymentProvider` | `refund(paymentId, amount)`, `getPayment(id)` | `checkout` (Stripe) | `orders` |
| `CommerceEvent` | Unión `view_item \| add_to_cart \| begin_checkout \| purchase` con `eventId` | `cart`, `checkout`, kits | `pixels`, `experiments` |
| `Money` | `{amount: number /* entero, unidades menores */, currency: string}` | `money` | comercio |

**Reglas IA.** No añadir lógica aquí; un contrato nuevo exige ADR. Cambios incompatibles = versión mayor de todo el tren.
**Aceptación.** Tests de tipos (`expectTypeOf`) por contrato; tamaño ≤ 10 KB inyectados.

---

## `@core/rbac` — roles y permisos

**Para qué.** Autorización sobre los usuarios de `@core/auth` (que deliberadamente no tiene roles).
**No incluye.** Autenticación, SSO, multi-tenant (un sitio = una organización; multi-tenant sería otro paquete).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/rbac` | `@core/db ^1`, `@core/auth ^1` | — | — | — |

**Tablas.** `roles` (id, key, label, permissions jsonb), `user_roles` (userId, roleId).
**API.** `can(user, action, resource, ctx?)`, `requirePermission(...)` (Hono) / `assertCan(...)` (Next), `defineRole()`, `grantRole()`, `revokeRole()`.
**Roles por defecto.** `owner` (todo, no se puede eliminar el último), `admin`, `editor` (todo el contenido), `author`
(solo su contenido), `support` (pedidos y clientes, sin ajustes), `customer` (implícito, sin acceso al admin).
Permisos con forma `recurso:acción` (`posts:publish`, `orders:refund`) y comodín `posts:*`.
**Reglas IA.** Comprobar permisos siempre en servidor; la UI solo oculta. Nunca crear un "modo dios" por env.
**Seguridad.** Escalada de privilegios: un usuario no puede concederse ni conceder roles superiores al suyo (test).
**Aceptación.** Matriz rol × permiso probada; último `owner` no eliminable; `author` no edita contenido ajeno.

---

## `@core/storage` — almacenamiento de archivos

**Para qué.** Interfaz `StorageProvider` para guardar y servir archivos: S3 compatible (Cloudflare R2, AWS S3, MinIO,
Backblaze B2) y disco local en desarrollo. URLs de subida firmadas para subir directo desde el navegador.
**No incluye.** Biblioteca de medios, metadatos ni transformación de imágenes (eso es `@core/media`).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/storage` | — | `aws4fetch` (firma SigV4, funciona en Node y Workers) | `STORAGE_DRIVER`, `STORAGE_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_PUBLIC_URL` | — |

Opcionales: `STORAGE_REGION` (default `auto`); con los drivers `local`/`memory`, `STORAGE_SECRET` (firma de subidas locales) y `STORAGE_LOCAL_DIR`.

**API.** `put(key, body, {contentType})`, `get`, `delete`, `presignUpload(key, {maxBytes, contentType, expiresIn})`, `publicUrl(key)`.
**Seguridad.** Claves generadas por el servidor (nunca el nombre del archivo del usuario como ruta); `maxBytes` y
`contentType` firmados en la URL; bucket privado por defecto con lectura pública solo por prefijo `public/`.
**Aceptación.** Contra MinIO en CI y driver local; subida firmada caduca; una clave con `..` se rechaza.

---

## `@core/jobs` — tareas en segundo plano y programadas

**Para qué.** Cola durable sobre Postgres (`FOR UPDATE SKIP LOCKED`), reintentos con backoff, tareas programadas (cron)
y ejecución diferida (`runAt`). Sin Redis ni servicios extra.
**No incluye.** Orquestación de flujos complejos; colas de Cloudflare/SQS (adaptadores futuros).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/jobs` | `@core/db ^1` | `cron-parser` | — | — |

**Tablas.** `jobs` (id, type, payload jsonb, runAt, attempts, maxAttempts, lockedUntil, lastError, status), `job_schedules`.
**API.** `defineJob(type, schema, handler)`, `enqueue(type, payload, {runAt, dedupeKey})`, `schedule(type, cron)`,
`runWorker({concurrency})` (proceso Node), `runDue()` (para invocar desde un cron HTTP en serverless/Vercel/Workers).
**Reglas IA.** Handlers idempotentes (pueden ejecutarse dos veces); payloads pequeños con IDs, nunca objetos enteros ni secretos.
**Aceptación.** Dos workers no toman el mismo job; reintento con backoff; `dedupeKey` evita duplicados; `runDue` en serverless.

---

## `@core/antispam` — protección de formularios y endpoints públicos

**Para qué.** Verificación de captcha (Cloudflare Turnstile por defecto, hCaptcha alternativo), honeypot, tiempo mínimo
de envío y limitación de frecuencia por IP/clave sobre Postgres.
**No incluye.** WAF ni protección DDoS (eso es de la plataforma de hosting).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/antispam` | `@core/db ^1` | — | `ANTISPAM_SECRET` (hash de claves y token de tiempo), `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` (o `HCAPTCHA_SECRET_KEY`) | — |

**Tablas.** `rate_limits` (key, windowStart, count).
**API.** `verifyHuman(headers, fields, {scope})`, `rateLimit(key, {limit, windowMs})`, `formTimingToken()`, `honeypotProps` (sin componente React: lo pinta cada formulario), `verifyCaptcha`, `clientIp`, `pruneRateLimits`.
**Reglas IA.** Todo endpoint público que escriba (formularios, comentarios, newsletter, login) pasa por aquí.
**Seguridad.** IPs guardadas con hash y caducidad (RGPD); sin captcha configurado, modo "solo honeypot + rate limit" con aviso.
**Aceptación.** Rate limit respeta la ventana; Turnstile verificado contra su clave de prueba.

---

## `@core/money` — dinero y monedas

**Para qué.** Aritmética de dinero en enteros (unidades menores), formato con `Intl.NumberFormat`, redondeo (incluido
"precios psicológicos" `.99`/`.95`), reparto proporcional (descuentos entre líneas) y conversión con tabla de tipos.
**No incluye.** Obtención automática de tipos de cambio (adaptador opcional por env).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/money` | `@core/contracts ^1` | — | — | — |

**API.** `money(amount, currency)`, `add/sub/mul/allocate`, `format(m, locale)`, `roundTo(m, '0.99')`, `convert(m, to, rates)`.
**Reglas IA.** Nunca `number` decimal para importes; nunca sumar monedas distintas (lanza error).
**Aceptación.** Tests de propiedades (fast-check): `allocate` reparte sin perder céntimos; monedas de 0 y 3 decimales (JPY, KWD).

---

## `@core/stripe` — cliente y webhooks de Stripe compartidos

**Para qué.** Una sola integración base con Stripe para **suscripciones** (`@core/billing`) y **pagos únicos**
(`@core/checkout`): cliente configurado, verificación de firma, tabla de eventos idempotente y despachador por tipo.
**No incluye.** Lógica de suscripciones ni de pedidos.

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/stripe` | `@core/db ^1` | `stripe` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` | Stripe (`npx -y @stripe/mcp`, verificar flags vigentes) |

**Tablas.** `stripe_events` (se **mueve** aquí desde `billing`).
**API.** `stripe` (cliente), `onStripeEvent(type, handler)`, `handleStripeWebhook(request)`, adaptadores Hono/Next de la ruta de webhook.
**Migración.** `@core/billing` 2.0 pasa a depender de `@core/stripe` y elimina su copia de cliente/webhook. Guía de
migración en su `AGENTS.md` (la tabla `stripe_events` conserva nombre y columnas para que no haya migración de datos).
**Aceptación.** Firma inválida ⇒ 400; evento repetido ⇒ un solo efecto; `billing` 2.0 pasa sus tests sobre esta base.

---

## `@core/consent` — consentimiento de cookies (RGPD/ePrivacy)

**Para qué.** Banner y centro de preferencias con categorías (necesarias, analítica, marketing), "rechazar" igual de
visible que "aceptar", registro de prueba del consentimiento y API para que otros paquetes carguen scripts solo con permiso.
Mismo criterio que la web de GenPM ([ADR-027](../brainstorming.md)).
**No incluye.** Textos legales del sitio (plantillas en `kit-store`); scripts de terceros concretos (eso es `pixels`).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/consent` | `@core/db ^1` (componentes sin estilos propios: clases `consent-*`) | `zod`, `react` | `CONSENT_POLICY_VERSION` | — |

**Tablas.** `consent_records` (id anónimo, categorías, versión de la política, fecha; sin IP en claro).
**API.** `getConsent(request)`, `hasConsent(cat)`, `onConsentChange(cb)`, `<ConsentBanner />`, `<ConsentGate category>`, Google Consent Mode v2 opcional.
**Reglas IA.** Ningún script de analítica/marketing se carga fuera de `<ConsentGate>`; nunca preseleccionar casillas.
**Aceptación.** Playwright: sin decisión no se descarga ningún script de terceros; revocar borra cookies de la categoría.

---

## `@core/ui` — sistema de diseño base

**Para qué.** Tokens (CSS variables, claro/oscuro con contraste AA verificado) y componentes accesibles sobre elementos nativos
(Button, TextField, TextareaField, SelectField, Checkbox, Field, DataTable, Pagination, Tabs, Dialog, Alert, Badge, Card, Toasts, Spinner, Skeleton). Base común del
admin, de los bloques y de las plantillas de los kits.
**No incluye.** Componentes de dominio (tarjeta de producto, tarjeta de post: viven en su paquete o kit).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/ui` | — | `react` (sin librerías de UI: elementos nativos y `<dialog>`) | — | — |

**Reglas IA.** Los temas se cambian editando tokens (`theme.css`), no componentes; nuevos componentes en la app, no aquí.
**Accesibilidad.** WCAG 2.2 AA: contraste, foco visible, navegación por teclado, `prefers-reduced-motion`.
**Aceptación.** axe-core sin violaciones en un storybook mínimo; claro y oscuro.

---

## `@core/admin` — panel de administración genérico

**Para qué.** El "shell" del panel: layout con navegación, guardas por rol, dashboard con widgets, y **CRUD genérico**
generado a partir de `AdminResource` (lista con filtros/orden/paginación, formulario con validación zod, acciones en
lote, borrado con confirmación), auditoría de cambios y búsqueda global. Cualquier paquete que registre un recurso
aparece en el panel sin escribir pantallas.
**No incluye.** Rutas (`/admin/*` las monta `kit-cms`); pantallas específicas de dominio (las aportan sus kits como
"vistas personalizadas" del recurso).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/admin` | `@core/auth ^1`, `@core/rbac ^1`, `@core/ui ^1`, `@core/contracts ^1` | `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers` | — | — |

**Tablas.** `admin_audit` (userId, resource, recordId, action, diff jsonb, at).
**API.** `defineAdmin({resources, widgets, nav})`, `<AdminShell>`, `<ResourceList>`, `<ResourceForm>`, tipos de campo
(`text`, `slug`, `richText`, `media`, `relation`, `select`, `money`, `date`, `json`, `blocks`), `registerFieldType()` para campos nuevos.
**Registro.** Archivo del proyecto `src/genpm/admin.ts`: `export default defineAdmin({ resources: [...cmsResources, ...storeResources] })`.
**Reglas IA.** Un recurso nuevo se registra, no se crea una página a mano; las vistas personalizadas reemplazan solo la pieza necesaria.
**Seguridad.** Acciones de servidor con CSRF y comprobación `can()` por recurso/acción; auditoría obligatoria en escrituras.
**Aceptación.** Recurso de ejemplo con 10 tipos de campo: lista, crea, edita, borra; `editor` no ve `orders`; auditoría con diff.
