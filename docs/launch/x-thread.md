# Hilo de X (6 posts)

**1/6** (grabación de pantalla de Claude Code o Cursor con el guion de [demo-script.md](demo-script.md), 26–55 s; mientras tanto `gifs/add.gif`)
> Tell your AI agent "add GitHub login and Stripe subscriptions".
> It searches GenPM, shows you a plan and injects the real source code into your repo — with rules it understands.
> No node_modules black box. 🧵

**2/6** (captura de `genpm.lock` o el final de `gifs/lock.gif`)
> Every module is pinned to a Git commit and the manifest is signed (Ed25519).
> `genpm audit` re-checks hashes, signatures and advisories. Same commit, same code, every time.

**3/6** (GIF `gifs/lock.gif`)
> Each package ships its own AGENTS.md. Your agent only loads it when it works in that folder:
> ~600 tokens per module instead of stuffing everything into one giant prompt.

**4/6**
> Some modules need an MCP server (billing → Stripe MCP).
> GenPM shows the exact command and only writes it to .mcp.json / .cursor/mcp.json if you say yes.
> No postinstall scripts. Ever.

**5/6** (captura de genpm.net/publish con todo en verde)
> Got a module you reuse in every project? Publish it in ~60 s:
> pick the repo at genpm.net/publish, it tells you what's missing and prefills genpm.json + AGENTS.md. Tag, publish, done.

**6/6**
> Free, public beta, works with Claude Code, Cursor, VS Code, Windsurf, Codex and Gemini CLI.
> curl -fsSL https://genpm.net/install.sh | sh
> https://genpm.net
