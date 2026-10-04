---
title: Sicherheitsmodell
section: Sicherheit
order: 50
---
GenPM ist von Grund auf sicher und für alle überprüfbar. Es verspricht nie „100 % sicher“; es garantiert zehn Invarianten, jede mit einem Test, der jedes Release blockiert:

1. **Integrität**: Die installierten Bytes sind genau der Baum des Commits `c`, nie ein Branch.
2. **Keine Ausführung**: keine Lifecycle-Skripte, Git-Hooks, Submodule oder Filter.
3. **Eingrenzung**: Schreibzugriffe bleiben im Projekt, auf den geplanten Pfaden.
4. **Keine ausführbaren Dateien**: Injizierte Dateien werden mit Modus `0644` geschrieben.
5. **Zustimmung**: keine MCP-Konfiguration, keine npm-Installationen und kein Überschreiben ohne dein Ja.
6. **Secrets**: GenPM liest nie die Werte aus `.env`.
7. **Autorität der Registry**: Beim Veröffentlichen wird GitHub gelesen, nie das, was der Client schickt.
8. **Signierte Manifeste**: Der CLI installiert nur Manifeste mit Ed25519-Signatur.
9. **Unveränderlichkeit**: Eine veröffentlichte Version ändert sich nie.
10. **Mandantentrennung**: Keine Abfrage überschreitet Registry-Grenzen.

Derselbe deterministische Scanner läuft in der Registry (beim Veröffentlichen) und im CLI (bei jeder Installation): Eine kompromittierte Registry reicht nicht, um ihn zu umgehen.

## Sicherheitslücke melden

Schreib an **hello@genpm.net** mit dem Betreff `[SECURITY]` oder nutze GitHub Private Vulnerability Reporting. Erste Antwort innerhalb von 48 Stunden. Siehe [/security](/security).
