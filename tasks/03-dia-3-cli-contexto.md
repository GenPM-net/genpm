# Día 3 · CLI y contexto

> Ref: [roadmap §4 Día 3](../docs/roadmap-mvp.md#día-3--cli-y-contexto) y [cli-mcp-spec](../docs/cli-mcp-spec.md). Hito **M3**: `genpm add` funciona en los 3 SO.
> **Checkpoint de recorte** al cerrar el día (`D3-G-04`).

## Track A · Plataforma (auth y CLI de autor)

- [x] `D3-A-01` **DONE** POST /v1/auth/github/exchange para device flow (api-spec §4.7) · A · 2h · deps: D0-06, D1-A-07
- [x] `D3-A-02` **DONE** Tokens gpm_ con checksum, HMAC en BD, scopes y expiración; GET /v1/me (api-spec §4.8) · A · 3h · deps: D3-A-01
- [x] `D3-A-03` **DONE** CLI login, logout y whoami con device flow y credenciales según security §4.2 · A · 2h · deps: D3-A-02
  - Device flow implementado y probado (pollDeviceFlow). Falta el client_id de la OAuth App (D0-06): mientras tanto `GENPM_GITHUB_CLIENT_ID` o `GENPM_TOKEN`.
- [x] `D3-A-04` **DONE** CLI init: genera genpm.json desde el repo · A · 1h · deps: D1-B-01
- [x] `D3-A-05` **DONE** CLI validate reutilizando el escáner v1 · A · 1h · deps: D2-A-07, D3-A-04
- [x] `D3-A-06` **DONE** CLI publish con URL del paquete en la respuesta · A · 2h · deps: D2-A-06, D3-A-03
- [x] `D3-A-07` **DONE** CLI yank --reason · A · 1h · deps: D3-A-06
  - Recorte 3: puede pasar a v0.1.1.

## Track B · Cliente (inyección y CLI de consumidor)

- [x] `D3-B-01` **DONE** core/inject: AGENTS.md por paquete e índice en el AGENTS.md raíz · B · 3h · deps: D2-B-05
- [x] `D3-B-02` **DONE** Adaptadores de contexto claude y cursor con bloques gestionados idempotentes · B · 3h · deps: D3-B-01
- [x] `D3-B-03` **DONE** Adaptadores de contexto copilot y windsurf · B · 2h · deps: D3-B-01
  - Recorte 1: primer candidato a recortar.
- [x] `D3-B-04` **DONE** Writer de config MCP (merge no destructivo), bloque .env.example y propuesta de deps npm · B · 3h · deps: D3-B-01
  - INV-5 (consentimiento) e INV-6 (nunca leer valores de .env).
- [x] `D3-B-05` **DONE** CLI add: plan visual, 3 prompts, --dry-run, --dest y --force con backup (cli-mcp-spec add) · B · 4h · deps: D3-B-02, D3-B-04, D2-B-07
- [x] `D3-B-06` **DONE** CLI search e info · B · 2h · deps: D2-A-01, D2-A-03
- [x] `D3-B-07` **DONE** CLI list con detección de drift y remove (E_DRIFT con fix) · B · 3h · deps: D2-B-06
- [x] `D3-B-08` **DONE** CLI audit y doctor · B · 2h · deps: D2-B-06
  - Recorte 3: doctor puede pasar a v0.1.1; audit no se recorta.
- [x] `D3-B-09` **DONE** --json en todos los comandos; NO_COLOR y no-TTY (E_CONFIRM_REQUIRED) · B · 2h · deps: D3-B-05
- [x] `D3-B-10` **DONE** Catálogos del CLI en en y es, flag --lang · B · 2h · deps: D1-B-09
- [x] `D3-B-11` **DONE** Snapshots de salida humana y JSON de todos los comandos · B · 2h · deps: D3-B-05, D3-B-06, D3-B-07, D3-B-09

## Track C · Contenido

- Semillas: ver [08-semillas.md](08-semillas.md) (`S-AU-*`, `S-BI-01`, `S-DB-05`, `S-AU-05`).

## Gates

- [ ] `D3-G-01` **BLOCKED** genpm add @core/auth instala auth + db desde staging en macOS, Linux y Windows (CI) · T · 1h · deps: D3-B-05, S-AU-05
  - Bloqueo: necesita staging (D1-A-07) y @core/auth publicado (S-AU-05). En local, add instala auth + db de punta a punta (packages/core/test/install.test.ts, packages/cli/test/cli.test.ts).
- [x] `D3-G-02` **DONE** Re-ejecutar add es idempotente (skip) · T · 0.5h · deps: D3-G-01
  - Verificado en local: segundo plan ⇒ action skip para ambos paquetes (install.test.ts "is idempotent").
- [x] `D3-G-03` **DONE** remove con drift falla con E_DRIFT y fix · T · 0.5h · deps: D3-B-07
- [x] `D3-G-04` **DONE** Checkpoint: si add no funciona de punta a punta, activar el plan de recorte (PLAN §6) · T · 0.5h · deps: D3-G-01
  - Checkpoint: add funciona de punta a punta en local (registry falso firmado + repos Git reales por SHA). No se activa el plan de recorte.
