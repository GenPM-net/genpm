# Aceptación de kit-cms: retrofit (CAT-CMS-15)

`site/` es un sitio Next de 5 páginas con todo el contenido escrito a mano ("Brightside Plumbing"). La prueba: un
agente, solo con los AGENTS.md, lo hace autoadministrable con `@core/kit-cms` y el HTML visible no cambia.

1. Copia `site/` a un directorio de trabajo con git, `npm install`, y `genpm add @core/kit-cms` (o, sin registro,
   `node catalog/scripts/simulate-add.mjs <dir> @core/kit-cms` y las dependencias npm que imprime).
2. Dale al agente una base de datos Postgres vacía y la petición: «Haz mi web autoadministrable con genpm: quiero poder
   cambiar los textos e imágenes desde un panel, sin que cambie el diseño».
3. Con las variables de `.env.local` del agente exportadas: `node snapshot.mjs <dir> <salida>` y
   `diff -r expected <salida>`.

Criterio: mismas 5 páginas, mismo título y descripción, mismo HTML visible. Única diferencia admitida: el
`<div hidden>` vacío que Next deja de emitir con `htmlLimitedBots`. Tiempo de agente < 30 min.

Resultado 2026-10-07 (con `genpm add` simulado): idéntico salvo esa diferencia, ~19 min y ~55 llamadas. Lo que le
faltó a la documentación ya está corregido (scripts sin top-level await, permisos con `_`, notas de Retrofit en
kit-cms y @core/content). Falta repetirla con el registro real.
