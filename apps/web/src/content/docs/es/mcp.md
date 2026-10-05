---
title: Servidor MCP
section: Servidor MCP
order: 30
---
El servidor MCP de GenPM le da a tu agente el mismo motor que el CLI: busca, inspecciona e inyecta módulos, y te pregunta antes de tocar nada fuera de tu código.

Lo más rápido es dejar que GenPM escriba la config de los clientes que detecta en tu proyecto:

```bash
genpm mcp setup
```

Muestra el cambio exacto y pregunta antes de escribir. Usa `--client` y `--scope` para elegir uno, o configúralo a mano como se indica abajo.

El servidor va dentro del [binario `genpm`](/docs/install): tu cliente lanza `genpm mcp serve`, sin Node.js. Sin el binario, usa el paquete de npm: cambia `genpm mcp serve` por `npx -y @genpm-net/mcp` (`"command": "npx", "args": ["-y", "@genpm-net/mcp"]`) en cualquiera de los ejemplos; `genpm mcp setup` ejecutado con npm o npx lo hace por ti.

## Claude Code

```bash
claude mcp add genpm -- genpm mcp serve
```

Eso lo registra para tu usuario. Para compartirlo con tu equipo, versiona un `.mcp.json` en la raíz del proyecto (`genpm mcp setup --client claude --scope project` lo escribe):

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

## Cursor

Proyecto: `.cursor/mcp.json`. Usuario: `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client cursor                # proyecto
genpm mcp setup --client cursor --scope user   # usuario
```

## VS Code (GitHub Copilot)

Proyecto: `.vscode/mcp.json` (fíjate en la clave `servers` y en `type`):

```json
{
  "servers": {
    "genpm": { "type": "stdio", "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

Usuario:

```bash
code --add-mcp '{"name":"genpm","command":"genpm","args":["mcp","serve"]}'
```

## Windsurf

Solo usuario: `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client windsurf
```

## Codex

Solo usuario: `~/.codex/config.toml`.

```toml
[mcp_servers.genpm]
command = "genpm"
args = ["mcp", "serve"]
```

```bash
genpm mcp setup --client codex
```

## Gemini CLI

Proyecto: `.gemini/settings.json` · Usuario: `~/.gemini/settings.json`. Solo se toca `mcpServers`; el resto de tus ajustes de Gemini se queda igual.

```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

```bash
genpm mcp setup --client gemini --scope project
```

## Herramientas

| Herramienta | Qué hace |
|---|---|
| `genpm_search` | Busca paquetes por necesidad. Nunca devuelve resultados patrocinados. |
| `genpm_info` | Manifiesto, dependencias, variables de entorno, servidores MCP y reglas de IA. |
| `genpm_add` | Planifica (`dryRun: true`) e inyecta. `allowMcp` e `installNpmDeps` requieren tu consentimiento. |
| `genpm_list` | Paquetes instalados con sus cambios locales. |
| `genpm_remove` | Quita un paquete; nunca borra código que hayas modificado. |
| `genpm_outdated` | Versiones nuevas disponibles. |
| `genpm_diff` | Parche upstream de un paquete instalado y tus cambios locales. |
| `genpm_update` | Actualiza con merge de tres vías o registra un parche que el agente ya aplicó (`strategy: "ai"`). |
| `genpm_audit` | Integridad, firmas y avisos de seguridad. |
| `genpm_validate` | Valida un paquete que estás creando. |

El servidor no tiene `force`, `publish` ni `login`. Las reglas de los paquetes se devuelven como contenido de terceros (`<package-rules trust="third-party">`): describen un módulo y nunca autorizan acciones que no hayas pedido.

## Prompts

- `genpm-find` — búsqueda → info → simulación → confirmación → instalación.
- `genpm-integrate` — lee `<d>/AGENTS.md` y conecta el módulo con la app.

## Servidores MCP que declaran los paquetes

Un paquete puede declarar los servidores MCP que necesita (por ejemplo, el de Stripe). **Nunca** se añaden en silencio: `genpm add` pregunta antes, `--no-mcp` los omite y puedes añadirlos después con `genpm mcp add <paquete>`. Los secretos se referencian como variables de entorno (`${STRIPE_SECRET_KEY}` en `.mcp.json`, `${env:STRIPE_SECRET_KEY}` en Cursor y VS Code), nunca se escriben sus valores.

## Problemas frecuentes

- **El cliente no ve las herramientas**: reinicia el cliente tras cambiar su config y comprueba que `genpm mcp serve` arranca en una terminal (se queda esperando; páralo con Ctrl+C).
- **El cliente no encuentra `genpm`**: algunas apps no leen el `PATH` de tu shell. Usa la ruta absoluta como comando: `which genpm` la muestra en macOS y Linux (por ejemplo `/Users/tu/.genpm/bin/genpm`), `where.exe genpm` en Windows.
- **Telemetría**: define `GENPM_TELEMETRY=0` (o `DO_NOT_TRACK=1`) en el `env` del servidor.
- **Otro registry**: define `GENPM_REGISTRY` en el `env` del servidor.
