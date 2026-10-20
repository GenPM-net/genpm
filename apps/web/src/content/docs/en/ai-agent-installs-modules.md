---
title: Let Claude Code or Cursor install modules
section: Guides
order: 73
---
Agents are good at writing code and bad at knowing which proven piece already exists. Connect GenPM's MCP server and your agent can **search the registry, show you the exact files and rules, and install** a module. Anything outside your code, like an external MCP server, needs your OK.

## Connect it (1 minute)

Claude Code:

```bash
claude mcp add genpm -- npx -y @genpm-net/mcp
```

Cursor (`.cursor/mcp.json`), VS Code (`.vscode/mcp.json`), Windsurf and others use the same server:

```json
{ "mcpServers": { "genpm": { "command": "npx", "args": ["-y", "@genpm-net/mcp"] } } }
```

With the `genpm` binary installed, `genpm mcp setup` writes the config for every client it detects. Claude Code users can also add the plugin: `claude plugin marketplace add GenPM-net/genpm`.

## Then just ask

- *"Add GitHub login to this project with genpm."*
- *"Find a billing module with Stripe and show me its rules before installing."*
- *"Which genpm packages in this repo are outdated?"*

## What the agent can and cannot do

- **Can:** search, read a package's manifest, files and AI rules, install into `src/`, list and update what is installed.
- **Must ask you:** before adding anything outside your code, such as an external MCP server a module declares (for example Stripe's). Everything it injects is plain code in `src/` that you see in your diff.
- **Never:** run scripts from a package (GenPM has none), install from a branch (only commits verified by SHA), or install rules that failed the prompt-injection scan.

After installing, each module brings an `AGENTS.md` that your agent reads only when it works in that folder, so it integrates the module the way its author intended.

More detail: [MCP server](/docs/mcp) · [Context & IDEs](/docs/context).
