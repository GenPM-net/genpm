---
title: Escribir reglas de IA
section: Publicar
order: 22
---
`AGENTS.md` es lo que leen los agentes de tus usuarios antes de tocar tu módulo. Mantenlo entre 300 y 1.500 tokens y escríbelo en inglés: gasta menos tokens y lo entiende cualquier colaborador.

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

Las cinco secciones (propósito, mapa, integración, convenciones y qué no hacer) son las que mejor funcionan con los agentes.

El registry analiza las reglas en busca de frases de prompt injection en ocho idiomas, instrucciones para exfiltrar datos, `curl | sh`, contenido codificado y Unicode invisible. Los paquetes marcados quedan en revisión hasta que una persona los revisa.
