# Marca y diseño

> Ref: [branding §8 y §12](../docs/branding.md#8-identidad-visual), manual [docs/design/genpm-identidad.html](../docs/design/genpm-identidad.html)
> y prototipo [docs/design/genpm-web.html](../docs/design/genpm-web.html). Identidad "Anclado": fondo blanco, sin sombras, color solo con significado.

## Hecho

- [x] `BR-01` **DONE** Concepto visual "Anclado" y cuatro principios · D · 2h · deps: —
- [x] `BR-02` **DONE** Manual de marca: logo, color, tipografía, retícula, componentes, iconos, voz, CLI y badges · D · 4h · deps: BR-01
- [x] `BR-03` **DONE** branding.md §8 actualizado a v0.2 · D · 1h · deps: BR-02
- [x] `BR-04` **DONE** docs/design/tokens.json (claro, oscuro, tipo, espacio, radio, borde, motion, capas) · D · 1h · deps: BR-02
- [x] `BR-05` **DONE** Prototipo navegable de genpm.net: home, búsqueda, paquete, MCP, publicar, docs y login · D · 6h · deps: BR-02
- [x] `BR-06` **DONE** web-ui-spec.md alineado: claro por defecto, foco y colores de capa · D · 0.5h · deps: BR-03

## Activos (branding §12)

- [ ] `BR-07` **TODO** Wordmark genpm▍ e isotipo g▍ en SVG: claro, oscuro y monocromo, con texto convertido a trazos · D · 2h · deps: BR-02
- [ ] `BR-08` **TODO** Favicon: .ico 32/16, apple-touch-icon 180 e icon.svg (a 16 px solo la g) · D · 1h · deps: BR-07
- [ ] `BR-09` **TODO** Avatar de redes: isotipo g▍ blanco sobre ink · D · 0.5h · deps: BR-07
- [ ] `BR-10` **TODO** Plantilla OG 1200×630 para home y por paquete (nombre, versión, resumen, badges de las 3 C) · D · 2h · deps: BR-07
- [ ] `BR-11` **TODO** Badges SVG: versión, installs, mcp y verified (branding §11) · D · 1h · deps: BR-04
- [ ] `BR-12` **TODO** Script que genera tokens.css y el preset de Tailwind desde tokens.json (fuente única para web, badges y OG) · D · 2h · deps: BR-04, D1-A-01
- [ ] `BR-13` **TODO** Validación automática de contraste AA de todos los pares de tokens, claros y oscuros, en CI · D · 1h · deps: BR-12
- [ ] `BR-14` **TODO** Hero del README: SVG animado de terminal o GIF ≤ 2 MB · D · 2h · deps: BR-07
- [ ] `BR-15` **TODO** Self-host de Instrument Sans y JetBrains Mono (subset latino) y Noto Sans JP/SC/KR para CJK · D · 1h · deps: D4-C-01

## Validación

- [ ] `BR-16` **TODO** Test de 5 segundos de la home con 5 desarrolladores: ¿entienden qué hace GenPM? · F · 2h · deps: D5-W-23
- [ ] `BR-17` **TODO** Revisión de accesibilidad del prototipo (teclado, foco, lectores de pantalla) antes de construir la web · D · 1h · deps: BR-05
