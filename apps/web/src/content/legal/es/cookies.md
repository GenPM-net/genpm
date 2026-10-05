---
title: Política de cookies
updated: 2026-10-05
---
Esta política cumple el artículo 22.2 de la Ley 34/2002 de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE) y la Guía sobre el uso de las cookies de la Agencia Española de Protección de Datos.

## Resumen

genpm.net usa **cookies técnicas y de preferencias que tú mismo eliges**, exentas de consentimiento (art. 22.2 LSSI-CE), y **una analítica opcional que solo se activa si la aceptas** en el aviso que verás en tu primera visita. «Aceptar» y «Rechazar» tienen el mismo peso: si rechazas o no eliges, no se carga ningún script de analítica ni se guarda nada suyo en tu dispositivo. No usamos cookies de publicidad. Aparte, contamos en nuestros servidores las páginas que pides (páginas vistas, búsquedas, paquetes, procedencia y país, sin IP ni identificadores): eso no guarda nada en tu navegador.

## Qué guardamos en tu navegador

| Nombre | Tipo | Titular | Finalidad | Duración |
|---|---|---|---|---|
| `__Host-genpm_session` | Cookie técnica | GenPM | Mantener tu sesión iniciada, solo si inicias sesión | 30 días |
| `__Host-genpm_oauth` | Cookie técnica | GenPM | Proteger el inicio de sesión con GitHub contra falsificaciones (CSRF) | 10 minutos |
| `genpm-theme` | Almacenamiento local | GenPM | Recordar el modo claro u oscuro que eliges | Hasta que lo borres |
| `genpm-lang-dismissed` | Almacenamiento local | GenPM | No volver a sugerirte otro idioma si cerraste el aviso | Hasta que lo borres |
| `genpm_consent` | Cookie de preferencia | GenPM | Recordar si aceptaste o rechazaste la analítica opcional | 6 meses |

## Analítica opcional (solo si la aceptas)

Si pulsas «Aceptar», usamos **PostHog** (PostHog, Inc., con los datos alojados en la UE) para ver mapas de calor de clics y desplazamiento y grabaciones anónimas de la sesión, con los campos de formulario ocultos. Las páginas de cuenta (inicio de sesión, tokens, panel y publicación) nunca se graban, y las peticiones pasan por nuestro propio dominio sin reenviar tu IP.

| Nombre | Tipo | Titular | Finalidad | Duración |
|---|---|---|---|---|
| `ph_<clave>_posthog` | Cookie y almacenamiento local de analítica | PostHog (tercero, encargado de GenPM) | Identificador aleatorio para agrupar tus visitas y la sesión grabada | 12 meses |
| `ph_*` en `sessionStorage` | Almacenamiento de sesión de analítica | PostHog | Mantener la grabación de la sesión en curso | Hasta cerrar la pestaña |

**Cambiar de opinión:** pulsa «Preferencias de cookies» en el pie de cualquier página. Si retiras el consentimiento, dejamos de cargar PostHog y borramos de tu navegador sus cookies y su almacenamiento. Retirarlo es tan fácil como darlo y no afecta a nada de lo que puedes hacer en la web.

## Seguridad de Cloudflare

La web se sirve a través de Cloudflare. Para proteger el sitio frente a ataques automatizados, Cloudflare puede establecer cookies técnicas de seguridad (por ejemplo `__cf_bm`, 30 minutos, o `cf_clearance`) y, en los formularios de patrocinios y empresas, el reto antibots **Turnstile** puede leer información técnica del navegador para distinguir personas de bots. Su única finalidad es la seguridad del servicio que solicitas: no se usan para publicidad ni para seguirte entre sitios. Más información en la [política de cookies de Cloudflare](https://www.cloudflare.com/cookie-policy/).

## Cómo borrarlas o bloquearlas

Puedes borrar o bloquear las cookies y el almacenamiento local desde la configuración de tu navegador ([Chrome](https://support.google.com/chrome/answer/95647), [Firefox](https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox), [Safari](https://support.apple.com/guide/safari/sfri11471), [Edge](https://support.microsoft.com/microsoft-edge)). Si bloqueas `__Host-genpm_session` no podrás iniciar sesión, pero sí buscar e instalar paquetes.

## El CLI y el servidor MCP

El CLI `genpm` y el servidor `@genpm-net/mcp` no usan cookies. Sobre la telemetría de instalaciones y cómo desactivarla, consulta la [Política de privacidad](/privacy).

Si cambiamos las cookies que usamos, actualizaremos esta política y, si la finalidad cambia, te volveremos a pedir el consentimiento.
