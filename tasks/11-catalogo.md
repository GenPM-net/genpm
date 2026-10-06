# Catálogo de paquetes y kits

> Ref: [docs/catalogo/README.md](../docs/catalogo/README.md) y [ADR-033](../docs/brainstorming.md) (✅ decidida).
> Nivel épica: cada tarea "Implementar y publicar" cubre las 8 tareas de una semilla (implementar, AGENTS.md, tests,
> validate, publicar, prueba de agente en Claude Code y en Cursor, revisión ADR-023) y se desglosa al empezar su fase.
> El DoD de cada paquete y kit está en [catálogo §8](../docs/catalogo/README.md#8-definición-de-terminado); su alcance, en su ficha.

## F0 · Decisiones

- [x] `CAT-00-01` **DONE** Decidir ADR-033 y las preguntas C1–C6 del catálogo (admin propio vs. CMS existente, scope de los kits, Next primero, licencias, proveedores, impuestos) · F · 2h · deps: —
- [ ] `CAT-00-02` **DOING** Workspace de desarrollo del catálogo (como ../genpm-seeds) con app Next de ejemplo, PGlite, Playwright y Changesets por tren · C · 4h · deps: CAT-00-01
  - Hecho (2026-10-06): `catalog/` con estructura de proyecto consumidor, PGlite, `scripts/meta.mjs`, `scripts/validate.sh` y job `catalog` en CI. Falta: app Next de ejemplo, Playwright y Changesets (con los primeros paquetes de UI).
- [ ] `CAT-00-03` **BLOCKED** Implementar y publicar @core/contracts (capa-1-transversales.md) · C · 6h · deps: CAT-00-02
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/contracts` (2026-10-06). Falta crear el repo `genpm-net/contracts` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-00-04` **BLOCKED** Implementar y publicar @core/ui con tokens claro/oscuro y axe sin violaciones · C · 12h · deps: CAT-00-02
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/ui` (2026-10-06). Falta crear el repo `genpm-net/ui` (fundador), publicar, pruebas de agente y revisión ADR-023.

## F1 · CMS (kit-cms)

- [ ] `CAT-CMS-01` **BLOCKED** Implementar y publicar @core/rbac · C · 8h · deps: CAT-00-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/rbac` (2026-10-06). Falta crear el repo `genpm-net/rbac` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-02` **BLOCKED** Implementar y publicar @core/storage (S3/R2/MinIO y local) · C · 8h · deps: CAT-00-02
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/storage` (2026-10-06). Falta crear el repo `genpm-net/storage` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-03` **BLOCKED** Implementar y publicar @core/jobs (cola Postgres, cron y runDue serverless) · C · 10h · deps: CAT-00-02
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/jobs` (2026-10-06). Falta crear el repo `genpm-net/jobs` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-04` **BLOCKED** Implementar y publicar @core/antispam (Turnstile, honeypot, rate limit) · C · 6h · deps: CAT-00-02
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/antispam` (2026-10-06). Falta crear el repo `genpm-net/antispam` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-05` **BLOCKED** Implementar y publicar @core/admin (shell, CRUD genérico de AdminResource, auditoría) · C · 32h · deps: CAT-00-04, CAT-CMS-01
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/admin` (2026-10-06). Falta crear el repo `genpm-net/admin` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-06` **BLOCKED** Implementar y publicar @core/content (colecciones, singletons, revisiones, programación, vista previa, retrofit) · C · 28h · deps: CAT-00-03, CAT-CMS-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/content` (2026-10-06). Falta crear el repo `genpm-net/content` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-07` **BLOCKED** Implementar y publicar @core/media (subida firmada, variantes, saneado de SVG y EXIF) · C · 14h · deps: CAT-CMS-02, CAT-00-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/media` (2026-10-06). Falta crear el repo `genpm-net/media` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-08` **BLOCKED** Implementar y publicar @core/rich-text (Tiptap, JSON, render anti-XSS) · C · 14h · deps: CAT-CMS-07
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/rich-text` (2026-10-06). Falta crear el repo `genpm-net/rich-text` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-09` **BLOCKED** Implementar y publicar @core/site (ajustes, menús, redirecciones sin open redirect) · C · 8h · deps: CAT-CMS-06
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/site` (2026-10-06). Falta crear el repo `genpm-net/site` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-10` **BLOCKED** Implementar y publicar @core/seo (metadatos, sitemap, robots, llms.txt, JSON-LD, OG) · C · 12h · deps: CAT-CMS-09
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/seo` (2026-10-06). Falta crear el repo `genpm-net/seo` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-11` **BLOCKED** Implementar y publicar @core/search (tsvector + pg_trgm, SearchSource) · C · 10h · deps: CAT-00-03, CAT-CMS-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/search` (2026-10-06). Falta crear el repo `genpm-net/search` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-12` **BLOCKED** Implementar y publicar @core/forms (definiciones, envíos, emails, webhook firmado) · C · 10h · deps: CAT-CMS-04, CAT-CMS-06
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/forms` (2026-10-06). Falta crear el repo `genpm-net/forms` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-13` **BLOCKED** Implementar y publicar @core/blocks (15 bloques, campo blocks en admin) · C · 20h · deps: CAT-CMS-08, CAT-00-04
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/blocks` (2026-10-06). Falta crear el repo `genpm-net/blocks` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-14` **BLOCKED** Implementar y publicar @core/kit-cms (rutas /admin, páginas, vista previa, cron, registro en src/genpm) · C · 20h · deps: CAT-CMS-05, CAT-CMS-10, CAT-CMS-11, CAT-CMS-12, CAT-CMS-13
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/app/(cms)` (2026-10-06). Falta crear el repo `genpm-net/kit-cms` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-CMS-15` **TODO** Aceptación kit-cms: retrofit de un sitio Next de 5 páginas con snapshots idénticos y sitio nuevo desde cero en < 30 min de agente · T · 4h · deps: CAT-CMS-14

## F2 · Blog (kit-blog)

- [ ] `CAT-BLG-01` **BLOCKED** Implementar y publicar @core/blog (colecciones, feeds RSS/Atom/JSON, relacionados) · C · 12h · deps: CAT-CMS-08, CAT-CMS-06
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/blog` (2026-10-06). Falta crear el repo `genpm-net/blog` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-BLG-02` **BLOCKED** Implementar y publicar @core/comments (moderación, valoración opcional, borrado RGPD) · C · 12h · deps: CAT-CMS-01, CAT-CMS-04
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/comments` (2026-10-06). Falta crear el repo `genpm-net/comments` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-BLG-03` **BLOCKED** Implementar y publicar @core/newsletter (doble opt-in, baja RFC 8058, campañas por lotes) · C · 16h · deps: CAT-CMS-03, CAT-CMS-04, CAT-CMS-08
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/newsletter` (2026-10-06). Falta crear el repo `genpm-net/newsletter` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-BLG-04` **BLOCKED** Implementar y publicar @core/kit-blog · C · 14h · deps: CAT-CMS-14, CAT-BLG-01, CAT-BLG-02, CAT-BLG-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/app/(blog)` (2026-10-06). Falta crear el repo `genpm-net/kit-blog` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-BLG-05` **TODO** Aceptación kit-blog: prueba de agente, feeds válidos y Lighthouse ≥ 95 · T · 3h · deps: CAT-BLG-04

## F3 · Landing (kit-landing)

- [ ] `CAT-LND-01` **BLOCKED** Implementar y publicar @core/consent (banner, ConsentGate, registro de prueba) · C · 10h · deps: CAT-00-04
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/consent` (2026-10-06). Falta crear el repo `genpm-net/consent` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-LND-02` **BLOCKED** Implementar y publicar @core/pixels (GA4, Meta Pixel + CAPI, TikTok + Events API con deduplicación) · C · 14h · deps: CAT-LND-01, CAT-00-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/pixels` (2026-10-06). Falta crear el repo `genpm-net/pixels` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-LND-03` **BLOCKED** Implementar y publicar @core/kit-landing · C · 12h · deps: CAT-CMS-14, CAT-LND-02
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/app/(landing)` (2026-10-06). Falta crear el repo `genpm-net/kit-landing` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-LND-04` **TODO** Aceptación kit-landing: 0 peticiones a terceros sin consentimiento y Lighthouse móvil ≥ 95 · T · 3h · deps: CAT-LND-03

## F4 · Tienda (kit-store)

- [ ] `CAT-STO-01` **BLOCKED** Implementar y publicar @core/money (tests de propiedades) · C · 6h · deps: CAT-00-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/money` (2026-10-06). Falta crear el repo `genpm-net/money` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-02` **BLOCKED** Implementar y publicar @core/stripe y migrar @core/billing a 2.0 sobre él · C · 12h · deps: CAT-00-02
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/stripe`, y @core/billing 2.0 sobre él en `catalog/src/lib/billing` con sus tests originales en verde (2026-10-06). Falta crear el repo `genpm-net/stripe`, llevar billing 2.0 a `genpm-net/billing` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-03` **BLOCKED** Implementar y publicar @core/catalog (variantes, colecciones, reserva de stock concurrente) · C · 20h · deps: CAT-CMS-07, CAT-STO-01
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/catalog` (2026-10-06). Falta crear el repo `genpm-net/catalog` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-04` **BLOCKED** Implementar y publicar @core/cart (precios en servidor, tubería de totales) · C · 14h · deps: CAT-STO-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/cart` (2026-10-06). Falta crear el repo `genpm-net/cart` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-05` **BLOCKED** Implementar y publicar @core/orders (máquina de estados, envíos parciales, reembolsos, anti-IDOR) · C · 20h · deps: CAT-STO-01, CAT-00-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/orders` (2026-10-06). Falta crear el repo `genpm-net/orders` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-06` **BLOCKED** Implementar y publicar @core/shipping (zonas, tarifas, seguimiento) · C · 10h · deps: CAT-STO-04
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/shipping` (2026-10-06). Falta crear el repo `genpm-net/shipping` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-07` **BLOCKED** Implementar y publicar @core/checkout (Stripe Checkout, pedido solo en webhook, idempotente) · C · 16h · deps: CAT-STO-02, CAT-STO-05, CAT-STO-06
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/checkout` (2026-10-06). Falta crear el repo `genpm-net/checkout` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-08` **BLOCKED** Implementar y publicar @core/discounts (cupones, límites, regla Ómnibus de 30 días) · C · 12h · deps: CAT-STO-04
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/discounts` (2026-10-06). Falta crear el repo `genpm-net/discounts` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-09` **BLOCKED** Implementar y publicar @core/reviews (compra verificada, importadas etiquetadas, AggregateRating) · C · 10h · deps: CAT-BLG-02, CAT-STO-05, CAT-STO-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/reviews` (2026-10-06). Falta crear el repo `genpm-net/reviews` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-10` **BLOCKED** Implementar y publicar @core/kit-store (tienda, área de cliente, emails, plantillas legales) · C · 32h · deps: CAT-CMS-14, CAT-STO-07, CAT-STO-08, CAT-STO-09
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/app/(store)` (2026-10-06). Falta crear el repo `genpm-net/kit-store` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-STO-11` **TODO** Aceptación kit-store: compra e2e con stripe listen en CI, manipulación de precio rechazada y Lighthouse ≥ 90 · T · 4h · deps: CAT-STO-10

## F5 · Dropshipping (kit-dropshipping)

- [ ] `CAT-DRP-01` **BLOCKED** Implementar y publicar @core/pricing (reglas de margen, historial de precios) · C · 10h · deps: CAT-STO-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/pricing` (2026-10-06). Falta crear el repo `genpm-net/pricing` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-DRP-02` **BLOCKED** Implementar y publicar @core/suppliers con el adaptador manual (CSV) · C · 20h · deps: CAT-DRP-01, CAT-STO-05, CAT-CMS-03
  - Bloqueo: implementado, con tests y `genpm validate` 5/5 en `catalog/src/lib/suppliers` (2026-10-06). Falta crear el repo `genpm-net/suppliers` (fundador), publicar, pruebas de agente y revisión ADR-023.
- [ ] `CAT-DRP-03` **TODO** Adaptador CJdropshipping para @core/suppliers (verificar API y términos vigentes) · C · 12h · deps: CAT-DRP-02
- [ ] `CAT-DRP-04` **TODO** Alta de la app en AliExpress Open Platform (dropshipping) y aprobación · F · 2h · deps: CAT-00-01
- [ ] `CAT-DRP-05` **TODO** Adaptador AliExpress para @core/suppliers · C · 14h · deps: CAT-DRP-02, CAT-DRP-04
- [ ] `CAT-DRP-06` **TODO** Implementar y publicar @core/kit-dropshipping (importar, reenvío, excepciones, landing de producto) · C · 24h · deps: CAT-STO-10, CAT-LND-03, CAT-DRP-02
- [ ] `CAT-DRP-07` **TODO** Aceptación kit-dropshipping: recorrido completo con proveedor simulado en < 45 min de agente · T · 4h · deps: CAT-DRP-06

## F6 · Crecimiento

- [ ] `CAT-GRO-01` **TODO** Implementar y publicar @core/experiments y añadirlo a kit-landing 1.1 · C · 16h · deps: CAT-LND-03
- [ ] `CAT-GRO-02` **TODO** Adaptador @core/content-payload si hay demanda (decisión C1) · C · 16h · deps: CAT-CMS-14
- [ ] `CAT-GRO-03` **TODO** Priorizar kits futuros (kits/futuros.md) con la demanda no cubierta del panel de analítica · F · 2h · deps: CAT-DRP-07
- [ ] `CAT-GRO-04` **TODO** Implementar y publicar @core/invoices (facturas españolas con numeración legal y VeriFactu; verificar plazos vigentes) · C · 24h · deps: CAT-STO-05
