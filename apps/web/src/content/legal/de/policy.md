---
title: Paketrichtlinie
updated: 2026-10-03
---
Diese Richtlinie hält GenPM sicher für alle, die Pakete installieren, und für die KI-Agenten, die deren Regeln lesen. Sie ist Teil der [Nutzungsbedingungen](/terms) und legt unsere Regeln zur Moderation von Inhalten nach der Verordnung (EU) 2022/2065 über digitale Dienste (DSA) fest. Bei Abweichungen ist die spanische Fassung maßgeblich.

## 1. Was nicht erlaubt ist

- Schadsoftware, Programme zum Abgreifen von Zugangsdaten, Krypto-Miner oder Code, der Daten abfließen lässt.
- KI-Regeln, die versuchen, die Anweisungen des Nutzers zu übergehen, Aktionen vor ihm zu verbergen oder den Agenten Daten an andere Stellen senden zu lassen (*Prompt Injection*).
- Dateien, die beim Öffnen oder Installieren eines Projekts automatisch ausgeführt werden: Installationsskripte, `.npmrc`, `.envrc`, `.vscode/tasks.json`, Git-Hooks und Ähnliches.
- Secrets: API-Schlüssel, Tokens oder private Schlüssel, auch widerrufene.
- Inhalte, die geistige oder gewerbliche Schutzrechte Dritter verletzen, oder sonstige rechtswidrige Inhalte.
- Typosquatting oder das Ausgeben als anderer Herausgeber oder als Marke.
- Spam, leere Pakete oder das Besetzen von Namen.

## 2. Wie wir es erkennen

- **Automatisch:** Jede Version wird beim Veröffentlichen und erneut vom CLI bei der Installation gescannt (selbstausführende Dateien, Secrets, unsichere Pfade, Symlinks und Anzeichen von Prompt Injection in KI-Regeln).
- **Durch Meldungen** von beliebigen Personen (siehe §4).
- **Menschliche Prüfung:** Markierte Versionen werden zur Prüfung gestellt und können erst installiert werden, wenn ein Mensch sie innerhalb von 24 Geschäftsstunden geprüft hat. Kein endgültiger Rückzug wird allein automatisiert entschieden.

## 3. Mögliche Maßnahmen

Je nach Schwere: die Version zur Prüfung stellen, sie zurückziehen (*yank*), das ganze Paket oder den Scope zur Prüfung stellen, einen Sicherheitshinweis unter [/security/advisories](/security/advisories) veröffentlichen und bei schweren oder wiederholten Verstößen das Konto sperren. Die Maßnahmen sind verhältnismäßig und berücksichtigen die Rechte und Interessen aller Beteiligten.

## 4. Inhalte melden

Jeder kann ein Paket melden, auch ohne Konto:

- mit der Schaltfläche **Melden** auf der Paketseite (erfordert Anmeldung mit GitHub) oder
- per E-Mail an {{email}} mit dem Betreff „[REPORT]“.

Damit wir handeln können, gib an: das Paket und die Version (oder die URL), warum du es für rechtswidrig oder richtlinienwidrig hältst, deinen Namen und deine E-Mail sowie eine Erklärung, dass die Angaben nach bestem Wissen richtig und vollständig sind. Für Schwachstellen in GenPM selbst siehe [/security](/security).

Wir bestätigen den Eingang und teilen dir unsere Entscheidung und die Rechtsbehelfe mit. Finden wir Hinweise auf eine Straftat, die Leben oder Sicherheit von Menschen bedroht, informieren wir die zuständigen Behörden (Art. 18 DSA).

## 5. Wenn wir gegen deine Inhalte vorgehen

Wenn wir ein Paket von dir zurückziehen oder einschränken oder dein Konto sperren, schicken wir dir eine Begründung (Art. 17 DSA): die Maßnahme, den Grund, die zugrunde liegenden Tatsachen, ob automatisierte Mittel beteiligt waren und welche Regel oder Klausel angewendet wurde.

**Widerspruch:** Du kannst innerhalb von 6 Monaten per E-Mail an {{email}} mit dem Betreff „[APPEAL]“ eine Überprüfung der Entscheidung verlangen. Ein Mensch, nicht der automatische Scan, prüft sie, und wir antworten mit Begründung. Du kannst auch vor Gericht gehen.

## 6. Transparenz

Wir veröffentlichen Sicherheitshinweise unter [/security/advisories](/security/advisories) und als JSON-Feed.
