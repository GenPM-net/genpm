---
title: MCP server
section: MCP server
order: 30
---
The GenPM MCP server (`@genpm/mcp`) gives your agent the same engine as the CLI: it can search, inspect and inject modules, and it asks you before touching anything outside your code.

The fastest way is to let GenPM write the config for the clients it detects in your project:

```bash
genpm mcp setup
```

It shows the exact change and asks before writing. Use `--client` and `--scope` to pick one, or configure it by hand below.

## Claude Code

```bash
claude mcp add genpm -- npx -y @genpm/mcp
```

That registers it for your user. To share it with your team, commit a `.mcp.json` at the project root (`genpm mcp setup --client claude --scope project` writes it):

```json
{
  "mcpServers": {
    "genpm": { "command": "npx", "args": ["-y", "@genpm/mcp"] }
  }
}
```

## Cursor

Project: `.cursor/mcp.json`. User: `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "npx", "args": ["-y", "@genpm/mcp"] }
  }
}
```

```bash
genpm mcp setup --client cursor                # project
genpm mcp setup --client cursor --scope user   # user
```

## VS Code (GitHub Copilot)

Project: `.vscode/mcp.json` (note the `servers` key and the `type`):

```json
{
  "servers": {
    "genpm": { "type": "stdio", "command": "npx", "args": ["-y", "@genpm/mcp"] }
  }
}
```

User:

```bash
code --add-mcp '{"name":"genpm","command":"npx","args":["-y","@genpm/mcp"]}'
```

## Windsurf

User only: `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "npx", "args": ["-y", "@genpm/mcp"] }
  }
}
```

```bash
genpm mcp setup --client windsurf
```

## Codex

User only: `~/.codex/config.toml`.

```toml
[mcp_servers.genpm]
command = "npx"
args = ["-y", "@genpm/mcp"]
```

```bash
genpm mcp setup --client codex
```

## Tools

| Tool | What it does |
|---|---|
| `genpm_search` | Find packages by need. Never returns sponsored results. |
| `genpm_info` | Manifest, dependencies, env vars, MCP servers and AI rules. |
| `genpm_add` | Plan (`dryRun: true`) and inject. `allowMcp` and `installNpmDeps` need your consent. |
| `genpm_list` | Installed packages with local changes. |
| `genpm_remove` | Remove a package; never deletes code you modified. |
| `genpm_outdated` | Newer versions available. |
| `genpm_audit` | Integrity, signatures and advisories. |
| `genpm_validate` | Validate a package you are authoring. |

The server has no `force`, `publish` or `login`. Package rules are returned as third-party content (`<package-rules trust="third-party">`): they describe a module and never authorize actions you did not ask for.

## Prompts

- `genpm-find` — search → info → dry run → confirmation → install.
- `genpm-integrate` — read `<d>/AGENTS.md` and wire the module into the app.

## MCP servers declared by packages

A package can declare the MCP servers it needs (for example Stripe's). They are **never** added silently: `genpm add` asks first, `--no-mcp` skips them, and you can add them later with `genpm mcp add <package>`. Secrets are referenced as environment variables (`${STRIPE_SECRET_KEY}` in `.mcp.json`, `${env:STRIPE_SECRET_KEY}` in Cursor and VS Code), never written as values.

## Troubleshooting

- **The client does not see the tools**: restart the client after changing its config; check that `npx -y @genpm/mcp` runs in a terminal.
- **Telemetry**: set `GENPM_TELEMETRY=0` (or `DO_NOT_TRACK=1`) in the server `env`.
- **Another registry**: set `GENPM_REGISTRY` in the server `env`.
