---
title: Política de privacidad
updated: 2026-10-05
---
Esta política explica qué datos personales trata GenPM (genpm.net, la API `api.genpm.net`, el CLI `genpm` y el servidor `@genpm-net/mcp`), para qué, con qué base jurídica y qué derechos tienes. Cumple el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).

## 1. Responsable del tratamiento

- **Responsable:** {{name}}
- **NIF:** {{nif}}
- **Domicilio:** {{address}}
- **Contacto:** {{email}} (indica «[PRIVACIDAD]» en el asunto)

No es obligatorio designar un delegado de protección de datos (art. 37 RGPD y art. 34 LOPDGDD); para cualquier cuestión escribe al contacto anterior.

## 2. Qué datos tratamos, para qué y con qué base jurídica

| Datos | Finalidad | Base jurídica | Conservación |
|---|---|---|---|
| Identificador, usuario, nombre, avatar y organizaciones de GitHub (al iniciar sesión) | Crear y mantener tu cuenta, mostrar quién publica cada paquete y autorizar la publicación en tus scopes | Ejecución del contrato (art. 6.1.b RGPD): los Términos del servicio | Mientras tengas la cuenta |
| Email de tu cuenta de GitHub (nunca se muestra) | Avisos de seguridad y del servicio sobre tus paquetes | Ejecución del contrato e interés legítimo en la seguridad del ecosistema (art. 6.1.f) | Mientras tengas la cuenta |
| Tokens de API (solo guardamos su hash) | Autenticar el CLI y la integración continua | Ejecución del contrato | Hasta que caduquen o los revoques |
| Paquetes publicados: manifiesto, repositorio, commit y tu usuario de GitHub | Ofrecer el registro: buscar, verificar e instalar paquetes | Ejecución del contrato | Indefinida: las versiones publicadas son inmutables para que los proyectos que las usan sigan siendo verificables (ver §6) |
| Eventos de instalación: paquete, versión, cliente (`cli`/`mcp`), versión del CLI y país (deducido de la IP, que no se guarda) | Contadores públicos de instalaciones y estadísticas agregadas | Interés legítimo en medir el uso del registro | Agregados por día; eventos individuales, 90 días |
| Dirección IP, convertida en un hash con una sal que rota cada día | Limitar el número de peticiones y prevenir abusos | Interés legítimo en la seguridad del servicio (art. 6.1.f y considerando 49) | 30 días como máximo |
| Registros técnicos del servidor (Cloudflare Workers) | Diagnosticar errores y ataques | Interés legítimo en la seguridad y continuidad del servicio | 7 días como máximo |
| Analítica de la web: búsquedas hechas, paquete visto, idioma y ruta (sin IP ni identificadores) | Saber qué se busca y qué se usa para mejorar el servicio | Interés legítimo en medir el uso de forma agregada (art. 6.1.f) | 3 meses (Analytics Engine de Cloudflare) |
| Formulario de patrocinios o de empresas: email, empresa, tamaño del equipo, IDE y mensaje | Responder a tu solicitud | Medidas precontractuales a petición tuya (art. 6.1.b) | 12 meses, salvo que lleguemos a un acuerdo |
| Denuncias de paquetes: tu cuenta, el paquete, el motivo y tu descripción | Revisar el contenido denunciado y comunicar la decisión | Obligación legal del Reglamento (UE) 2022/2065 de Servicios Digitales, art. 16 (art. 6.1.c RGPD) | 2 años desde la decisión |
| Correos que nos envías | Atender tu consulta o el ejercicio de tus derechos | Interés legítimo en responderte o, en su caso, obligación legal | Lo necesario para resolverla y hasta 2 años después |

Estos plazos se aplican solos: un proceso diario borra o anonimiza lo que ha caducado.

**Lo que nunca tratamos:** el contenido de tu proyecto, tus archivos `.env` o los valores de tus variables de entorno. Tampoco usamos cookies publicitarias ni de seguimiento entre sitios, y tu navegador no envía nada para la analítica: contamos en nuestros servidores las páginas que pides (ver la [Política de cookies](/cookies)).

**Telemetría del CLI y del servidor MCP:** con `GENPM_TELEMETRY=0` o `DO_NOT_TRACK=1`, el cliente envía `client=none` y el registro no guarda el evento. Puedes oponerte así en cualquier momento.

No tomamos decisiones basadas únicamente en tratamientos automatizados que produzcan efectos jurídicos sobre ti (art. 22 RGPD). El escáner automático puede poner un paquete en revisión, pero la decisión final de retirarlo la toma una persona (ver la [Política de paquetes](/policy)).

Facilitar los datos de GitHub es necesario para crear una cuenta; sin ellos no puedes publicar, aunque sí buscar e instalar paquetes, que no requiere cuenta.

## 3. Destinatarios y encargados del tratamiento

No vendemos ni cedemos tus datos a terceros. Los tratan por cuenta nuestra estos proveedores, con contrato de encargo conforme al art. 28 RGPD:

| Proveedor | Servicio | Ubicación |
|---|---|---|
| Cloudflare, Inc. | Alojamiento (Workers), base de datos (D1), red de entrega, protección antibots (Turnstile) y analítica agregada | UE y EE. UU. |
| Piensa Solutions (Arsys Internet, S.L.U.) | Dominio y correo electrónico | España |

**GitHub, Inc.** actúa como responsable independiente cuando inicias sesión con tu cuenta de GitHub y cuando el registro lee repositorios públicos; se rige por su propia [declaración de privacidad](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Los datos públicos de los paquetes (nombre, versiones, repositorio y usuario de GitHub del publicador) se muestran a cualquier visitante y a los agentes de IA que usan el registro, porque esa es la finalidad del servicio.

Solo comunicaremos datos a autoridades cuando una norma nos obligue.

## 4. Transferencias internacionales

Cloudflare, Inc. y GitHub, Inc. están adheridas al Marco de Privacidad de Datos UE-EE. UU. (Data Privacy Framework), reconocido por la Decisión de adecuación de la Comisión Europea de 10 de julio de 2023 (art. 45 RGPD). Además, sus contratos incluyen las cláusulas contractuales tipo de la Comisión (art. 46 RGPD).

## 5. Tus derechos

Puedes ejercer en cualquier momento tus derechos de **acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad**, y retirar el consentimiento que hayas dado, escribiendo a {{email}} con el asunto «[PRIVACIDAD]». Te responderemos en el plazo de un mes (art. 12.3 RGPD). Si no podemos identificarte con la información que aportas, te pediremos lo mínimo necesario para hacerlo.

Si consideras que no hemos atendido bien tu solicitud, puedes presentar una reclamación ante la **Agencia Española de Protección de Datos** ([www.aepd.es](https://www.aepd.es), C/ Jorge Juan 6, 28001 Madrid).

## 6. Baja de la cuenta

Si pides la baja, anonimizamos tus datos personales en un plazo de 30 días; las copias de seguridad se sobrescriben en otros 30. Los paquetes que hayas publicado permanecen disponibles, asignados a una cuenta del sistema, porque otros proyectos dependen de ellos y sus versiones son inmutables. La URL del repositorio de GitHub de cada paquete, que puede contener tu usuario, forma parte del paquete publicado; si quieres que dejen de instalarse, puedes retirarlos (*yank*) antes de pedir la baja.

## 7. Menores

GenPM es un servicio para desarrolladores. Debes tener al menos 16 años para crear una cuenta: es la edad general del art. 8 RGPD y la que fija el proyecto de ley orgánica de protección de menores en entornos digitales, que elevará la del art. 7 LOPDGDD (14 años). No aceptamos cuentas de menores de esa edad; si detectamos una, la cerramos y borramos sus datos.

## 8. Seguridad

Aplicamos medidas técnicas y organizativas adecuadas al riesgo: cifrado en tránsito (HTTPS con HSTS), tokens almacenados solo como hash, cookies `HttpOnly` y `Secure`, direcciones IP seudonimizadas, acceso restringido con doble factor y firma de los manifiestos. Si se produce una brecha de seguridad que suponga un riesgo para tus derechos, lo notificaremos a la AEPD en 72 horas y, cuando proceda, a ti (arts. 33 y 34 RGPD).

## 9. Cambios

Si cambiamos esta política de forma relevante, lo avisaremos en genpm.net y, si tienes cuenta, por email con antelación.
