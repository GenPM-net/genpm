---
title: MCP server
section: MCP server
order: 30
---
The GenPM MCP server gives your agent the same engine as the CLI: it can search, inspect and inject modules, and it asks you before touching anything outside your code.

The fastest way is to let GenPM write the config for the clients it detects in your project:

```bash
genpm mcp setup
```

It shows the exact change and asks before writing. Use `--client` and `--scope` to pick one, or configure it by hand below.

The server is built into the [`genpm` binary](/docs/install): your client launches `genpm mcp serve`, no Node.js needed. Without the binary, use the npm package instead — replace `genpm mcp serve` with `npx -y @genpm-net/mcp` (`"command": "npx", "args": ["-y", "@genpm-net/mcp"]`) in any snippet below; `genpm mcp setup` run through npm or npx does this for you.

## Claude Code

```bash
claude mcp add genpm -- genpm mcp serve
```

That registers it for your user. To share it with your team, commit a `.mcp.json` at the project root (`genpm mcp setup --client claude --scope project` writes it):

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

## Cursor

Project: `.cursor/mcp.json`. User: `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
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
    "genpm": { "type": "stdio", "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

User:

```bash
code --add-mcp '{"name":"genpm","command":"genpm","args":["mcp","serve"]}'
```

## Windsurf

User only: `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
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
command = "genpm"
args = ["mcp", "serve"]
```

```bash
genpm mcp setup --client codex
```

## Gemini CLI

Project: `.gemini/settings.json` · User: `~/.gemini/settings.json`. Only `mcpServers` is touched; your other Gemini settings stay as they are.

```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

```bash
genpm mcp setup --client gemini --scope project
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
| `genpm_diff` | Upstream patch of an installed package plus your local changes. |
| `genpm_update` | Update with a three-way merge, or record a patch the agent already applied (`strategy: "ai"`). |
| `genpm_audit` | Integrity, signatures and advisories. |
| `genpm_validate` | Validate a package you are authoring. |

The server has no `force`, `publish` or `login`. Package rules are returned as third-party content (`<package-rules trust="third-party">`): they describe a module and never authorize actions you did not ask for.

## Prompts

- `genpm-find` — search → info → dry run → confirmation → install.
- `genpm-integrate` — read `<d>/AGENTS.md` and wire the module into the app.

## MCP servers declared by packages

A package can declare the MCP servers it needs (for example Stripe's). They are **never** added silently: `genpm add` asks first, `--no-mcp` skips them, and you can add them later with `genpm mcp add <package>`. Secrets are referenced as environment variables (`${STRIPE_SECRET_KEY}` in `.mcp.json`, `${env:STRIPE_SECRET_KEY}` in Cursor and VS Code), never written as values.

## Troubleshooting

- **The client does not see the tools**: restart the client after changing its config; check that `genpm mcp serve` starts in a terminal (it waits for input; stop it with Ctrl+C).
- **`genpm` not found by the client**: some apps do not read your shell `PATH`. Use the absolute path as the command: `which genpm` prints it on macOS and Linux (for example `/Users/you/.genpm/bin/genpm`), `where.exe genpm` on Windows.
- **Telemetry**: set `GENPM_TELEMETRY=0` (or `DO_NOT_TRACK=1`) in the server `env`.
- **Another registry**: set `GENPM_REGISTRY` in the server `env`.
