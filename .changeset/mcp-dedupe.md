---
"@genpm-net/cli": patch
"@genpm-net/mcp": patch
---

Un servidor MCP declarado por varios paquetes (p. ej. `stripe` en `@core/billing` y `@core/stripe`) aparece una sola vez en el plan y se pregunta una sola vez.
