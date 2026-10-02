# @genpm/manifest

Fuente única de verdad del formato `genpm.json` y `genpm.lock`.

- Esquemas zod: `SourceManifest`, `ResolvedManifest`, `LockFile`, `McpServerEntry`.
- Exporta JSON Schema generado (para SchemaStore y autocompletado en IDEs).
- Validaciones puras: nombre de paquete, semver, ruta `d` segura, ref inmutable (`t`).
- Catálogo de códigos de error `E_*` compartido por API, CLI y MCP.
- **Sin I/O, sin dependencias de Node** → corre en Workers, Node y navegador.

Spec: [docs/manifest-spec.md](../../docs/manifest-spec.md)
