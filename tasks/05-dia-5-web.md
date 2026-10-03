# Día 5 · Web MVP y pulido del cliente

> Ref: [roadmap §4 Día 5](../docs/roadmap-mvp.md#día-5--web-mvp-y-pulido-del-cliente), [web-ui-spec](../docs/web-ui-spec.md) y prototipo [docs/design/genpm-web.html](../docs/design/genpm-web.html).
> Hito **M5**: web P0 en staging y las 5 semillas aceptadas.

## Web · base

- [ ] `D5-W-01` **TODO** Layout global: header sticky, búsqueda en cabecera, footer, skip link y landmarks, según el prototipo · W · 2h · deps: D4-C-01
- [ ] `D5-W-02` **TODO** Componentes: CommandBlock, PackageCard, LayerBadges, VerifiedBadge, SponsoredLabel, ScanPill, ShaChip, Tabs, Banner, EmptyState, Skeleton, Toast · W · 4h · deps: D4-C-01
- [ ] `D5-W-03` **TODO** Cliente del registry vía Service Binding con caché edge y stale-if-error · W · 2h · deps: D4-C-01, D2-A-04

## Web · páginas P0

- [ ] `D5-W-04` **TODO** Home / con hero CLI|MCP, tres capas, featured, trending, cómo funciona, MCP por cliente, seguridad y CTA de publicar · W · 3h · deps: D5-W-02, D5-W-03, D4-A-02
- [ ] `D5-W-05` **TODO** Búsqueda /search con estado en la URL, filtros, orden, patrocinado etiquetado y estado vacío · W · 3h · deps: D5-W-02, D5-W-03
- [ ] `D5-W-06` **TODO** Página de paquete /p/@scope/name con tabs Overview, AI Rules, Files, MCP, Versions, Dependencies, Security y panel de instalación · W · 5h · deps: D5-W-02, D5-W-03
  - Estados especiales: deprecated, yanked, quarantined, source unavailable. SEO: title, OG, JSON-LD SoftwareSourceCode.
- [ ] `D5-W-07` **TODO** MarkdownRenderer sanitizado para contenido no confiable y resaltado con Shiki en el edge · W · 2h · deps: D5-W-06
- [ ] `D5-W-08` **TODO** FileTree + CodeViewer desde GitHub git/trees @ SHA, cacheados por SHA · W · 3h · deps: D5-W-06
- [ ] `D5-W-09` **TODO** Publisher /@scope · W · 2h · deps: D5-W-02
  - Recorte 2.
- [ ] `D5-W-10` **TODO** SearchPalette ⌘K como isla Preact (role=combobox, flechas, ⌘Enter copia el comando) · W · 2h · deps: D5-W-03
- [ ] `D5-W-11` **TODO** Tokens /settings/tokens: crear, mostrar una vez, revocar · W · 2h · deps: D5-W-12, D3-A-02
  - Recorte 2.
- [ ] `D5-W-12` **TODO** Login con GitHub (OAuth web) y cookies __Host- HttpOnly/Secure/SameSite=Lax · W · 2h · deps: D3-A-01
- [ ] `D5-W-13` **TODO** Docs con Starlight en /docs: Quickstart, uso, publicación, referencia del manifiesto, MCP por cliente, códigos de error · W · 4h · deps: D4-C-01
- [ ] `D5-W-14` **TODO** Página /mcp con selector de cliente, bloques copiables y deeplinks donde existan · W · 2h · deps: D5-W-02
- [ ] `D5-W-15` **TODO** OG images por paquete con Satori en el edge, cacheadas por versión · W · 2h · deps: BR-10, D5-W-06
  - Recorte 2.
- [ ] `D5-W-16` **TODO** Superficies para agentes: /llms.txt, /p/@scope/name.md y /search.md · W · 2h · deps: D5-W-06
- [ ] `D5-W-17` **TODO** Routing de 8 idiomas: selector, hreflang y fuentes Noto CJK (i18n §4.4) · W · 3h · deps: D5-W-01, D4-A-06
- [ ] `D5-W-18` **TODO** /security/advisories y /.well-known/security.txt · W · 1h · deps: D4-A-05
- [ ] `D5-W-19` **TODO** Legal: /terms, /privacy y /policy (uso aceptable y política de paquetes) · W · 2h · deps: D5-W-01
- [ ] `D5-W-20` **TODO** 404 con búsqueda sugerida, 500, sitemap.xml, robots.txt y canonical · W · 1h · deps: D5-W-01
- [ ] `D5-W-21` **TODO** Reportar paquete: modal con login y POST /v1/reports · W · 2h · deps: D5-W-06, D5-W-12
- [ ] `D5-W-22` **TODO** CSP estricta, proxy de imágenes de GitHub, Turnstile y analítica sin cookies (copy_install, search, tab_view…) · W · 2h · deps: D5-W-01
- [ ] `D5-W-23` **TODO** Deploy de apps/web a staging con Service Binding al registry · W · 1h · deps: D5-W-04, D5-W-05, D5-W-06

## Track B · Pulido del cliente

- [ ] `D5-B-01` **TODO** CLI outdated · B · 1h · deps: D3-B-07
  - Recorte 3.
- [ ] `D5-B-02` **TODO** Revisar uno a uno los mensajes de error: causa + fix en todos · B · 2h · deps: D3-B-11
- [ ] `D5-B-03` **TODO** Rendimiento: add en frío < 5 s · B · 2h · deps: D3-G-01
- [ ] `D5-B-04` **TODO** Empaquetado con tsdown; npx en frío < 2 s · B · 2h · deps: D4-B-01
- [ ] `D5-B-05` **TODO** npm publish --provenance en dry-run desde CI · B · 1h · deps: D5-B-04, D0-09

## Gates

- [ ] `D5-G-01` **TODO** Lighthouse ≥ 95 (performance, accesibilidad, SEO) en home y página de paquete; JS cliente < 30 KB en home y < 50 KB en paquete · T · 1h · deps: D5-W-04, D5-W-06, D5-W-23
- [ ] `D5-G-02` **TODO** Las 5 semillas pasan la prueba de aceptación de agente en Claude Code y Cursor · T · 0.5h · deps: S-DB-07, S-AU-07, S-BI-07, S-EM-07, S-AI-07
