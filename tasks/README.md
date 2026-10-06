# Tareas de GenPM

Planificación ejecutable del proyecto. El plan completo (objetivo, calendario, camino crítico, recortes y riesgos) está en [PLAN.md](PLAN.md).
Cada archivo `NN-*.md` es una fase con sus tareas.

## Estados

| Estado | Casilla | Significa |
|---|---|---|
| `TODO` | `[ ]` | Pendiente |
| `DOING` | `[ ]` | En curso (una persona o agente trabajando en ella) |
| `DONE` | `[x]` | Terminada y con su DoD cumplido |
| `BLOCKED` | `[ ]` | Bloqueada: añade debajo una línea `- Bloqueo: …` con el motivo |
| `CUT` | `[ ]` | Recortada del alcance (plan de recorte, PLAN §6): añade debajo `- Recorte: …` |

## Formato de una tarea

```md
- [ ] `D3-B-05` **TODO** CLI add: plan visual, 3 prompts, --dry-run… · B · 4h · deps: D3-B-02, D3-B-04
  - Nota, DoD o motivo de bloqueo (opcional, indentado)
```

| Parte | Regla |
|---|---|
| ID | `D<día>-<track>-<nn>` en el sprint, `D<día>-G-<nn>` para gates, `S-<semilla>-<nn>`, `BR-<nn>`, `V<versión>-<nn>`, `ENT-<nn>`, `CAT-<bloque>-<nn>` (catálogo de kits). Nunca se reutiliza. |
| Track | `F` fundador · `A` plataforma · `B` cliente · `C` contenido · `W` web · `D` diseño · `T` todo el equipo |
| Estimación | Horas de trabajo enfocado (`0.5h`, `3h`) |
| deps | IDs que deben estar en `DONE` o `CUT` antes de empezar, o `—` |

## Cómo marcar tareas

Desde la raíz del repo (Node ≥ 20, sin dependencias):

```bash
pnpm tasks
```

```bash
pnpm tasks next
```

```bash
pnpm tasks start D1-A-01
```

```bash
pnpm tasks done D1-A-01 D1-A-02
```

| Comando | Qué hace |
|---|---|
| `pnpm tasks` | Progreso por fase, tareas en curso, bloqueadas y siguientes |
| `pnpm tasks next [n]` | Tareas `TODO` con todas sus dependencias cerradas |
| `pnpm tasks list [filtro…]` | Lista filtrando por estado (`doing`), track (`B`), archivo (`08-semillas.md`) o prefijo de ID (`D3`, `S-BI`) |
| `pnpm tasks start/done/block/cut/todo <ID…>` | Cambia el estado y la casilla, y avisa si quedan dependencias abiertas |
| `pnpm tasks sync` | Alinea casillas y estados y regenera el tablero de abajo |
| `pnpm tasks check` | Valida IDs duplicados, dependencias, ciclos y formato (sale con 1 si hay errores; apto para CI) |

También puedes editar a mano: cambia la palabra de estado o marca la casilla `[x]` (en el editor o en GitHub).
Después ejecuta `pnpm tasks sync`: **una casilla marcada pasa la tarea a `DONE`**.

## Reglas

1. Una tarea pasa a `DONE` solo cuando su DoD está cumplido y probado. Los gates (`*-G-*`) cierran cada día.
2. Si una tarea crece más del doble de su estimación, divídela en tareas nuevas con IDs nuevos.
3. Nada de las puertas de seguridad (`D6-S-*`) se marca `CUT`.
4. Las tareas nuevas siguen el formato exacto; `pnpm tasks check` debe pasar antes de hacer commit.

## Tablero

<!-- board:start -->
<!-- Generado por `pnpm tasks sync` · 2026-10-06. No editar a mano. -->

**67 %** completado · 214/318 tareas · 721.5h estimadas pendientes

TODO 52 · DOING 5 · DONE 214 · BLOCKED 47 · CUT 0

| Fase | Progreso | Hechas | Pendiente |
|---|---|---|---|
| [Día 0 · Preparación](00-dia-0-preparacion.md) | `▓▓▓▓▓░░░░░░░` 38 % | 6/16 | 9h |
| [Día 1 · Cimientos](01-dia-1-cimientos.md) | `▓▓▓▓▓▓▓▓▓▓▓░` 95 % | 20/21 | 0.5h |
| [Día 2 · Registry y motor de fetch](02-dia-2-registry-fetch.md) | `▓▓▓▓▓▓▓▓▓▓▓░` 95 % | 20/21 | 0.5h |
| [Día 3 · CLI y contexto](03-dia-3-cli-contexto.md) | `▓▓▓▓▓▓▓▓▓▓▓░` 95 % | 21/22 | 1h |
| [Día 4 · Servidor MCP](04-dia-4-mcp.md) | `▓▓▓▓▓▓▓▓▓▓▓░` 88 % | 15/17 | 2h |
| [Día 5 · Web MVP y pulido del cliente](05-dia-5-web.md) | `▓▓▓▓▓▓▓▓▓▓▓░` 93 % | 28/30 | 1.5h |
| [Día 6 · Integración, seguridad y producción](06-dia-6-produccion.md) | `▓▓▓▓▓▓▓▓░░░░` 63 % | 19/30 | 15h |
| [Día 7 · Lanzamiento](07-dia-7-lanzamiento.md) | `▓▓░░░░░░░░░░` 18 % | 2/11 | 16.5h |
| [Semillas @core/*](08-semillas.md) | `▓▓▓▓▓▓▓▓▓░░░` 76 % | 32/42 | 5h |
| [Marca y diseño](09-marca-diseno.md) | `▓▓▓▓▓▓▓▓▓▓▓░` 94 % | 17/18 | 2h |
| [Post-MVP](10-post-mvp.md) | `▓▓▓▓▓▓▓▓▓▓░░` 83 % | 33/40 | 46.5h |
| [Catálogo de paquetes y kits](11-catalogo.md) | `░░░░░░░░░░░░` 2 % | 1/50 | 622h |

**En curso**

- `D0-01` Registrar genpm.net, activar registrar lock y DNSSEC (DNS en Cloudflare) · F · 2h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-05` Crear la org de GitHub GenPM-net con 2FA obligatorio · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-10` Cuenta Cloudflare Workers Paid con llaves FIDO2 · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `V011-02` Binario nativo de genpm para macOS, Linux y Windows con instaladores de una línea y genpm upgrade (ADR-025) · B · 8h ([10-post-mvp.md](10-post-mvp.md))
- `CAT-00-02` Workspace de desarrollo del catálogo (como ../genpm-seeds) con app Next de ejemplo, PGlite, Playwright y Changesets por tren · C · 4h ([11-catalogo.md](11-catalogo.md))

**Bloqueadas**

- `D0-02` Registrar genpm.dev como dominio defensivo con 301 a genpm.net · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-03` Búsqueda de marca registrada "GenPM" (USPTO, EUIPO, INPI Brasil, SAPI Venezuela, IMPI México) · F · 2h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-04` Reservar handles @genpm en X, Discord, YouTube y LinkedIn (fallback genpmnet / genpm-net) · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-09` Org de npm @genpm con 2FA, placeholder genpm@0.0.0 y trusted publishing para el monorepo · F · 1h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-13` Gestor de secretos del equipo con todos los secretos; ningún .env commiteado · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-14` Contratar revisor nativo de pt-BR para el Día 6 y buscar revisores de nivel 2 (ja, zh-CN, ko, fr, de) · F · 1h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-G-01` M0: todas las cuentas con 2FA/FIDO2 y accesos repartidos al equipo · T · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D1-G-01` CI verde en macOS, Linux y Windows · T · 0.5h ([01-dia-1-cimientos.md](01-dia-1-cimientos.md))
- `D2-G-01` Publicar por curl un fixture en staging y obtener su SHA vía resolve · T · 0.5h ([02-dia-2-registry-fetch.md](02-dia-2-registry-fetch.md))
- `D3-G-01` genpm add @core/auth instala auth + db desde staging en macOS, Linux y Windows (CI) · T · 1h ([03-dia-3-cli-contexto.md](03-dia-3-cli-contexto.md))
- `D4-B-08` Prueba real en Cursor con el mismo guion · B · 1h ([04-dia-4-mcp.md](04-dia-4-mcp.md))
- `D4-G-01` En Claude Code y Cursor, "añade login con GitHub" instala el módulo llamando primero a genpm_add con dryRun:true · T · 1h ([04-dia-4-mcp.md](04-dia-4-mcp.md))
- `D5-B-05` npm publish --provenance en dry-run desde CI · B · 1h ([05-dia-5-web.md](05-dia-5-web.md))
- `D6-S-01` INV-1 a INV-10 con tests verdes en macOS, Linux y Windows · T · 1h ([06-dia-6-produccion.md](06-dia-6-produccion.md))
- `S-DB-07` Prueba de agente en Cursor · C · 0.5h ([08-semillas.md](08-semillas.md))
- `S-DB-08` Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h ([08-semillas.md](08-semillas.md))
- `S-AU-07` Prueba de agente en Cursor · C · 0.5h ([08-semillas.md](08-semillas.md))
- `S-AU-08` Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h ([08-semillas.md](08-semillas.md))
- `S-BI-07` Prueba de agente en Cursor · C · 0.5h ([08-semillas.md](08-semillas.md))
- `S-BI-08` Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h ([08-semillas.md](08-semillas.md))
- `S-EM-07` Prueba de agente en Cursor · C · 0.5h ([08-semillas.md](08-semillas.md))
- `S-EM-08` Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h ([08-semillas.md](08-semillas.md))
- `S-AI-07` Prueba de agente en Cursor · C · 0.5h ([08-semillas.md](08-semillas.md))
- `S-AI-08` Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h ([08-semillas.md](08-semillas.md))
- `CAT-00-03` Implementar y publicar @core/contracts (capa-1-transversales.md) · C · 6h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-01` Implementar y publicar @core/rbac · C · 8h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-02` Implementar y publicar @core/storage (S3/R2/MinIO y local) · C · 8h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-03` Implementar y publicar @core/jobs (cola Postgres, cron y runDue serverless) · C · 10h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-04` Implementar y publicar @core/antispam (Turnstile, honeypot, rate limit) · C · 6h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-06` Implementar y publicar @core/content (colecciones, singletons, revisiones, programación, vista previa, retrofit) · C · 28h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-07` Implementar y publicar @core/media (subida firmada, variantes, saneado de SVG y EXIF) · C · 14h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-08` Implementar y publicar @core/rich-text (Tiptap, JSON, render anti-XSS) · C · 14h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-09` Implementar y publicar @core/site (ajustes, menús, redirecciones sin open redirect) · C · 8h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-10` Implementar y publicar @core/seo (metadatos, sitemap, robots, llms.txt, JSON-LD, OG) · C · 12h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-11` Implementar y publicar @core/search (tsvector + pg_trgm, SearchSource) · C · 10h ([11-catalogo.md](11-catalogo.md))
- `CAT-CMS-12` Implementar y publicar @core/forms (definiciones, envíos, emails, webhook firmado) · C · 10h ([11-catalogo.md](11-catalogo.md))
- `CAT-BLG-01` Implementar y publicar @core/blog (colecciones, feeds RSS/Atom/JSON, relacionados) · C · 12h ([11-catalogo.md](11-catalogo.md))
- `CAT-BLG-02` Implementar y publicar @core/comments (moderación, valoración opcional, borrado RGPD) · C · 12h ([11-catalogo.md](11-catalogo.md))
- `CAT-BLG-03` Implementar y publicar @core/newsletter (doble opt-in, baja RFC 8058, campañas por lotes) · C · 16h ([11-catalogo.md](11-catalogo.md))
- `CAT-STO-01` Implementar y publicar @core/money (tests de propiedades) · C · 6h ([11-catalogo.md](11-catalogo.md))
- `CAT-STO-02` Implementar y publicar @core/stripe y migrar @core/billing a 2.0 sobre él · C · 12h ([11-catalogo.md](11-catalogo.md))
- `CAT-STO-03` Implementar y publicar @core/catalog (variantes, colecciones, reserva de stock concurrente) · C · 20h ([11-catalogo.md](11-catalogo.md))
- `CAT-STO-04` Implementar y publicar @core/cart (precios en servidor, tubería de totales) · C · 14h ([11-catalogo.md](11-catalogo.md))
- `CAT-STO-05` Implementar y publicar @core/orders (máquina de estados, envíos parciales, reembolsos, anti-IDOR) · C · 20h ([11-catalogo.md](11-catalogo.md))
- `CAT-STO-06` Implementar y publicar @core/shipping (zonas, tarifas, seguimiento) · C · 10h ([11-catalogo.md](11-catalogo.md))
- `CAT-STO-07` Implementar y publicar @core/checkout (Stripe Checkout, pedido solo en webhook, idempotente) · C · 16h ([11-catalogo.md](11-catalogo.md))
- `CAT-STO-08` Implementar y publicar @core/discounts (cupones, límites, regla Ómnibus de 30 días) · C · 12h ([11-catalogo.md](11-catalogo.md))

**Siguientes disponibles** (TODO con todas sus dependencias cerradas)

- `D6-P-04` Alertas: errores 5xx > 1 % y latencia p95 · A · 1h ([06-dia-6-produccion.md](06-dia-6-produccion.md))
- `D6-P-07` Apertura del código (ADR-016): semillas públicas, paquetes cliente públicos con licencia, registry y web según decisión del fundador · F · 1h ([06-dia-6-produccion.md](06-dia-6-produccion.md))
- `D6-P-08` Datos del titular (nombre, NIF, domicilio, ciudad) en apps/web/src/content/legal/owner.json y revisión legal (ADR-024) · F · 0.5h ([06-dia-6-produccion.md](06-dia-6-produccion.md))
- `D7-01` Vídeo demo de 90–120 s con el guion del objetivo (PLAN §1) · T · 3h ([07-dia-7-lanzamiento.md](07-dia-7-lanzamiento.md))
- `D7-04` Hilo en X de 6 posts (esqueleto de branding §9) · F · 1h ([07-dia-7-lanzamiento.md](07-dia-7-lanzamiento.md))
- `BR-16` Test de 5 segundos de la home con 5 desarrolladores: ¿entienden qué hace GenPM? · F · 2h ([09-marca-diseno.md](09-marca-diseno.md))
- `V011-13` Activar PostHog en producción: proyecto en región EU, DPA aceptado, retención 30 días/12 meses, POSTHOG_KEY en wrangler.jsonc y despliegue de la web · F · 0.5h ([10-post-mvp.md](10-post-mvp.md))
- `V03-06` Auditoría de seguridad externa · F · 8h ([10-post-mvp.md](10-post-mvp.md))
- `V10-07` Pentest y bug bounty con recompensas · F · 8h ([10-post-mvp.md](10-post-mvp.md))
- `ENT-04` SLA y soporte dedicado · F · 8h ([10-post-mvp.md](10-post-mvp.md))

<!-- board:end -->
