# genpm.com — Especificación de la interfaz web

> Estado: **v0.1 (MVP)** · Fecha: 2026-10-02
> Stack: Astro SSR (adapter Cloudflare) + Tailwind (preset generado desde los tokens de [branding](branding.md)) + islas Preact donde haya interactividad.
> Datos: registry vía Service Binding ([api-spec](api-spec.md)); README y árbol de archivos desde GitHub, cacheados por SHA.

---

## 1. Objetivos

| # | Objetivo | Métrica |
|---|---|---|
| 1 | **Descubrir**: encontrar el módulo correcto en segundos | Tiempo hasta primer clic en resultado; % búsquedas sin resultado |
| 2 | **Confiar**: entender qué se va a inyectar *antes* de instalar | % visitas a tabs "AI Rules"/"Files"/"Security" |
| 3 | **Instalar**: convertir la visita en un comando copiado | Tasa de copia del comando por página de paquete |
| 4 | **Publicar**: captar autores | Visitas a `/publish` → paquetes publicados |
| 5 | **Monetizar**: patrocinios y waitlist enterprise | Leads en `/sponsors` y `/enterprise` |

## 2. Principios de UX

1. **Command-first.** El comando de instalación es el elemento más visible de cada página relevante; siempre copiable con un clic.
2. **Transparencia radical.** Código, reglas IA, MCP, SHA y escaneo visibles sin login. Es nuestra ventaja de confianza frente a node_modules.
3. **Las tres C en todas partes.** Badges y colores Code (lime) · Context (violet) · Connections (cyan) consistentes con CLI y badges.
4. **Legible por agentes.** Cada página tiene su versión Markdown (`.md`) y el sitio tiene `llms.txt`.
5. **Rápida por defecto.** SSR + caché edge; JS solo donde aporta (búsqueda, copiar, tabs, gráficos).
6. **Honesta con la publicidad.** Patrocinados siempre etiquetados y separados (ADR-010).

## 3. Mapa del sitio

| Ruta | Página | Auth | Prioridad |
|---|---|---|---|
| `/` | Home | — | **P0** |
| `/search?q=` | Resultados de búsqueda | — | **P0** |
| `/p/@scope/name` | Paquete (tabs; `?v=1.2.0` para versión concreta) | — | **P0** |
| `/@scope` | Publisher (usuario u org) | — | P1 |
| `/docs/*` | Documentación (Starlight) | — | **P0** |
| `/mcp` | Conectar GenPM a tu IDE | — | **P0** |
| `/publish` | Guía + constructor/validador de `genpm.json` | — | P1 |
| `/login` · `/logout` | GitHub OAuth | — | **P0** |
| `/dashboard` | Mis paquetes, publicaciones, instalaciones | ✔ | P1 |
| `/settings/tokens` | Tokens de API (crear/revocar) | ✔ | P1 |
| `/settings/profile` | Perfil, orgs sincronizadas | ✔ | P2 |
| `/sponsors` | Patrocinar paquetes (landing + contacto) | — | P1 |
| `/enterprise` | Registros privados (landing + waitlist) | — | P1 |
| `/report?p=` | Reportar paquete (modal en página de paquete) | ✔ | **P0** |
| `/terms` · `/privacy` · `/policy` | Legal + política de paquetes y uso aceptable | — | **P0** |
| `/security` | Cómo protege GenPM (invariantes, firma, escaneo), cómo reportar, `security.txt` | — | **P0** |
| `/security/advisories` | Lista de advisories + feed RSS/JSON | — | **P0** |
| `/{es,pt-br,fr,de,ja,zh-cn,ko}/…` | Versiones localizadas de todas las páginas públicas | — | **P0** |
| `/admin/*` | Cola de cuarentena, reportes, featured, patrocinios | staff | P2 |
| `/llms.txt` · `/p/@scope/name.md` · `/search.md?q=` | Superficies para agentes | — | **P0** |
| `/schema/v1/genpm.json` | JSON Schema del manifiesto | — | **P0** |
| `/sitemap.xml` · `/robots.txt` | SEO | — | **P0** |
| `404` · `500` | Errores | — | **P0** |

## 4. Navegación global

**Header (sticky, 64 px):**
```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ genpm▍   [⌘K  Search packages…                ]   Docs  MCP  Publish  🌐 EN  ☾  [Sign in] │
└──────────────────────────────────────────────────────────────────────────────────────┘
```
- `⌘K` / `Ctrl+K` / `/` abren la paleta de búsqueda (instantánea, debounce 150 ms, 5 resultados, `Enter` → paquete, `⌘Enter` → copia el comando de instalación).
- Selector de idioma `🌐` (8 idiomas, nombre de cada idioma en su propia lengua: English, Español, Português (Brasil), Français, Deutsch, 日本語, 简体中文, 한국어); los de nivel 2 marcados *beta*. Mantiene la ruta actual al cambiar (`/p/@core/auth` → `/es/p/@core/auth`).
- Toggle de tema (dark por defecto, respeta `prefers-color-scheme`, persiste en `localStorage`).
- Logueado: avatar → Dashboard, Tokens, Sign out.
- Móvil (< 768 px): logo + icono de búsqueda + menú hamburguesa (sheet lateral).

**Footer:** Producto (Docs, MCP, Publish, Changelog) · Empresa (Sponsors, Enterprise, Blog) · Comunidad (GitHub, Discord, X) · Legal (Terms, Privacy, Policy, Report abuse) · Estado del sistema.

## 5. Páginas

### 5.1 Home `/` — P0

**Propósito:** explicar el concepto en 5 segundos y llevar a instalar o buscar.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Install architectures, not dependencies.                             │
│  Source code, AI rules and MCP — injected into your repo,            │
│  pinned to a commit.                                                 │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │ $ npx genpm add @core/auth            [Copy] │  [ CLI | MCP ]     │
│  └──────────────────────────────────────────────┘                    │
│  [⌘K Search 128 packages…]                                           │
│                                                                      │
│  ▸ Terminal animado: add → árbol de archivos → "✔ Injected"          │
├──────────────────────────────────────────────────────────────────────┤
│  CODE (lime)          CONTEXT (violet)        CONNECTIONS (cyan)      │
│  Código en tu src/    Reglas con alcance      MCP declarados          │
├──────────────────────────────────────────────────────────────────────┤
│  Featured (@core/*)            │  Trending this week                  │
│  [card][card][card]            │  1. @core/billing  ▁▃▅▇  +32%        │
│  ── Sponsored ── [card]        │  2. …                                │
├──────────────────────────────────────────────────────────────────────┤
│  How it works: 1 Search → 2 Inspect (rules, files, SHA) → 3 Inject   │
├──────────────────────────────────────────────────────────────────────┤
│  "Ask your AI" — snippet MCP por cliente (Claude Code, Cursor, VS…)  │
├──────────────────────────────────────────────────────────────────────┤
│  Security: SHA verificado · cero scripts · escaneo de reglas          │
├──────────────────────────────────────────────────────────────────────┤
│  Publish your architecture in 60s → /publish                          │
│  Stats: 128 packages · 12.4k installs · 41 publishers                 │
└──────────────────────────────────────────────────────────────────────┘
```
- Toggle **CLI | MCP** en el hero: cambia el bloque a `claude mcp add genpm -- npx -y @genpm/mcp` + ejemplo de prompt.
- Datos: `GET /v1/featured`, `GET /v1/search?sort=installs&limit=5`, `GET /v1/stats`. Caché edge 60 s.
- Máx. 1 tarjeta patrocinada, al final de "Featured", con etiqueta.

### 5.2 Búsqueda `/search?q=` — P0

```
┌───────────────┬──────────────────────────────────────────────────────┐
│ Filters       │  "stripe"  ·  12 results        Sort: [Relevance ▾]  │
│ ☐ Has MCP     │ ┌──────────────────────────────────────────────────┐ │
│ ☐ Verified    │ │ ── Sponsored ──  @vendor/payments 2.1.0          │ │
│ Category      │ └──────────────────────────────────────────────────┘ │
│ ○ auth        │ ┌──────────────────────────────────────────────────┐ │
│ ○ billing     │ │ @core/billing  1.2.0  ✓verified                  │ │
│ ○ email …     │ │ Stripe subscriptions, portal & webhooks          │ │
│ License       │ │ [Code][Context][MCP]  billing · stripe   890/30d │ │
│ ○ MIT …       │ │ $ npx genpm add @core/billing           [Copy]   │ │
│               │ └──────────────────────────────────────────────────┘ │
│               │  …                              [Load more]          │
└───────────────┴──────────────────────────────────────────────────────┘
```
- Estado en la URL (`q`, `k`, `mcp`, `sort`) → enlaces compartibles, SSR para SEO.
- Filtros en móvil: botón "Filters" que abre un sheet.
- Vacío: "No packages for 'X'" + sugerencias (keywords cercanas) + CTA "Publish one" (registra la query en analytics como demanda no cubierta).
- Datos: `GET /v1/search` (forma larga, `sponsored=1`).

### 5.3 Paquete `/p/@scope/name` — P0 (la página más importante)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ @core / billing   1.2.0 ▾   ✓ verified   MIT        [Report] [★ GitHub] │
│ Stripe subscriptions, portal & webhooks idempotentes con Drizzle        │
│ [Code] [Context ~1.1k tokens] [MCP: stripe]   scan ✔ passed             │
├──────────────────────────────────────────────┬───────────────────────────┤
│ [Overview] [AI Rules] [Files 23] [MCP]       │ Install                   │
│ [Versions 7] [Dependencies] [Security]       │ [CLI | MCP prompt | Manual]│
│──────────────────────────────────────────────│ $ npx genpm add           │
│                                              │   @core/billing   [Copy]  │
│  (contenido de la tab)                       │                           │
│                                              │ Injects into              │
│                                              │   src/lib/billing         │
│                                              │ Commit  9f2c4e1 ⧉         │
│                                              │ Tag     v1.2.0            │
│                                              │ Requires                  │
│                                              │   @core/db ^1 · @core/auth│
│                                              │ npm  stripe ^17           │
│                                              │ Env  STRIPE_SECRET_KEY …  │
│                                              │ Installs ▁▂▃▅▇ 890/30d    │
│                                              │ Repo  github.com/genpmhq/… │
│                                              │ Published 2d ago · GenPM  │
│                                              │ [badge markdown ⧉]        │
└──────────────────────────────────────────────┴───────────────────────────┘
```

**Pestañas**
| Tab | Contenido | Fuente |
|---|---|---|
| **Overview** | README renderizado | GitHub raw @ SHA, caché inmutable por SHA |
| **AI Rules** (violet) | `x` completo renderizado + vista "raw", nº de tokens, hallazgos del escáner resaltados en línea, explicación de dónde se instalará (AGENTS.md, .cursor/rules…) | `contextPreview` / GitHub raw @ SHA |
| **Files** (lime) | Árbol **exacto** de lo que se inyectará (aplicando `i` y `.genpmignore`), con tamaños; clic → visor de archivo con resaltado | GitHub `git/trees/<sha>?recursive=1` + raw, caché por SHA |
| **MCP** (cyan) | Cada servidor: nombre, comando completo, env requeridas, enlace a su fuente; aviso "solo se añade con tu consentimiento" | manifiesto `m` |
| **Versions** | Tabla: versión, tag, SHA, fecha, publisher, escaneo, `yanked` (tachado + motivo) | `/versions` |
| **Dependencies** | `g` (enlaces a paquetes GenPM), `p` (enlaces a npm), "Used by" (v0.2) | manifiesto |
| **Security** | Estado del escaneo, hallazgos, verificación de SHA/tag, licencia detectada, cómo reportar | `security` |

**Install panel (tabs):**
- **CLI:** `npx genpm add @core/billing` (selector `npx | pnpm dlx | bunx`).
- **MCP prompt:** `Install @core/billing with genpm and integrate it following its AGENTS.md` (copiable para pegar en el agente).
- **Manual:** `git fetch` por SHA + lista de pasos (para quien no quiere instalar el CLI).

**Estados especiales:** `deprecated` (banner amber con mensaje), `yanked` en versión seleccionada (banner red + enlace a la última buena), `quarantined` (banner red, comando de instalación oculto), repo inaccesible (banner amber "source unavailable").
**SEO:** `<title>@core/billing — GenPM</title>`, meta description = `s`, OG image generada, JSON-LD `SoftwareSourceCode` (`codeRepository`, `version`, `license`, `programmingLanguage`).

### 5.4 Publisher `/@scope` — P1
Cabecera (avatar, nombre, verificado, enlace GitHub, nº paquetes, instalaciones totales) + grid de paquetes + (si org) miembros con rol público.

### 5.5 Docs `/docs/*` — P0
Starlight dentro de la misma app Astro, misma marca. Estructura:
```
Getting started   Quickstart (60 s) · How GenPM works · FAQ
Using packages    add · search · list/remove · outdated · Context & IDEs · MCP config · Lockfile
Publishing        Your first package · genpm.json reference · Writing AI rules · Monorepos · CI publishing
MCP server        Setup per client · Tools reference · Prompts
Reference         CLI · API · Error codes (una página por E_*, enlazada desde el `type` de problem+json)
Security          Threat model · Reporting
```
Cada página de docs expone su `.md` (para agentes) y botón "Copy page as Markdown".

### 5.6 MCP `/mcp` — P0
Selector de cliente (Claude Code · Cursor · VS Code · Windsurf · Codex) → instrucciones + bloque copiable + botón de instalación en un clic donde el cliente soporte deeplinks (Cursor y VS Code; verificar formato vigente de cada esquema de URL). Debajo: 3 prompts de ejemplo y un vídeo corto.

### 5.7 Publish `/publish` — P1
1. Guía en 4 pasos (init → AGENTS.md → tag → publish) con comandos.
2. **Constructor de manifiesto** interactivo: formulario ↔ JSON en vivo, validado en el navegador con `@genpm/manifest` (mismo zod que el registry), contador de tokens de las reglas (pegar AGENTS.md), botón "Copy genpm.json".
3. Checklist de calidad (licencia, tests, reglas con secciones recomendadas).

### 5.8 Login `/login` — P0
Botón único "Continue with GitHub" (OAuth web flow) con texto de permisos solicitados (`read:user`, `read:org`) y por qué. Redirección a la página de origen.

### 5.9 Dashboard `/dashboard` — P1
- Tabla "My packages": nombre, última versión, escaneo, instalaciones 30 d, acciones (ver, deprecar).
- Actividad reciente (desde `audit_log` del usuario): publicaciones, yanks, tokens.
- Gráfico de instalaciones (CLI vs MCP) por paquete.
- Estado vacío: "Publish your first package" → `/publish`.

### 5.10 Tokens `/settings/tokens` — P1
Lista (nombre, prefijo `gpm_xxxx…`, scopes, último uso, expira) · crear (nombre, scopes `read`/`publish`, expiración 30/90/365 días, paquetes permitidos opcional) · el token completo se muestra **una vez** con botón copiar · revocar con confirmación.

### 5.11 Sponsors `/sponsors` y Enterprise `/enterprise` — P1
- **Sponsors:** qué se compra (slot en home, búsqueda por keyword, categoría, newsletter), reglas de transparencia (etiqueta siempre visible, nunca en resultados para agentes MCP — lo explicamos como valor), formulario de contacto.
- **Enterprise:** propuesta de registros privados (catálogo interno, RBAC, SSO, "tu código nunca toca nuestros servidores"), waitlist (email, empresa, tamaño, IDE principal).
- Formularios: envío a un endpoint del registry (`POST /v1/leads`, P1) con honeypot + Turnstile.

### 5.12 Reportar — P0
Modal desde la página de paquete: motivo (malware, prompt injection, spam, typosquat, licencia, otro), versión, detalles. Requiere login (anti-spam). `POST /v1/reports`.

### 5.13 Superficies para agentes — P0
- `/llms.txt`: qué es GenPM, leyenda de claves, enlaces a `/docs/*.md`, top paquetes con su `.md`.
- `/p/@scope/name.md`: manifiesto resuelto (compacto) + resumen + reglas completas + comando de instalación. `Content-Type: text/markdown`.
- `/search.md?q=`: resultados en Markdown (1 línea por paquete, como el texto de `genpm_search`).

## 6. Componentes

| Componente | Descripción | Notas |
|---|---|---|
| `CommandBlock` | Comando + botón copiar + selector de runner | Feedback "Copied" 1.5 s; `aria-live="polite"`; evento analytics `copy_install` |
| `PackageCard` | Nombre, versión, resumen, `LayerBadges`, keywords, instalaciones, comando corto | Variante `compact` (paleta ⌘K) y `sponsored` |
| `LayerBadges` | Code / Context (+ tokens) / MCP (+ nombres) | Colores de las 3 C; texto, no solo color |
| `VerifiedBadge` · `SponsoredLabel` · `ScanPill` | Estados de confianza | Sponsored usa borde amber, nunca lime |
| `ShaChip` | SHA corto + copiar SHA completo + tooltip con tag | Fuente mono, violet |
| `FileTree` + `CodeViewer` | Árbol navegable con teclado + visor con Shiki | Shiki en build/edge, sin JS cliente para resaltar |
| `MarkdownRenderer` | README y reglas | **Contenido no confiable**: sanitizado (sin HTML crudo, sin `<script>`, imágenes proxied, enlaces `rel="nofollow ugc noopener"`) |
| `RulesViewer` | Reglas + contador de tokens + hallazgos del escáner resaltados | Toggle rendered/raw |
| `VersionTable` | Semver, SHA, fecha, estado | Yanked tachado con motivo |
| `Sparkline` | Instalaciones 12 semanas | SVG inline, sin librería |
| `SearchPalette` | ⌘K | Isla Preact; navegación con flechas; `role="combobox"` |
| `Tabs` | Tabs de paquete | URL hash (`#rules`) para enlaces profundos; patrón ARIA tabs |
| `Banner` | deprecated / yanked / quarantined / unavailable | Colores de estado + icono + texto |
| `EmptyState` · `Skeleton` · `Toast` | Estados | — |

## 7. Estados y errores

| Situación | Comportamiento |
|---|---|
| Registry caído | Página de paquete servida desde caché stale (`stale-if-error`); banner discreto "Showing cached data" |
| GitHub no responde (README/Files) | La página carga; la tab muestra "Source temporarily unavailable" + reintento; metadatos siguen visibles |
| Paquete inexistente | 404 con búsqueda sugerida por similitud |
| Paquete privado sin acceso (futuro) | 404 (nunca revelar existencia) |
| Búsqueda vacía | Sugerencias + CTA publicar |
| Rate limit | Mensaje amable + reintento automático con backoff en islas |

## 8. Requisitos transversales

**Responsive:** breakpoints Tailwind `sm 640 · md 768 · lg 1024 · xl 1280`. Página de paquete: sidebar de instalación pasa *arriba* del contenido en < 1024 px (el comando siempre visible sin scroll). Ancho máx. de contenido 1200 px; gutter 16 px en móvil; sin scroll horizontal (bloques de código con scroll propio).

**Accesibilidad (WCAG 2.2 AA):** contraste verificado en [branding §8.2](branding.md#82-color); foco visible (anillo 2 px lime en dark / lime-700 en light); todo operable por teclado (tabs, árbol, paleta); `prefers-reduced-motion` desactiva el terminal animado; los badges de capa llevan texto además de color; landmarks y `skip to content`.

**Rendimiento (presupuestos):** LCP < 1.5 s (4G), CLS < 0.05, INP < 200 ms, JS cliente < 50 KB gzip en página de paquete y < 30 KB en home; fuentes self-hosted con `font-display: swap` y subset latino; Lighthouse ≥ 95.

**SEO:** SSR de todo lo público; canonical (`/p/@scope/name` sin `?v=` para la última); `sitemap.xml` generado desde el registry; OG images por paquete (Satori en el edge, caché por versión); JSON-LD.

**Seguridad web:** CSP estricta (`default-src 'self'`; imágenes de GitHub vía proxy propio), cookies `__Host-` HttpOnly/Secure/SameSite=Lax, CSRF token en formularios autenticados, Turnstile en formularios públicos, sanitización de todo Markdown de terceros.

**Analítica (sin cookies):** Cloudflare Web Analytics + eventos propios a Analytics Engine: `search` (query, nº resultados), `copy_install` (paquete, runner, tab), `tab_view` (tab), `sponsored_impression`/`sponsored_click` (campaña), `mcp_setup_copy` (cliente), `publish_cta`.

**i18n:** 8 idiomas desde el lanzamiento (nivel 1 `en`, `es`, `pt-BR`; nivel 2 beta `fr`, `de`, `ja`, `zh-CN`, `ko`) con Astro i18n routing, `hreflang`, fuentes CJK por ruta, propiedades CSS lógicas (preparado para RTL) y banner de sugerencia según `Accept-Language` (sin redirección automática). Detalle: [i18n §4.4](i18n.md#44-web).

**Theming:** tokens CSS en `:root` (light) y `[data-theme="dark"]` / `prefers-color-scheme` (dark por defecto); un único preset Tailwind generado desde `tokens.json` compartido con badges y OG images.

## 9. Flujos clave

**A. Descubrir e instalar (visitante):**
Home → ⌘K "stripe" → `/p/@core/billing` → tab *AI Rules* (lee qué le dirán a su IA) → tab *Files* → copia comando (o prompt MCP) → instala. *Objetivo: < 60 s.*

**B. Publicar (autor):**
`/publish` → constructor de manifiesto → copia `genpm.json` → terminal: `genpm init`, `git tag`, `genpm publish` → URL devuelta por el CLI → página del paquete ya visible (purga de caché) → copia el badge al README.

**C. Conectar el MCP:**
Home (toggle MCP) o `/mcp` → elige cliente → deeplink o bloque copiable → prueba con prompt sugerido.

**D. Patrocinio:**
Etiqueta "Sponsored" → `/sponsors` → formulario → lead en D1 → venta manual (MVP); self-serve con Stripe en v1.0.

**E. Reportar:**
Página de paquete → Report → login → modal → confirmación con nº de reporte → staff revisa en `/admin` (P2; en MVP, notificación por email al equipo).

## 10. Alcance MVP (Día 5 del sprint)

| P0 (Día 5) | P1 (Día 6 si sobra tiempo / v0.1.1) | P2 (v0.2+) |
|---|---|---|
| Home, Búsqueda, Paquete (todas las tabs salvo "Used by"), Docs, MCP, Login, Report, Legal, Security + Advisories, 8 idiomas, llms.txt/.md, sitemap, 404/500 | Publisher, Publish (constructor), Dashboard, Tokens, Sponsors, Enterprise, OG images | Admin, Profile, docs completas en nivel 2, Used by, comparador de versiones (diff visual), status page |
