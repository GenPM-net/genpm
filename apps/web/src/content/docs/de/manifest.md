---
title: genpm.json-Referenz
section: Veröffentlichen
order: 21
---
Ein vollständiges Quell-Manifest (`genpm.json` im Wurzelverzeichnis deines Repos):

```json
{
  "$": 1,
  "n": "@acme/billing",
  "v": "1.2.0",
  "s": { "en": "Stripe subscriptions with webhooks", "de": "Stripe-Abos mit Webhooks" },
  "d": "src/lib/billing",
  "k": ["stripe", "billing", "subscriptions"],
  "g": { "@core/db": "^1.0.0" },
  "p": { "stripe": "^17.0.0" },
  "e": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "m": [{ "n": "stripe", "c": "npx", "a": ["-y", "@stripe/mcp"], "e": ["STRIPE_SECRET_KEY"] }]
}
```

Die Schlüssel sind ein Zeichen lang, damit Manifeste wenige Tokens kosten. Überall, wo ein LLM Manifeste sieht, steht diese Legende:

```text
genpm keys: n=name v=version s=summary r=repo t=git-ref c=commit-sha d=install-dir i=repo-subdir x=ai-rules-file l=license k=keywords g=genpm-deps p=npm-deps e=env-vars m=mcp-servers(n=name c=command a=args u=url e=env)
```

| Schlüssel | Name | Pflicht | Regeln |
|---|---|---|---|
| `n` | Name | ja | `@scope/name`, kleingeschrieben. |
| `v` | Version | ja | Striktes SemVer, ohne `v`-Präfix und ohne Build-Metadaten. |
| `d` | Ziel | ja | Relativer POSIX-Pfad im Projekt des Nutzers. Kein `..`, keine absoluten Pfade, nie `.git/`, `node_modules/` oder `.genpm/`, höchstens 8 Segmente. |
| `s` | Kurzbeschreibung | empfohlen | ≤ 160 Zeichen, eine Zeile. Text oder `{ "en": "…", "de": "…" }` (muss `en` enthalten). |
| `r` | Repo | nein | Git-URL per HTTPS; standardmäßig der Remote `origin`. |
| `t` | Ref | nein | Ein Tag oder ein 40-stelliger Hex-SHA; standardmäßig `v{v}`. Nie ein Branch. |
| `i` | Include | nein | Zu injizierender Unterordner des Repos (Standard `.`). |
| `x` | Kontext | nein | Datei mit KI-Regeln, relativ zu `i` (Standard `AGENTS.md`, ≤ 16 KB). |
| `l` | Lizenz | nein | SPDX-Ausdruck; die von GitHub erkannte Lizenz hat Vorrang. |
| `k` | Schlagwörter | nein | Bis zu 10, `^[a-z0-9-]{2,32}$`. |
| `g` | genpm-Abhängigkeiten | nein | `{ "@core/db": "^1.0.0" }`, bis zu 10. Werden von GenPM aufgelöst. |
| `p` | npm-Abhängigkeiten | nein | Werden dem Nutzer vorgeschlagen; nie ohne Zustimmung installiert. |
| `e` | Umgebung | nein | **Namen** von Variablen (`^[A-Z][A-Z0-9_]{1,63}$`), nie Werte. |
| `m` | MCP | nein | Bis zu 5 Server: `"@stripe/mcp"` oder `{ "n", "c", "a", "u", "e" }`. |
| `_*` | Erweiterungen | nein | Von offiziellen Tools ignoriert. Jeder andere Schlüssel ist ein Fehler. |

Das Quell-Manifest **darf** `c` (den eigenen Commit) **nicht** enthalten; die Registry ergänzt beim Auflösen `r`, `t`, `c`, `i`, `x` und `l`.

Schließe Dateien mit `.genpmignore` aus (gitignore-Syntax, relativ zu `i`). `.git/`, `.github/`, `node_modules/`, `genpm.json`, `.genpmignore` und `.env*` sind immer ausgeschlossen.

## Grenzen

| Was | Grenze |
|---|---|
| Dateien pro Paket | 2.000 |
| Paketgröße | 20 MB (bei der Installation mit `--max-size` anpassbar) |
| Einzelne Datei | 1 MB |
| Datei mit KI-Regeln | 16 KB; ~1.500 Tokens empfohlen, Warnung ab 4.000 |
| Pfadlänge / -tiefe | 200 Zeichen / 8 Segmente |
| Schlagwörter · genpm-Deps · npm-Deps · Variablen · MCP-Server | 10 · 10 · 30 · 30 · 5 |

`genpm validate` prüft all das lokal mit demselben Code wie die Registry.

JSON Schema: [`/schema/v1/genpm.json`](/schema/v1/genpm.json).
