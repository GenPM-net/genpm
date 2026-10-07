# `@core/kit-blog` — blog completo

> Parte del [catálogo](../README.md) · Fase F2 · Estado: planificación.
> Prompt de aceptación: *"Añade un blog a mi web con genpm"*.

## 1. Qué obtiene el usuario

Un blog editable desde el mismo `/admin` del CMS: posts con texto enriquecido e imágenes, autores con perfil,
categorías, etiquetas y series, programación, feeds, buscador, comentarios moderados, suscripción a la newsletter y
SEO completo (JSON-LD `BlogPosting`, sitemap, OG).

## 2. Manifiesto

| Campo | Valor |
|---|---|
| `d` | `src/app/(blog)` |
| `g` | `@core/kit-cms`, `@core/blog`, `@core/comments`, `@core/newsletter` |
| `p` | — (las de sus piezas) |
| `e` | `NEWSLETTER_FROM`, `NEWSLETTER_POSTAL_ADDRESS` (vía `newsletter`) |
| `m` | — |

Reutiliza sin repetir: `content`, `rich-text`, `media`, `seo`, `search`, `forms`, `antispam`, `admin` (todo vía `kit-cms`).

## 3. Qué contiene

| Ruta | Función |
|---|---|
| `/blog` | Listado paginado con destacados |
| `/blog/[slug]` | Post: cabecera, imagen, contenido, autor, tiempo de lectura, compartir (enlaces, sin scripts de terceros), relacionados, comentarios, CTA de newsletter |
| `/blog/category/[slug]`, `/blog/tag/[slug]`, `/blog/author/[slug]`, `/blog/series/[slug]` | Archivos |
| `/blog/archive/[year]/[month]` | Archivo por fecha |
| `/blog/feed.xml`, `/blog/atom.xml`, `/blog/feed.json` | Feeds |
| `/newsletter/confirm`, `/newsletter/unsubscribe` | Doble opt-in y baja |

**Admin:** recursos `posts`, `authors`, `categories`, `tags`, `series`, `comments` (cola de moderación como widget del
dashboard), `subscribers`, `campaigns` ("enviar este post como campaña" en un clic).
**Registro:** añade `blogResources` a `admin.ts`, fuentes de `blog` a `seo.ts` y `search.ts`, bloque "Últimos posts" a `blocks.ts`.
**Plantilla visual:** una por defecto, basada en `ui` y tokens; personalizable editando los componentes del kit (son del usuario tras instalarlos).

## 4. Integración (resumen del `AGENTS.md`)

1. Requiere `kit-cms` integrado (si no, el resolvedor lo instala y el agente sigue primero su `AGENTS.md`).
2. Migraciones de `comments` y `newsletter`.
3. Añadir las cuatro líneas de registro.
4. Configurar el remitente de la newsletter y verificar el dominio en el proveedor de email (SPF/DKIM/DMARC; el
   agente explica cómo, no lo hace por el usuario).
5. Verificar: crear post, programarlo, comentarlo como invitado, aprobar comentario, suscribirse y confirmar.

## 5. Opcionales

- `@core/ai` instalado ⇒ el kit muestra en el editor "sugerir título/resumen/etiquetas" y "traducir post" (borrador, nunca publica solo).
- `@core/billing` instalado ⇒ posts "solo suscriptores" con `hasEntitlement` (base del futuro kit de membresías).

## 6. Implementación 1.0 (notas)

- Código en `catalog/src/app/(blog)`; las líneas de registro marcadas `// kit-blog` en `catalog/src/genpm`.
- Comentarios, newsletter y formularios funcionan sin JavaScript (POST + 303 de vuelta con el resultado en la URL).
- Los campos de relación del panel guardan el slug (`relationKey: 'slug'` en `@core/admin`), como espera `@core/blog`.
- "Enviar como campaña" crea un **borrador** de campaña; el envío se lanza desde Campañas (nunca automático).
- Opcionales `ai` y `billing`: no incluidos en 1.0 (puntos de extensión documentados en el `AGENTS.md`).

## 7. Aceptación específica

- Feeds válidos; post programado no aparece antes de su hora en web, feed, sitemap ni buscador.
- Comentario de invitado con enlace ⇒ moderación; spam ⇒ bloqueado por `antispam`.
- Baja de newsletter en un clic desde Gmail (cabecera `List-Unsubscribe-Post`).
- Lighthouse ≥ 95 en `/blog/[slug]`.
