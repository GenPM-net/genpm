# Día 6 · Integración, seguridad y producción

> Ref: [roadmap §4 Día 6](../docs/roadmap-mvp.md#día-6--integración-seguridad-y-producción) y [security §10](../docs/security.md#10-puertas-de-seguridad-del-lanzamiento-día-6).
> Hito **M6**: puertas de seguridad en verde y paquetes publicados en npm. **Sin todas las `D6-S-*` en DONE no hay lanzamiento.**

## Dogfooding

- [ ] `D6-01` **TODO** Crear una app Hono desde cero solo con el MCP en Claude Code; registrar cada fricción como issue · T · 2h · deps: D4-G-01, D5-G-02
- [ ] `D6-02` **TODO** Crear una app Next.js desde cero solo con el MCP en Cursor; registrar cada fricción como issue · T · 2h · deps: D4-G-01, D5-G-02
- [ ] `D6-03` **TODO** Triage de las fricciones y arreglo de todos los P0/P1 · T · 4h · deps: D6-01, D6-02

## Puertas de seguridad (no se recortan)

- [ ] `D6-S-01` **TODO** INV-1 a INV-10 con tests verdes en macOS, Linux y Windows · T · 1h · deps: D2-B-08, D4-A-04, D1-G-01
- [ ] `D6-S-02` **TODO** Corpus de path traversal de security §8.2 completo y en verde · T · 1h · deps: D4-A-03, D1-B-07
- [ ] `D6-S-03` **TODO** Firma de manifiestos activa y verificada por el CLI publicado · T · 0.5h · deps: D2-B-07, D6-P-06
- [ ] `D6-S-04` **TODO** Escáner v1 activo en publish y en el cliente · T · 0.5h · deps: D2-A-07, D3-A-05
- [ ] `D6-S-05` **TODO** Las 5 semillas con escaneo passed y revisión de dos personas · T · 0.5h · deps: S-DB-08, S-AU-08, S-BI-08, S-EM-08, S-AI-08
- [ ] `D6-S-06` **TODO** npm con provenance desde CI, 2FA/FIDO2 en todas las cuentas y registrar lock en el dominio · T · 0.5h · deps: D6-P-06, D0-G-01
- [ ] `D6-S-07` **TODO** security.txt, política de divulgación y canal de reporte operativos en los idiomas de nivel 1 · T · 1h · deps: D5-W-18, D6-I-02
- [ ] `D6-S-08` **TODO** Runbook de incidentes probado en staging: cuarentena de un paquete y rotación de la clave de firma · T · 2h · deps: D2-A-08

## Idiomas

- [ ] `D6-I-01` **TODO** Revisión nativa de pt-BR (web, CLI y docs de nivel 1) · F · 3h · deps: D4-A-06, D0-14
- [ ] `D6-I-02` **TODO** Legal y security.txt traducidos a en, es y pt-BR · F · 2h · deps: D5-W-19
- [ ] `D6-I-03` **TODO** Capturas con pseudo-locale para detectar textos sin traducir y desbordes · T · 1h · deps: D5-W-17

## Producción

- [ ] `D6-P-01` **TODO** Migraciones de D1 en producción · A · 0.5h · deps: D1-A-05
- [ ] `D6-P-02` **TODO** Dominios api.genpm.net y genpm.net apuntando a los Workers de producción · A · 1h · deps: D0-01, D5-W-23
- [ ] `D6-P-03` **TODO** Secretos de producción y rate limits configurados · A · 1h · deps: D6-P-01
- [ ] `D6-P-04` **TODO** Alertas: errores 5xx > 1 % y latencia p95 · A · 1h · deps: D6-P-02
- [ ] `D6-P-05` **TODO** Publicar las 5 semillas en prod con el CLI, marcar @core/* como featured y el scope como verificado · A · 1h · deps: D6-P-03, D6-S-05
- [ ] `D6-P-06` **TODO** npm publish de genpm@0.1.0 y @genpm/mcp@0.1.0 con provenance · B · 1h · deps: D5-B-05, D6-03
- [ ] `D6-P-07` **TODO** Apertura del código (ADR-016): semillas públicas, paquetes cliente públicos con licencia, registry y web según decisión del fundador · F · 1h · deps: D6-P-05

## Documentación

- [ ] `D6-D-01` **TODO** README del monorepo con el hero de marca y GIFs · C · 1h · deps: BR-14
- [ ] `D6-D-02` **TODO** Quickstart de 60 segundos · C · 1h · deps: D5-W-13
- [ ] `D6-D-03` **TODO** Guía de publicación · C · 1h · deps: D5-W-13
- [ ] `D6-D-04` **TODO** Referencia del manifiesto genpm.json · C · 1h · deps: D5-W-13, D1-B-02
- [ ] `D6-D-05` **TODO** Configuración del MCP por cliente · C · 1h · deps: D5-W-14

## Gates

- [ ] `D6-G-01` **TODO** Checklist de seguridad sin ítems abiertos de severidad alta · T · 0.5h · deps: D6-S-01, D6-S-02, D6-S-03, D6-S-04, D6-S-05, D6-S-06, D6-S-07, D6-S-08
- [ ] `D6-G-02` **TODO** Instalación desde npm público en una máquina limpia; genpm search auth < 1 s en producción · T · 0.5h · deps: D6-P-06, D6-P-05
- [ ] `D6-G-03` **TODO** genpm publish de un paquete nuevo aparece en genpm.net en < 1 minuto · T · 0.5h · deps: D6-P-05, D6-P-02
