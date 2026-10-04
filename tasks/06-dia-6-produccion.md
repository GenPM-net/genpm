# Día 6 · Integración, seguridad y producción

> Ref: [roadmap §4 Día 6](../docs/roadmap-mvp.md#día-6--integración-seguridad-y-producción) y [security §10](../docs/security.md#10-puertas-de-seguridad-del-lanzamiento-día-6).
> Hito **M6**: puertas de seguridad en verde y paquetes publicados en npm. **Sin todas las `D6-S-*` en DONE no hay lanzamiento.**

## Dogfooding

- [ ] `D6-01` **TODO** Crear una app Hono desde cero solo con el MCP en Claude Code; registrar cada fricción como issue · T · 2h · deps: D4-G-01, D5-G-02
- [ ] `D6-02` **TODO** Crear una app Next.js desde cero solo con el MCP en Cursor; registrar cada fricción como issue · T · 2h · deps: D4-G-01, D5-G-02
- [ ] `D6-03` **TODO** Triage de las fricciones y arreglo de todos los P0/P1 · T · 4h · deps: D6-01, D6-02

## Puertas de seguridad (no se recortan)

- [ ] `D6-S-01` **BLOCKED** INV-1 a INV-10 con tests verdes en macOS, Linux y Windows · T · 1h · deps: D2-B-08, D4-A-04, D1-G-01
  - En verde en macOS (Node 24) y Linux (Docker: Node 22 y Node 20 con el bundle construido en 22). Falta Windows: solo en el CI de GitHub (D0-08). El CI ahora compila con Node 22 (tsdown y Astro 7 lo exigen) y prueba con la versión de la matriz.
- [x] `D6-S-02` **DONE** Corpus de path traversal de security §8.2 completo y en verde · T · 1h · deps: D4-A-03, D1-B-07
  - Unitario en `core/src/fs/safe-path.test.ts` (+ fast-check) y end-to-end en `core/test/install.test.ts`: corpus completo como `d` del registro y nombres reservados/NFD/punto final dentro del árbol Git (NFD real vía plumbing).
- [ ] `D6-S-03` **TODO** Firma de manifiestos activa y verificada por el CLI publicado · T · 0.5h · deps: D2-B-07, D6-P-06
- [x] `D6-S-04` **DONE** Escáner v1 activo en publish y en el cliente · T · 0.5h · deps: D2-A-07, D3-A-05
  - Mismo `scanTree` de @genpm/manifest en `registry/routes/publish.ts`, `core/plan.ts` y `genpm validate`; cubierto por `registry/test/publish.test.ts` y `core/test/install.test.ts`.
- [ ] `D6-S-05` **TODO** Las 5 semillas con escaneo passed y revisión de seguridad (ADR-023) · T · 0.5h · deps: S-DB-08, S-AU-08, S-BI-08, S-EM-08, S-AI-08
- [ ] `D6-S-06` **TODO** npm con provenance desde CI, 2FA/FIDO2 en todas las cuentas y registrar lock en el dominio · T · 0.5h · deps: D6-P-06, D0-G-01
- [x] `D6-S-07` **DONE** security.txt, política de divulgación y canal de reporte operativos en los idiomas de nivel 1 · T · 1h · deps: D5-W-18, D6-I-02
  - Canal único según security §9: hello@genpm.net con asunto [SECURITY] (security.txt, /security en 8 idiomas, SECURITY.md, legales). Pendiente fundador: buzón operativo, filtro y clave PGP.
- [ ] `D6-S-08` **BLOCKED** Runbook de incidentes probado en staging: cuarentena de un paquete y rotación de la clave de firma · T · 2h · deps: D2-A-08
  - Bloqueo: falta el ensayo en staging (D0-10/D0-11) y la revisión de seguridad de ADR-022 según ADR-023 (toca INV-8). Hecho y ensayado en local: docs/runbook.md, revocación en el cliente (caché monótona), re-firma por cron (`resignStale`), refresco de `sg` en el lock, `E_READ_ONLY` y `scripts/sign-revocation.mjs`.

## Idiomas

- [ ] `D6-I-01` **TODO** Revisión nativa de pt-BR (web, CLI y docs de nivel 1) · F · 3h · deps: D4-A-06, D0-14
- [x] `D6-I-02` **DONE** Legal y security.txt traducidos a en, es y pt-BR · F · 2h · deps: D5-W-19
  - en/es/pt-BR en `apps/web/src/content/legal/`. security.txt con `Preferred-Languages: en, es, pt` (sin enlace de agradecimientos muerto). Pendiente: revisión legal humana antes del lanzamiento.
  - Ampliado (ADR-024): aviso legal y política de cookies nuevos; privacidad, términos y política de paquetes reescritos para RGPD/LOPDGDD, LSSI-CE, consumidores y DSA; versión vinculante en español.
- [x] `D6-I-03` **DONE** Capturas con pseudo-locale para detectar textos sin traducir y desbordes · T · 1h · deps: D5-W-17
  - `?pseudo=1` en la web (fuera de producción) y `--lang en-XA` en el CLI. Revisadas 14 páginas: sin desbordes a 375 px; corregidos el estado de escaneo de la tabla de versiones y la página /docs/errors (ahora en el idioma del lector). pseudo.mjs respeta glosario, flags, rutas y comandos.

## Producción

- [x] `D6-P-01` **DONE** Migraciones de D1 en producción · A · 0.5h · deps: D1-A-05
- [x] `D6-P-02` **DONE** Dominios api.genpm.net y genpm.net apuntando a los Workers de producción · A · 1h · deps: D0-01, D5-W-23
- [ ] `D6-P-03` **TODO** Secretos de producción y rate limits configurados · A · 1h · deps: D6-P-01
- [ ] `D6-P-04` **TODO** Alertas: errores 5xx > 1 % y latencia p95 · A · 1h · deps: D6-P-02
- [x] `D6-P-05` **DONE** Publicar las 5 semillas en prod con el CLI, marcar @core/* como featured y el scope como verificado · A · 1h · deps: D6-P-03, D6-S-05
  - ✅ 2026-10-04: repos GenPM-net/{db,auth,billing,email,ai} públicos (1 commit cada uno, sin secretos), las 5 publicadas en v1.0.0 desde la web, destacadas en la home (auth, db, billing, ai, email) y verificadas (scope de acc_system). Yohangel es staff (membresía manual en acc_system).
- [ ] `D6-P-06` **TODO** npm publish de genpm@0.1.0 y @genpm/mcp@0.1.0 con provenance · B · 1h · deps: D5-B-05, D6-03
- [ ] `D6-P-07` **TODO** Apertura del código (ADR-016): semillas públicas, paquetes cliente públicos con licencia, registry y web según decisión del fundador · F · 1h · deps: D6-P-05
- [ ] `D6-P-08` **TODO** Datos del titular (nombre, NIF, domicilio, ciudad) en apps/web/src/content/legal/owner.json y revisión legal (ADR-024) · F · 0.5h · deps: D5-W-19

## Documentación

- [x] `D6-D-01` **DONE** README del monorepo con el hero de marca y GIFs · C · 1h · deps: BR-14
- [x] `D6-D-02` **DONE** Quickstart de 60 segundos · C · 1h · deps: D5-W-13
- [x] `D6-D-03` **DONE** Guía de publicación · C · 1h · deps: D5-W-13
- [x] `D6-D-04` **DONE** Referencia del manifiesto genpm.json · C · 1h · deps: D5-W-13, D1-B-02
- [x] `D6-D-05` **DONE** Configuración del MCP por cliente · C · 1h · deps: D5-W-14

## Gates

- [ ] `D6-G-01` **TODO** Checklist de seguridad sin ítems abiertos de severidad alta · T · 0.5h · deps: D6-S-01, D6-S-02, D6-S-03, D6-S-04, D6-S-05, D6-S-06, D6-S-07, D6-S-08
- [x] `D6-G-02` **DONE** Instalación desde npm público en una máquina limpia; genpm search auth < 1 s en producción · T · 0.5h · deps: D6-P-06, D6-P-05
- [ ] `D6-G-03` **TODO** genpm publish de un paquete nuevo aparece en genpm.net en < 1 minuto · T · 0.5h · deps: D6-P-05, D6-P-02
