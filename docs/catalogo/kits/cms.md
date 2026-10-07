# `@core/kit-cms` — sitio autoadministrable

> Parte del [catálogo](../README.md) · Fase F1 · Estado: planificación.
> Prompt de aceptación: *"Convierte mi web en autoadministrable con genpm"* (sitio existente) y *"Crea un sitio corporativo editable con genpm"* (sitio nuevo).

## 1. Qué obtiene el usuario

Un panel en `/admin` donde una persona sin conocimientos técnicos edita **textos, imágenes, páginas, menús, ajustes,
formularios y redirecciones**, con borradores, vista previa, programación y roles, sin tocar código. Es la base de
todos los demás kits: blog, landing y tienda se instalan **encima** de este.

## 2. Manifiesto

| Campo | Valor |
|---|---|
| `d` | `src/app/(cms)` |
| `g` | `@core/admin`, `@core/content`, `@core/media`, `@core/rich-text`, `@core/blocks`, `@core/site`, `@core/seo`, `@core/forms`, `@core/search` (9; `rbac`, `storage`, `jobs`, `antispam`, `ui`, `contracts`, `db`, `auth`, `email` llegan transitivamente) |
| `p` | `next` (peer, ≥ 15), `react` (peer) |
| `e` | Todas las de sus dependencias; el kit no añade propias |
| `m` | — |

## 3. Qué contiene (solo pegamento)

**Rutas del panel** (`/admin`, protegidas por `rbac`):

| Ruta | Función |
|---|---|
| `/admin` | Dashboard: borradores recientes, envíos de formularios, actividad, accesos rápidos (widgets registrables) |
| `/admin/[resource]` y `/admin/[resource]/[id]` | CRUD genérico de cualquier `AdminResource` registrado |
| `/admin/media` | Biblioteca de medios con subida múltiple |
| `/admin/menus`, `/admin/settings`, `/admin/redirects` | Vistas personalizadas de `site` |
| `/admin/users` | Usuarios y roles (`auth` + `rbac`), invitación por email |
| `/admin/login` | Login (reutiliza `auth`: magic link y OAuth configurados) |

**Rutas públicas:**

| Ruta | Función |
|---|---|
| `/[...slug]` | Páginas de la colección `pages` renderizadas con `blocks` (solo si el usuario no tiene ya esa ruta; ver §5) |
| `/api/preview`, `/api/exit-preview` | Vista previa de borradores con `draftMode` |
| `/api/forms/[key]` | Envío de formularios |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt` | De `seo` |
| `/search` | Página de resultados de `search` |
| `/api/cron` | Endpoint protegido para `jobs.runDue()` en hosting serverless |

**Archivos de registro que crea en el proyecto** (son del usuario, no del kit): `src/genpm/admin.ts`,
`src/genpm/seo.ts`, `src/genpm/search.ts`, `src/genpm/blocks.ts`, `src/genpm/content.ts` (colecciones del sitio).
Los kits siguientes añaden una línea en cada uno.

**Contenido inicial:** colección `pages` (con `blocks` y `seoFields`), singletons `settings`, `header`, `footer`;
roles por defecto; plantillas de páginas legales vacías marcadas "pendiente de revisar" (nunca texto legal inventado
presentado como definitivo).

## 4. Integración (resumen del `AGENTS.md` del kit)

1. Comprobar Next ≥ 15 App Router y alias `@/`; si el proyecto usa `app/` sin `src/`, instalar con `--dest app/(cms)`.
2. Configurar env (`DATABASE_URL`, `AUTH_SECRET`, `STORAGE_*`, `EMAIL_*`, `SITE_URL`, `CONTENT_PREVIEW_SECRET`).
3. Generar y aplicar migraciones de todas las piezas (`drizzle-kit` recoge los esquemas por glob).
4. Crear los archivos `src/genpm/*.ts` y el primer usuario `owner` (`pnpm genpm-cms create-owner` → script del kit, ejecutado por el usuario).
5. Montar `redirectMiddleware` y el cron de `jobs`.
6. **Sitio existente → modo retrofit** (§5). **Sitio nuevo →** crear la home con bloques de ejemplo.
7. Verificar: login en `/admin`, editar un texto de la home, ver el cambio en público y en vista previa.

## 5. Modo retrofit (convertir un sitio existente)

El objetivo que pidió el fundador: *que una web hecha a mano pase a ser editable*. El agente sigue el procedimiento de
`@core/content` (inventario → singletons/colecciones → semilla con los valores actuales → sustituir literales →
snapshot idéntico), con estas reglas del kit:

- No cambiar diseño ni markup: solo el origen de los datos. El snapshot HTML antes/después debe coincidir.
- Imágenes locales → `media` (se suben con su `alt`; si falta, se marca para que el editor lo complete).
- Rutas existentes del usuario tienen prioridad: el catch-all `[...slug]` solo sirve páginas creadas desde el admin.
- Hacerlo **página a página**, con un commit por página, para que el usuario pueda revisar.
- Sitios no Next (HTML estático, Astro, Vite+React): fuera de alcance del kit 1.0; el agente debe decirlo y proponer
  migrar a Next o esperar a los kits Astro (F6).

## 6. Alternativa: adaptador Payload (opcional, no forma parte del kit)

Para quien ya usa o prefiere **Payload CMS** (TypeScript, se instala dentro de Next, Postgres con Drizzle): paquete
`@core/content-payload` que implementa `ContentSource`/`SitemapSource`/`SearchSource` leyendo de Payload, para que
`blog`, `blocks`, `seo` y `search` funcionen igual. El panel sería el de Payload. Se planifica en F6 si hay demanda
(ADR-033 §3). Keystatic (contenido en Git, sin BD) es otro candidato de adaptador para landings simples.

## 7. Implementación 1.0 (notas)

- Código en `catalog/src/app/(cms)`; el registro del proyecto de ejemplo (composición de todos los kits) en
  `catalog/src/genpm`, copiado de `_templates/genpm` del kit. Los kits siguientes añaden líneas a esos archivos.
- Login solo OAuth (lo que ofrece `@core/auth` 1.x): el primer `owner` se crea con `_scripts/create-owner.ts` tras el
  primer inicio de sesión; los demás usuarios aparecen al iniciar sesión y se les asigna rol en Admin → Usuarios
  (`usersAdminResource` de `@core/rbac`). La invitación por email queda para cuando `auth` tenga enlace mágico.
- `/admin/media`, menús, ajustes y redirecciones usan el CRUD genérico (sin vistas a medida en 1.0); el campo `media`
  del panel permite elegir de la biblioteca o subir. Vista previa firmada desde el enlace "Preview" de cada página.
- Límite del manifiesto: 10 dependencias GenPM; `auth`, `rbac`, `db`… llegan por `admin` y se importan igualmente.

## 8. Aceptación específica

- Retrofit de un sitio Next de ejemplo de 5 páginas (`examples/` del workspace de desarrollo): snapshots idénticos,
  todos los textos e imágenes editables, < 30 min de agente.
- `editor` publica páginas pero no ve usuarios ni ajustes; `author` solo edita lo suyo.
- Página programada aparece a su hora con el cron serverless.
- Lighthouse ≥ 90 en la home de ejemplo; axe sin violaciones en el panel.
