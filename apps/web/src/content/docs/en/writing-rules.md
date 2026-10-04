---
title: Writing AI rules
section: Publishing
order: 22
---
`AGENTS.md` is what your users' agents read before touching your module. Keep it between 300 and 1,500 tokens and in English: it costs fewer tokens and every contributor can read it.

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

These five sections (purpose, map, integration, conventions and don'ts) are the ones agents follow best.

The registry scans rules for prompt-injection phrases in eight languages, exfiltration instructions, `curl | sh`, encoded blobs and invisible Unicode. Flagged packages are quarantined for human review.
