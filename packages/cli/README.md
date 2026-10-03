# genpm

**Install architectures, not dependencies.** Inject complete modules — source code + AI rules + MCP config — into your project from immutable Git commits.

![genpm add](https://raw.githubusercontent.com/genpm-net/genpm/main/docs/design/brand/readme-hero.svg)

```bash
curl -fsSL https://genpm.net/install.sh | sh     # macOS / Linux
irm https://genpm.net/install.ps1 | iex          # Windows (PowerShell)

genpm add @core/auth
```

The recommended install is the native binary: no Node.js needed, and `genpm upgrade` keeps it current. This npm package is the same CLI for Node 20.11+ users: `npm i -g genpm`, or `npx genpm add @core/auth` without installing (handy in CI). git 2.25+ is recommended; without it GenPM falls back to GitHub tarballs.

## Commands

| Command | What it does |
|---|---|
| `genpm add <spec…>` | Plan and inject packages and their GenPM dependencies. Shows the plan and asks first. |
| `genpm search <query>` | Search the registry. |
| `genpm info <name>` | Manifest, dependencies, env vars, MCP servers and AI rules (`--rules`). |
| `genpm list` | Installed packages and local changes. |
| `genpm remove <name>` | Remove a package; refuses to delete code you modified unless `--keep-code` or `--force`. |
| `genpm outdated` | Newer versions (`--exit-code` for CI). |
| `genpm audit` | Integrity, signatures, advisories and yanked versions. |
| `genpm doctor` | Check your environment and project. |
| `genpm mcp setup` | Register the GenPM MCP server in your AI client. |
| `genpm mcp serve` | Run the MCP server over stdio (native binary only; from npm use `npx -y @genpm/mcp`). |
| `genpm upgrade` | Update the native binary (`--check` to only look). |
| `genpm init` · `validate` · `publish` · `yank` | Author a package. |

Global flags: `--json` (single-line JSON, English), `--yes`, `--lang <locale>`, `--cwd <dir>`, `--registry <url>`, `--verbose`, `--quiet`. Output is available in English, Spanish, Portuguese (Brazil), French, German, Japanese, Simplified Chinese and Korean.

## Safety

GenPM never runs package code or install scripts, pins every package to a verified commit SHA, only installs registry-signed manifests, writes only inside your project, and never adds MCP servers or npm packages without your consent.

Docs: [genpm.net/docs](https://genpm.net/docs) · Security: [genpm.net/security](https://genpm.net/security) · License: MIT
