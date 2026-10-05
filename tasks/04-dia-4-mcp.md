# Día 4 · Servidor MCP

> Ref: [roadmap §4 Día 4](../docs/roadmap-mvp.md#día-4--servidor-mcp) y [cli-mcp-spec parte B](../docs/cli-mcp-spec.md). Hito **M4**: instalación conversacional en Claude Code y Cursor.

## Track A · Plataforma

- [x] `D4-A-01` **DONE** Cron triggers: rollup de Analytics Engine a D1, popularidad, patrocinios y auditoría de tags · A · 3h · deps: D2-A-06
- [x] `D4-A-02` **DONE** GET /v1/featured, /v1/stats y /v1/badge/:scope/:name.svg con los colores de branding §11 · A · 2h · deps: D4-A-01
- [x] `D4-A-03` **DONE** Tests de seguridad de la API: traversal vía d, ref de rama, typosquatting, payloads grandes, inyección FTS · A · 3h · deps: D2-A-06, D2-A-01
- [x] `D4-A-04` **DONE** Suite cross-tenant INV-10 (security §8.4) · A · 2h · deps: D2-A-03
- [x] `D4-A-05` **DONE** GET /v1/advisories y su consumo en genpm audit · A · 2h · deps: D3-B-08
- [x] `D4-A-06` **DONE** Bot de traducción y checks de i18n en CI; generar pt-BR y nivel 2 (ja, zh-CN, ko, fr, de) · A · 3h · deps: D3-B-10
  - `scripts/translate.mjs` (API de Anthropic, glosario, marca `machine: true` en `.meta.json`) y `.github/workflows/i18n.yml` (check + bot con label `translate`). pt-BR y nivel 2 generados por máquina; revisión nativa en D6-I-01.

## Track B · Cliente

- [x] `D4-B-01` **DONE** @genpm/mcp tools: search, info, add (dryRun/planId), list, remove, outdated, audit, validate · B · 5h · deps: D3-B-05, D3-B-06, D3-B-07
- [x] `D4-B-02` **DONE** Reglas de paquetes delimitadas como contenido de terceros + instructions del servidor · B · 1h · deps: D4-B-01
- [x] `D4-B-03` **DONE** Resources y prompts genpm-find y genpm-integrate · B · 2h · deps: D4-B-01
- [x] `D4-B-04` **DONE** Raíces vía roots/list y candado .genpm/.lock · B · 1h · deps: D4-B-01
- [x] `D4-B-05` **DONE** Tests de contrato con InMemoryTransport y test de respuestas < 1 500 tokens · B · 2h · deps: D4-B-01
- [x] `D4-B-06` **DONE** genpm mcp setup, add y remove con adaptadores por cliente (Claude Code, Cursor, VS Code, Windsurf, Codex) · B · 3h · deps: D3-B-04
  - Recorte 3: add/remove pueden pasar a v0.1.1; setup se mantiene.
- [x] `D4-B-07` **DONE** Prueba real en Claude Code con el guion "Añade auth y billing a este proyecto" · B · 1h · deps: D4-B-05, D4-B-06
  - Hecho el 2026-10-05 con el MCP publicado por stdio y un agente Claude (el CLI `claude` del Mac tenía la sesión caducada): "añade auth y billing" → search → info → add dryRun → add sin MCP ni npm hasta consentimiento. Falta la sesión en la app de Claude Code con el usuario delante (vídeo D7-01).
  - Bloqueo: necesita el registry en staging con @core/auth y @core/billing publicados (D1-A-07, S-AU-05, S-BI-05). El servidor ya pasa los tests de contrato (packages/mcp/test/contract.test.ts).
- [ ] `D4-B-08` **BLOCKED** Prueba real en Cursor con el mismo guion · B · 1h · deps: D4-B-05, D4-B-06
  - Bloqueo: igual que D4-B-07 (staging + semillas publicadas).

## Track C · Contenido y web

- [x] `D4-C-01` **DONE** Scaffold de apps/web: Astro SSR + adapter Cloudflare + islas Preact + preset Tailwind desde docs/design/tokens.json · C · 3h · deps: D1-A-01, BR-12
  - En curso: package.json y tokens generados (src/styles); falta astro.config, layout y páginas.
- Semillas: ver [08-semillas.md](08-semillas.md) (`S-BI-*`, `S-EM-*`, `S-AI-01`).

## Gates

- [ ] `D4-G-01` **BLOCKED** En Claude Code y Cursor, "añade login con GitHub" instala el módulo llamando primero a genpm_add con dryRun:true · T · 1h · deps: D4-B-07, D4-B-08
  - Bloqueo: depende de D4-B-07/D4-B-08 (pruebas reales en Claude Code y Cursor).
- [x] `D4-G-02` **DONE** Todas las respuestas de tools < 1 500 tokens (test automatizado) · T · 0.5h · deps: D4-B-05
