# Envíos que requieren formulario web (texto listo para pegar)

Ninguno admite PR ni API: hay que enviarlos desde el navegador con tu cuenta. Orden por impacto.

## 1. Directorio oficial de plugins de Claude Code (aparece en `/plugin → Discover`)

Formulario: https://clau.de/plugin-directory-submission

- **Plugin name:** genpm
- **Repository / marketplace:** https://github.com/GenPM-net/genpm (marketplace en `.claude-plugin/marketplace.json`, plugin en `plugins/claude-code`)
- **Install:** `claude plugin marketplace add GenPM-net/genpm` → `claude plugin install genpm@genpm`
- **Short description:** Add full modules (auth, Stripe subscriptions, email, AI chat, store, blog…) to any project as source code you own, with their AI rules and MCP config, pinned to a verified commit.
- **What it contains:** one skill (when and how to use GenPM: search → info → dry-run plan → install → follow AGENTS.md) and the GenPM MCP server (`npx -y @genpm-net/mcp`). ~120 tokens always-on.
- **Security:** installs a 40-char commit SHA verified against an Ed25519-signed manifest, never runs install scripts, scans AI rules for prompt injection, asks before MCP config or npm installs. https://genpm.net/docs/security
- **License:** MIT · **Contact:** yohangelr@gmail.com

## 2. Glama (lo exige el PR a punkpeye/awesome-mcp-servers #16283)

https://glama.ai/mcp/servers → "Add server" con GitHub → repo `GenPM-net/genpm` (subcarpeta `packages/mcp`).
Cuando pase sus comprobaciones, añadir su badge al PR si lo piden.

## 3. mcpservers.org (wong2/awesome-mcp-servers no acepta PRs)

https://mcpservers.org/submit
- **Name:** GenPM · **URL:** https://github.com/GenPM-net/genpm/tree/main/packages/mcp
- **Description:** Package manager for AI agents: search, inspect and inject full source modules (auth, Stripe billing, email, AI chat…) with their AGENTS.md rules and MCP config, pinned to a verified Git commit. `npx -y @genpm-net/mcp`
- **Category:** Developer Tools

## 4. Plantillas de Vercel

https://vercel.com/templates → "Submit a template" con `https://github.com/GenPM-net/saas-starter`.
- **Title:** Next.js SaaS Starter (GenPM)
- **Description:** GitHub login, Stripe subscriptions, plan gating and transactional email on Next.js 16 + Postgres/Drizzle. All backend code is plain TypeScript in src/lib, installed with GenPM.
- **Framework:** Next.js · **Use case:** SaaS, Starter, Authentication, Payments · **Database:** Postgres
- **Screenshot:** https://github.com/GenPM-net/saas-starter/blob/main/docs/screenshot.jpg

## 5. Google Search Console

https://search.google.com/search-console → propiedad de dominio `genpm.net` (registro TXT en Cloudflare) → enviar
`https://genpm.net/sitemap.xml`. Bing/Yandex ya reciben las URLs por IndexNow; Google no usa IndexNow.

## 6. awesome-claude-code (a partir del 17-10, el repo ya tiene 14 días)

Solo con su formulario de issue en la web: https://github.com/hesreallyhim/awesome-claude-code/issues/new/choose
Recomendar **una** cosa: el plugin de GenPM (texto del punto 1).
