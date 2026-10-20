# Reddit (y foros parecidos)

Reglas que hay que cumplir para que no te borren el post ni te marquen como spam:
- Publica desde tu cuenta personal, en primera persona, y quédate a responder las primeras 2 horas.
- Un subreddit por día como mucho, y no copies el mismo texto: cada comunidad pregunta cosas distintas.
- Lee las reglas de autopromoción de cada sub antes de publicar. En r/nextjs y r/webdev la autopromoción va en los
  hilos semanales ("Weekly Showoff" / "Showoff Saturday"); en r/ClaudeAI y r/cursor se acepta si aporta algo útil.
- Enlaza a una guía concreta, no a la portada: convierte mejor y parece menos anuncio.

---

## r/ClaudeAI — flair "Built with Claude" o "MCP"

**Título:** I gave Claude Code a package manager for whole backend modules (auth, Stripe, email) via MCP

> I kept watching Claude Code rewrite GitHub login and Stripe webhooks from scratch in every project, each time a bit
> differently. So I built GenPM: an MCP server + CLI that lets the agent search a registry of modules, show you the
> exact files and rules, and inject them into `src/` as plain source code, pinned to a commit.
>
> Each module ships an `AGENTS.md` that Claude reads only when it works in that folder, so it integrates the module the
> way the author intended instead of improvising. External MCP servers a module needs (e.g. Stripe's) are only added
> after you say yes. No install scripts, ever.
>
> Setup: `claude mcp add genpm -- npx -y @genpm-net/mcp`, then ask "add GitHub login to this project with genpm".
>
> Guide: https://genpm.net/docs/ai-agent-installs-modules
>
> It's free and MIT. I'd love feedback on what modules you keep asking Claude to write over and over.

## r/cursor

**Título:** Stop letting Cursor improvise your auth: install a reviewed module it already knows how to integrate

> Same idea as shadcn/ui, but for backend modules: GenPM copies a full module (code, tables, routes) into your repo and
> adds a `.cursor/rules/genpm-*.mdc` scoped to that folder, so Cursor follows the module's own integration steps.
>
> `.cursor/mcp.json`: `{ "mcpServers": { "genpm": { "command": "npx", "args": ["-y", "@genpm-net/mcp"] } } }`
> then "add Stripe subscriptions with genpm".
>
> Comparison with npm packages and copy-paste: https://genpm.net/docs/shadcn-for-backend
>
> Free, MIT, 48 modules so far (Next.js and Hono). What would you want in it next?

## r/nextjs — solo en el hilo semanal de autopromoción

> **GenPM** — add GitHub login (`@core/auth`) or Stripe subscriptions (`@core/billing`) to a Next.js App Router project
> as source code you own, with one command: `npx @genpm-net/cli add @core/auth`.
> Step-by-step: https://genpm.net/docs/nextjs-github-login · Template with both wired: https://github.com/GenPM-net/saas-starter

## r/SideProject

**Título:** I built a package manager that installs whole modules as source code, for people who build with AI agents

> (Mismo texto base que r/ClaudeAI, contado como historia: el problema que tenías, qué construiste, qué has aprendido y
> qué necesitas ahora: feedback y los primeros usuarios. Añade el vídeo de la demo de restaurante o de dropshipping.)

## Español — r/programacion, Discord de midudev, Telegram de dev

> Hice GenPM: en vez de pedirle a tu IA que reescriba el login o los cobros con Stripe en cada proyecto, instala un
> módulo completo como código fuente en `src/` (tuyo, lo ves en el diff), fijado a un commit y con las instrucciones
> para que tu agente lo integre bien.
>
> `npx @genpm-net/cli add @core/auth` → login con GitHub en Next.js. Guía paso a paso:
> https://genpm.net/es/docs/nextjs-github-login
>
> Es gratis y MIT. ¿Qué módulo te gustaría que existiera?

---

**Cómo medirlo:** el panel /admin/analytics muestra los referentes (`reddit.com`, `news.ycombinator.com`) y las
instalaciones por día. Mira el día siguiente, no a los 5 minutos: Analytics Engine tarda unos 20 minutos en ingerir.
