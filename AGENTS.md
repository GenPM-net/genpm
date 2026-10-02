# AGENTS.md — reglas para agentes de IA que trabajan en este repo

## Contexto
GenPM es un gestor de paquetes que inyecta código fuente + reglas de IA + config MCP desde repos Git inmutables.
Fuente de verdad del diseño: `docs/`. Si el código contradice `docs/`, gana `docs/` hasta que se actualice con un ADR en `docs/brainstorming.md`.

## Reglas de arquitectura (no negociables)
- Toda la lógica de negocio vive en `packages/core`. `cli` y `mcp` son fachadas: parsean input, llaman a core, formatean output.
- `packages/manifest` no hace I/O (corre en Node, Workers y navegador).
- Nunca ejecutar scripts de paquetes de terceros. GenPM no tiene lifecycle scripts.
- Nunca resolver a ramas (`main`, `master`…). Solo tags o SHA de 40 caracteres; siempre verificar el SHA tras el fetch.
- Toda ruta de escritura pasa por `core/fs/safePath()` (anti path-traversal).
- Los 10 invariantes de `docs/security.md` §2 son intocables: cualquier cambio que los afecte necesita test y revisión de dos personas.
- Ningún texto visible por humanos en el código: todo va a `packages/i18n/locales/en/*.json` (el lint lo bloquea). Textos para LLMs (MCP) siempre en inglés.
- Los códigos de error (`E_*`) se definen una sola vez en `packages/manifest/src/errors.ts` y se comparten entre API, CLI y MCP.

## Convenciones
- TypeScript `strict`, ESM, Node >= 20.11. Sin `any` salvo en límites de I/O, validados con zod.
- Nombres de archivos en kebab-case. Tests junto al código: `*.test.ts`.
- Commits: Conventional Commits (`feat(cli): …`). Versionado con Changesets.
- Documentación interna en español; identificadores en inglés; textos de usuario con fuente en inglés y traducidos vía `@genpm/i18n`.
