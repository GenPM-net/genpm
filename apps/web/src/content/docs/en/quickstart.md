---
title: Quickstart
section: Getting started
order: 1
---
Add your first module in about a minute. You need **Node 20.11+** and **git 2.25+** (without git, GenPM falls back to GitHub tarballs).

## 1. Add a package

Run this in the root of your project. GenPM shows the full plan and asks before writing anything.

```bash
npx genpm add @core/auth
```

GenPM resolves `@core/auth` and its dependency `@core/db`, verifies the registry signature of each manifest, downloads the exact commit and scans it locally before showing you the plan.

## 2. See what changed

```bash
git status
```

- The code is in `src/lib/auth` and `src/lib/db` — it is your code now.
- The rules your AI reads are in `src/lib/auth/AGENTS.md`.
- `genpm.lock` pins every package to a 40-character commit SHA.
- `.env.example` lists the variables to configure (names only, never values).

## 3. Let your AI take over

Open your agent and ask it to wire the module in. It reads the module rules and follows their **Integration** section:

```text
Integrate @core/auth following src/lib/auth/AGENTS.md. Add GitHub login.
```

Connect the [MCP server](/docs/mcp) and your agent can do step 1 too.
