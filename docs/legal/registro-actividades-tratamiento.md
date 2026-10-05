# Registro de actividades de tratamiento (art. 30 RGPD)

> Documento **interno** (no se publica). Responsable: el titular de [`owner.json`](../../apps/web/src/content/legal/owner.json)
> (`{{name}}`, NIF `{{nif}}`), contacto hello@genpm.net. Sin DPD (no obligatorio: art. 37 RGPD, art. 34 LOPDGDD).
> Fuente pública equivalente: [política de privacidad](../../apps/web/src/content/legal/es/privacy.md) §2–§4. Si cambia
> una, se cambia la otra. Última revisión: 2026-10-05.

| # | Actividad | Interesados | Datos | Finalidad | Base | Destinatarios / encargados | Transferencias | Plazo (cómo se aplica) |
|---|---|---|---|---|---|---|---|---|
| 1 | Cuentas | Usuarios registrados | ID, login, nombre, avatar y orgs de GitHub; email | Cuenta, autoría, permisos de scope, avisos | 6.1.b; email 6.1.b/f | Cloudflare (D1, Workers) | EE. UU. (DPF + CCT) | Mientras exista la cuenta; baja → anonimización ≤ 30 d (manual, runbook §3) |
| 2 | Tokens de API | Usuarios | Hash del token, scopes, fechas | Autenticar CLI y CI | 6.1.b | Cloudflare | EE. UU. | Revocados/caducados: borrado a los 30 d (cron diario `purgeExpired`) |
| 3 | Registro de paquetes | Publicadores | Manifiesto, repo, commit, login | Prestar el registro | 6.1.b | Cloudflare; público | EE. UU. | Indefinido (inmutabilidad, §6 de la política) |
| 4 | Instalaciones | Usuarios del CLI/MCP | Paquete, versión, cliente, versión, país (de la IP, no guardada) | Contadores y estadísticas | 6.1.f | Cloudflare (Analytics Engine) | EE. UU. | Eventos 90 d (retención de Analytics Engine); agregados diarios |
| 5 | Seguridad | Cualquiera | Hash de IP con sal diaria (audit_log, leads) | Rate limit, abuso, auditoría | 6.1.f (cons. 49) | Cloudflare | EE. UU. | 30 d (cron diario) |
| 6 | Logs técnicos | Cualquiera | Petición, errores (Workers Logs) | Diagnóstico | 6.1.f | Cloudflare | EE. UU. | ≤ 7 d (retención de Workers Logs) |
| 7 | Analítica web | Visitantes | Página vista, búsqueda (y nº de resultados), paquete visto, idioma, ruta, dominio de procedencia, campaña, país, robot/persona/con sesión; sin IP ni identificadores | Mejorar el servicio | 6.1.f | Cloudflare (Analytics Engine) | EE. UU. | 3 meses (retención de Analytics Engine) |
| 11 | Analítica opcional (ADR-027) | Visitantes que la aceptan | Clics, desplazamiento, páginas, grabación de sesión con formularios enmascarados (nunca páginas de cuenta), ID aleatorio del navegador, navegador y dispositivo; sin IP (el proxy `/ph` no la reenvía) | Mapas de calor y mejora de la web | 6.1.a + art. 22.2 LSSI (banner, retirada en el pie) | PostHog, Inc. (Cloud EU, Fráncfort) | EE. UU. solo para acceso de soporte (CCT) | Eventos 12 meses y grabaciones 30 días (configurar en el proyecto de PostHog) |
| 12 | SSO y SCIM de organizaciones (V10-02, ENT-02) | Miembros de organizaciones clientes | Identificador del IdP (`sub`), email corporativo, estado activo, última autenticación | Control de acceso a registros privados por encargo del cliente | 6.1.b (contrato con la organización; GenPM actúa como encargado del cliente) | Cloudflare | EE. UU. | Mientras dure la conexión; se borra al quitar el SSO o la cuenta |
| 13 | Facturación (V10-05, V10-06) | Clientes de planes de pago y patrocinadores | Cuenta, registro o paquete, importe, estado del pago e ids de Stripe (cliente, suscripción, pago); la tarjeta la trata solo Stripe | Cobrar y cumplir obligaciones fiscales | 6.1.b y 6.1.c | Stripe Payments Europe, Ltd. (Irlanda) | EE. UU. para soporte (DPF/CCT) | Mientras dure la relación + plazos fiscales (6 años) |
| 8 | Leads | Empresas y patrocinadores | Email, empresa, tamaño, IDE, mensaje | Responder | 6.1.b (precontractual) | Cloudflare | EE. UU. | 12 meses salvo acuerdo (cron diario) |
| 9 | Denuncias (DSA art. 16) | Denunciantes | Cuenta, paquete, motivo, descripción | Moderación y comunicación | 6.1.c | Cloudflare | EE. UU. | Cerradas: 2 años (cron diario) |
| 10 | Correo | Remitentes | Email y contenido | Atender consultas y derechos | 6.1.f / 6.1.c | Piensa Solutions (Arsys) | No (España) | Lo necesario + 2 años (manual) |

**Encargados (art. 28):** Cloudflare, Inc. (DPA incluido en sus condiciones; DPF y CCT) y Arsys Internet, S.L.U. (contrato
del servicio de correo). **GitHub, Inc.** es responsable independiente (login y lectura de repos públicos).

**Medidas de seguridad (art. 32):** HTTPS forzado y HSTS preload; tokens y sesiones solo como hash; cookies `__Host-`
`HttpOnly`/`Secure`/`SameSite=Lax`; IP seudonimizada con sal diaria; manifiestos firmados (Ed25519); 2FA en las cuentas
de administración; rate limits; CSP estricta; copias en D1 (Time Travel 30 d). Brechas: notificación a la AEPD ≤ 72 h
(art. 33) según el runbook.

## Ponderación de intereses legítimos (art. 6.1.f)

| Actividad | Interés | Necesidad | Equilibrio |
|---|---|---|---|
| 4 Instalaciones | Medir el uso del registro y mostrar contadores públicos útiles para elegir paquetes | Solo datos técnicos mínimos; la IP no se guarda | Esperable en un gestor de paquetes (npm, PyPI lo hacen); oposición sencilla: `GENPM_TELEMETRY=0` / `DO_NOT_TRACK=1` |
| 5 Seguridad | Evitar abusos y ataques | Hash con sal diaria, 30 días | Considerando 49 RGPD; impacto mínimo |
| 6 Logs | Diagnosticar fallos | ≤ 7 días | Impacto mínimo |
| 7 Analítica | Mejorar búsqueda y contenido, saber de dónde llegan las visitas | Sin IP ni identificadores, solo en el servidor (sin acceso al terminal: no aplica el art. 22.2 LSSI); el país y el dominio de procedencia ya vienen en la petición | Datos agregados, sin perfiles |
| 1 Email (avisos) | Avisar de incidentes de seguridad en los paquetes del usuario | No se muestra ni se usa para marketing | Esperable y en interés del propio usuario |

## Pendiente del responsable

- Revisión jurídica de los textos legales (tarea `D6-P-08`).
- Actividad 13: aceptar el DPA de Stripe y añadir Stripe a la política de privacidad y a las condiciones (precios, renovación, reembolsos de patrocinios) antes de poner `STRIPE_SECRET_KEY`.
- Si se activan Turnstile o newsletter, añadir la actividad aquí y en la política.
- Actividad 11: firmar el DPA de PostHog (se acepta en su panel), elegir la región EU al crear el proyecto y fijar
  la retención de grabaciones en 30 días y de eventos en 12 meses antes de poner `POSTHOG_KEY` en producción.
