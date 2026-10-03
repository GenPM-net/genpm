# Semillas @core/*

> Ref: [seeds/README.md](../seeds/README.md) y [roadmap §5](../docs/roadmap-mvp.md#5-paquetes-semilla--criterio-de-aceptación).
> Ejecutadas mayormente por agentes IA y revisadas por A/B. Cada semilla vive en su propio repo `github.com/genpm-net/<nombre>`.
> Una semilla está **terminada** cuando sus 8 tareas están en DONE. Recorte 6: `email` y `ai` pueden quedar fuera (5 → 3).

## Común

- [ ] `S-00-01` **TODO** Fijar el stack común: TypeScript estricto + Drizzle, agnóstico de framework, adaptadores Hono y Next.js · C · 1h · deps: —
- [ ] `S-00-02` **TODO** Plantilla de AGENTS.md (Propósito, Mapa, Integración, Convenciones, No hacer) y de genpm.json · C · 1h · deps: S-00-01

## @core/db · Día 1–2

- [ ] `S-DB-01` **TODO** Implementar: factoría de cliente Postgres, esquemas por módulo, withTransaction, IDs ULID, timestamps y drizzle-kit · C · 4h · deps: S-00-01, D0-08
- [ ] `S-DB-02` **TODO** AGENTS.md con las 5 secciones · C · 1h · deps: S-DB-01, S-00-02
- [ ] `S-DB-03` **TODO** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-DB-01
- [ ] `S-DB-04` **TODO** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-DB-02, S-DB-03, D3-A-05
- [ ] `S-DB-05` **TODO** Publicado en staging con el CLI real · C · 0.5h · deps: S-DB-04, D3-A-06
- [ ] `S-DB-06` **TODO** Prueba de agente en Claude Code: compila y pasan los tests en < 10 min sin edición humana · C · 0.5h · deps: S-DB-05, D4-B-07
- [ ] `S-DB-07` **TODO** Prueba de agente en Cursor · C · 0.5h · deps: S-DB-06, D4-B-08
- [ ] `S-DB-08` **TODO** Escaneo passed y revisión de dos personas · T · 0.5h · deps: S-DB-07

## @core/auth · Día 2–3

- [ ] `S-AU-01` **TODO** Implementar: sesiones con cookie (hash, rotación, expiración deslizante), OAuth GitHub y Google con arctic, requireUser y getUser() · C · 5h · deps: S-DB-03
- [ ] `S-AU-02` **TODO** AGENTS.md con las 5 secciones · C · 1h · deps: S-AU-01, S-00-02
- [ ] `S-AU-03` **TODO** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-AU-01
- [ ] `S-AU-04` **TODO** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-AU-02, S-AU-03, D3-A-05
- [ ] `S-AU-05` **TODO** Publicado en staging con el CLI real · C · 0.5h · deps: S-AU-04, S-DB-05
- [ ] `S-AU-06` **TODO** Prueba de agente en Claude Code · C · 0.5h · deps: S-AU-05, D4-B-07
- [ ] `S-AU-07` **TODO** Prueba de agente en Cursor · C · 0.5h · deps: S-AU-06, D4-B-08
- [ ] `S-AU-08` **TODO** Escaneo passed y revisión de dos personas · T · 0.5h · deps: S-AU-07

## @core/billing · Día 3–4

- [ ] `S-BI-01` **TODO** Implementar: checkout de suscripción, portal, webhooks idempotentes (stripe_events), sync de subscriptions y hasEntitlement · C · 5h · deps: S-AU-03
- [ ] `S-BI-02` **TODO** AGENTS.md con las 5 secciones y declaración m del MCP de Stripe (verificar paquete y flags vigentes) · C · 1h · deps: S-BI-01, S-00-02
- [ ] `S-BI-03` **TODO** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-BI-01
- [ ] `S-BI-04` **TODO** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-BI-02, S-BI-03, D3-A-05
- [ ] `S-BI-05` **TODO** Publicado en staging con el CLI real · C · 0.5h · deps: S-BI-04, S-AU-05
- [ ] `S-BI-06` **TODO** Prueba de agente en Claude Code (incluye consentimiento MCP) · C · 0.5h · deps: S-BI-05, D4-B-07
- [ ] `S-BI-07` **TODO** Prueba de agente en Cursor · C · 0.5h · deps: S-BI-06, D4-B-08
- [ ] `S-BI-08` **TODO** Escaneo passed y revisión de dos personas · T · 0.5h · deps: S-BI-07

## @core/email · Día 4

- [ ] `S-EM-01` **TODO** Implementar: interfaz EmailProvider (Resend y SMTP), plantillas React Email (bienvenida, magic link, recibo), sendEmail tipado y modo dev · C · 4h · deps: S-00-01
- [ ] `S-EM-02` **TODO** AGENTS.md con las 5 secciones · C · 1h · deps: S-EM-01, S-00-02
- [ ] `S-EM-03` **TODO** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-EM-01
- [ ] `S-EM-04` **TODO** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-EM-02, S-EM-03, D3-A-05
- [ ] `S-EM-05` **TODO** Publicado en staging con el CLI real · C · 0.5h · deps: S-EM-04, D3-A-06
- [ ] `S-EM-06` **TODO** Prueba de agente en Claude Code · C · 0.5h · deps: S-EM-05, D4-B-07
- [ ] `S-EM-07` **TODO** Prueba de agente en Cursor · C · 0.5h · deps: S-EM-06, D4-B-08
- [ ] `S-EM-08` **TODO** Escaneo passed y revisión de dos personas · T · 0.5h · deps: S-EM-07

## @core/ai · Día 4–5

- [ ] `S-AI-01` **TODO** Implementar: chat con streaming, prompts versionados, scaffold de tool-calling, registro de uso y coste en BD, modelo por env · C · 5h · deps: S-DB-03
- [ ] `S-AI-02` **TODO** AGENTS.md con las 5 secciones · C · 1h · deps: S-AI-01, S-00-02
- [ ] `S-AI-03` **TODO** Tests en verde, LICENSE MIT y tag v1.0.0 · C · 1h · deps: S-AI-01
- [ ] `S-AI-04` **TODO** genpm validate sin errores y reglas ≤ 1 500 tokens · C · 0.5h · deps: S-AI-02, S-AI-03, D3-A-05
- [ ] `S-AI-05` **TODO** Publicado en staging con el CLI real · C · 0.5h · deps: S-AI-04, S-DB-05
- [ ] `S-AI-06` **TODO** Prueba de agente en Claude Code · C · 0.5h · deps: S-AI-05, D4-B-07
- [ ] `S-AI-07` **TODO** Prueba de agente en Cursor · C · 0.5h · deps: S-AI-06, D4-B-08
- [ ] `S-AI-08` **TODO** Escaneo passed y revisión de dos personas · T · 0.5h · deps: S-AI-07
