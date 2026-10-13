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
4. **GenPM no está en el registro oficial de MCP.** `packages/mcp/server.json` publica el servidor remoto
   (`mcp.genpm.net`) con el workflow `mcp-registry` (OIDC, sin secretos). El paquete npm se añadirá con
   `@genpm-net/mcp` 0.2.1, que lleva `mcpName`.

## Recomendaciones sobre las cifras

- Mientras no haya uso externo, mostrar contadores bajos en la portada resta credibilidad: considerar ocultar
  "Instalaciones" y "Publicadores" por debajo de un umbral.
- No inflarlas nunca (instalaciones de CI, scripts, cuentas propias): la comunidad lo detecta y destruye la confianza.

## Hecho el 12-10 (por delegación del fundador)

- Repo `GenPM-net/genpm` público (ADR-035), con secret scanning y push protection, y `main` protegida contra
  force-push y borrado. Push protection activada en los 47 repos públicos de la organización, todos escaneados
  (gitleaks y trufflehog): sin secretos.
- GitHub Actions vuelve a ejecutarse: los repos públicos usan minutos gratis y el bloqueo de facturación ya no aplica.
- Binarios nativos 0.2.0 publicados en `GenPM-net/genpm-releases` (el mismo commit que `@genpm-net/cli@0.2.0` en npm),
  y Homebrew y Scoop actualizados. Antes `curl … | sh` instalaba la 0.1.4.

- **genpm 0.2.1** (binarios, Homebrew y Scoop): un servidor MCP declarado por varios paquetes se pregunta una sola
  vez (`genpm add @core/billing` preguntaba dos veces por `stripe`). npm sigue en 0.2.0 hasta que haya `NPM_TOKEN`.
- GenPM está en el registro oficial de MCP: `io.github.GenPM-net/genpm` (servidor remoto `mcp.genpm.net`).
- La portada muestra 48 paquetes · 6 clientes de IA · 8 idiomas; instalaciones y publicadores aparecen al pasar los
  umbrales (1000 y 10).
- PR a punkpeye/awesome-mcp-servers (#16283). awesome-claude-code exige 14 días de repo: a partir del 17-10, y solo con
  su formulario web.
- Vídeo demo de terminal sin voz (54 s): `gifs/demo.mp4` y `gifs/demo.gif` (`vhs gifs/demo.tape`).

## Bloqueo crítico: Cloudflare desafía a los centros de datos

`api.genpm.net` responde **403 con un desafío** ("Just a moment…", `cf-mitigated: challenge`) a las IPs de GitHub
Actions. El Worker nunca ve la petición. Lo mismo afecta a cualquier cliente que no sea un navegador desde un centro de datos: CI,
Codespaces, agentes en la nube (Claude Code web, agentes en segundo plano de Cursor), Docker en servidores. Para ellos
`genpm add` falla. Arreglo (panel de Cloudflare, zona genpm.net):

1. Security → Bots: desactivar **Bot Fight Mode** (en el plan Free no admite excepciones por ruta).
2. Security → WAF → Custom rules: si hay alguna regla con *Managed Challenge* o *JS Challenge*, excluir
   `api.genpm.net` y `mcp.genpm.net` (y `genpm.net/install.sh`, `/install.ps1`).
3. Security → Settings: Security Level en *Essentially off* o *Low* para esos hosts (Configuration Rules).
4. Comprobar: el job `example` del CI vuelve a verde (el script ya imprime `server` y `cf-mitigated` si falla).

El rate limiting propio del Worker (`RL_PUBLIC`, 300/min por IP) sigue protegiendo el API.

## Pendiente del fundador

- `NPM_TOKEN` en los secretos del repo (o `npm login` con 2FA) para publicar `@genpm-net/mcp` 0.2.1.
- El vídeo demo (D7-01) y estar disponible las 6 primeras horas de Show HN para responder.
- La revisión legal del aviso legal (D6-P-08).
