---
title: Datenschutzerklärung
updated: 2026-10-05
---
Diese Erklärung beschreibt, welche personenbezogenen Daten GenPM (genpm.net, die API `api.genpm.net`, der CLI `genpm` und der Server `@genpm-net/mcp`) verarbeitet, warum, auf welcher Rechtsgrundlage und welche Rechte du hast. Sie entspricht der Verordnung (EU) 2016/679 (DSGVO) und dem spanischen Organgesetz 3/2018 (LOPDGDD). Bei Abweichungen ist die spanische Fassung maßgeblich.

## 1. Verantwortlicher

- **Verantwortlicher:** {{name}}
- **Steuernummer (NIF):** {{nif}}
- **Anschrift:** {{address}}
- **Kontakt:** {{email}} („[PRIVACY]“ in den Betreff schreiben)

Die Benennung eines Datenschutzbeauftragten ist nicht erforderlich (Art. 37 DSGVO, Art. 34 LOPDGDD); bei Fragen schreib an den obigen Kontakt.

## 2. Was wir verarbeiten, warum und auf welcher Grundlage

| Daten | Zweck | Rechtsgrundlage | Speicherdauer |
|---|---|---|---|
| GitHub-ID, Login, Name, Avatar und Organisationen (bei der Anmeldung) | Dein Konto anlegen und führen, anzeigen, wer welches Paket veröffentlicht, und das Veröffentlichen in deinen Scopes erlauben | Vertragserfüllung (Art. 6.1.b DSGVO): die Nutzungsbedingungen | Solange dein Konto besteht |
| E-Mail deines GitHub-Kontos (nie angezeigt) | Sicherheits- und Servicehinweise zu deinen Paketen | Vertrag und berechtigtes Interesse an der Sicherheit des Ökosystems (Art. 6.1.f) | Solange dein Konto besteht |
| API-Tokens (nur ihr Hash wird gespeichert) | Den CLI und die CI authentifizieren | Vertrag | Bis sie ablaufen oder du sie widerrufst |
| Veröffentlichte Pakete: Manifest, Repository, Commit und dein GitHub-Login | Die Registry betreiben: Pakete suchen, prüfen und installieren | Vertrag | Unbegrenzt: Veröffentlichte Versionen sind unveränderlich, damit Projekte, die sie nutzen, prüfbar bleiben (siehe §6) |
| Installationsereignisse: Paket, Version, Client (`cli`/`mcp`), CLI-Version und Land (aus der IP abgeleitet, die nicht gespeichert wird) | Öffentliche Installationszähler und aggregierte Statistiken | Berechtigtes Interesse, die Nutzung der Registry zu messen | Täglich aggregiert; Einzelereignisse 90 Tage |
| IP-Adresse, gehasht mit einem täglich wechselnden Salt | Ratenbegrenzung und Missbrauchsabwehr | Berechtigtes Interesse an der Sicherheit des Dienstes (Art. 6.1.f, Erwägungsgrund 49) | Höchstens 30 Tage |
| Technische Serverprotokolle (Cloudflare Workers) | Fehler und Angriffe diagnostizieren | Berechtigtes Interesse an Sicherheit und Betrieb des Dienstes | Höchstens 7 Tage |
| Webanalyse: durchgeführte Suchen, angesehenes Paket, Sprache und Pfad (ohne IP oder Kennungen) | Wissen, was gesucht und genutzt wird, um den Dienst zu verbessern | Berechtigtes Interesse an aggregierter Nutzungsmessung (Art. 6.1.f) | 3 Monate (Cloudflare Analytics Engine) |
| Formular für Sponsoren oder Unternehmen: E-Mail, Firma, Teamgröße, IDE und Nachricht | Deine Anfrage beantworten | Vorvertragliche Maßnahmen auf deine Anfrage (Art. 6.1.b) | 12 Monate, sofern keine Vereinbarung zustande kommt |
| Paketmeldungen: dein Konto, das Paket, der Grund und deine Beschreibung | Den gemeldeten Inhalt prüfen und die Entscheidung mitteilen | Rechtliche Pflicht nach Art. 16 des EU-Gesetzes über digitale Dienste (Art. 6.1.c DSGVO) | 2 Jahre nach der Entscheidung |
| E-Mails, die du uns schickst | Deine Anfrage oder die Ausübung deiner Rechte bearbeiten | Berechtigtes Interesse, dir zu antworten, oder gegebenenfalls eine rechtliche Pflicht | So lange wie nötig und bis zu 2 Jahre danach |

Diese Fristen werden automatisch durchgesetzt: Ein täglicher Prozess löscht oder anonymisiert, was abgelaufen ist.

**Was wir nie verarbeiten:** den Inhalt deines Projekts, deine `.env`-Dateien oder die Werte deiner Umgebungsvariablen. Wir verwenden keine Werbe- oder websiteübergreifenden Tracking-Cookies, und dein Browser sendet nichts für die Analyse: Wir zählen auf unseren Servern die Seiten, die du aufrufst (siehe [Cookie-Richtlinie](/cookies)).

**Telemetrie von CLI und MCP:** Mit `GENPM_TELEMETRY=0` oder `DO_NOT_TRACK=1` sendet der Client `client=none`, und die Registry speichert das Ereignis nicht. So kannst du jederzeit widersprechen.

Wir treffen keine ausschließlich automatisierten Entscheidungen, die dir gegenüber rechtliche Wirkung entfalten (Art. 22 DSGVO). Der automatische Scan kann ein Paket zur Prüfung stellen, aber über einen endgültigen Rückzug entscheidet ein Mensch (siehe [Paketrichtlinie](/policy)).

Die Angabe deiner GitHub-Daten ist für ein Konto erforderlich; ohne sie kannst du nicht veröffentlichen, aber weiterhin Pakete suchen und installieren, wofür kein Konto nötig ist.

## 3. Empfänger und Auftragsverarbeiter

Wir verkaufen deine Daten nicht und geben sie nicht an Dritte weiter. Diese Anbieter verarbeiten sie in unserem Auftrag auf Grundlage von Auftragsverarbeitungsverträgen (Art. 28 DSGVO):

| Anbieter | Leistung | Standort |
|---|---|---|
| Cloudflare, Inc. | Hosting (Workers), Datenbank (D1), Auslieferungsnetz, Bot-Schutz (Turnstile) und aggregierte Statistiken | EU und USA |
| Piensa Solutions (Arsys Internet, S.L.U.) | Domain und E-Mail | Spanien |

**GitHub, Inc.** handelt als eigenständiger Verantwortlicher, wenn du dich mit GitHub anmeldest und wenn die Registry öffentliche Repositories liest; es gilt die eigene [Datenschutzerklärung von GitHub](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Öffentliche Paketdaten (Name, Versionen, Repository und GitHub-Login des Herausgebers) sind für alle Besucher und für KI-Agenten sichtbar, die die Registry nutzen, denn das ist der Zweck des Dienstes.

Wir geben Daten nur an Behörden weiter, wenn ein Gesetz es verlangt.

## 4. Internationale Übermittlungen

Cloudflare, Inc. und GitHub, Inc. nehmen am EU-US-Datenschutzrahmen teil, der durch den Angemessenheitsbeschluss der Europäischen Kommission vom 10. Juli 2023 anerkannt ist (Art. 45 DSGVO). Ihre Verträge enthalten außerdem die Standardvertragsklauseln der Kommission (Art. 46 DSGVO).

## 5. Deine Rechte

Du kannst deine Rechte auf **Auskunft, Berichtigung, Löschung, Widerspruch, Einschränkung und Datenübertragbarkeit** ausüben und erteilte Einwilligungen jederzeit widerrufen, indem du an {{email}} mit dem Betreff „[PRIVACY]“ schreibst. Wir antworten innerhalb eines Monats (Art. 12.3 DSGVO). Wenn wir dich mit deinen Angaben nicht identifizieren können, fragen wir nach dem Nötigsten.

Wenn du meinst, dass wir deine Anfrage nicht richtig bearbeitet haben, kannst du dich bei der **spanischen Datenschutzbehörde** ([www.aepd.es](https://www.aepd.es), C/ Jorge Juan 6, 28001 Madrid) oder bei der Behörde deines Wohnsitzlandes beschweren.

## 6. Konto schließen

Wenn du die Schließung deines Kontos verlangst, anonymisieren wir deine personenbezogenen Daten innerhalb von 30 Tagen; Sicherungskopien werden innerhalb weiterer 30 Tage überschrieben. Deine veröffentlichten Pakete bleiben verfügbar und werden einem Systemkonto zugeordnet, weil andere Projekte von ihnen abhängen und ihre Versionen unveränderlich sind. Die URL des GitHub-Repositorys jedes Pakets, die deinen Login enthalten kann, ist Teil des veröffentlichten Pakets; wenn sie nicht mehr installiert werden sollen, ziehe sie vor der Schließung deines Kontos zurück.

## 7. Minderjährige

GenPM ist ein Dienst für Entwickler. Für ein Konto musst du mindestens 16 Jahre alt sein: Das ist das allgemeine Alter nach Art. 8 DSGVO und das, was der spanische Entwurf eines Organgesetzes zum Schutz Minderjähriger in digitalen Umgebungen vorsieht (er hebt die 14 Jahre aus Art. 7 LOPDGDD an). Konten jüngerer Personen akzeptieren wir nicht; finden wir eines, schließen wir es und löschen seine Daten.

## 8. Sicherheit

Wir treffen dem Risiko angemessene technische und organisatorische Maßnahmen: Verschlüsselung bei der Übertragung (HTTPS mit HSTS), Tokens nur als Hash gespeichert, Cookies mit `HttpOnly` und `Secure`, pseudonymisierte IP-Adressen, Zugriff mit Zwei-Faktor-Authentifizierung und signierte Manifeste. Gefährdet eine Datenpanne deine Rechte, melden wir sie innerhalb von 72 Stunden der AEPD und, wo erforderlich, dir (Art. 33 und 34 DSGVO).

## 9. Änderungen

Wenn wir diese Erklärung wesentlich ändern, kündigen wir es vorab auf genpm.net und, falls du ein Konto hast, per E-Mail an.
