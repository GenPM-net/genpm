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

- [x] `BR-07` **DONE** Wordmark genpm▍ e isotipo g▍ en SVG: claro, oscuro y monocromo, con texto convertido a trazos · D · 2h · deps: BR-02
- [x] `BR-08` **DONE** Favicon: .ico 32/16, apple-touch-icon 180 e icon.svg (a 16 px solo la g) · D · 1h · deps: BR-07
- [x] `BR-09` **DONE** Avatar de redes: isotipo g▍ blanco sobre ink · D · 0.5h · deps: BR-07
- [x] `BR-10` **DONE** Plantilla OG 1200×630 para home y por paquete (nombre, versión, resumen, badges de las 3 C) · D · 2h · deps: BR-07
  - Plantilla SVG + OG de la home generadas por scripts/brand/gen-assets.mjs (texto convertido a trazos).
- [x] `BR-11` **DONE** Badges SVG: versión, installs, mcp y verified (branding §11) · D · 1h · deps: BR-04
- [x] `BR-12` **DONE** Script que genera tokens.css y el preset de Tailwind desde tokens.json (fuente única para web, badges y OG) · D · 2h · deps: BR-04, D1-A-01
- [x] `BR-13` **DONE** Validación automática de contraste AA de todos los pares de tokens, claros y oscuros, en CI · D · 1h · deps: BR-12
  - Dos pares fallan sobre `wash` (mcp texto 4.40:1, code señal 2.94:1): quedan como excepciones explícitas en scripts/brand/check-contrast.mjs. Decisión de diseño pendiente: oscurecer mcp a #087584 y code a #549800.
- [x] `BR-14` **DONE** Hero del README: SVG animado de terminal o GIF ≤ 2 MB · D · 2h · deps: BR-07
  - `scripts/brand/gen-hero.mjs` → `docs/design/brand/readme-hero.svg` (4 KB, CSS animado, respeta prefers-reduced-motion). Usado en README raíz y de npm.
- [x] `BR-15` **DONE** Self-host de Instrument Sans y JetBrains Mono (subset latino) y Noto Sans JP/SC/KR para CJK · D · 1h · deps: D4-C-01

## Validación

- [ ] `BR-16` **TODO** Test de 5 segundos de la home con 5 desarrolladores: ¿entienden qué hace GenPM? · F · 2h · deps: D5-W-23
- [x] `BR-17` **DONE** Revisión de accesibilidad del prototipo (teclado, foco, lectores de pantalla) antes de construir la web · D · 1h · deps: BR-05
  - Hecha sobre la web construida (15 páginas): lang, título, un h1, <main>, alt, nombres accesibles, labels, ids únicos, sin tabindex positivo, skip link, :focus-visible, tabs con flechas, <dialog> nativo. Corregidos los saltos de encabezado (footer h4→h2, h3 sin h2 previo → h2.h3).
