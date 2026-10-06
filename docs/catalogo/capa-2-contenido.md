# Capa 2 · Contenido

> Parte del [catálogo](README.md). Modelo de contenido, medios, texto enriquecido, ajustes del sitio, búsqueda, comentarios y blog.
> Estado: planificación.

---

## `@core/content` — modelo de contenido (el corazón del CMS)

**Para qué.** Definir **colecciones** (muchas entradas: páginas, posts, FAQs) y **singletons** (una entrada: "home",
"ajustes", "pie de página") con campos tipados en zod, guardarlas en Postgres y servirlas con borradores, revisiones,
publicación programada, idiomas y vista previa.
**No incluye.** UI de edición (la genera `admin` a partir de los recursos que este paquete exporta); render de bloques (`blocks`).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/content` | `@core/db ^1`, `@core/jobs ^1`, `@core/contracts ^1` | `zod` | `CONTENT_PREVIEW_SECRET`, `CONTENT_DEFAULT_LOCALE` (opc.) | — |

**Tablas.** `content_entries` (id, collection, slug, locale, groupId de traducciones, status `draft|scheduled|published|archived`,
`data` = lo publicado, `draft` = cambios sin publicar, authorId, publishedAt, scheduledAt), `content_revisions` (una por publicación).
Editar una entrada publicada no cambia la web hasta volver a publicar.
**API.**
- `defineCollection(name, {schema, fields, localized, titleField})`, `defineSingleton(name, {...})`. Las lecturas públicas solo devuelven lo publicado; no hay API HTTP pública de contenido (cada kit decide qué rutas exponer).
- Lectura tipada: `getEntry('pages', 'about', {locale})`, `listEntries('pages', {where, orderBy, limit})`, `getSingleton('home')`.
- Escritura: `saveDraft`, `publish`, `schedule(at)` (vía `jobs`), `unpublish`, `restoreRevision`.
- Vista previa: `createPreviewToken(entryId)` + adaptador Next `draftMode`.
- Implementa `ContentSource`, `SitemapSource`, `SearchSource` y exporta `AdminResource` por colección.

**Modo "retrofit" (sitio existente).** El `AGENTS.md` describe el procedimiento para convertir textos e imágenes
*hardcodeados* en contenido editable: 1) inventariar literales visibles por página, 2) agruparlos en un singleton por
página (`home`, `about`) o colección si se repiten (testimonios, FAQs), 3) generar la definición y una migración de
**semilla** con los valores actuales, 4) sustituir literales por lecturas tipadas, 5) comprobar que el HTML renderizado
no cambia (snapshot antes/después). Es la pieza que hace realidad *"convierte mi web en autoadministrable"*.

**Reglas IA.** Cambiar la forma de una colección exige migración de datos (`migrateEntries`), nunca editar jsonb a
mano; las lecturas públicas solo devuelven `published` salvo token de vista previa.
**Seguridad.** Token de vista previa firmado y con caducidad; `publicRead: false` por defecto en colecciones nuevas.
**Aceptación.** Borrador no visible en público; programado se publica a su hora (`jobs`); fallback de idioma; retrofit
de una página de ejemplo con snapshot idéntico.

---

## `@core/media` — biblioteca de medios

**Para qué.** Subida directa (URL firmada de `storage`), biblioteca con carpetas y búsqueda, texto alternativo
obligatorio, punto focal, dimensiones, variantes responsivas (`srcset`) y componente `<Img>`.
**No incluye.** Edición de vídeo; DAM avanzado.

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/media` | `@core/db ^1`, `@core/storage ^1`, `@core/contracts ^1` | `zod` | `MEDIA_TRANSFORM` (`cloudflare` \| `vercel` \| `none`) | — |

Sin `sharp` en la 1.0: los metadatos se quitan sin recodificar (JPEG, PNG, WebP) y el redimensionado lo hace la CDN.

**Tablas.** `media` (id, key, filename, mime, size, width, height, alt, focalX, focalY, folder, uploadedBy, createdAt).
**API.** `createUpload({filename, mime, size})`, `confirmUpload(id)`, `<Img media sizes>`, `imageUrl(media, {w, h, fit})`,
`AdminResource` "Medios" con selector reutilizable (`media` como tipo de campo en `admin`).
**Seguridad.** Lista blanca de MIME con *sniffing* real del contenido (no la extensión); SVG solo saneado o
prohibido por defecto; límite de tamaño; eliminación de EXIF/GPS en imágenes.
**Aceptación.** Subida de 3 formatos; SVG con `<script>` rechazado; EXIF eliminado; `srcset` correcto con cada driver.

---

## `@core/rich-text` — texto enriquecido

**Para qué.** Editor (Tiptap) con encabezados, listas, enlaces, citas, tablas, código, imágenes de `media`, embeds
(YouTube/Vimeo como enlace por defecto, iframe sin cookies opcional); almacenamiento en **JSON** (no HTML) y render a React/HTML,
texto plano (para búsqueda) y tiempo de lectura.
**No incluye.** Tablas (1.1) ni colaboración en tiempo real (posible fase futura con Yjs).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/rich-text` | — (las imágenes de `media` se resuelven con una función que pasa la app) | `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `react`, `zod` | — | — |

**API.** `<RichTextEditor value onChange extensions>`, `<RichText doc />`, `toPlainText(doc)`, `readingTime(doc)`,
`defineNode()` para nodos nuevos; tipo de campo `richText` para `admin`.
**Seguridad.** Al renderizar desde JSON con lista blanca de nodos/marcas, no hay HTML arbitrario (anti-XSS por
construcción); enlaces `javascript:` rechazados; `rel="noopener nofollow"` configurable en externos.
**Aceptación.** Payload XSS conocidos (OWASP cheat sheet) no producen ejecución; ida y vuelta JSON estable.

---

## `@core/site` — ajustes globales, menús y redirecciones

**Para qué.** Lo que todo sitio tiene y nadie quiere reprogramar: nombre, logo, favicon, redes, datos de contacto,
**menús** (cabecera, pie) editables con anidamiento, **redirecciones 301/302** gestionables y páginas legales
asignables (privacidad, aviso legal, cookies, términos, devoluciones).
**No incluye.** Contenido de las páginas legales (plantillas en kits) ni SEO (lo lee `seo` de aquí).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/site` | `@core/content ^1`, `@core/db ^1`, `@core/contracts ^1` | `zod` | `SITE_URL`, `SITE_REDIRECT_HOSTS` (opc.) | — |

**Tablas.** `redirects` (from, to, status, hits). Ajustes y menús son singletons/colecciones de `content`.
**API.** `getSiteSettings()`, `getMenu('header')`, `redirectMiddleware` (Next middleware / Hono), `AdminResource` "Ajustes", "Menús", "Redirecciones".
**Seguridad.** Redirecciones solo a rutas relativas o dominios permitidos (anti open redirect, mismo fallo visto en `auth` 1.0.0).
**Aceptación.** Redirección con bucle detectada y rechazada; menú de 3 niveles; open redirect bloqueado.

---

## `@core/search` — búsqueda en el sitio

**Para qué.** Búsqueda de texto completo en Postgres (`tsvector` por idioma + `pg_trgm` para tolerancia a erratas),
indexación incremental desde cualquier `SearchSource`, facetas por tipo y endpoint/componente listos.
**No incluye.** Búsqueda semántica (posible extensión con `@core/ai` + pgvector); motores externos (adaptadores Meilisearch/Typesense en F6).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/search` | `@core/db ^1`, `@core/contracts ^1`, `@core/jobs ^1` | — | — | — |

**Tablas.** `search_documents` (id, type, locale, url, title, body, tsv, updatedAt).
**API.** `registerSearchSource(src)` (en `src/genpm/search.ts`), `search(q, {types, locale, limit})`, `reindex()`, `<SearchBox>`, `<SearchResults>`.
**Aceptación.** Erratas de 1 carácter encuentran resultados; reindexado incremental al publicar; borrador nunca indexado.

---

## `@core/comments` — comentarios y valoraciones sobre cualquier entidad

**Para qué.** Hilos sobre cualquier cosa (`entityType`, `entityId`): posts, productos, páginas. Respuestas anidadas (1
nivel), moderación (cola, aprobar, spam, bloquear autor), notificaciones por email, invitados con email verificado o
usuarios con sesión, y **valoración opcional 1–5** (que `reviews` reutiliza).
**No incluye.** Reglas de "compra verificada" ni agregados de producto (eso es `reviews`).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/comments` | `@core/db ^1`, `@core/auth ^1`, `@core/antispam ^1`, `@core/email ^1`, `@core/jobs ^1`, `@core/contracts ^1` | `zod` | `COMMENTS_NOTIFY_TO` (opc.) | — |

**Tablas.** `comments` (id, entityType, entityId, parentId, authorId, guestName, guestEmailHash, body, rating, status
`pending|approved|spam|deleted`, createdAt), `comment_bans`.
**API.** `listComments(entity)`, `postComment(...)`, `moderate(id, action)`, `<Comments entity>`, `AdminResource` "Comentarios".
**Reglas IA.** Cuerpo en texto plano (o Markdown limitado sin HTML); moderación previa por defecto en invitados.
**Seguridad.** Emails de invitados con hash; antispam obligatorio; derecho de supresión (borrar todos los de un email).
**Aceptación.** Invitado ⇒ `pending`; usuario de confianza ⇒ `approved`; spam por rate limit; borrado RGPD por email.

---

## `@core/blog` — dominio de blog

**Para qué.** Colecciones `posts`, `authors`, `categories`, `tags`, `series` sobre `content`; listados paginados,
archivo por fecha, posts relacionados, destacados, feeds **RSS 2.0, Atom y JSON Feed**, tiempo de lectura y datos para
JSON-LD `BlogPosting`.
**No incluye.** Rutas ni plantillas visuales (las pone `kit-blog`), comentarios ni newsletter (paquetes propios).

| `d` | `g` | `p` | `e` | `m` |
|---|---|---|---|---|
| `src/lib/blog` | `@core/content ^1`, `@core/rich-text ^1`, `@core/contracts ^1`, `@core/db ^1` | `zod` | `SITE_URL` | — |

**Tablas.** Ninguna propia: todo son colecciones de `content` (demuestra que el modelo es suficiente).
**API.** `listPosts({category, tag, author, page})`, `getPost(slug)`, `relatedPosts(post)`, `archive()`,
`feed('rss' | 'atom' | 'json')`, implementa `SitemapSource` y `SearchSource`, `blogResources` para `admin`.
**Aceptación.** Feeds válidos (validador W3C en CI); relacionados por etiquetas comunes; posts programados no aparecen en feeds.
