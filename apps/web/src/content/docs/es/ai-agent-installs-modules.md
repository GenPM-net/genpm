---
title: Que Claude Code o Cursor instalen módulos
section: Guías
order: 73
---
Los agentes escriben bien código, pero no saben qué pieza probada ya existe. Conecta el servidor MCP de GenPM y tu agente podrá **buscar en el registry, enseñarte los archivos y reglas exactos e instalar** un módulo. Lo que quede fuera de tu código, como un servidor MCP externo, necesita tu visto bueno.

## Conéctalo (1 minuto)

Claude Code:

```bash
claude mcp add genpm -- npx -y @genpm-net/mcp
```

Cursor (`.cursor/mcp.json`), VS Code (`.vscode/mcp.json`), Windsurf y otros usan el mismo servidor:

```json
{ "mcpServers": { "genpm": { "command": "npx", "args": ["-y", "@genpm-net/mcp"] } } }
```

Con el binario `genpm` instalado, `genpm mcp setup` escribe la configuración de todos los clientes que detecta. En Claude Code también puedes añadir el plugin: `claude plugin marketplace add GenPM-net/genpm`.

## Después, pídeselo

- *"Añade login con GitHub a este proyecto con genpm."*
- *"Busca un módulo de cobros con Stripe y enséñame sus reglas antes de instalarlo."*
- *"¿Qué paquetes de genpm de este repo están desactualizados?"*

## Qué puede hacer el agente y qué no

- **Puede:** buscar, leer el manifiesto, los archivos y las reglas de IA de un paquete, instalar en `src/`, listar y actualizar lo instalado.
- **Tiene que preguntarte:** antes de añadir algo fuera de tu código, como un servidor MCP externo que declare el módulo (por ejemplo, el de Stripe). Todo lo que inyecta es código normal en `src/` que ves en tu diff.
- **Nunca:** ejecutar scripts de un paquete (GenPM no tiene), instalar desde una rama (solo commits verificados por SHA) ni instalar reglas que no pasaron el escáner de inyección de prompts.

Cada módulo trae un `AGENTS.md` que tu agente lee solo cuando trabaja en esa carpeta, así lo integra como pretendía su autor.

Más detalle: [Servidor MCP](/es/docs/mcp) · [Contexto e IDEs](/es/docs/context).
