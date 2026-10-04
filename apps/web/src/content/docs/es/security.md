---
title: Modelo de seguridad
section: Seguridad
order: 50
---
GenPM es seguro por diseño y verificable por cualquiera. Nunca promete un «100 % seguro»; garantiza diez invariantes, cada uno con un test que bloquea cualquier release:

1. **Integridad**: los bytes instalados son exactamente el árbol del commit `c`, nunca una rama.
2. **Cero ejecución**: sin scripts de ciclo de vida, hooks de Git, submódulos ni filtros.
3. **Confinamiento**: solo se escribe dentro del proyecto, en las rutas del plan.
4. **Sin ejecutables**: los archivos inyectados se escriben con permisos `0644`.
5. **Consentimiento**: ni configuración MCP, ni instalaciones npm, ni sobrescrituras sin tu sí.
6. **Secretos**: GenPM nunca lee los valores de `.env`.
7. **Autoridad del registry**: al publicar se lee GitHub, nunca lo que envía el cliente.
8. **Manifiestos firmados**: el CLI solo instala manifiestos firmados con Ed25519.
9. **Inmutabilidad**: una versión publicada nunca cambia.
10. **Aislamiento entre tenants**: ninguna consulta cruza registries.

El mismo escáner determinista se ejecuta en el registry (al publicar) y en el CLI (en cada instalación), así que comprometer el registry no basta para saltárselo.

## Reportar una vulnerabilidad

Escribe a **hello@genpm.net** con el asunto `[SECURITY]` o usa GitHub Private Vulnerability Reporting. Primera respuesta en menos de 48 horas. Más información en [/security](/security).
