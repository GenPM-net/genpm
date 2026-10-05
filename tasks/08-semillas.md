# Semillas @core/*

> Ref: [seeds/README.md](../seeds/README.md) y [roadmap §5](../docs/roadmap-mvp.md#5-paquetes-semilla--criterio-de-aceptación).
> Ejecutadas mayormente por agentes IA y revisadas por A/B. Cada semilla vive en su propio repo `github.com/genpm-net/<nombre>`.
> Una semilla está **terminada** cuando sus 8 tareas están en DONE. Recorte 6: `email` y `ai` pueden quedar fuera (5 → 3).


> **Estado (2026-10-03):** las 5 semillas están implementadas en `../genpm-seeds` (fuera del monorepo, ver seeds/README.md):
> 29 tests en verde con PGlite, `genpm validate` sin errores (reglas de 517 a 670 tokens) y prueba de portabilidad: copiadas
> como las inyecta GenPM en un proyecto Hono vacío y en uno estilo Next.js, compilan con solo las dependencias `p`, y
> `drizzle-kit generate` crea las 7 tablas. Bloqueado: publicar en staging (D0-10/D0-11, repos `genpm-net/<nombre>`),
> pruebas de agente en Claude Code y Cursor, y revisión de seguridad (ADR-023).

## Común

- [x] `S-00-01` **DONE** Fijar el stack común: TypeScript estricto + Drizzle, agnóstico de framework, adaptadores Hono y Next.js · C · 1h · deps: —
- [x] `S-00-02` **DONE** Plantilla de AGENTS.md (Propósito, Mapa, Integración, Convenciones, No hacer) y de genpm.json · C · 1h · deps: S-00-01

## @core/db · Día 1–2

- [x] `S-DB-01` **DONE** Implementar: factoría de cliente Postgres, esquemas por módulo, withTransaction, IDs ULID, timestamps y drizzle-kit · C · 4h · deps: S-00-01, D0-08
- [x] `S-DB-02` **DONE** AGENTS.md con las 5 secciones · C · 1h · deps: S-DB-01, S-00-02
- [x] `S-DB-03` **DONE** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-DB-01
  - Tests en verde (Vitest + PGlite) y LICENSE MIT en `../genpm-seeds/src/lib/db`. El tag `v1.0.0` se crea al separar el repo (`git subtree split`) en la publicación (S-DB-05).
- [x] `S-DB-04` **DONE** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-DB-02, S-DB-03, D3-A-05
- [x] `S-DB-05` **DONE** Publicado en staging con el CLI real · C · 0.5h · deps: S-DB-04, D3-A-06
  - Publicadas directamente en producción (más exigente que staging): v1.0.0 con el CLI y v1.0.1/1.1.0 con el asistente web el 2026-10-05.
- [x] `S-DB-06` **DONE** Prueba de agente en Claude Code: compila y pasan los tests en < 10 min sin edición humana · C · 0.5h · deps: S-DB-05, D4-B-07
  - 2026-10-05: SaaS completo (db + auth 1.1.0 + billing + email + ai) solo con el MCP y las reglas, `tsc` sin errores en < 10 min; endpoints verificados. Fricción arreglada: auth 1.1.0 añade `isNewUser`/`onLogin` (el correo de bienvenida obligaba a editar auth).
- [ ] `S-DB-07` **BLOCKED** Prueba de agente en Cursor · C · 0.5h · deps: S-DB-06, D4-B-08
- [ ] `S-DB-08` **BLOCKED** Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h · deps: S-DB-07
  - Revisión con IA (ADR-023 paso 2) hecha el 2026-10-05 sobre las 5 semillas: open redirect en auth (`/<TAB>/evil.com`), mensajes `system` y sin límites en ai, instantánea de Stripe en billing → arreglados en auth 1.0.1, ai 1.0.1, billing 1.0.1. Pendiente: CI verde y autorrevisión diferida del fundador.

## @core/auth · Día 2–3

- [x] `S-AU-01` **DONE** Implementar: sesiones con cookie (hash, rotación, expiración deslizante), OAuth GitHub y Google con arctic, requireUser y getUser() · C · 5h · deps: S-DB-03
- [x] `S-AU-02` **DONE** AGENTS.md con las 5 secciones · C · 1h · deps: S-AU-01, S-00-02
- [x] `S-AU-03` **DONE** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-AU-01
- [x] `S-AU-04` **DONE** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-AU-02, S-AU-03, D3-A-05
- [x] `S-AU-05` **DONE** Publicado en staging con el CLI real · C · 0.5h · deps: S-AU-04, S-DB-05
- [x] `S-AU-06` **DONE** Prueba de agente en Claude Code · C · 0.5h · deps: S-AU-05, D4-B-07
- [ ] `S-AU-07` **BLOCKED** Prueba de agente en Cursor · C · 0.5h · deps: S-AU-06, D4-B-08
- [ ] `S-AU-08` **BLOCKED** Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h · deps: S-AU-07

## @core/billing · Día 3–4

- [x] `S-BI-01` **DONE** Implementar: checkout de suscripción, portal, webhooks idempotentes (stripe_events), sync de subscriptions y hasEntitlement · C · 5h · deps: S-AU-03
- [x] `S-BI-02` **DONE** AGENTS.md con las 5 secciones y declaración m del MCP de Stripe (verificar paquete y flags vigentes) · C · 1h · deps: S-BI-01, S-00-02
- [x] `S-BI-03` **DONE** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-BI-01
- [x] `S-BI-04` **DONE** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-BI-02, S-BI-03, D3-A-05
- [x] `S-BI-05` **DONE** Publicado en staging con el CLI real · C · 0.5h · deps: S-BI-04, S-AU-05
- [x] `S-BI-06` **DONE** Prueba de agente en Claude Code (incluye consentimiento MCP) · C · 0.5h · deps: S-BI-05, D4-B-07
- [ ] `S-BI-07` **BLOCKED** Prueba de agente en Cursor · C · 0.5h · deps: S-BI-06, D4-B-08
- [ ] `S-BI-08` **BLOCKED** Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h · deps: S-BI-07

## @core/email · Día 4

- [x] `S-EM-01` **DONE** Implementar: interfaz EmailProvider (Resend y SMTP), plantillas React Email (bienvenida, magic link, recibo), sendEmail tipado y modo dev · C · 4h · deps: S-00-01
- [x] `S-EM-02` **DONE** AGENTS.md con las 5 secciones · C · 1h · deps: S-EM-01, S-00-02
- [x] `S-EM-03` **DONE** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-EM-01
- [x] `S-EM-04` **DONE** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-EM-02, S-EM-03, D3-A-05
- [x] `S-EM-05` **DONE** Publicado en staging con el CLI real · C · 0.5h · deps: S-EM-04, D3-A-06
- [x] `S-EM-06` **DONE** Prueba de agente en Claude Code · C · 0.5h · deps: S-EM-05, D4-B-07
- [ ] `S-EM-07` **BLOCKED** Prueba de agente en Cursor · C · 0.5h · deps: S-EM-06, D4-B-08
- [ ] `S-EM-08` **BLOCKED** Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h · deps: S-EM-07

## @core/ai · Día 4–5

- [x] `S-AI-01` **DONE** Implementar: chat con streaming, prompts versionados, scaffold de tool-calling, registro de uso y coste en BD, modelo por env · C · 5h · deps: S-DB-03
- [x] `S-AI-02` **DONE** AGENTS.md con las 5 secciones · C · 1h · deps: S-AI-01, S-00-02
- [x] `S-AI-03` **DONE** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-AI-01
- [x] `S-AI-04` **DONE** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-AI-02, S-AI-03, D3-A-05
- [x] `S-AI-05` **DONE** Publicado en staging con el CLI real · C · 0.5h · deps: S-AI-04, S-DB-05
- [x] `S-AI-06` **DONE** Prueba de agente en Claude Code · C · 0.5h · deps: S-AI-05, D4-B-07
- [ ] `S-AI-07` **BLOCKED** Prueba de agente en Cursor · C · 0.5h · deps: S-AI-06, D4-B-08
- [ ] `S-AI-08` **BLOCKED** Escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h · deps: S-AI-07
