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

## Tareas
- El plan y las tareas viven en `tasks/` (ver `tasks/README.md`). Antes de empezar, `pnpm tasks next`; al empezar, `pnpm tasks start <ID>`; al terminar con el DoD cumplido, `pnpm tasks done <ID>`.
- No inventes IDs: si una tarea nueva hace falta, añádela con el formato exacto y deja `pnpm tasks check` en verde.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
