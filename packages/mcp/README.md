# @genpm-net/mcp

The GenPM MCP server: lets your AI agent search, inspect and inject architecture modules (source code + AI rules + MCP config) from immutable Git commits — with the same engine as the `genpm` CLI.

```bash
claude mcp add genpm -- npx -y @genpm-net/mcp
```

Don't want Node.js? The same server is built into the native `genpm` binary ([genpm.net/docs/install](https://genpm.net/docs/install)): register `genpm mcp serve` instead, or run `genpm mcp setup` and it writes the config for you. Cursor, VS Code, Windsurf and Codex: see [genpm.net/docs/mcp](https://genpm.net/docs/mcp).

## Tools

| Tool | What it does |
|---|---|
| `genpm_search` | Find packages by need (never returns sponsored results). |
| `genpm_info` | Manifest, dependencies, env vars, MCP servers and AI rules. |
| `genpm_add` | Plan with `dryRun: true`, then inject. MCP config and npm installs need explicit consent. |
| `genpm_list` | Installed packages with local changes. |
| `genpm_remove` | Remove a package; never deletes code you modified. |
| `genpm_outdated` | Newer versions available. |
| `genpm_audit` | Integrity, signatures and advisories. |
| `genpm_validate` | Validate a package you are authoring. |

Prompts: `genpm-find` and `genpm-integrate`.

## Safety

No `publish`, `login` or `force` tools: credentials stay out of the agent's reach. Writes only happen inside the project root (taken from the client's roots), package code is never executed, and package rules are returned as clearly delimited third-party content that never authorizes actions on its own.

Environment: `GENPM_REGISTRY` (another registry), `GENPM_TELEMETRY=0` or `DO_NOT_TRACK=1` (no telemetry).

License: MIT
