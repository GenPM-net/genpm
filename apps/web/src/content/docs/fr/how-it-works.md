---
title: Fonctionnement de GenPM
section: Premiers pas
order: 2
---
Un paquet GenPM, ce sont trois couches qui voyagent ensemble, épinglées sur un même commit :

| Couche | Ce que c’est | Où elle arrive |
|---|---|---|
| **Code** | Code source d’un module | `d`, par exemple `src/lib/auth/` |
| **Contexte** | Règles pour votre agent IA (`x`) | `<d>/AGENTS.md`, plus des fichiers de règles d’IDE avec portée |
| **Connexions** | Serveurs MCP dont le module a besoin (`m`) | `.mcp.json`, `.cursor/mcp.json`… seulement avec votre accord |

## Le registry ne stocke que des métadonnées

Le registry indexe des manifestes et pointe vers Git. À l’installation, le CLI télécharge le code **directement depuis l’hébergeur Git** au commit exact (`c`) et le vérifie : `git rev-parse HEAD` doit être égal à `c`, et chaque fichier doit correspondre à l’arbre du commit.

## Planifier avant d’agir

`plan()` n’écrit jamais dans votre projet. Il résout les dépendances, télécharge dans un cache global et analyse les fichiers. `apply()` écrit via un journal : si quelque chose échoue, tout est annulé.

## Aucun script, jamais

GenPM n’a pas de scripts de cycle de vie. Rien d’un paquet ne s’exécute sur votre machine. Les fichiers que d’autres outils exécutent automatiquement (`postinstall`, `.npmrc`, `.envrc`, `.vscode/tasks.json`…) sont rejetés.
