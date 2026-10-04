---
title: Kontext & IDEs
section: Pakete verwenden
order: 11
---
Die Regeln eines Pakets werden **nur geladen, wenn dein Agent in diesem Ordner arbeitet**:

| Client | Erkannt an | Geschriebene Datei |
|---|---|---|
| Jeder (immer) | — | `<d>/AGENTS.md` und ein Indexblock in der `AGENTS.md` im Wurzelverzeichnis |
| Claude Code | `CLAUDE.md` oder `.claude/` | `<d>/CLAUDE.md` (`@AGENTS.md`) und ein Index in `CLAUDE.md` |
| Cursor | `.cursor/` oder `.cursorrules` | `.cursor/rules/genpm-<slug>.mdc` mit `globs: <d>/**` |
| GitHub Copilot | `.github/copilot-instructions.md` oder `.vscode/` | `.github/instructions/genpm-<slug>.instructions.md` |
| Windsurf | `.windsurf/` oder `.windsurfrules` | `.windsurf/rules/genpm-<slug>.md` |

Lege die Clients mit `--clients cursor,claude` oder `clients=` in `.genpmrc` fest.

GenPM bearbeitet nur den Bereich zwischen seinen Markierungen und lässt den Rest deiner Dateien unberührt:

```md
<!-- genpm:index:start -->
## GenPM packages
- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)
<!-- genpm:index:end -->
```
