# Día 2 · Registry y motor de fetch

> Ref: [roadmap §4 Día 2](../docs/roadmap-mvp.md#día-2--registry-y-motor-de-fetch). Hito **M2**: un fixture publicado se instala de punta a punta.

## Track A · Plataforma

- [ ] `D2-A-01` **TODO** GET /v1/search con FTS5, ranking y forma compacta fmt=c (api-spec §4.1) · A · 3h · deps: D1-A-07
- [ ] `D2-A-02` **TODO** GET /v1/resolve: rango, dist-tag, clausura de deps g y detección de conflictos (api-spec §4.2) · A · 4h · deps: D1-A-07, D1-B-04
- [ ] `D2-A-03` **TODO** GET /v1/packages/:n y /versions[/:version] (api-spec §4.3–4.4) · A · 2h · deps: D1-A-07
- [ ] `D2-A-04` **TODO** Cache API, ETag y cabeceras de caché por endpoint (api-spec §2) · A · 2h · deps: D2-A-01, D2-A-02, D2-A-03
- [ ] `D2-A-05` **TODO** Rate limiting por IP y por token · A · 1h · deps: D1-A-07
- [ ] `D2-A-06` **TODO** POST /v1/publish completo, pasos 1–12 de api-spec §4.5, leyendo GitHub en el servidor (INV-7) · A · 5h · deps: D1-A-07, D1-A-08, D0-07, D1-B-05
- [x] `D2-A-07` **DONE** Escáner v1 compartido registry/cliente: prompt injection, unicode invisible, auto-ejecución, Trojan Source, secretos, colisiones de ruta · A · 4h · deps: D1-B-01
- [ ] `D2-A-08` **DOING** Firma Ed25519 del manifiesto resuelto canónico y GET /v1/keys (INV-8) · A · 2h · deps: D0-12, D1-B-05
- [ ] `D2-A-09` **TODO** Seed SQL de staging con 3 paquetes fixture · A · 1h · deps: D1-A-05

## Track B · Cliente

- [ ] `D2-B-01` **TODO** core/fetch: git por SHA (sparse + partial clone) y verificación rev-parse HEAD === c (INV-1) · B · 4h · deps: D1-B-07
- [ ] `D2-B-02` **TODO** Endurecimiento de git: hooksPath, protocol.*, submódulos, symlinks, LFS, sin shell (INV-2) · B · 2h · deps: D2-B-01
- [ ] `D2-B-03` **TODO** Caché inmutable por SHA y fallback tarball · B · 3h · deps: D2-B-01
  - Recorte 4: el fallback tarball puede pasar a v0.1.1 (exigir git).
- [ ] `D2-B-04` **TODO** core/plan: plan de instalación sin escrituras · B · 3h · deps: D1-B-01, D1-B-08
- [ ] `D2-B-05` **TODO** core/apply: journal y rollback, .genpmignore, rechazo de symlinks, límites de tamaño, staging + rename atómico, modo 0o644 · B · 5h · deps: D2-B-04, D1-B-07
  - INV-3 e INV-4.
- [ ] `D2-B-06` **TODO** core/lock: una línea por paquete, firma sg y .genpm/files con hashes SHA-256 · B · 2h · deps: D2-B-05
- [ ] `D2-B-07` **TODO** Verificación de firma de manifiestos en el cliente con claves fijadas (INV-8) · B · 2h · deps: D2-A-08
- [ ] `D2-B-08` **TODO** Tests de invariantes INV-1 a INV-4 (security §2) · B · 3h · deps: D2-B-02, D2-B-05

## Track C · Contenido

- Semillas: ver [08-semillas.md](08-semillas.md) (`S-DB-*`, `S-AU-01`).

## Gates

- [ ] `D2-G-01` **TODO** Publicar por curl un fixture en staging y obtener su SHA vía resolve · T · 0.5h · deps: D2-A-02, D2-A-06
- [ ] `D2-G-02` **TODO** plan() + apply() instalan un fixture en un proyecto temporal · T · 0.5h · deps: D2-B-05, D2-B-06
- [ ] `D2-G-03` **TODO** Un fallo inyectado a mitad de copia deja el disco idéntico (rollback) · T · 0.5h · deps: D2-B-05
- [ ] `D2-G-04` **TODO** Caché caliente del registry < 100 ms · T · 0.5h · deps: D2-A-04
