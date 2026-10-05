---
title: Pakete verwenden
section: Pakete verwenden
order: 10
---
## add

```bash
genpm add @core/billing            # neueste Version
genpm add @core/auth@^1.2          # SemVer-Bereich
genpm add @core/db --dest packages/db
genpm add @core/billing --dry-run  # zeigt den Plan, schreibt nichts
```

GenPM stellt drei getrennte Fragen: den Code injizieren, MCP-Server hinzufügen (mit dem vollständigen Befehl) und den Befehl des Paketmanagers für npm-Abhängigkeiten ausführen. `--yes` beantwortet nur die erste; nutze `--mcp` und `--install-deps` für die anderen.

Existiert das Ziel und ist nicht leer, schlägt `add` mit `E_DEST_CONFLICT` fehl. `--force` verschiebt den alten Inhalt vorher nach `.genpm/backup/<timestamp>/`.

## search und info

```bash
genpm search stripe
genpm info @core/billing          # Manifest, Abhängigkeiten, MCP, Umgebungsvariablen und die vollständigen KI-Regeln
genpm info @core/billing --rules  # nur die Regeln
```

## list und remove

```bash
genpm list
genpm remove @core/auth
```

`list` vergleicht jede injizierte Datei mit ihrem gespeicherten SHA-256 (lokale Änderungen). `remove` löscht keinen Code, den du geändert hast (`E_DRIFT`): Nutze `--keep-code`, um ihn zu behalten, oder `--force`, um ihn trotzdem zu löschen. Ein Paket, von dem ein anderes abhängt, kann nicht zuerst entfernt werden (`E_REQUIRED_BY`). Beim Entfernen eines Pakets werden auch seine MCP-Server und von GenPM angelegte Dateien entfernt, die leer zurückbleiben.

## outdated und audit

```bash
genpm outdated
genpm audit   # in deiner CI als: npx @genpm-net/cli audit
```

`audit` prüft die Integrität der Dateien, die Registry-Signatur jedes Lock-Eintrags, Sicherheitshinweise, zurückgezogene Versionen und Quarantänen. Bei hohen oder kritischen Befunden endet es mit Code 6.

## update und diff

```bash
genpm diff @core/auth
genpm update @core/auth
```

`diff` zeigt, was sich upstream seit deiner installierten Version geändert hat, mit Pfaden, die bereits auf deinen Ordner zeigen (anwenden mit `git apply --3way`). `update` führt einen Drei-Wege-Merge aus: Dateien, die du nicht angefasst hast, erhalten die neue Version, deine geänderten Zeilen bleiben erhalten, und wenn beide Seiten dieselben Zeilen geändert haben, bleibt die Datei mit den üblichen `<<<<<<<`-Markern stehen und der Befehl endet mit Code 4. Eine upstream entfernte Datei, die du geändert hast, bleibt erhalten.

`genpm diff --local` listet auch deine lokalen Änderungen; `genpm update --dry-run` zeigt den Plan, ohne etwas zu schreiben.

## JSON-Ausgabe

Jeder Befehl akzeptiert `--json` (eine Zeile, auf Englisch, ohne Rückfragen). Ohne interaktives Terminal schlägt jede unbeantwortete Frage mit `E_CONFIRM_REQUIRED` fehl (Exit-Code 2), und es wird nichts geschrieben.
