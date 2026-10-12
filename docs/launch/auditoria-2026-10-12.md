# Auditoría de métricas y preparación del lanzamiento (12-10-2026)

## Métricas de la portada

| Cifra | Valor | Fuente | ¿Correcta? |
|---|---|---|---|
| Paquetes | 48 | `packages` activos y públicos en D1 | Sí |
| Instalaciones | 81 | `sum(installs_total)`: rollup de Analytics Engine, solo `client` ∈ {cli, mcp} | Sí, según su definición |
| Publicadores | 2 | `count(DISTINCT owner_id)`: `acc_system` (43 paquetes @core) y la cuenta del fundador (5) | Sí, pero ambos son internos |

Las 85 entradas de Analytics Engine (81 de cli/mcp y 4 de web) son del **4 y 5 de octubre**, todas desde **ES**,
con las versiones del CLI 0.1.0 → 0.1.4, que se publicaron esos mismos días. Son pruebas internas: no hay uso externo
registrado. Desde el 5 de octubre: 0 instalaciones, 0 cuentas nuevas (3 cuentas, todas anteriores al lanzamiento) y 0 leads.

La telemetría funciona: una petición de prueba con `client=web` (que el rollup excluye) llegó a Analytics Engine con
unos 20 minutos de retraso de ingesta. La caché no se salta el contador.

npm marca ~350 descargas/semana de `@genpm-net/cli` y de `@genpm-net/mcp`, pero ningún `resolve`. Eso encaja con
mirrors, escáneres y bots de npm, no con usuarios.

## El embudo de un usuario nuevo funciona

`install.sh` tarda 5 s; `genpm search auth`, 0,2 s; `genpm add @core/auth` resuelve `@core/db`, verifica SHA y firma,
escanea las reglas y escribe el lockfile en 1,3 s. El problema no es el producto: **todavía no se ha lanzado**.

## Bloqueantes del lanzamiento

1. **El repo `GenPM-net/genpm` es privado** (D6-P-07). El README, `docs/security.md` y el `repository` del paquete de
   npm dan 404 a cualquiera. En HN la primera pregunta será "¿es open source?".
2. **Faltan los datos del titular para el aviso legal** (D6-P-08), que la LSSI exige antes de promocionar el sitio.
3. **Sin publicar**: el vídeo demo (D7-01), Show HN (D7-03), el hilo de X (D7-04), LinkedIn (D7-05) y las comunidades (D7-06).
4. **GenPM no está en el registro oficial de MCP**. Esta rama añade `mcpName` y `packages/mcp/server.json`. Falta
   publicar `@genpm-net/mcp` 0.2.1 y después ejecutar `mcp-publisher login github` y `mcp-publisher publish` (fundador).

## Recomendaciones sobre las cifras

- Mientras no haya uso externo, mostrar contadores bajos en la portada resta credibilidad: considerar ocultar
  "Instalaciones" y "Publicadores" por debajo de un umbral.
- No inflarlas nunca (instalaciones de CI, scripts, cuentas propias): la comunidad lo detecta y destruye la confianza.
