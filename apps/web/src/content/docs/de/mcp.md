---
title: MCP-Server
section: MCP-Server
order: 30
---
Der MCP-Server von GenPM gibt deinem Agenten dieselbe Engine wie dem CLI: Er kann Module suchen, prüfen und injizieren und fragt, bevor er irgendetwas außerhalb deines Codes anfasst.

Am schnellsten lässt du GenPM die Konfiguration für die Clients schreiben, die es in deinem Projekt erkennt:

```bash
genpm mcp setup
```

Es zeigt die genaue Änderung und fragt vor dem Schreiben. Mit `--client` und `--scope` wählst du einen aus, oder du konfigurierst ihn unten von Hand.

Der Server steckt im [`genpm`-Binary](/docs/install): Dein Client startet `genpm mcp serve`, ohne Node.js. Ohne das Binary nimmst du das npm-Paket: Ersetze in den Beispielen unten `genpm mcp serve` durch `npx -y @genpm-net/mcp` (`"command": "npx", "args": ["-y", "@genpm-net/mcp"]`); `genpm mcp setup` über npm oder npx erledigt das für dich.

## Claude Code

```bash
claude mcp add genpm -- genpm mcp serve
```

Damit ist er für deinen Benutzer registriert. Um ihn mit dem Team zu teilen, committe eine `.mcp.json` im Projektstamm (`genpm mcp setup --client claude --scope project` schreibt sie):

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

## Cursor

Projekt: `.cursor/mcp.json`. Benutzer: `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client cursor                # Projekt
genpm mcp setup --client cursor --scope user   # Benutzer
```

## VS Code (GitHub Copilot)

Projekt: `.vscode/mcp.json` (beachte den Schlüssel `servers` und den `type`):

```json
{
  "servers": {
    "genpm": { "type": "stdio", "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

Benutzer:

```bash
code --add-mcp '{"name":"genpm","command":"genpm","args":["mcp","serve"]}'
```

## Windsurf

Nur Benutzer: `~/.codeium/windsurf/mcp_config.json`.

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

Nur Benutzer: `~/.codex/config.toml`.

```toml
[mcp_servers.genpm]
command = "genpm"
args = ["mcp", "serve"]
```

```bash
genpm mcp setup --client codex
```

## Gemini CLI

Projekt: `.gemini/settings.json` · Benutzer: `~/.gemini/settings.json`. Nur `mcpServers` wird geändert; deine übrigen Gemini-Einstellungen bleiben, wie sie sind.

```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

```bash
genpm mcp setup --client gemini --scope project
```

## Remote-Server (nur lesend)

Clients, die Remote-MCP-Server über Streamable HTTP unterstützen, können sich ohne Installation mit `https://mcp.genpm.net` verbinden. Er bietet nur `genpm_search` und `genpm_info` (keine Dateien, keine Zugangsdaten): Zum Installieren gibt dir der Agent den Befehl `genpm add`, oder du wechselst zum lokalen Server oben.

```json
{ "mcpServers": { "genpm": { "url": "https://mcp.genpm.net" } } }
```

## Werkzeuge

| Werkzeug | Funktion |
|---|---|
| `genpm_search` | Sucht Pakete nach Bedarf. Liefert nie gesponserte Ergebnisse. |
| `genpm_info` | Manifest, Abhängigkeiten, Umgebungsvariablen, MCP-Server und KI-Regeln. |
| `genpm_add` | Plant (`dryRun: true`) und injiziert. `allowMcp` und `installNpmDeps` brauchen deine Zustimmung. |
| `genpm_list` | Installierte Pakete mit lokalen Änderungen. |
| `genpm_remove` | Entfernt ein Paket; löscht nie Code, den du geändert hast. |
| `genpm_outdated` | Verfügbare neuere Versionen. |
| `genpm_diff` | Upstream-Patch eines installierten Pakets und deine lokalen Änderungen. |
| `genpm_update` | Aktualisiert per Drei-Wege-Merge oder registriert einen Patch, den der Agent schon angewendet hat (`strategy: "ai"`). |
| `genpm_audit` | Integrität, Signaturen und Sicherheitshinweise. |
| `genpm_validate` | Prüft ein Paket, das du gerade erstellst. |

Der Server hat kein `force`, `publish` oder `login`. Paketregeln werden als Inhalt von Dritten zurückgegeben (`<package-rules trust="third-party">`): Sie beschreiben ein Modul und erlauben nie Aktionen, um die du nicht gebeten hast.

## Prompts

- `genpm-find`: Suche → Info → Probelauf → Bestätigung → Installation.
- `genpm-integrate`: liest `<d>/AGENTS.md` und bindet das Modul in die Anwendung ein.

## Von Paketen deklarierte MCP-Server

Ein Paket kann die MCP-Server deklarieren, die es braucht (zum Beispiel den von Stripe). Sie werden **nie** stillschweigend hinzugefügt: `genpm add` fragt zuerst, `--no-mcp` überspringt sie, und du kannst sie später mit `genpm mcp add <paket>` hinzufügen. Secrets werden als Umgebungsvariablen referenziert (`${STRIPE_SECRET_KEY}` in `.mcp.json`, `${env:STRIPE_SECRET_KEY}` in Cursor und VS Code), nie als Werte geschrieben.

## Fehlerbehebung

- **Der Client sieht die Werkzeuge nicht**: Starte den Client nach einer Konfigurationsänderung neu; prüfe, ob `genpm mcp serve` in einem Terminal startet (es wartet auf Eingaben; beende es mit Strg+C).
- **Der Client findet `genpm` nicht**: Manche Apps lesen den `PATH` deiner Shell nicht. Nutze den absoluten Pfad als Befehl: `which genpm` zeigt ihn unter macOS und Linux (zum Beispiel `/Users/du/.genpm/bin/genpm`), `where.exe genpm` unter Windows.
- **Telemetrie**: Setze `GENPM_TELEMETRY=0` (oder `DO_NOT_TRACK=1`) im `env` des Servers.
- **Eine andere Registry**: Setze `GENPM_REGISTRY` im `env` des Servers.
