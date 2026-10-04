---
title: Écrire des règles IA
section: Publication
order: 22
---
`AGENTS.md` est ce que lisent les agents de vos utilisateurs avant de toucher à votre module. Gardez-le entre 300 et 1 500 tokens, et en anglais : il coûte moins de tokens et tout contributeur peut le lire.

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

Ces cinq sections (objectif, carte, intégration, conventions et interdits) sont celles que les agents suivent le mieux.

Le registry analyse les règles à la recherche de formules de prompt injection dans huit langues, d’instructions d’exfiltration, de `curl | sh`, de contenus encodés et d’Unicode invisible. Les paquets signalés sont mis en quarantaine jusqu’à l’examen d’une personne.
