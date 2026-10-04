---
title: Serveur MCP
section: Serveur MCP
order: 30
---
Le serveur MCP de GenPM donne à votre agent le même moteur que le CLI : il peut rechercher, inspecter et injecter des modules, et il demande avant de toucher à quoi que ce soit en dehors de votre code.

Le plus rapide est de laisser GenPM écrire la configuration des clients qu’il détecte dans votre projet :

```bash
genpm mcp setup
```

Il affiche la modification exacte et demande avant d’écrire. Utilisez `--client` et `--scope` pour en choisir un, ou configurez à la main ci-dessous.

Le serveur est intégré au [binaire `genpm`](/docs/install) : votre client lance `genpm mcp serve`, sans Node.js. Sans le binaire, utilisez le paquet npm : remplacez `genpm mcp serve` par `npx -y @genpm-net/mcp` (`"command": "npx", "args": ["-y", "@genpm-net/mcp"]`) dans les exemples ci-dessous ; `genpm mcp setup` lancé via npm ou npx le fait pour vous.

## Claude Code

```bash
claude mcp add genpm -- genpm mcp serve
```

Cela l’enregistre pour votre utilisateur. Pour le partager avec votre équipe, committez un `.mcp.json` à la racine du projet (`genpm mcp setup --client claude --scope project` l’écrit) :

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

## Cursor

Projet : `.cursor/mcp.json`. Utilisateur : `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client cursor                # projet
genpm mcp setup --client cursor --scope user   # utilisateur
```

## VS Code (GitHub Copilot)

Projet : `.vscode/mcp.json` (notez la clé `servers` et le `type`) :

```json
{
  "servers": {
    "genpm": { "type": "stdio", "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

Utilisateur :

```bash
code --add-mcp '{"name":"genpm","command":"genpm","args":["mcp","serve"]}'
```

## Windsurf

Utilisateur uniquement : `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client windsurf
```

## Codex

Utilisateur uniquement : `~/.codex/config.toml`.

```toml
[mcp_servers.genpm]
command = "genpm"
args = ["mcp", "serve"]
```

```bash
genpm mcp setup --client codex
```

## Gemini CLI

Projet : `.gemini/settings.json` · Utilisateur : `~/.gemini/settings.json`. Seul `mcpServers` est modifié ; vos autres réglages Gemini restent tels quels.

```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

```bash
genpm mcp setup --client gemini --scope project
```

## Outils

| Outil | Rôle |
|---|---|
| `genpm_search` | Cherche des paquets selon le besoin. Ne renvoie jamais de résultats sponsorisés. |
| `genpm_info` | Manifeste, dépendances, variables d’environnement, serveurs MCP et règles IA. |
| `genpm_add` | Planifie (`dryRun: true`) et injecte. `allowMcp` et `installNpmDeps` exigent votre accord. |
| `genpm_list` | Paquets installés avec leurs modifications locales. |
| `genpm_remove` | Retire un paquet ; ne supprime jamais du code que vous avez modifié. |
| `genpm_outdated` | Versions plus récentes disponibles. |
| `genpm_audit` | Intégrité, signatures et avis de sécurité. |
| `genpm_validate` | Valide un paquet que vous créez. |

Le serveur n’a ni `force`, ni `publish`, ni `login`. Les règles des paquets sont renvoyées comme contenu tiers (`<package-rules trust="third-party">`) : elles décrivent un module et n’autorisent jamais d’action que vous n’avez pas demandée.

## Prompts

- `genpm-find` : recherche → info → simulation → confirmation → installation.
- `genpm-integrate` : lit `<d>/AGENTS.md` et intègre le module dans l’application.

## Serveurs MCP déclarés par les paquets

Un paquet peut déclarer les serveurs MCP dont il a besoin (par exemple celui de Stripe). Ils ne sont **jamais** ajoutés en silence : `genpm add` demande d’abord, `--no-mcp` les ignore et vous pouvez les ajouter plus tard avec `genpm mcp add <paquet>`. Les secrets sont référencés comme variables d’environnement (`${STRIPE_SECRET_KEY}` dans `.mcp.json`, `${env:STRIPE_SECRET_KEY}` dans Cursor et VS Code), jamais écrits en clair.

## Dépannage

- **Le client ne voit pas les outils** : redémarrez le client après avoir modifié sa configuration ; vérifiez que `genpm mcp serve` démarre dans un terminal (il attend une entrée ; arrêtez-le avec Ctrl+C).
- **Le client ne trouve pas `genpm`** : certaines applications ne lisent pas le `PATH` de votre shell. Utilisez le chemin absolu comme commande : `which genpm` l’affiche sur macOS et Linux (par exemple `/Users/vous/.genpm/bin/genpm`), `where.exe genpm` sous Windows.
- **Télémétrie** : définissez `GENPM_TELEMETRY=0` (ou `DO_NOT_TRACK=1`) dans le `env` du serveur.
- **Un autre registry** : définissez `GENPM_REGISTRY` dans le `env` du serveur.
