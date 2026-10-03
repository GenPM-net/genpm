# Paquetes semilla `@core/*`

Los paquetes **no viven en este monorepo**: cada uno es un repo Git público propio (`github.com/genpm-net/<nombre>`, ADR-015)
porque GenPM instala desde tags/SHA de repos reales. Esta carpeta solo contiene su especificación.

Stack común (Q3): **TypeScript estricto + Drizzle ORM**, agnóstico de framework, con adaptadores para **Hono** y **Next.js (route handlers)**.
Las semillas se eligieron para demostrar todas las capacidades del manifiesto. Cada una publica su resumen `s` en los 8 idiomas y sus reglas `AGENTS.md` en inglés; todas pasan las puertas de seguridad ([security §10](../docs/security.md#10-puertas-de-seguridad-del-lanzamiento-día-6)) con revisión de dos personas.

| Paquete | Demuestra | `d` | `g` (deps GenPM) | `p` (npm) | `e` (env) | `m` (MCP) |
|---|---|---|---|---|---|---|
| `@core/db` | Base de composición | `src/lib/db` | — | `drizzle-orm`, `postgres` | `DATABASE_URL` | — |
| `@core/auth` | Dependencia `g`, adaptadores | `src/lib/auth` | `@core/db ^1` | `arctic`, `@oslojs/crypto`, `@oslojs/encoding` | `AUTH_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | — |
| `@core/billing` | Cadena de deps + **MCP** | `src/lib/billing` | `@core/db ^1`, `@core/auth ^1` | `stripe` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe (`npx -y @stripe/mcp`) — verificar paquete y flags vigentes |
| `@core/email` | Módulo independiente, plantillas | `src/lib/email` | — | `resend`, `@react-email/components` | `RESEND_API_KEY`, `EMAIL_FROM` | — |
| `@core/ai` | Caso "vibe coding" nativo | `src/lib/ai` | `@core/db ^1` (log de uso) | `ai` + proveedor | `AI_PROVIDER_API_KEY`, `AI_MODEL` | — |

## Stack común (S-00-01)

| Pieza | Decisión |
|---|---|
| Lenguaje | TypeScript `strict` + `noUncheckedIndexedAccess`, ESM, imports con extensión `.js`, Node ≥ 20.11 |
| Base de datos | Drizzle ORM 0.45 sobre Postgres (`postgres` 3). Tipos de la BD como `PgDatabase` genérico: el mismo código corre con `postgres`, Neon, PGlite o node-postgres |
| Esquemas | Cada módulo es dueño de su `schema.ts` (`src/lib/<modulo>/schema.ts`); `drizzle-kit` los recoge con un glob, así ningún módulo edita las tablas de otro |
| Dependencias entre módulos | Imports relativos (`../db/index.js`) que asumen las rutas `d` por defecto; el `AGENTS.md` explica qué cambiar si se usó `--dest` |
| Frameworks | Núcleo agnóstico (funciones que reciben `Request`/valores); adaptadores finos en `adapters/hono.ts` y `adapters/next.ts` |
| Tests | Vitest + PGlite (Postgres en WASM, sin servicios externos); se excluyen de la inyección con `.genpmignore` |
| Reglas | `AGENTS.md` en inglés con las 5 secciones de [templates/AGENTS.md](templates/AGENTS.md), ≤ 1 500 tokens |

### Flujo de desarrollo

Las 5 semillas se desarrollan juntas en un workspace propio, **fuera de este monorepo** (`../genpm-seeds`), con la misma
estructura que un proyecto consumidor (`src/lib/{db,auth,billing,email,ai}`): así los imports relativos entre módulos se
prueban tal y como quedarán tras `genpm add`. Al publicar, cada carpeta se separa en su repo con
`git subtree split --prefix src/lib/<nombre> -b <nombre>` y se empuja a `github.com/genpm-net/<nombre>` con el tag `v1.0.0`.
Plantillas: [templates/](templates/).

## Alcance funcional

### `@core/db`
Factoría de cliente (Postgres vía `postgres`; SQLite/D1 como variante documentada), convención de esquemas por módulo
(cada módulo con su `src/lib/<modulo>/schema.ts`, recogidos por glob), helper `withTransaction`, IDs ULID, timestamps estándar, scripts de migración `drizzle-kit`.
Reglas clave: cómo añade cada módulo sus tablas sin tocar las de otros.

### `@core/auth`
Sesiones con cookie (tokens aleatorios con hash en BD, rotación, expiración deslizante), OAuth GitHub y Google con `arctic`,
tablas `users`, `sessions`, `oauth_accounts`, middleware `requireUser` para Hono y helper `getUser()` para Next. Sin roles (fuera de alcance, documentado).

### `@core/billing`
Checkout de suscripción, portal de cliente, handler de webhooks **idempotente** (tabla `stripe_events`), sincronización de
`subscriptions`, helper `hasEntitlement(user, feature)`. El MCP de Stripe permite al agente consultar productos/precios reales al integrar.

### `@core/email`
Interfaz `EmailProvider` (Resend por defecto, SMTP como alternativa), plantillas React Email (bienvenida, magic link, recibo),
`sendEmail()` tipado por plantilla, modo dev que imprime en consola.

### `@core/ai`
Endpoint de chat con streaming, registro de prompts versionados, scaffold de tool-calling, registro de uso (tokens/coste) en BD,
proveedor y modelo configurables por env (sin modelo hardcodeado).

## Criterio de "terminado"
Ver [docs/roadmap-mvp.md §5](../docs/roadmap-mvp.md#5-paquetes-semilla--criterio-de-aceptación).
