---
title: Contexto e IDEs
section: Usar paquetes
order: 11
---
Las reglas de un paquete se cargan **solo cuando tu agente trabaja en esa carpeta**:

| Cliente | Se detecta por | Archivo que se escribe |
|---|---|---|
| Cualquiera (siempre) | — | `<d>/AGENTS.md` y un bloque índice en el `AGENTS.md` de la raíz |
| Claude Code | `CLAUDE.md` o `.claude/` | `<d>/CLAUDE.md` (`@AGENTS.md`) y un índice en `CLAUDE.md` |
| Cursor | `.cursor/` o `.cursorrules` | `.cursor/rules/genpm-<slug>.mdc` con `globs: <d>/**` |
| GitHub Copilot | `.github/copilot-instructions.md` o `.vscode/` | `.github/instructions/genpm-<slug>.instructions.md` |
| Windsurf | `.windsurf/` o `.windsurfrules` | `.windsurf/rules/genpm-<slug>.md` |

Puedes forzar los clientes con `--clients cursor,claude` o con `clients=` en `.genpmrc`.

GenPM solo edita entre sus marcadores y nunca toca el resto de tus archivos:

```md
<!-- genpm:index:start -->
## GenPM packages
- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)
<!-- genpm:index:end -->
```
