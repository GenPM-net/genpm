# Show HN

**Título** (≤ 80 caracteres):

> Show HN: GenPM – a package manager that injects source code, AI rules and MCP into your repo

**URL:** https://genpm.net

**Primer comentario (del autor):**

> Hi HN, I'm Yohangel. GenPM installs full modules (auth, billing, email, AI chat…) as source code into your project
> instead of node_modules, pinned to a Git commit.
>
> Each package ships AI rules (an AGENTS.md) that load only when your agent works in that folder, plus the MCP servers
> it needs, which are only added with your consent. The registry stores only metadata; code comes straight from GitHub
> and the CLI verifies the commit SHA and an Ed25519 signature of the manifest. There are no postinstall scripts.
>
> Try it:
>
>     npx @genpm-net/cli add @core/billing      # billing + auth + db, ~1 s
>
> or let your agent do it: `genpm mcp setup` registers the MCP server in Claude Code, Cursor, VS Code, Windsurf,
> Codex or Gemini CLI, and then "add GitHub login and Stripe subscriptions" searches, shows you a dry-run plan and
> installs.
>
> The catalog has 48 MIT packages today: building blocks (auth, rbac, billing, stripe, email, storage, jobs, search…)
> and kits that compose them into a whole app — `@core/kit-store`, `kit-blog`, `kit-cms`, `kit-landing`,
> `kit-dropshipping`. Publishing your own takes a public GitHub repo, a genpm.json and a tag — the web wizard at
> genpm.net/publish checks what's missing and prefills the files.
>
> What I'd love feedback on: the security model (docs at genpm.net/docs/security), and whether "own the code, keep
> an upgrade path" is the right trade-off vs. regular dependencies. Updating modified modules (3-way merge assisted by
> your agent) is next.
