---
title: KI-Regeln schreiben
section: Veröffentlichen
order: 22
---
`AGENTS.md` lesen die Agenten deiner Nutzer, bevor sie dein Modul anfassen. Halte die Datei zwischen 300 und 1.500 Tokens und schreibe sie auf Englisch: Das kostet weniger Tokens, und jeder Mitwirkende kann sie lesen.

```md
# @acme/auth — rules for agents

## Purpose
Cookie sessions + OAuth (GitHub, Google). Authorization (roles) is out of scope.

## Module map
- `index.ts` — public API. Import only from here.
- `session.ts` — create, validate and rotate sessions.

## Integration (do this after installing)
1. Run the migrations that add `users` and `sessions`.
2. Mount `authRoutes` in the app router.
3. Configure `AUTH_SECRET` (see `.env.example`).

## Conventions
- Never read cookies outside `session.ts`.

## Don't
- Don't store OAuth tokens in plain text.
```

Diese fünf Abschnitte (Zweck, Übersicht, Integration, Konventionen und Verbote) befolgen Agenten am zuverlässigsten.

Die Registry durchsucht die Regeln nach Prompt-Injection-Formulierungen in acht Sprachen, Anweisungen zum Datenabfluss, `curl | sh`, kodierten Inhalten und unsichtbarem Unicode. Markierte Pakete bleiben in Quarantäne, bis ein Mensch sie prüft.
