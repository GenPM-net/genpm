---
title: Cómo funciona GenPM
section: Primeros pasos
order: 2
---
Un paquete GenPM son tres capas que viajan juntas y están ancladas a un solo commit:

| Capa | Qué es | Dónde termina |
|---|---|---|
| **Código** | Código fuente de un módulo | `d`, por ejemplo `src/lib/auth/` |
| **Contexto** | Reglas para tu agente de IA (`x`) | `<d>/AGENTS.md` y archivos de reglas del IDE con alcance |
| **Conexiones** | Servidores MCP que necesita el módulo (`m`) | `.mcp.json`, `.cursor/mcp.json`… solo con tu consentimiento |

## El registry solo guarda metadatos

El registry indexa manifiestos y apunta a Git. Al instalar, el CLI descarga el código **directamente del host Git** en el commit exacto (`c`) y lo verifica: `git rev-parse HEAD` debe ser igual a `c` y cada archivo debe coincidir con el árbol del commit.

## Plan antes que acción

`plan()` nunca escribe en tu proyecto. Resuelve dependencias, descarga a una caché global y escanea los archivos. `apply()` escribe con un journal: si algo falla, se revierte todo.

## Nunca hay scripts

GenPM no tiene scripts de ciclo de vida. Nada de un paquete se ejecuta en tu máquina. Se rechazan los archivos que otras herramientas ejecutan solas (`postinstall`, `.npmrc`, `.envrc`, `.vscode/tasks.json`…).
