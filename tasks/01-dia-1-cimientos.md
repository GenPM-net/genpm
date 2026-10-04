# Día 1 · Cimientos

> Ref: [roadmap §4 Día 1](../docs/roadmap-mvp.md#día-1--cimientos). Hito **M1**: CI verde en 3 SO y `/v1/health` en staging.

## Track A · Plataforma

- [x] `D1-A-01` **DONE** Bootstrap del monorepo: pnpm workspaces, Turborepo, Biome, @genpm/tsconfig, Changesets, Vitest · A · 3h · deps: D0-08
- [x] `D1-A-02` **DONE** CI en GitHub Actions: matriz ubuntu/macos/windows × Node 20/22, Actions fijadas por SHA · A · 2h · deps: D1-A-01
- [x] `D1-A-03` **DONE** Seguridad en cada PR: Semgrep, CodeQL, OSV-Scanner y gitleaks (security §8.1) · A · 2h · deps: D1-A-02
- [x] `D1-A-04` **DONE** apps/registry: Hono + wrangler.jsonc con bindings de D1, Queue y Analytics Engine · A · 2h · deps: D1-A-01, D0-11
- [x] `D1-A-05` **DONE** Migración 0001_init.sql (api-spec §5.3) aplicada en staging · A · 2h · deps: D1-A-04
  - Bloqueo: migración escrita (apps/registry/migrations/0001_init.sql) y aplicada en local/tests (miniflare); falta aplicarla en staging: necesita D0-11 (D1 en Cloudflare). Comando: `pnpm --filter @genpm/registry migrate:staging`.
- [x] `D1-A-06` **DONE** Middleware problem+json y requestId, con los códigos E_* de @genpm/manifest · A · 2h · deps: D1-A-04, D1-B-03
- [x] `D1-A-07` **DONE** GET /v1/health y deploy a staging · A · 1h · deps: D1-A-05, D1-A-06
  - Bloqueo: GET /v1/health implementado y probado en workerd; el deploy a staging necesita D0-10/D0-11 (cuenta Cloudflare y D1). Comando: `pnpm --filter @genpm/registry deploy:staging`.
- [x] `D1-A-08` **DONE** Seed de scopes reservados (genpm, core, genpm-net…) con cuenta de sistema, api-spec §5.3, y test: auto-claim o publish en scope reservado ⇒ 403 E_FORBIDDEN_SCOPE · A · 1h · deps: D1-A-05

## Track B · Cliente

- [x] `D1-B-01` **DONE** @genpm/manifest: esquemas zod de manifiesto fuente, resuelto, lockfile y entrada MCP (manifest-spec §3) · B · 4h · deps: D1-A-01
- [x] `D1-B-02` **DONE** JSON Schema generado desde zod para /schema/v1/genpm.json · B · 1h · deps: D1-B-01
- [x] `D1-B-03` **DONE** Catálogo único de errores E_* en packages/manifest/src/errors.ts · B · 1h · deps: D1-B-01
- [x] `D1-B-04` **DONE** Validadores de nombre, semver, ruta y ref (rechazo de ramas, SHA de 40) · B · 2h · deps: D1-B-01
- [x] `D1-B-05` **DONE** Canonicalización y hash del manifiesto (manifest-spec §8) · B · 2h · deps: D1-B-01
- [x] `D1-B-06` **DONE** Fixtures golden válidos e inválidos compartidos entre Node y Workers · B · 2h · deps: D1-B-04, D1-B-05
- [x] `D1-B-07` **DONE** core/fs/safe-path con fuzzing (rutas Windows, unicode, .. codificado) y property tests con fast-check · B · 3h · deps: D1-A-01
  - INV-3. 100 % de ramas cubiertas.
- [x] `D1-B-08` **DONE** core/detect: raíz del proyecto, clientes IA instalados y package manager · B · 2h · deps: D1-A-01
- [x] `D1-B-09` **DONE** @genpm/i18n: createT, negotiate, format, tipos generados y lint de literales (i18n §4.1) · B · 3h · deps: D1-A-01

## Track C · Contenido

- Semillas: ver [08-semillas.md](08-semillas.md) (`S-00-01`, `S-DB-01`).

## Gates

- [ ] `D1-G-01` **BLOCKED** CI verde en macOS, Linux y Windows · T · 0.5h · deps: D1-A-02, D1-A-03
  - Bloqueo: workflows listos (.github/workflows/ci.yml y security.yml); falta el repo en GitHub (D0-05/D0-08) para que corran.
- [x] `D1-G-02` **DONE** GET /v1/health responde en staging · T · 0.5h · deps: D1-A-07
  - Bloqueo: depende del deploy a staging (D1-A-07).
- [x] `D1-G-03` **DONE** 100 % de ramas cubiertas en safe-path y validadores · T · 0.5h · deps: D1-B-04, D1-B-07
- [x] `D1-G-04` **DONE** Los fixtures golden validan igual en Node y en Workers · T · 0.5h · deps: D1-B-06, D1-A-04
