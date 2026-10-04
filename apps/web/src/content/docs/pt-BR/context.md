---
title: Contexto e IDEs
section: Usando pacotes
order: 11
---
As regras de um pacote são carregadas **só quando o seu agente trabalha naquela pasta**:

| Cliente | Detectado por | Arquivo escrito |
|---|---|---|
| Qualquer um (sempre) | — | `<d>/AGENTS.md` e um bloco de índice no `AGENTS.md` da raiz |
| Claude Code | `CLAUDE.md` ou `.claude/` | `<d>/CLAUDE.md` (`@AGENTS.md`) e um índice em `CLAUDE.md` |
| Cursor | `.cursor/` ou `.cursorrules` | `.cursor/rules/genpm-<slug>.mdc` com `globs: <d>/**` |
| GitHub Copilot | `.github/copilot-instructions.md` ou `.vscode/` | `.github/instructions/genpm-<slug>.instructions.md` |
| Windsurf | `.windsurf/` ou `.windsurfrules` | `.windsurf/rules/genpm-<slug>.md` |

Force os clientes com `--clients cursor,claude` ou com `clients=` no `.genpmrc`.

O GenPM só edita entre os seus marcadores e nunca toca no resto dos seus arquivos:

```md
<!-- genpm:index:start -->
## GenPM packages
- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)
<!-- genpm:index:end -->
```
