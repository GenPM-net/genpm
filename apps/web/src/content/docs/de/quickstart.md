---
title: Schnellstart
section: Erste Schritte
order: 1
---
Füge dein erstes Modul in etwa einer Minute hinzu. Du brauchst nur **git 2.25+** (ohne git nutzt GenPM die Tarballs von GitHub).

## 1. genpm installieren

macOS und Linux:

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

Windows (PowerShell):

```powershell
irm https://genpm.net/install.ps1 | iex
```

Es ist ein einzelnes Binary, ohne Node.js. Weitere Optionen (npm, eine bestimmte Version, Mirrors) findest du unter [Installation](/docs/install).

## 2. Ein Paket hinzufügen

Führe das im Wurzelverzeichnis deines Projekts aus. GenPM zeigt den vollständigen Plan und fragt, bevor es etwas schreibt.

```bash
genpm add @core/auth
```

GenPM löst `@core/auth` und seine Abhängigkeit `@core/db` auf, prüft die Registry-Signatur jedes Manifests, lädt den exakten Commit und scannt ihn lokal, bevor es dir den Plan zeigt.

## 3. Sieh dir die Änderungen an

```bash
git status
```

- Der Code liegt in `src/lib/auth` und `src/lib/db`: Er gehört jetzt dir.
- Die Regeln, die deine KI liest, stehen in `src/lib/auth/AGENTS.md`.
- `genpm.lock` pinnt jedes Paket auf einen 40-stelligen Commit-SHA.
- `.env.example` listet die zu konfigurierenden Variablen (nur Namen, nie Werte).

## 4. Lass deine KI übernehmen

Öffne deinen Agenten und bitte ihn, das Modul einzubinden. Er liest die Regeln des Moduls und folgt dem Abschnitt **Integration**:

```text
Binde @core/auth gemäß src/lib/auth/AGENTS.md ein. Füge die Anmeldung mit GitHub hinzu.
```

Verbinde den [MCP-Server](/docs/mcp), dann kann dein Agent auch Schritt 1 übernehmen.
