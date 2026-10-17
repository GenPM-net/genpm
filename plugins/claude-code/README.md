# GenPM for Claude Code

Add complete, production-ready modules to your project instead of writing them from scratch: authentication with
GitHub/Google OAuth, Stripe subscriptions, transactional email, AI chat, file storage, background jobs, search, forms,
newsletter, SEO, and whole app sections such as an online store, a blog, a CMS, a landing page or a dropshipping store.

GenPM injects each module as **source code you own** (for example `src/lib/auth`), pinned to a 40-character Git commit
and verified against an Ed25519-signed manifest. Every module ships an `AGENTS.md` with its integration steps, and this
plugin teaches Claude to use them: search the registry, show you a dry-run plan, install only after you agree, then
follow the module's integration section.

## What the plugin contains

- **Skill `genpm`**: tells Claude when GenPM is the right tool and the safe workflow (search → info → dry-run plan →
  install with your consent → integrate → type-check).
- **MCP server `genpm`**: the official GenPM MCP server, `npx -y @genpm-net/mcp@0.2.0`, with tools such as
  `genpm_search`, `genpm_info`, `genpm_add` (with `dryRun`), `genpm_list`, `genpm_outdated`, `genpm_update` and
  `genpm_remove`. Source: [packages/mcp](https://github.com/GenPM-net/genpm/tree/main/packages/mcp).

## What it runs, sends and fetches

- It runs the MCP server above through `npx`, which downloads `@genpm-net/mcp` from the npm registry.
- It talks to the GenPM registry at `https://api.genpm.net` to search packages and resolve versions.
- It downloads module source code from the module's public Git repository (GitHub) at the pinned commit, or from the
  registry's signed archive copy if that repository is unavailable.
- When a module is installed, the registry records an anonymous event with only the package name, version, client
  (`mcp`), CLI version and country. Set `GENPM_TELEMETRY=0` or `DO_NOT_TRACK=1` to send nothing.
- It writes files only inside your project, never runs install scripts from modules, and asks before adding MCP servers
  or running your package manager. It never reads `.env` values.

Security model: [genpm.net/docs/security](https://genpm.net/docs/security) · Catalog: [genpm.net](https://genpm.net)

## License

MIT, see [LICENSE](LICENSE).
