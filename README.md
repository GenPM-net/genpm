# GenPM — Generative Package Manager

> **Instala arquitecturas, no dependencias.**
> Código que es tuyo · Contexto que tu IA entiende · Conexiones MCP listas.

GenPM inyecta módulos completos (código fuente + reglas de IA + servidores MCP) directamente en tu proyecto
desde repositorios Git inmutables. Sin `node_modules` opacos: el código queda en `src/`, versionado contigo,
y tu LLM lo puede leer, modificar y actualizar.

```bash
npx genpm add @core/auth
```

## Estado

Fase de diseño — MVP de 7 días. **Todavía no hay código de implementación.** Empieza por [docs/README.md](docs/README.md).

## Estructura del monorepo

```
genpm/
├── apps/
│   ├── registry/      # API Edge: Cloudflare Workers + Hono + D1 (solo metadatos)
│   └── web/           # genpm.net: Astro SSR en Cloudflare (búsqueda, páginas de paquete, docs)
├── packages/
│   ├── manifest/      # @genpm/manifest — esquema zod, tipos, JSON Schema, semver helpers (sin I/O)
│   ├── core/          # @genpm/core — resolver, fetcher Git, injector, lockfile, contexto, MCP config
│   ├── cli/           # genpm — binario de terminal (fachada fina sobre core)
│   ├── mcp/           # @genpm/mcp — servidor MCP stdio (fachada fina sobre core)
│   ├── i18n/          # @genpm/i18n — catálogos ICU de 8 idiomas + negociación de locale
│   └── tsconfig/      # configuración TS compartida
├── seeds/             # especificación de los 5 paquetes semilla (viven en repos Git propios)
└── docs/              # documentación técnica oficial
```

Seguridad: [docs/security.md](docs/security.md) · Idiomas: en, es, pt-BR, fr, de, ja, zh-CN, ko ([docs/i18n.md](docs/i18n.md)) · Web: [genpm.net](https://genpm.net)

Stack: TypeScript estricto · pnpm workspaces + Turborepo · Biome · Vitest · Hono · Cloudflare Workers/D1 · Astro.
