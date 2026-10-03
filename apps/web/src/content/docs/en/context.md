---
title: Context & IDEs
section: Using packages
order: 11
---
Package rules are loaded **only when your agent works in that folder**:

| Client | Detected by | File written |
|---|---|---|
| Any (always) | — | `<d>/AGENTS.md` and an index block in the root `AGENTS.md` |
| Claude Code | `CLAUDE.md` or `.claude/` | `<d>/CLAUDE.md` (`@AGENTS.md`) and an index in `CLAUDE.md` |
| Cursor | `.cursor/` or `.cursorrules` | `.cursor/rules/genpm-<slug>.mdc` with `globs: <d>/**` |
| GitHub Copilot | `.github/copilot-instructions.md` or `.vscode/` | `.github/instructions/genpm-<slug>.instructions.md` |
| Windsurf | `.windsurf/` or `.windsurfrules` | `.windsurf/rules/genpm-<slug>.md` |

Override detection with `--clients cursor,claude` or `clients=` in `.genpmrc`.

GenPM only edits between its markers and never touches the rest of your files:

```md
<!-- genpm:index:start -->
## GenPM packages
- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)
<!-- genpm:index:end -->
```
