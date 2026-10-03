# Día 4 · Servidor MCP

> Ref: [roadmap §4 Día 4](../docs/roadmap-mvp.md#día-4--servidor-mcp) y [cli-mcp-spec parte B](../docs/cli-mcp-spec.md). Hito **M4**: instalación conversacional en Claude Code y Cursor.

## Track A · Plataforma

- [ ] `D4-A-01` **TODO** Cron triggers: rollup de Analytics Engine a D1, popularidad, patrocinios y auditoría de tags · A · 3h · deps: D2-A-06
- [ ] `D4-A-02` **TODO** GET /v1/featured, /v1/stats y /v1/badge/:scope/:name.svg con los colores de branding §11 · A · 2h · deps: D4-A-01
- [ ] `D4-A-03` **TODO** Tests de seguridad de la API: traversal vía d, ref de rama, typosquatting, payloads grandes, inyección FTS · A · 3h · deps: D2-A-06, D2-A-01
- [ ] `D4-A-04` **TODO** Suite cross-tenant INV-10 (security §8.4) · A · 2h · deps: D2-A-03
- [ ] `D4-A-05` **TODO** GET /v1/advisories y su consumo en genpm audit · A · 2h · deps: D3-B-08
- [ ] `D4-A-06` **TODO** Bot de traducción y checks de i18n en CI; generar pt-BR y nivel 2 (ja, zh-CN, ko, fr, de) · A · 3h · deps: D3-B-10

## Track B · Cliente

- [ ] `D4-B-01` **TODO** @genpm/mcp tools: search, info, add (dryRun/planId), list, remove, outdated, audit, validate · B · 5h · deps: D3-B-05, D3-B-06, D3-B-07
- [ ] `D4-B-02` **TODO** Reglas de paquetes delimitadas como contenido de terceros + instructions del servidor · B · 1h · deps: D4-B-01
- [ ] `D4-B-03` **TODO** Resources y prompts genpm-find y genpm-integrate · B · 2h · deps: D4-B-01
- [ ] `D4-B-04` **TODO** Raíces vía roots/list y candado .genpm/.lock · B · 1h · deps: D4-B-01
- [ ] `D4-B-05` **TODO** Tests de contrato con InMemoryTransport y test de respuestas < 1 500 tokens · B · 2h · deps: D4-B-01
- [ ] `D4-B-06` **TODO** genpm mcp setup, add y remove con adaptadores por cliente (Claude Code, Cursor, VS Code, Windsurf, Codex) · B · 3h · deps: D3-B-04
  - Recorte 3: add/remove pueden pasar a v0.1.1; setup se mantiene.
- [ ] `D4-B-07` **TODO** Prueba real en Claude Code con el guion "Añade auth y billing a este proyecto" · B · 1h · deps: D4-B-05, D4-B-06
- [ ] `D4-B-08` **TODO** Prueba real en Cursor con el mismo guion · B · 1h · deps: D4-B-05, D4-B-06

## Track C · Contenido y web

- [ ] `D4-C-01` **TODO** Scaffold de apps/web: Astro SSR + adapter Cloudflare + islas Preact + preset Tailwind desde docs/design/tokens.json · C · 3h · deps: D1-A-01, BR-12
- Semillas: ver [08-semillas.md](08-semillas.md) (`S-BI-*`, `S-EM-*`, `S-AI-01`).

## Gates

- [ ] `D4-G-01` **TODO** En Claude Code y Cursor, "añade login con GitHub" instala el módulo llamando primero a genpm_add con dryRun:true · T · 1h · deps: D4-B-07, D4-B-08
- [ ] `D4-G-02` **TODO** Todas las respuestas de tools < 1 500 tokens (test automatizado) · T · 0.5h · deps: D4-B-05
