---
title: Escrevendo regras de IA
section: Publicação
order: 22
---
O `AGENTS.md` é o que os agentes dos seus usuários leem antes de mexer no seu módulo. Mantenha entre 300 e 1.500 tokens e em inglês: gasta menos tokens e qualquer colaborador entende.

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

Essas cinco seções (propósito, mapa, integração, convenções e o que não fazer) são as que os agentes seguem melhor.

O registry escaneia as regras em busca de frases de prompt injection em oito idiomas, instruções de exfiltração, `curl | sh`, conteúdo codificado e Unicode invisível. Pacotes marcados ficam em revisão até uma pessoa revisá-los.
