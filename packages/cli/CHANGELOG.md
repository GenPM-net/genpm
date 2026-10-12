# @genpm-net/cli

## 0.2.1

### Patch Changes

- 778b99e: Un servidor MCP declarado por varios paquetes (p. ej. `stripe` en `@core/billing` y `@core/stripe`) aparece una sola vez en el plan y se pregunta una sola vez.
- 564b772: `genpm add gh:owner/repo` without a ref, or with a branch (`#main`), now fails with `E_REF_MUTABLE` (exit 6) as the spec says, instead of a generic `E_USAGE`.

## 0.2.0

### Minor Changes

- 6d38c0d: `genpm compose <recipe>` installs every package of a recipe (registry name or local JSON file) with the same plan and questions as `genpm add`; `genpm compose --list` shows the registry's recipes. The MCP `genpm_add` tool accepts `recipe`.
- 6d3cc1a: Publish from GitLab CI with trusted publishing: `genpm publish` exchanges the `GENPM_ID_TOKEN` id_token, detects gitlab.com remotes (subgroups included) and installs GitLab packages via git or the SHA-pinned archive.
- 8be47ac: Native `genpm` binary for macOS, Linux and Windows (no Node.js needed), one-line installers (`curl -fsSL https://genpm.net/install.sh | sh`, `irm https://genpm.net/install.ps1 | iex`) and `genpm upgrade`, which verifies the SHA-256 of each release before replacing itself. New error codes: `E_UPGRADE_UNSUPPORTED`, `E_UPGRADE_PERMISSION`, `E_UPGRADE_INTEGRITY`.

  The MCP server is built into the binary too: `genpm mcp serve`, which `genpm mcp setup` registers when GenPM runs as the native binary (no Node.js or npx). `@genpm-net/mcp` now exports `serveStdio()` from `@genpm-net/mcp/serve`. `genpm init --workflow` installs the binary in CI instead of using npx.

- 24126ce: Organization policies: with `policy=<registry url>` in `.genpmrc`, installs outside the allowed packages, without a passed security scan, with a denied license or straight from Git fail with `E_POLICY`. Registry admins manage them with `genpm registry policy`; also `genpm registry domain|verify|audit`.
- fd26c10: Private registries: `genpm registry` (create, list, members), `genpm team` (organization teams) and `genpm access` (visibility and per-package grants).
- e5cb678: `genpm publish` en GitHub Actions usa trusted publishing (OIDC) cuando no hay `GENPM_TOKEN`, y `genpm init --workflow` genera el workflow con `id-token: write`.
- d729055: `genpm diff` y `genpm update` (merge de 3 vías que conserva tus cambios), y las herramientas MCP `genpm_diff` y `genpm_update` (`strategy: 3way | ai`).
- a8776da: Si el repositorio de un paquete desaparece o GitHub no responde, la instalación usa la copia firmada del registry (Verified Archive), verificando firma, sha256 y commit.

### Patch Changes

- 520ef62: `genpm add --dry-run` y la vista previa `dryRun` del MCP ya no cuentan como instalación (envían `client=none`).
