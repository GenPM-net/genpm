# Post-MVP

> Ref: [roadmap §10](../docs/roadmap-mvp.md#10-después-del-mvp), [web-ui-spec §10](../docs/web-ui-spec.md#10-alcance-mvp-día-5-del-sprint) e [i18n §7](../docs/i18n.md#7-impacto-en-el-sprint).
> Nivel épica: cada tarea se desglosa en un archivo propio cuando empiece su versión (`11-v0-2.md`, …). Estimaciones gruesas.

## v0.1.1 · +1 semana (lo recortado del sprint)

- [ ] `V011-01` **TODO** Recuperar todo lo marcado como CUT en el sprint (ver pnpm tasks list cut) · T · 8h · deps: D7-09
- [ ] `V011-02` **DOING** Binario nativo de genpm para macOS, Linux y Windows con instaladores de una línea y genpm upgrade (ADR-025) · B · 8h · deps: D5-B-04
  - DoD: `release.yml` verde en macOS, Linux y Windows (smoke del binario + install.sh + install.ps1 en PowerShell 5.1 y 7); autorrevisión diferida (ADR-023) de `scripts/install/` y `core/src/self-update.ts` antes del primer tag. El release real espera a la apertura del repo (D6-P-07).
- [ ] `V011-03` **TODO** Firma de código de los binarios: Apple Developer ID + notarización y Authenticode · F · 6h · deps: V011-02
- [x] `V011-04` **DONE** Canales de paquetes para el binario: Homebrew tap, Scoop y winget · B · 4h · deps: V011-02
  - Hecho el 2026-10-05: `brew install genpm-net/tap/genpm` (GenPM-net/homebrew-tap, auditado y checksum verificado) y Scoop (GenPM-net/scoop-bucket, hashes verificados); `genpm upgrade` remite a `brew upgrade`/`scoop update`. winget queda fuera hasta firmar los binarios (V011-03): exige PR a microsoft/winget-pkgs.
- [x] `V011-05` **DONE** genpm mcp serve en el binario para usar el MCP sin Node · B · 4h · deps: V011-02
- [ ] `V011-06` **TODO** Crear el token `CF_AE_TOKEN` (Account Analytics: Read) y cargarlo en producción y staging · F · 0.5h · deps: D6-P-03
  - `wrangler secret put CF_AE_TOKEN` y `wrangler secret put CF_AE_TOKEN --env staging` en apps/registry. Comprobar: en la siguiente hora en punto desaparece `installs_rollup_skipped` de los logs; el cron de las 03:15 recupera los últimos 30 días (ADR-027).
- [ ] `V011-07` **TODO** Cloudflare Web Analytics sin cookies: alta del sitio, beacon en Base.astro y CSP ampliada · W · 1h · deps: V011-06
- [ ] `V011-08` **TODO** Eventos de producto en el navegador: POST /e same-origin con sendBeacon a Analytics Engine (copy_install, tab_view, mcp_setup_copy, publish_cta) · W · 3h · deps: V011-07
  - Sin cookies, sin IP ni identificadores; lista cerrada de eventos validada con zod; rate limit; textos y ruta truncados como en lib/analytics.ts.
- [ ] `V011-09` **TODO** Eventos de servidor que faltan: búsquedas sin resultados, publish_ok, login y sponsored_impression/click · A · 2h · deps: V011-06
- [ ] `V011-10` **TODO** Panel /admin/analytics (solo staff) sobre la SQL API de AE: visitas, top búsquedas, demanda no cubierta y embudo visita → copia → instalación · W · 6h · deps: V011-08, V011-09
- [ ] `V011-11` **TODO** Decidir ADR-027 capa 2 (mapas de calor con consentimiento) y revisar el texto legal del banner · F · 1h · deps: V011-10
- [ ] `V011-12` **TODO** PostHog Cloud EU con opt-in: banner con rechazar igual de visible, proxy /ph/*, mapas de calor y grabaciones enmascaradas, políticas actualizadas · W · 8h · deps: V011-11
  - DoD: sin consentimiento no se carga ningún script ni se escribe nada en el navegador (test e2e); cambiar de opinión desde el pie de página; política de cookies, privacidad y registro de actividades actualizados.

## v0.2 · +2 semanas

> Priorización (D7-10, 2026-10-05), por lo visto en las pruebas de agente y en el ensayo del runbook:
> 1. **`V02-01` + `V02-02` (actualizar con merge de 3 vías)**: hoy subir `@core/auth` 1.0.0 → 1.1.0 en un proyecto con
>    cambios obliga a `remove` + `add` y se pierden las ediciones. Es lo primero que preguntará cualquiera tras instalar.
> 2. **`V02-10`**: `genpm add --yes` sin instalar dependencias de npm (en CI y en demos no hay forma de decir "sí al
>    código, no a npm" sin preguntas).
> 3. **`V02-03` (Used by)** y **`V02-04` (calidad)**: ayudan a elegir entre paquetes cuando haya más que las semillas.
> 4. **`V02-07` / `V02-08`** (web P1/P2) y **`V02-05`** (revisión nativa de nivel 2) según tracción por idioma.

- [ ] `V02-01` **TODO** genpm diff y update con merge 3-way · B · 24h · deps: D7-10
- [ ] `V02-02` **TODO** Tool genpm_diff y actualización asistida por IA · B · 8h · deps: V02-01
- [ ] `V02-03` **TODO** Dependents ("Used by") en API y página de paquete · A · 6h · deps: D7-10
- [ ] `V02-04` **TODO** Puntuación de calidad de paquetes · A · 8h · deps: D7-10
- [ ] `V02-05` **TODO** Revisión nativa del nivel 2 de idiomas y retirada del banner beta · F · 8h · deps: D7-06
- [x] `V02-06` **DONE** Docs completas en pt-BR · C · 8h · deps: D6-I-01
  - Hecho el 2026-10-04: las 11 páginas de docs en los 8 idiomas (pendiente la revisión nativa de D6-I-01).
- [ ] `V02-07` **TODO** Web P1: dashboard del autor, perfil, sponsors y enterprise (landing + waitlist con POST /v1/leads) · W · 16h · deps: D5-W-23
- [ ] `V02-08` **TODO** Web P2: comparador de versiones (diff visual), status page y cola de admin · W · 16h · deps: V02-01
- [x] `V02-09` **DONE** Modo oscuro opcional de la web con los tokens dark de tokens.json · W · 4h · deps: D5-W-23
  - Ya en producción: botón de tema en la cabecera y en el menú móvil (claro por defecto, branding §8).
- [x] `V02-10` **DONE** genpm add: aceptar el plan sin instalar las dependencias de npm ni preguntar (`--no-install-deps`), para CI y demos · B · 1h · deps: D7-10

## v0.3 · +6 semanas

- [ ] `V03-01` **TODO** Trusted publishing con OIDC de GitHub Actions · A · 12h · deps: V02-01
- [ ] `V03-02` **TODO** Mirror R2 "Verified Archive" · A · 16h · deps: V02-01
- [ ] `V03-03` **TODO** Publicación desde GitLab · A · 12h · deps: V02-01
- [ ] `V03-04` **TODO** Transporte MCP HTTP remoto de solo lectura · B · 12h · deps: V02-02
- [ ] `V03-05` **TODO** Recetas compose (varios paquetes en un comando) · B · 16h · deps: V02-01
- [ ] `V03-06` **TODO** Auditoría de seguridad externa · F · 8h · deps: V02-01

## v1.0 · SaaS · +3 meses

- [ ] `V10-01` **TODO** Registros privados (shared tenancy) con RBAC: teams y package_grants (migración aditiva api-spec §5.4) · A · 60h · deps: V03-01
- [ ] `V10-02` **TODO** SSO · A · 24h · deps: V10-01
- [ ] `V10-03` **TODO** Dominio propio por registro · A · 12h · deps: V10-01
- [ ] `V10-04` **TODO** Auditoría exportable · A · 12h · deps: V10-01
- [ ] `V10-05` **TODO** Facturación con Stripe · A · 24h · deps: V10-01
- [ ] `V10-06` **TODO** Patrocinios self-serve · W · 24h · deps: V10-05
- [ ] `V10-07` **TODO** Pentest y bug bounty con recompensas · F · 8h · deps: V10-01

## Enterprise · +6 meses

- [ ] `ENT-01` **TODO** Tenancy dedicada: D1 por cliente vía Workers for Platforms · A · 60h · deps: V10-01
- [ ] `ENT-02` **TODO** SCIM · A · 24h · deps: V10-02
- [ ] `ENT-03` **TODO** Políticas: paquetes permitidos y escaneo obligatorio · A · 24h · deps: V10-01
- [ ] `ENT-04` **TODO** SLA y soporte dedicado · F · 8h · deps: ENT-01
