---
title: Contexte et IDE
section: Utiliser des paquets
order: 11
---
Les règles d’un paquet sont chargées **uniquement quand votre agent travaille dans ce dossier** :

| Client | Détecté par | Fichier écrit |
|---|---|---|
| Tous (toujours) | — | `<d>/AGENTS.md` et un bloc d’index dans le `AGENTS.md` racine |
| Claude Code | `CLAUDE.md` ou `.claude/` | `<d>/CLAUDE.md` (`@AGENTS.md`) et un index dans `CLAUDE.md` |
| Cursor | `.cursor/` ou `.cursorrules` | `.cursor/rules/genpm-<slug>.mdc` avec `globs: <d>/**` |
| GitHub Copilot | `.github/copilot-instructions.md` ou `.vscode/` | `.github/instructions/genpm-<slug>.instructions.md` |
| Windsurf | `.windsurf/` ou `.windsurfrules` | `.windsurf/rules/genpm-<slug>.md` |

Forcez les clients avec `--clients cursor,claude` ou `clients=` dans `.genpmrc`.

GenPM n’édite qu’entre ses marqueurs et ne touche jamais au reste de vos fichiers :

```md
<!-- genpm:index:start -->
## GenPM packages
- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)
<!-- genpm:index:end -->
```
