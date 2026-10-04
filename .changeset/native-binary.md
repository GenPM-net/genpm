---
"genpm": minor
"@genpm/core": minor
"@genpm/manifest": minor
"@genpm/i18n": minor
"@genpm-net/mcp": minor
---

Native `genpm` binary for macOS, Linux and Windows (no Node.js needed), one-line installers (`curl -fsSL https://genpm.net/install.sh | sh`, `irm https://genpm.net/install.ps1 | iex`) and `genpm upgrade`, which verifies the SHA-256 of each release before replacing itself. New error codes: `E_UPGRADE_UNSUPPORTED`, `E_UPGRADE_PERMISSION`, `E_UPGRADE_INTEGRITY`.

The MCP server is built into the binary too: `genpm mcp serve`, which `genpm mcp setup` registers when GenPM runs as the native binary (no Node.js or npx). `@genpm-net/mcp` now exports `serveStdio()` from `@genpm-net/mcp/serve`. `genpm init --workflow` installs the binary in CI instead of using npx.
