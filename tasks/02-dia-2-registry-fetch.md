# Día 2 · Registry y motor de fetch

> Ref: [roadmap §4 Día 2](../docs/roadmap-mvp.md#día-2--registry-y-motor-de-fetch). Hito **M2**: un fixture publicado se instala de punta a punta.

## Track A · Plataforma

- [x] `D2-A-01` **DONE** GET /v1/search con FTS5, ranking y forma compacta fmt=c (api-spec §4.1) · A · 3h · deps: D1-A-07
- [x] `D2-A-02` **DONE** GET /v1/resolve: rango, dist-tag, clausura de deps g y detección de conflictos (api-spec §4.2) · A · 4h · deps: D1-A-07, D1-B-04
- [x] `D2-A-03` **DONE** GET /v1/packages/:n y /versions[/:version] (api-spec §4.3–4.4) · A · 2h · deps: D1-A-07
- [x] `D2-A-04` **DONE** Cache API, ETag y cabeceras de caché por endpoint (api-spec §2) · A · 2h · deps: D2-A-01, D2-A-02, D2-A-03
- [x] `D2-A-05` **DONE** Rate limiting por IP y por token · A · 1h · deps: D1-A-07
- [x] `D2-A-06` **DONE** POST /v1/publish completo, pasos 1–12 de api-spec §4.5, leyendo GitHub en el servidor (INV-7) · A · 5h · deps: D1-A-07, D1-A-08, D0-07, D1-B-05
  - Probado con un GitHub falso (test/publish.test.ts). En producción usa la GitHub App (D0-07); mientras tanto acepta GITHUB_TOKEN.
- [x] `D2-A-07` **DONE** Escáner v1 compartido registry/cliente: prompt injection, unicode invisible, auto-ejecución, Trojan Source, secretos, colisiones de ruta · A · 4h · deps: D1-B-01
- [x] `D2-A-08` **DONE** Firma Ed25519 del manifiesto resuelto canónico y GET /v1/keys (INV-8) · A · 2h · deps: D0-12, D1-B-05
  - Hecho con la clave de desarrollo `dev1`; las claves k1/k2 de producción llegan con D0-12 (script `scripts/gen-signing-keys.mjs`).
- [x] `D2-A-09` **DONE** Seed SQL de staging con 3 paquetes fixture · A · 1h · deps: D1-A-05
  - SQL en apps/registry/seeds/fixtures.sql (generado con `node apps/registry/scripts/gen-seed.mjs`); aplicarlo en staging requiere D0-11.

## Track B · Cliente

- [x] `D2-B-01` **DONE** core/fetch: git por SHA (sparse + partial clone) y verificación rev-parse HEAD === c (INV-1) · B · 4h · deps: D1-B-07
- [x] `D2-B-02` **DONE** Endurecimiento de git: hooksPath, protocol.*, submódulos, symlinks, LFS, sin shell (INV-2) · B · 2h · deps: D2-B-01
- [x] `D2-B-03` **DONE** Caché inmutable por SHA y fallback tarball · B · 3h · deps: D2-B-01
  - Recorte 4: el fallback tarball puede pasar a v0.1.1 (exigir git).
- [x] `D2-B-04` **DONE** core/plan: plan de instalación sin escrituras · B · 3h · deps: D1-B-01, D1-B-08
- [x] `D2-B-05` **DONE** core/apply: journal y rollback, .genpmignore, rechazo de symlinks, límites de tamaño, staging + rename atómico, modo 0o644 · B · 5h · deps: D2-B-04, D1-B-07
  - INV-3 e INV-4.
- [x] `D2-B-06` **DONE** core/lock: una línea por paquete, firma sg y .genpm/files con hashes SHA-256 · B · 2h · deps: D2-B-05
- [x] `D2-B-07` **DONE** Verificación de firma de manifiestos en el cliente con claves fijadas (INV-8) · B · 2h · deps: D2-A-08
- [x] `D2-B-08` **DONE** Tests de invariantes INV-1 a INV-4 (security §2) · B · 3h · deps: D2-B-02, D2-B-05

## Track C · Contenido

- Semillas: ver [08-semillas.md](08-semillas.md) (`S-DB-*`, `S-AU-01`).

## Gates

- [ ] `D2-G-01` **BLOCKED** Publicar por curl un fixture en staging y obtener su SHA vía resolve · T · 0.5h · deps: D2-A-02, D2-A-06
  - Bloqueo: necesita staging (D1-A-07). Probado en local: test/publish.test.ts publica un fixture y resolve devuelve su SHA.
- [x] `D2-G-02` **DONE** plan() + apply() instalan un fixture en un proyecto temporal · T · 0.5h · deps: D2-B-05, D2-B-06
- [x] `D2-G-03` **DONE** Un fallo inyectado a mitad de copia deja el disco idéntico (rollback) · T · 0.5h · deps: D2-B-05
- [ ] `D2-G-04` **BLOCKED** Caché caliente del registry < 100 ms · T · 0.5h · deps: D2-A-04
  - Bloqueo: medir en staging (D1-A-07). La caché (Cache API + ETag) está implementada y probada (HIT/304) en apps/registry/test/read-api.test.ts.
