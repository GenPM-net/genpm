# Día 5 · Web MVP y pulido del cliente

> Ref: [roadmap §4 Día 5](../docs/roadmap-mvp.md#día-5--web-mvp-y-pulido-del-cliente), [web-ui-spec](../docs/web-ui-spec.md) y prototipo [docs/design/genpm-web.html](../docs/design/genpm-web.html).
> Hito **M5**: web P0 en staging y las 5 semillas aceptadas.

## Web · base

- [x] `D5-W-01` **DONE** Layout global: header sticky, búsqueda en cabecera, footer, skip link y landmarks, según el prototipo · W · 2h · deps: D4-C-01
- [x] `D5-W-02` **DONE** Componentes: CommandBlock, PackageCard, LayerBadges, VerifiedBadge, SponsoredLabel, ScanPill, ShaChip, Tabs, Banner, EmptyState, Skeleton, Toast · W · 4h · deps: D4-C-01
- [x] `D5-W-03` **DONE** Cliente del registry vía Service Binding con caché edge y stale-if-error · W · 2h · deps: D4-C-01, D2-A-04

## Web · páginas P0

- [x] `D5-W-04` **DONE** Home / con hero CLI|MCP, tres capas, featured, trending, cómo funciona, MCP por cliente, seguridad y CTA de publicar · W · 3h · deps: D5-W-02, D5-W-03, D4-A-02
- [x] `D5-W-05` **DONE** Búsqueda /search con estado en la URL, filtros, orden, patrocinado etiquetado y estado vacío · W · 3h · deps: D5-W-02, D5-W-03
- [x] `D5-W-06` **DONE** Página de paquete /p/@scope/name con tabs Overview, AI Rules, Files, MCP, Versions, Dependencies, Security y panel de instalación · W · 5h · deps: D5-W-02, D5-W-03
  - Estados especiales: deprecated, yanked, quarantined, source unavailable. SEO: title, OG, JSON-LD SoftwareSourceCode.
- [x] `D5-W-07` **DONE** MarkdownRenderer sanitizado para contenido no confiable y resaltado con Shiki en el edge · W · 2h · deps: D5-W-06
- [x] `D5-W-08` **DONE** FileTree + CodeViewer desde GitHub git/trees @ SHA, cacheados por SHA · W · 3h · deps: D5-W-06
- [x] `D5-W-09` **DONE** Publisher /@scope · W · 2h · deps: D5-W-02
  - Recorte 2.
- [x] `D5-W-10` **DONE** SearchPalette ⌘K como isla Preact (role=combobox, flechas, ⌘Enter copia el comando) · W · 2h · deps: D5-W-03
- [x] `D5-W-11` **DONE** Tokens /settings/tokens: crear, mostrar una vez, revocar · W · 2h · deps: D5-W-12, D3-A-02
  - Recorte 2.
- [x] `D5-W-12` **DONE** Login con GitHub (OAuth web) y cookies __Host- HttpOnly/Secure/SameSite=Lax · W · 2h · deps: D3-A-01
- [x] `D5-W-13` **DONE** Docs con Starlight en /docs: Quickstart, uso, publicación, referencia del manifiesto, MCP por cliente, códigos de error · W · 4h · deps: D4-C-01
  - Docs propias en Astro (no Starlight): un solo mecanismo de idiomas, sin JS en cliente y la marca del prototipo. Cada página expone su .md. ADR-019.
- [x] `D5-W-14` **DONE** Página /mcp con selector de cliente, bloques copiables y deeplinks donde existan · W · 2h · deps: D5-W-02
- [ ] `D5-W-15` **CUT** OG images por paquete con Satori en el edge, cacheadas por versión · W · 2h · deps: BR-10, D5-W-06
  - Recorte 2.
  - Recorte: plan de recorte 2 (PLAN §6). Se usa la OG de la home (docs/design/brand/og-home.png); la plantilla por paquete existe (og-template.svg) para v0.1.1.
- [x] `D5-W-16` **DONE** Superficies para agentes: /llms.txt, /p/@scope/name.md y /search.md · W · 2h · deps: D5-W-06
- [x] `D5-W-17` **DONE** Routing de 8 idiomas: selector, hreflang y fuentes Noto CJK (i18n §4.4) · W · 3h · deps: D5-W-01, D4-A-06
  - Routing, selector, hreflang y fuentes CJK; los 8 idiomas completos (sin avisos de `check.mjs`).
- [x] `D5-W-18` **DONE** /security/advisories y /.well-known/security.txt · W · 1h · deps: D4-A-05
- [x] `D5-W-19` **DONE** Legal: /terms, /privacy y /policy (uso aceptable y política de paquetes) · W · 2h · deps: D5-W-01
- [x] `D5-W-20` **DONE** 404 con búsqueda sugerida, 500, sitemap.xml, robots.txt y canonical · W · 1h · deps: D5-W-01
- [x] `D5-W-21` **DONE** Reportar paquete: modal con login y POST /v1/reports · W · 2h · deps: D5-W-06, D5-W-12
- [x] `D5-W-22` **DONE** CSP estricta, proxy de imágenes de GitHub, Turnstile y analítica sin cookies (copy_install, search, tab_view…) · W · 2h · deps: D5-W-01
- [ ] `D5-W-23` **BLOCKED** Deploy de apps/web a staging con Service Binding al registry · W · 1h · deps: D5-W-04, D5-W-05, D5-W-06
  - Bloqueo: necesita cuenta Cloudflare (D0-10). Comando: `pnpm --filter @genpm/web deploy:staging` (wrangler usa dist/server/wrangler.json).

## Track B · Pulido del cliente

- [x] `D5-B-01` **DONE** CLI outdated · B · 1h · deps: D3-B-07
  - Recorte 3.
- [x] `D5-B-02` **DONE** Revisar uno a uno los mensajes de error: causa + fix en todos · B · 2h · deps: D3-B-11
  - Test `core/test/error-catalog.test.ts`: todo E_* con message+fix y cada fail()/httpError() pasa sus parámetros (AST). La CLI ahora traduce también los errores sin parámetros. GET /report redirige a /security#report.
- [ ] `D5-B-03` **BLOCKED** Rendimiento: add en frío < 5 s · B · 2h · deps: D3-G-01
  - Bloqueo: la medida real (add en frío < 5 s) es contra staging con las semillas publicadas (D3-G-01). En local, `npx genpm --version` en frío tarda ~1 s (D5-B-04).
- [x] `D5-B-04` **DONE** Empaquetado con tsdown; npx en frío < 2 s · B · 2h · deps: D4-B-01
  - tsdown en cli y mcp con todo dentro (0 dependencias en el tarball; catálogos no usados como stub). `pnpm --filter genpm cold-start` en CI: ~1 s en local.
- [ ] `D5-B-05` **BLOCKED** npm publish --provenance en dry-run desde CI · B · 1h · deps: D5-B-04, D0-09
  - Hecho `.github/workflows/release.yml` (dry-run con provenance en cada push a main, publicación real con tag v*). Bloqueo: npm solo firma provenance desde repos públicos (ADR-016 → D6-P-07) y falta la org npm (D0-09). Pack local verificado: 0 dependencias, bin/exports correctos.

## Gates

- [x] `D5-G-01` **DONE** Lighthouse ≥ 95 (performance, accesibilidad, SEO) en home y página de paquete; JS cliente < 30 KB en home y < 50 KB en paquete · T · 1h · deps: D5-W-04, D5-W-06, D5-W-23
  - Lighthouse 13.5 en build de producción (astro preview): home 97/100/100/100, paquete 98/100/100/100, /es y /search ≥ 97; JS transferido 20,5 KB. Corregido el contraste de `.t-mcp` (MCP sobre wash).
- [ ] `D5-G-02` **TODO** Las 5 semillas pasan la prueba de aceptación de agente en Claude Code y Cursor · T · 0.5h · deps: S-DB-07, S-AU-07, S-BI-07, S-EM-07, S-AI-07
