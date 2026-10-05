---
title: Dein erstes Paket
section: Veröffentlichen
order: 20
---
Dein Code bleibt auf GitHub; die Registry speichert das Manifest und den Commit, auf den es zeigt.

**Im Web, ohne Terminal:** Melde dich auf [genpm.net/publish](/publish) an, wähle eines deiner Repositories, und GenPM sagt dir, was fehlt. Es erzeugt die `genpm.json` für dich, und jede Korrektur öffnet GitHub mit der fertigen Datei zum Committen (GenPM fragt nie nach Schreibzugriff). Ist alles grün, veröffentlichst du auf derselben Seite.

**Im Terminal:**

```bash
genpm init          # erstellt genpm.json, AGENTS.md und .genpmignore
genpm validate      # derselbe Scanner wie in der Registry
git tag v1.0.0 && git push --tags
genpm login
genpm publish
```

`publish` prüft, dass es keine ungecommitteten Änderungen gibt und dass der Tag auf `origin` auf denselben Commit zeigt wie deiner (`E_REF_NOT_PUSHED`). Danach liest die Registry die `genpm.json` **von GitHub** bei diesem Commit (nie von deinem Rechner), validiert sie, scannt den Baum, signiert das aufgelöste Manifest und listet das Paket.

Versionen sind unveränderlich: `(Name, Version)` kann nie zweimal veröffentlicht werden, auch nicht nach einem Yank. Branches werden immer abgelehnt (`E_REF_MUTABLE`).

Probiere es zuerst, ohne etwas zu veröffentlichen:

```bash
genpm publish --dry-run
```

## Was die Registry prüft

- Dass der Tag auf GitHub existiert und auf den Commit zeigt, den du gepusht hast.
- Dass die `genpm.json` gültig ist und ihr Name zu einem Scope passt, in dem du veröffentlichen darfst.
- Dass der Baum den Scan besteht: keine Dateien, die sich selbst ausführen (Installationsskripte, `.npmrc`, `.vscode/tasks.json`, Git-Hooks…), keine Secrets, keine Symlinks, sichere Pfade.
- Dass die KI-Regeln keine Prompt Injection enthalten. Wirkt etwas verdächtig, kommt die Version **in Quarantäne** und ein Mensch prüft sie innerhalb von 24 Geschäftsstunden.

## Vorabversionen und Dist-Tags

Eine Vorabversion wie `1.3.0-beta.1` landet automatisch im Dist-Tag `next`, damit `latest` weiter auf deine letzte stabile Version zeigt. Nutzer holen sie mit `genpm add @acme/billing@next`. Mit `--dist-tag` wählst du einen anderen Tag.

## Monorepos

Veröffentliche ein Paket aus einem Unterordner mit `--manifest packages/billing/genpm.json` und setze `i` auf diesen Ordner, damit nur er injiziert wird. Nutze Tags pro Paket, etwa `billing@1.2.0`.

## Eine Version zurückziehen

```bash
genpm yank @acme/billing@1.2.0 --reason "bricht die Webhooks mit der Stripe-API 2026-09"
```

Eine zurückgezogene Version bleibt für Projekte, die sie schon nutzen, unveränderlich und prüfbar, neue Installationen überspringen sie aber, und die Website zeigt den Grund.

## Scopes

Dein Scope ist dein GitHub-Login oder eine deiner Organisationen. Scopes wie `@core`, `@genpm` oder `@official` sind reserviert.

## CI

`genpm init --workflow` fügt einen GitHub-Actions-Workflow hinzu, der beim Push eines `v*`-Tags veröffentlicht, mit `GENPM_TOKEN` als Secret.

### Ohne Token: vertrauenswürdiges Veröffentlichen

Autorisiere das Repository einmal unter [Vertrauenswürdiges Veröffentlichen](/settings/publishing) (optional nur eine Workflow-Datei oder ein Environment). Gib dem Job dann `id-token: write` und entferne `GENPM_TOKEN`: `genpm publish` fordert bei Actions ein OIDC-Token an, und GenPM tauscht es gegen ein 15-Minuten-Token, das nur aus diesem Repository in deinen Scope veröffentlichen kann.

```yaml
permissions:
  contents: read
  id-token: write   # trusted publishing
steps:
  - uses: actions/checkout@v4
    with: { fetch-depth: 0 }
  - run: npx -y @genpm-net/cli publish --yes
```
