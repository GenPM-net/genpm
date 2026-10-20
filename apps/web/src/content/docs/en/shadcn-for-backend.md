---
title: Like shadcn/ui, for backend modules
section: Guides
order: 72
---
shadcn/ui made a simple idea popular: instead of installing a UI library, you **copy the component's source into your project** and own it. GenPM applies the same idea to whole backend modules (auth, Stripe billing, email, jobs, a CMS) and adds the two things AI agents need: rules and connections.

| | npm package | Copy-paste (shadcn/ui style) | GenPM |
|---|---|---|---|
| Where the code lives | `node_modules`, hidden | `src/`, yours | `src/`, yours |
| Granularity | A library | A UI component | A full module: code, tables, routes |
| Pinned and verified | Version range | No | Commit SHA, verified after every fetch |
| Install scripts | Can run on install | None | None, ever |
| Instructions for your AI | README, if any | No | `AGENTS.md` per module, loaded only in that folder |
| External services (MCP) | No | No | Declared and added with your consent |
| Updates | `npm update` | Manual | `genpm outdated` / `genpm update` with a diff |

## When it fits

- Your AI agent writes most of the code and you want it to **build on proven modules** instead of improvising auth or webhooks.
- You want to read and change what you install, the way you do with shadcn components.
- You start projects often and keep rewriting the same backend pieces.

## When it doesn't

- You want a hosted service (Clerk, Auth0) and do not want the code in your repo.
- You need a framework that is not covered yet: today the modules target TypeScript with Next.js and Hono.

## Try it

```bash
npx @genpm-net/cli add @core/auth
```

Then open `src/lib/auth/`: it is plain code you can read, change and commit. Browse the [48 packages](/search) or read [how it works](/docs/how-it-works).
