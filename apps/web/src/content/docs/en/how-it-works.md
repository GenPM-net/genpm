---
title: How GenPM works
section: Getting started
order: 2
---
A GenPM package is three layers that travel together and are pinned to one commit:

| Layer | What it is | Where it lands |
|---|---|---|
| **Code** | Source code of a module | `d`, for example `src/lib/auth/` |
| **Context** | Rules for your AI agent (`x`) | `<d>/AGENTS.md`, plus IDE rule files with scope |
| **Connections** | MCP servers the module needs (`m`) | `.mcp.json`, `.cursor/mcp.json`… only with your consent |

## The registry stores metadata only

The registry indexes manifests and points to Git. When you install, the CLI downloads the code **directly from the Git host** at the exact commit (`c`) and verifies it: `git rev-parse HEAD` must equal `c`, and every file must match the commit tree.

## Plan before action

`plan()` never writes to your project. It resolves dependencies, downloads into a global cache and scans the files. `apply()` writes through a journal: if anything fails, everything is rolled back.

## No scripts, ever

GenPM has no lifecycle scripts. Nothing from a package runs on your machine. Files that other tools run automatically (`postinstall`, `.npmrc`, `.envrc`, `.vscode/tasks.json`…) are rejected.
