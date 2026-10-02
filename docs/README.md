# Documentación de GenPM

> Fase: diseño del MVP (sprint de 7 días) · Última actualización: 2026-10-02

Orden de lectura recomendado:

| # | Documento | Para qué | Audiencia |
|---|---|---|---|
| 0 | [brainstorming.md](brainstorming.md) | Dudas y decisiones (ADR-001…015), incluidas las del fundador | Todos — leer primero |
| 1 | [architecture.md](architecture.md) | Diseño del sistema, flujos de datos, seguridad, decisiones tecnológicas, camino a SaaS | Ingeniería |
| 2 | [manifest-spec.md](manifest-spec.md) | Especificación de `genpm.json`, `genpm.lock` y cómo deben interpretarlos los LLMs | Ingeniería, autores de paquetes |
| 3 | [api-spec.md](api-spec.md) | Endpoints del registry edge y esquema D1 (preparado para registros privados y patrocinios) | Backend |
| 4 | [cli-mcp-spec.md](cli-mcp-spec.md) | Contratos de comandos del CLI y tools/resources/prompts del servidor MCP | Cliente (CLI/MCP) |
| 4b | [security.md](security.md) | Invariantes de seguridad, escaneo, firma, cadena de suministro, respuesta a incidentes, riesgo residual | Todos (normativo) |
| 4c | [i18n.md](i18n.md) | 8 idiomas: superficies, arquitectura `@genpm/i18n`, flujo de traducción, QA | Ingeniería, producto |
| 5 | [roadmap-mvp.md](roadmap-mvp.md) | Plan día a día, criterios de aceptación, plan de recorte, post-MVP | Todos |
| 6 | [branding.md](branding.md) | Nombre, posicionamiento, voz, paleta, tipografía, CLI, mensajes de lanzamiento | Producto, diseño, marketing |
| 7 | [web-ui-spec.md](web-ui-spec.md) | Páginas, funcionalidades, componentes y requisitos de genpm.com | Diseño, frontend |

Fuera de `/docs`: [seeds/README.md](../seeds/README.md) (los 5 paquetes semilla) y [AGENTS.md](../AGENTS.md) (reglas para agentes IA que trabajen en este repo).

## Resumen en 30 segundos

- Un paquete GenPM = **Code** (se copia a `src/…`) + **Context** (reglas IA con alcance) + **Connections** (servidores MCP, con consentimiento).
- El **registry** (Cloudflare Workers + D1) solo guarda metadatos; el código viene directo de GitHub, **anclado a un SHA verificado**.
- **CLI** y **servidor MCP** son fachadas del mismo motor (`@genpm/core`).
- Esquema de datos multi-tenant desde el día 1 (`registry_id`, `visibility`, `owner_id` polimórfico, IDs globales) → registros privados sin migraciones destructivas.
- **Seguridad**: 10 invariantes garantizados por construcción con test bloqueante, manifiestos firmados, doble escaneo; riesgo residual documentado (no existe el "100 %").
- **8 idiomas** desde el lanzamiento en web y CLI; los contratos de máquina no se traducen.
- El problema difícil — actualizar código que el usuario/IA ya modificó — está diseñado (merge 3-way + "actualización asistida por IA") y llega en v0.2.
