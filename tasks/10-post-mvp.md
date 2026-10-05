# Post-MVP

> Ref: [roadmap §10](../docs/roadmap-mvp.md#10-después-del-mvp), [web-ui-spec §10](../docs/web-ui-spec.md#10-alcance-mvp-día-5-del-sprint) e [i18n §7](../docs/i18n.md#7-impacto-en-el-sprint).
> Nivel épica: cada tarea se desglosa en un archivo propio cuando empiece su versión (`11-v0-2.md`, …). Estimaciones gruesas.

## v0.1.1 · +1 semana (lo recortado del sprint)

- [x] `V011-01` **DONE** Recuperar todo lo marcado como CUT en el sprint (ver pnpm tasks list cut) · T · 8h · deps: D7-09
  - ✅ 2026-10-05: `pnpm tasks list cut` ⇒ 0 tareas: no se recortó nada del sprint.
- [ ] `V011-02` **DOING** Binario nativo de genpm para macOS, Linux y Windows con instaladores de una línea y genpm upgrade (ADR-025) · B · 8h · deps: D5-B-04
  - DoD: `release.yml` verde en macOS, Linux y Windows (smoke del binario + install.sh + install.ps1 en PowerShell 5.1 y 7); autorrevisión diferida (ADR-023) de `scripts/install/` y `core/src/self-update.ts` antes del primer tag. El release real espera a la apertura del repo (D6-P-07).
- [ ] `V011-03` **TODO** Firma de código de los binarios: Apple Developer ID + notarización y Authenticode · F · 6h · deps: V011-02
- [x] `V011-04` **DONE** Canales de paquetes para el binario: Homebrew tap, Scoop y winget · B · 4h · deps: V011-02
  - Hecho el 2026-10-05: `brew install genpm-net/tap/genpm` (GenPM-net/homebrew-tap, auditado y checksum verificado) y Scoop (GenPM-net/scoop-bucket, hashes verificados); `genpm upgrade` remite a `brew upgrade`/`scoop update`. winget queda fuera hasta firmar los binarios (V011-03): exige PR a microsoft/winget-pkgs.
- [x] `V011-05` **DONE** genpm mcp serve en el binario para usar el MCP sin Node · B · 4h · deps: V011-02
- [x] `V011-06` **DONE** Crear el token `CF_AE_TOKEN` (Account Analytics: Read) y cargarlo en producción y staging · F · 0.5h · deps: D6-P-03
  - `wrangler secret put CF_AE_TOKEN` y `wrangler secret put CF_AE_TOKEN --env staging` en apps/registry. Comprobar: en la siguiente hora en punto desaparece `installs_rollup_skipped` de los logs; el cron de las 03:15 recupera los últimos 30 días (ADR-027).
  - ✅ 2026-10-05: el fundador cargó el secreto en producción y staging. Queda confirmar en los logs que ya no aparece `installs_rollup_skipped`; la recuperación de 30 días llega al desplegar esta rama.
- [x] `V011-07` **DONE** Analítica de servidor sin consentimiento: page_view con procedencia, país, campaña y bot/persona/sesión · W · 2h · deps: V011-06
  - ✅ 2026-10-05: sustituye a Cloudflare Web Analytics (su baliza también exige consentimiento, ADR-027). Middleware de la web + lib/analytics.ts; robots separados por user-agent sin guardarlo.
- [x] `V011-08` **DONE** Eventos de producto del navegador (copy_install, tab_view, mcp_setup_copy) solo con consentimiento, vía PostHog · W · 2h · deps: V011-07
- [x] `V011-09` **DONE** Eventos de servidor que faltan: búsquedas sin resultados, publish_ok, login y sponsored_impression/click · A · 2h · deps: V011-06
  - ✅ 2026-10-05: nº de resultados en `search`; impresiones y clics (`?sc=`) de patrocinados; publicaciones, logins y cuentas nuevas salen de D1 (audit_log/accounts) en el panel.
- [x] `V011-10` **DONE** Panel /admin/analytics (solo staff) sobre la SQL API de AE: visitas, top búsquedas, demanda no cubierta y embudo visita → copia → instalación · W · 6h · deps: V011-08, V011-09
  - ✅ 2026-10-05: `GET /v1/admin/analytics` (staff; resto 404) + página en 8 idiomas. El embudo es vista de paquete → instalación (la copia solo se mide con consentimiento, en PostHog).
- [x] `V011-11` **DONE** Decidir ADR-027 capa 2 (mapas de calor con consentimiento) y revisar el texto legal del banner · F · 1h · deps: V011-10
  - ✅ 2026-10-05: el fundador decide añadir el banner. Revisión por abogado sigue en `D6-P-08`.
- [x] `V011-12` **DONE** PostHog Cloud EU con opt-in: banner con rechazar igual de visible, proxy /ph/*, mapas de calor y grabaciones enmascaradas, políticas actualizadas · W · 8h · deps: V011-11
  - ✅ 2026-10-05: probado en Chromium con `wrangler dev`: sin decisión o con «Rechazar» no se descarga PostHog ni se escribe nada `ph_*`; con «Aceptar» se carga por `/ph`; el banner se reabre desde el pie. Cookies, privacidad (8 idiomas) y registro de actividades actualizados.
- [ ] `V011-13` **TODO** Activar PostHog en producción: proyecto en región EU, DPA aceptado, retención 30 días/12 meses, POSTHOG_KEY en wrangler.jsonc y despliegue de la web · F · 0.5h · deps: V011-12
  - Hasta entonces no hay banner ni PostHog; la capa de servidor y el panel funcionan ya.
  - 2026-10-05: proyecto 295000 en EU Cloud creado y clave en wrangler.jsonc (solo producción; staging sin PostHog para no mezclar datos). Falta: DPA, dominios autorizados, replay y heatmaps activados, y desplegar la web.

## v0.2 · +2 semanas

> Priorización (D7-10, 2026-10-05), por lo visto en las pruebas de agente y en el ensayo del runbook:
> 1. **`V02-01` + `V02-02` (actualizar con merge de 3 vías)**: hoy subir `@core/auth` 1.0.0 → 1.1.0 en un proyecto con
>    cambios obliga a `remove` + `add` y se pierden las ediciones. Es lo primero que preguntará cualquiera tras instalar.
> 2. **`V02-10`**: `genpm add --yes` sin instalar dependencias de npm (en CI y en demos no hay forma de decir "sí al
>    código, no a npm" sin preguntas).
> 3. **`V02-03` (Used by)** y **`V02-04` (calidad)**: ayudan a elegir entre paquetes cuando haya más que las semillas.
> 4. **`V02-07` / `V02-08`** (web P1/P2) y **`V02-05`** (revisión nativa de nivel 2) según tracción por idioma.

- [x] `V02-01` **DONE** genpm diff y update con merge 3-way · B · 24h · deps: D7-10
  - ✅ 2026-10-05: core/merge.ts (planMerge + git merge-file endurecido), plan({update}) con acción `update`, apply con merge archivo a archivo dentro del journal, `genpm diff` (parche aplicable con git apply) y `genpm update` (exit 4 con conflictos). Tests en core y CLI.
- [x] `V02-02` **DONE** Tool genpm_diff y actualización asistida por IA · B · 8h · deps: V02-01
  - ✅ 2026-10-05: `genpm_diff` (parche delimitado como contenido de terceros, truncado al presupuesto) y `genpm_update` con `strategy: 3way | ai`; instrucciones del servidor actualizadas (< 250 tokens).
- [x] `V02-03` **DONE** Dependents ("Used by") en API y página de paquete · A · 6h · deps: D7-10
  - ✅ 2026-10-05: `GET /v1/packages/:scope/:name/dependents` (índice inverso existente), `dependentsCount` en el paquete y lista en la pestaña Dependencies y el lateral.
- [x] `V02-04` **DONE** Puntuación de calidad de paquetes · A · 8h · deps: D7-10
  - ✅ 2026-10-05: `@genpm/manifest` quality.ts (9 comprobaciones ponderadas, 0–100), estático al publicar (tests aunque se ignoren), cron diario, migración 0005, peso en popularidad, checklist en la pestaña Security y en `genpm validate`.
- [ ] `V02-05` **TODO** Revisión nativa del nivel 2 de idiomas y retirada del banner beta · F · 8h · deps: D7-06
- [x] `V02-06` **DONE** Docs completas en pt-BR · C · 8h · deps: D6-I-01
  - Hecho el 2026-10-04: las 11 páginas de docs en los 8 idiomas (pendiente la revisión nativa de D6-I-01).
- [x] `V02-07` **DONE** Web P1: dashboard del autor, perfil, sponsors y enterprise (landing + waitlist con POST /v1/leads) · W · 16h · deps: D5-W-23
  - ✅ 2026-10-05: dashboard con barras CLI/MCP de 30 días, calidad y deprecar/revertir (`POST /v1/packages/…/deprecate`); `/settings/profile` (orgs y rol, idioma de avisos con `PATCH /v1/me`, derechos RGPD); sponsors y enterprise ya tenían landing + `POST /v1/leads`. Miembros de org en /@scope: no se publican (GitHub no expone qué membresías son públicas).
- [x] `V02-08` **DONE** Web P2: comparador de versiones (diff visual), status page y cola de admin · W · 16h · deps: V02-01
  - ✅ 2026-10-05: `/p/@scope/name/compare` (API `compare` sobre GitHub, inmutable en caché), `/status` (componentes + último cron) y `/admin` (cuarentena, reportes, destacados, patrocinios, leads; todo en audit_log). 8 idiomas; revisado en Chromium con wrangler dev.
- [x] `V02-09` **DONE** Modo oscuro opcional de la web con los tokens dark de tokens.json · W · 4h · deps: D5-W-23
  - Ya en producción: botón de tema en la cabecera y en el menú móvil (claro por defecto, branding §8).
- [x] `V02-10` **DONE** genpm add: aceptar el plan sin instalar las dependencias de npm ni preguntar (`--no-install-deps`), para CI y demos · B · 1h · deps: D7-10

## v0.3 · +6 semanas

- [x] `V03-01` **DONE** Trusted publishing con OIDC de GitHub Actions · A · 12h · deps: V02-01
  - ✅ 2026-10-05: migración 0006, `POST /v1/auth/oidc/exchange` (JWT RS256 verificado contra el JWKS de GitHub), `/v1/scopes/:scope/trusted-publishers`, `/settings/publishing`, `genpm publish` usa OIDC sin GENPM_TOKEN, plantilla de `init --workflow` con `id-token: write`, docs en 8 idiomas. De paso: `allowed_packages` de los tokens no se aplicaba; ahora sí (publish, yank, deprecate).
- [x] `V03-02` **DONE** Mirror R2 "Verified Archive" · A · 16h · deps: V02-01
  - ✅ 2026-10-05: migración 0007, binding R2 `ARCHIVE`, copia en publish con registro firmado (`archiveRecord`), `GET /v1/archive/…`, fallback en `fetchSource` (`mirror`) desde plan(). Pendiente fundador: `wrangler r2 bucket create genpm-archive` y `genpm-archive-staging` antes de desplegar.
- [x] `V03-03` **DONE** Publicación desde GitLab · A · 12h · deps: V02-01
  - ✅ 2026-10-05 (ADR-028): sin vincular cuentas; el dueño del scope autoriza un proyecto público de gitlab.com como editor de confianza y GitLab CI publica con `id_tokens` (`GENPM_ID_TOKEN`). Registry: `services/gitlab.ts` + `source-host.ts` (publish, auditoría de tags y compare agnósticos del host), OIDC multiemisor. CLI: remotos de GitLab y tarball del API anclado al SHA. Web: README/árbol desde GitLab, selector de host en /settings/publishing. Docs en 8 idiomas.
- [x] `V03-04` **DONE** Transporte MCP HTTP remoto de solo lectura · B · 12h · deps: V02-02
  - ✅ 2026-10-05: `mcp.genpm.net` (custom domain del Worker del registry) y `/mcp` en el API; Streamable HTTP sin estado, `genpm_search`/`genpm_info`, CORS abierto, docs en 8 idiomas. Pendiente fundador: nada (el dominio se crea al desplegar).
- [x] `V03-05` **DONE** Recetas compose (varios paquetes en un comando) · B · 16h · deps: V02-01
  - ✅ 2026-10-05: `validateRecipe` en manifest; migración 0008 `recipes`, `GET /v1/recipes[/:slug]`, gestión staff `PUT/DELETE /v1/admin/recipes/:slug`; core `loadRecipe` (slug o JSON local); `genpm compose <receta> [--list]` con el flujo de `add`; MCP `genpm_add {recipe}`; página `/recipes`; docs en 8 idiomas. Pendiente fundador: crear las primeras recetas con el API de staff.
- [ ] `V03-06` **TODO** Auditoría de seguridad externa · F · 8h · deps: V02-01

## v1.0 · SaaS · +3 meses

- [x] `V10-01` **DONE** Registros privados (shared tenancy) con RBAC: teams y package_grants (migración aditiva api-spec §5.4) · A · 60h · deps: V03-01
  - ✅ 2026-10-05 (ADR-029): migración 0009, tenant privado en el middleware (404 a no miembros, `private, no-store`), `/r/:slug`, visibilidad `internal`/`private` con grants en Repo, publicación de repos privados con la App por dueño, rutas `/v1/registries`, `/v1/orgs/:org/teams`, `/v1/packages/…/access|grants`; CLI `genpm registry|team|access`; web `/settings/registries`; docs en 8 idiomas. Pendiente fundador: aplicar la migración en producción.
- [x] `V10-02` **DONE** SSO · A · 24h · deps: V10-01
  - ✅ 2026-10-05 (ADR-030): OIDC por org (descubrimiento, PKCE, nonce, JWKS), vinculación 1:1, JIT, `enforce` en el acceso a registros privados; migración 0010; web `/settings/sso`; RAT actividad 12. SAML: puente OIDC del IdP.
- [x] `V10-03` **DONE** Dominio propio por registro · A · 12h · deps: V10-01
  - ✅ 2026-10-05: `PUT/DELETE /v1/registries/:slug/domain` + `POST …/verify` (TXT por DoH), enrutado por host en el Worker, alta en Cloudflare for SaaS si hay `CF_SAAS_*`; CLI `genpm registry domain|verify`. Pendiente fundador: runbook §3.2 (Custom Hostnames, ruta y secretos).
- [x] `V10-04` **DONE** Auditoría exportable · A · 12h · deps: V10-01
  - ✅ 2026-10-05: `GET /v1/registries/:slug/audit` (JSON/CSV/JSONL), `genpm registry audit`, descarga CSV en /settings/registries.
- [ ] `V10-05` **TODO** Facturación con Stripe · A · 24h · deps: V10-01
- [ ] `V10-06` **TODO** Patrocinios self-serve · W · 24h · deps: V10-05
- [ ] `V10-07` **TODO** Pentest y bug bounty con recompensas · F · 8h · deps: V10-01

## Enterprise · +6 meses

- [ ] `ENT-01` **TODO** Tenancy dedicada: D1 por cliente vía Workers for Platforms · A · 60h · deps: V10-01
- [x] `ENT-02` **DONE** SCIM · A · 24h · deps: V10-02
  - ✅ 2026-10-05: `/scim/v2/:org/Users` (alta, filtro, PUT/PATCH `active`, baja) con token por org; la identidad SCIM se vincula en el primer login SSO por email; la baja corta el acceso y quita la membresía; migración 0011; token desde /settings/sso.
- [ ] `ENT-03` **TODO** Políticas: paquetes permitidos y escaneo obligatorio · A · 24h · deps: V10-01
- [ ] `ENT-04` **TODO** SLA y soporte dedicado · F · 8h · deps: ENT-01
