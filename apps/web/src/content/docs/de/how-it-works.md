---
title: So funktioniert GenPM
section: Erste Schritte
order: 2
---
Ein GenPM-Paket besteht aus drei Ebenen, die zusammen reisen und auf einen Commit gepinnt sind:

| Ebene | Was es ist | Wo es landet |
|---|---|---|
| **Code** | Quellcode eines Moduls | `d`, zum Beispiel `src/lib/auth/` |
| **Kontext** | Regeln für deinen KI-Agenten (`x`) | `<d>/AGENTS.md`, plus Regeldateien der IDE mit Geltungsbereich |
| **Verbindungen** | MCP-Server, die das Modul braucht (`m`) | `.mcp.json`, `.cursor/mcp.json`… nur mit deiner Zustimmung |

## Die Registry speichert nur Metadaten

Die Registry indexiert Manifeste und verweist auf Git. Bei der Installation lädt der CLI den Code **direkt vom Git-Host** beim exakten Commit (`c`) und prüft ihn: `git rev-parse HEAD` muss gleich `c` sein, und jede Datei muss zum Commit-Baum passen.

## Erst planen, dann handeln

`plan()` schreibt nie in dein Projekt. Es löst Abhängigkeiten auf, lädt in einen globalen Cache und scannt die Dateien. `apply()` schreibt über ein Journal: Schlägt etwas fehl, wird alles zurückgerollt.

## Niemals Skripte

GenPM hat keine Lifecycle-Skripte. Nichts aus einem Paket läuft auf deinem Rechner. Dateien, die andere Tools automatisch ausführen (`postinstall`, `.npmrc`, `.envrc`, `.vscode/tasks.json`…), werden abgelehnt.
