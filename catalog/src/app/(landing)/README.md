# @core/kit-landing

[![genpm](https://api.genpm.net/v1/badge/@core/kit-landing.svg)](https://genpm.net/p/@core/kit-landing) ![license](https://img.shields.io/badge/license-MIT-blue)

> Landing page kit for Next.js: block-built pages, lead forms, cookie banner and consent-gated pixels with dedup

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/app/(landing)`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/kit-landing
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/kit-landing`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/kit-landing with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Conversion landing pages on top of @core/kit-cms: the `landings` collection (blocks, SEO, minimal layout without
site navigation, conversion goal, thank-you page) served at `/lp/<slug>`, lead forms that store the submission with
its UTM parameters and fire one deduplicated `lead` event (server + browser with the same `eventId`, only with
consent), a cookie banner, consent-gated GA4/Meta/TikTok pixels and a real-deadline countdown block.
A/B tests with @core/experiments: a landing can name an experiment and show `blocksB` to variant `b`.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/app/(landing)/AGENTS.md` and can do them for you):

1. @core/kit-cms must be integrated first.
2. Add the lines of `_templates/genpm.md` to the project's `src/genpm/*.ts` (it says which file and where): the
   landings collection and lead event, the `countdown` block, the sitemap source and the admin resource and widget.
   Lines marked "A/B tests (optional)" are only needed for step 5.
3. Root layout: render `<SiteTracking policyHref="/cookies" />` at the end of `<body>`, and add `className="site-chrome"`
   to the site header and footer so minimal landings can hide them. Add `<CookieSettingsButton />` (@core/consent/react, a client
   component that calls `openConsentPreferences()`) in the footer.
4. Env (all optional; a platform is active only when configured): public ids `GA4_MEASUREMENT_ID`, `META_PIXEL_ID`,
   `TIKTOK_PIXEL_ID` and the server tokens described in src/lib/pixels/AGENTS.md. Bump `CONSENT_POLICY_VERSION`
   when the cookie policy changes (everyone is asked again).
5. A/B tests (optional): set `EXPERIMENTS_SECRET`, add the "A/B tests (optional)" lines of `_templates/genpm.md`, run the
   kit-cms `setup-schedules.ts` again (schedules `experiments.prune`), create an experiment
   with variants `a` (control) and `b` and goal `lead`, then set its key and the "variant B" sections on the landing.
6. Give editors the `landings:*` permission if they should manage landings (`defineRole`, @core/rbac).
7. Verify: create a landing with a hero and a form block, submit it with UTM parameters, see the submission with
   its UTM in Admin → Submissions, and the `Lead` event in each platform's test tool after accepting cookies.

## What's inside

Paths are relative to `src/app/(landing)`.

- `_templates/genpm.md` — the exact lines this kit adds to the project's `src/genpm/*.ts` (generated, always current).
- `lp/[slug]/page.tsx` — landing. `lp/[slug]/lead/[formKey]/route.ts` — form posts. `lp/[slug]/thanks/page.tsx` — thank-you + browser event.
- `api/consent/route.ts` — saves the banner choice and deletes cookies of rejected categories.
- `_lib/landings.ts` — collection and `landingPath`. `_lib/conversion.ts` — lead handling and the `landing.lead-event` job.
- `_components/site-tracking.tsx` — `<SiteTracking />` (banner + pixels) for the root layout. `_blocks/countdown.tsx`.
- `_lib/widgets.ts` — "Leads by landing (7 days)" dashboard widget.

## At a glance

- **GenPM dependencies** (installed with it): [@core/kit-cms](https://genpm.net/p/@core/kit-cms), [@core/consent](https://genpm.net/p/@core/consent), [@core/pixels](https://genpm.net/p/@core/pixels), [@core/experiments](https://genpm.net/p/@core/experiments)
- **npm dependencies** (proposed, never installed without asking): `next`, `react`, `zod`
- **Environment variables** (added to `.env.example`): `GA4_MEASUREMENT_ID`, `META_PIXEL_ID`, `TIKTOK_PIXEL_ID`, `CONSENT_POLICY_VERSION`, `EXPERIMENTS_SECRET`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/app/(landing)`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
