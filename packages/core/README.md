# @genpm/core

Motor de GenPM. Lo consumen `genpm` (CLI) y `@genpm/mcp` por igual.

Módulos previstos:
```
src/
├── registry-client.ts   # cliente tipado del API (+ enrutado por scope vía .genpmrc)
├── resolve.ts           # spec → ResolvedManifest + grafo plano de dependencias `g`
├── fetch/               # git fetch --depth 1 por SHA, sparse-checkout, fallback tarball, caché ~/.genpm/cache
├── plan.ts              # calcula InstallPlan (archivos, conflictos, contexto, MCP, deps npm, env)
├── apply.ts             # ejecuta el plan con journal + rollback
├── inject/              # copia segura, contexto IDE (AGENTS.md, .cursor/rules, …), mcp.json, .env.example
├── lock.ts              # genpm.lock + .genpm/files/*.json (hashes por archivo)
├── fs/safe-path.ts      # anti path-traversal / symlinks
└── detect.ts            # raíz de proyecto, clientes IA, package manager
```
Spec: [docs/architecture.md](../../docs/architecture.md), [docs/cli-mcp-spec.md](../../docs/cli-mcp-spec.md)
