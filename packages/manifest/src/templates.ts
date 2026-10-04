// Plantillas que comparten el CLI (`genpm init`) y el asistente de publicación de la web. Sin I/O.

/** Plantilla de reglas para autores (manifest-spec §11). Texto para LLMs: inglés. */
export function agentsTemplate(name: string): string {
  return `# ${name} — rules for agents

## Purpose
What this module does in one or two sentences, and what it deliberately does not do.

## Module map
- \`index.ts\` — public API. Import only from here.

## Integration (do this after installing)
1. Configure the env vars listed in .env.example.
2. Wire the module into the app (routes, middleware, migrations).

## Conventions
- Keep the public API in \`index.ts\`; internal files may change between versions.

## Don't
- Don't hardcode secrets; read them from the environment.
`;
}
