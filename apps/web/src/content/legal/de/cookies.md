---
title: Cookie-Richtlinie
updated: 2026-10-05
---
Diese Richtlinie entspricht Artikel 22.2 des spanischen Gesetzes 34/2002 über Dienste der Informationsgesellschaft (LSSI-CE) und dem Cookie-Leitfaden der spanischen Datenschutzbehörde. Bei Abweichungen ist die spanische Fassung maßgeblich.

## Kurz gesagt

genpm.net verwendet **technische Cookies und Einstellungen, die du selbst wählst** und die keiner Einwilligung bedürfen (Art. 22.2 LSSI-CE), sowie **eine optionale Analyse, die nur läuft, wenn du sie im Hinweis bei deinem ersten Besuch akzeptierst**. „Akzeptieren“ und „Ablehnen“ sind gleichwertig: Lehnst du ab oder triffst keine Wahl, wird kein Analyseskript geladen und nichts davon auf deinem Gerät gespeichert. Wir verwenden keine Werbe-Cookies. Unabhängig davon zählen wir auf unseren Servern die Seiten, die du aufrufst (Seitenaufrufe, Suchen, Pakete, Herkunft und Land, ohne IP oder Kennungen): Dabei wird nichts in deinem Browser gespeichert.

## Was wir in deinem Browser speichern

| Name | Art | Anbieter | Zweck | Dauer |
|---|---|---|---|---|
| `__Host-genpm_session` | Technisches Cookie | GenPM | Dich angemeldet halten, nur wenn du dich anmeldest | 30 Tage |
| `__Host-genpm_oauth` | Technisches Cookie | GenPM | Die GitHub-Anmeldung vor Fälschung schützen (CSRF) | 10 Minuten |
| `genpm-theme` | Lokaler Speicher | GenPM | Den gewählten hellen oder dunklen Modus merken | Bis du ihn löschst |
| `genpm-lang-dismissed` | Lokaler Speicher | GenPM | Keine andere Sprache mehr vorschlagen, nachdem du den Hinweis geschlossen hast | Bis du ihn löschst |
| `genpm_consent` | Einstellungs-Cookie | GenPM | Speichern, ob du die optionale Analyse akzeptiert oder abgelehnt hast | 6 Monate |

## Optionale Analyse (nur mit deiner Zustimmung)

Wenn du auf „Akzeptieren“ klickst, nutzen wir **PostHog** (PostHog, Inc., Daten in der EU gespeichert) für Heatmaps von Klicks und Scrollen sowie anonyme Sitzungsaufzeichnungen mit verborgenen Formularfeldern. Kontoseiten (Anmeldung, Tokens, Dashboard und Veröffentlichen) werden nie aufgezeichnet, und die Anfragen laufen über unsere eigene Domain, ohne deine IP weiterzugeben.

| Name | Typ | Anbieter | Zweck | Dauer |
|---|---|---|---|---|
| `ph_<schlüssel>_posthog` | Analyse-Cookie und lokaler Speicher | PostHog (Dritter, Auftragsverarbeiter von GenPM) | Zufällige Kennung, um deine Besuche und die aufgezeichnete Sitzung zusammenzufassen | 12 Monate |
| `ph_*` in `sessionStorage` | Analyse-Sitzungsspeicher | PostHog | Aufzeichnung der laufenden Sitzung | Bis du den Tab schließt |

**Meinung ändern:** Klicke im Footer jeder Seite auf „Cookie-Einstellungen“. Wenn du die Einwilligung widerrufst, laden wir PostHog nicht mehr und löschen seine Cookies und seinen Speicher aus deinem Browser. Der Widerruf ist so einfach wie die Einwilligung und schränkt nichts ein, was du auf der Website tun kannst.

## Sicherheit durch Cloudflare

Die Website wird über Cloudflare ausgeliefert. Zum Schutz vor automatisierten Angriffen kann Cloudflare technische Sicherheits-Cookies setzen (zum Beispiel `__cf_bm`, 30 Minuten, oder `cf_clearance`), und auf den Formularen für Sponsoren und Unternehmen kann die Anti-Bot-Prüfung **Turnstile** technische Browserinformationen lesen, um Menschen von Bots zu unterscheiden. Ihr einziger Zweck ist die Sicherheit des angeforderten Dienstes: Sie dienen weder der Werbung noch der websiteübergreifenden Verfolgung. Mehr dazu in der [Cookie-Richtlinie von Cloudflare](https://www.cloudflare.com/cookie-policy/).

## Löschen oder blockieren

Du kannst Cookies und lokalen Speicher in den Einstellungen deines Browsers löschen oder blockieren ([Chrome](https://support.google.com/chrome/answer/95647), [Firefox](https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox), [Safari](https://support.apple.com/guide/safari/sfri11471), [Edge](https://support.microsoft.com/microsoft-edge)). Wenn du `__Host-genpm_session` blockierst, kannst du dich nicht anmelden, aber weiterhin Pakete suchen und installieren.

## CLI und MCP-Server

Der CLI `genpm` und der Server `@genpm-net/mcp` verwenden keine Cookies. Zur Installations-Telemetrie und wie du sie abschaltest, siehe die [Datenschutzerklärung](/privacy).

Wenn wir die verwendeten Cookies ändern, aktualisieren wir diese Richtlinie und bitten dich bei geändertem Zweck erneut um deine Einwilligung.
