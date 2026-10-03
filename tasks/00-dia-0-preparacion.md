# Día 0 · Preparación

> Antes del lunes, ~3 h de trabajo del fundador (más esperas de terceros). Ref: [roadmap §3](../docs/roadmap-mvp.md#3-día-0--preparación-antes-del-lunes-3-h).
> Hito **M0**: cuentas, dominios y claves listos; accesos repartidos al equipo.

## Dominios y marca

- [ ] `D0-01` **DOING** Registrar genpm.net, activar registrar lock y DNSSEC (DNS en Cloudflare) · F · 2h · deps: —
  - ✅ Registrado 2026-10-03 06:12 UTC en Piensa Solutions (Arsys/Nicline), plan Correo Basic. Vence 2027-10-03. `clientTransferProhibited` ya activo.
  - Pendiente: renovación automática (ideal varios años) · 2FA en la cuenta de Piensa · nameservers → Cloudflare · DNSSEC (DS de Cloudflare en el panel DNSSEC de Piensa) · borrar el A de parking `217.76.156.252`.
  - DNS en Cloudflare: conservar MX `mx.buzondecorreo.com` y SPF de Piensa; SPF `~all` → `-all`; DMARC `p=quarantine` → `p=reject`; DKIM si Piensa lo ofrece; CAA (`letsencrypt.org`, `pki.goog`, `ssl.com`, `iodef mailto:hello@genpm.net`).
  - Opcional: transferir a Cloudflare Registrar a partir del 2026-12-02 (bloqueo ICANN de 60 días en dominios nuevos).
- [ ] `D0-02` **BLOCKED** Registrar genpm.dev como dominio defensivo con 301 a genpm.net · F · 0.5h · deps: —
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.
- [ ] `D0-03` **BLOCKED** Búsqueda de marca registrada "GenPM" (USPTO, EUIPO, INPI Brasil, SAPI Venezuela, IMPI México) · F · 2h · deps: —
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.
- [ ] `D0-04` **BLOCKED** Reservar handles @genpm en X, Discord, YouTube y LinkedIn (fallback genpmnet / genpm-net) · F · 0.5h · deps: —
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.

## GitHub y npm

- [ ] `D0-05` **DOING** Crear la org de GitHub GenPM-net con 2FA obligatorio · F · 0.5h · deps: —
  - ✅ Org creada 2026-10-03 (`github.com/GenPM-net`, plan Free). Verificado por API: `two_factor_requirement_enabled: false` → falta activarlo.
  - Pendiente (Settings): exigir 2FA · base permissions "No permission" · solo owners crean repos · Dependabot alerts y secret scanning con push protection para repos nuevos · verificar el dominio genpm.net (badge "Verified").
- [ ] `D0-06` **BLOCKED** OAuth App de GitHub con Device Flow (login del CLI y de la web) · F · 0.5h · deps: D0-05
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.
- [ ] `D0-07` **BLOCKED** GitHub App de solo lectura para el registry (lectura de repos en publish) · F · 0.5h · deps: D0-05
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.
- [x] `D0-08` **DONE** Repo GenPM-net/genpm con protección de main y 5 repos vacíos para las semillas · F · 0.5h · deps: D0-05
  - Decisión ADR-016: repo **privado** hasta el lanzamiento. Para proteger `main` en privado hace falta el plan Team de GitHub; semillas privadas hasta `D6-P-07`.
  - ✅ `GenPM-net/genpm` creado (privado) y con el código subido el 2026-10-03.
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.
  - ✅ 2026-10-03: repos privados `GenPM-net/{db,auth,billing,email,ai}` creados con su subtree y tag `v1.0.0`. Sin plan Team: `main` sin protección según ADR-023.

- [ ] `D0-09` **BLOCKED** Org de npm @genpm con 2FA, placeholder genpm@0.0.0 y trusted publishing para el monorepo · F · 1h · deps: D0-08
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.

## Cloudflare y claves

- [ ] `D0-10` **DOING** Cuenta Cloudflare Workers Paid con llaves FIDO2 · F · 0.5h · deps: —
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.
  - ✅ 2026-10-03: cuenta `f88afb06…` con wrangler; staging funciona en el plan gratuito (D1, Queues, Rate Limiting, Analytics Engine). Pendiente fundador: Workers Paid antes del lanzamiento (límites de CPU/peticiones) y llaves FIDO2.

- [x] `D0-11` **DONE** Crear D1 genpm-registry y genpm-registry-staging, dataset de Analytics Engine y Queue de escaneo · F · 0.5h · deps: D0-10
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.
  - ✅ 2026-10-03: D1 `genpm-registry` (`fd31f31d…`) y `genpm-registry-staging` (`b715994c…`) con las 4 migraciones; colas `genpm-scan` y `genpm-scan-staging`; datasets de Analytics Engine se crean al primer write.

- [ ] `D0-12` **DOING** Generar claves de firma Ed25519 (k1 activa, k2 siguiente) y clave raíz de revocación guardada offline · F · 1h · deps: —
  - ✅ 2026-10-03: k1/k2/root generadas en `~/genpm-keys-2026-10-03/`, públicas fijadas en `packages/core/src/keys.ts` y registradas en la D1 de producción; staging usa su propia clave `s1`. Pendiente fundador: mover `root.private` offline y borrarla del disco.

- [ ] `D0-13` **BLOCKED** Gestor de secretos del equipo con todos los secretos; ningún .env commiteado · F · 0.5h · deps: D0-12
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.

## Personas y canales

- [ ] `D0-14` **BLOCKED** Contratar revisor nativo de pt-BR para el Día 6 y buscar revisores de nivel 2 (ja, zh-CN, ko, fr, de) · F · 1h · deps: —
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.
- [x] `D0-15` **DONE** Buzón hello@genpm.net operativo (único; seguridad con asunto [SECURITY]) · F · 0.5h · deps: D0-01
  - ✅ Activo el 2026-10-03 en Piensa (Correo Basic). MX `mx.buzondecorreo.com` y SPF verificados por DNS. Falta: DMARC y DKIM (ver `D0-01`), 2FA/contraseña única del buzón, filtro para `[SECURITY]`.
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.

## Gate

- [ ] `D0-G-01` **BLOCKED** M0: todas las cuentas con 2FA/FIDO2 y accesos repartidos al equipo · T · 0.5h · deps: D0-06, D0-07, D0-08, D0-09, D0-11, D0-13
  - Bloqueo: requiere acción del fundador fuera del repo (compras, cuentas, 2FA o contratación); un agente no puede hacerlo.
