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
| ID | `D<día>-<track>-<nn>` en el sprint, `D<día>-G-<nn>` para gates, `S-<semilla>-<nn>`, `BR-<nn>`, `V<versión>-<nn>`, `ENT-<nn>`. Nunca se reutiliza. |
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
<!-- Generado por `pnpm tasks sync` · 2026-10-03. No editar a mano. -->

**18 %** completado · 45/253 tareas · 731h estimadas pendientes

TODO 187 · DOING 3 · DONE 45 · BLOCKED 18 · CUT 0

| Fase | Progreso | Hechas | Pendiente |
|---|---|---|---|
| [Día 0 · Preparación](00-dia-0-preparacion.md) | `▓░░░░░░░░░░░` 6 % | 1/16 | 12h |
| [Día 1 · Cimientos](01-dia-1-cimientos.md) | `▓▓▓▓▓▓▓▓▓▓░░` 81 % | 17/21 | 4h |
| [Día 2 · Registry y motor de fetch](02-dia-2-registry-fetch.md) | `▓▓▓▓▓▓▓▓▓▓▓░` 90 % | 19/21 | 1h |
| [Día 3 · CLI y contexto](03-dia-3-cli-contexto.md) | `▓░░░░░░░░░░░` 9 % | 2/22 | 37.5h |
| [Día 4 · Servidor MCP](04-dia-4-mcp.md) | `░░░░░░░░░░░░` 0 % | 0/17 | 35.5h |
| [Día 5 · Web MVP y pulido del cliente](05-dia-5-web.md) | `░░░░░░░░░░░░` 0 % | 0/30 | 63.5h |
| [Día 6 · Integración, seguridad y producción](06-dia-6-produccion.md) | `░░░░░░░░░░░░` 0 % | 0/29 | 34h |
| [Día 7 · Lanzamiento](07-dia-7-lanzamiento.md) | `░░░░░░░░░░░░` 0 % | 0/11 | 18.5h |
| [Semillas @core/*](08-semillas.md) | `░░░░░░░░░░░░` 0 % | 0/42 | 47.5h |
| [Marca y diseño](09-marca-diseno.md) | `▓▓▓▓░░░░░░░░` 35 % | 6/17 | 15.5h |
| [Post-MVP](10-post-mvp.md) | `░░░░░░░░░░░░` 0 % | 0/27 | 462h |

**En curso**

- `D0-01` Registrar genpm.net, activar registrar lock y DNSSEC (DNS en Cloudflare) · F · 2h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-05` Crear la org de GitHub GenPM-net con 2FA obligatorio · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-08` Repo GenPM-net/genpm con protección de main y 5 repos vacíos para las semillas · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))

**Bloqueadas**

- `D0-02` Registrar genpm.dev como dominio defensivo con 301 a genpm.net · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-03` Búsqueda de marca registrada "GenPM" (USPTO, EUIPO, INPI Brasil, SAPI Venezuela, IMPI México) · F · 2h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-04` Reservar handles @genpm en X, Discord, YouTube y LinkedIn (fallback genpmnet / genpm-net) · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-06` OAuth App de GitHub con Device Flow (login del CLI y de la web) · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-07` GitHub App de solo lectura para el registry (lectura de repos en publish) · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-09` Org de npm @genpm con 2FA, placeholder genpm@0.0.0 y trusted publishing para el monorepo · F · 1h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-10` Cuenta Cloudflare Workers Paid con llaves FIDO2 · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-11` Crear D1 genpm-registry y genpm-registry-staging, dataset de Analytics Engine y Queue de escaneo · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-12` Generar claves de firma Ed25519 (k1 activa, k2 siguiente) y clave raíz de revocación guardada offline · F · 1h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-13` Gestor de secretos del equipo con todos los secretos; ningún .env commiteado · F · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-14` Contratar revisor nativo de pt-BR para el Día 6 y buscar revisores de nivel 2 (ja, zh-CN, ko, fr, de) · F · 1h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D0-G-01` M0: todas las cuentas con 2FA/FIDO2 y accesos repartidos al equipo · T · 0.5h ([00-dia-0-preparacion.md](00-dia-0-preparacion.md))
- `D1-A-05` Migración 0001_init.sql (api-spec §5.3) aplicada en staging · A · 2h ([01-dia-1-cimientos.md](01-dia-1-cimientos.md))
- `D1-A-07` GET /v1/health y deploy a staging · A · 1h ([01-dia-1-cimientos.md](01-dia-1-cimientos.md))
- `D1-G-01` CI verde en macOS, Linux y Windows · T · 0.5h ([01-dia-1-cimientos.md](01-dia-1-cimientos.md))
- `D1-G-02` GET /v1/health responde en staging · T · 0.5h ([01-dia-1-cimientos.md](01-dia-1-cimientos.md))
- `D2-G-01` Publicar por curl un fixture en staging y obtener su SHA vía resolve · T · 0.5h ([02-dia-2-registry-fetch.md](02-dia-2-registry-fetch.md))
- `D2-G-04` Caché caliente del registry < 100 ms · T · 0.5h ([02-dia-2-registry-fetch.md](02-dia-2-registry-fetch.md))

**Siguientes disponibles** (TODO con todas sus dependencias cerradas)

- `D3-A-03` CLI login, logout y whoami con device flow y credenciales según security §4.2 · A · 2h ([03-dia-3-cli-contexto.md](03-dia-3-cli-contexto.md))
- `D3-A-04` CLI init: genera genpm.json desde el repo · A · 1h ([03-dia-3-cli-contexto.md](03-dia-3-cli-contexto.md))
- `D3-B-01` core/inject: AGENTS.md por paquete e índice en el AGENTS.md raíz · B · 3h ([03-dia-3-cli-contexto.md](03-dia-3-cli-contexto.md))
- `D3-B-06` CLI search e info · B · 2h ([03-dia-3-cli-contexto.md](03-dia-3-cli-contexto.md))
- `D3-B-07` CLI list con detección de drift y remove (E_DRIFT con fix) · B · 3h ([03-dia-3-cli-contexto.md](03-dia-3-cli-contexto.md))
- `D3-B-08` CLI audit y doctor · B · 2h ([03-dia-3-cli-contexto.md](03-dia-3-cli-contexto.md))
- `D3-B-10` Catálogos del CLI en en y es, flag --lang · B · 2h ([03-dia-3-cli-contexto.md](03-dia-3-cli-contexto.md))
- `D4-A-01` Cron triggers: rollup de Analytics Engine a D1, popularidad, patrocinios y auditoría de tags · A · 3h ([04-dia-4-mcp.md](04-dia-4-mcp.md))
- `D4-A-03` Tests de seguridad de la API: traversal vía d, ref de rama, typosquatting, payloads grandes, inyección FTS · A · 3h ([04-dia-4-mcp.md](04-dia-4-mcp.md))
- `D4-A-04` Suite cross-tenant INV-10 (security §8.4) · A · 2h ([04-dia-4-mcp.md](04-dia-4-mcp.md))

<!-- board:end -->
