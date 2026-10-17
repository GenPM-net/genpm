# @core/consent

[![genpm](https://api.genpm.net/v1/badge/@core/consent.svg)](https://genpm.net/p/@core/consent) ![license](https://img.shields.io/badge/license-MIT-blue)

> GDPR cookie consent: banner with equal reject/accept, categories, proof records, ConsentGate and Google Consent Mode v2

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/consent`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/consent
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/consent`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/consent with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Cookie consent that meets GDPR/ePrivacy: categories (necessary always on; analytics, marketing, preferences off by
default), a banner where "Reject all" is as prominent as "Accept all", a preferences center, proof of each decision
(`consent_records`: choices, policy version, date; no IP), server checks (`hasConsent`), a client `ConsentGate` and
Google Consent Mode v2 values. Changing `CONSENT_POLICY_VERSION` asks everyone again.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/consent/AGENTS.md` and can do them for you):

1. Env: `CONSENT_POLICY_VERSION` (bump it when the cookie policy changes), `SITE_URL` (its host gives the registrable
   domain where third-party tags set their cookies: the last two labels) and, when that guess is wrong (e.g. `.co.uk`),
   `CONSENT_COOKIE_DOMAIN=example.co.uk`. Migrations as in `src/lib/db/AGENTS.md`.
2. Mount `/api/consent` (pass `cookiesByCategory`, e.g. `{ analytics: ['_ga'], marketing: ['_fbp', '_ttp'] }`, so withdrawing
   deletes them, host-only and on the registrable domain). The endpoint only accepts same-origin JSON POSTs (CSRF):
   a cross-site `Origin`/`Sec-Fetch-Site` gets 403 and other content types 415; the banner already posts that way.
3. Root layout: `<ConsentBanner policyVersion={policyVersion()} policyHref="/cookies" labels={translated} />` and in the footer
   `<CookieSettingsButton />` (a button that calls `openConsentPreferences()`). The banner also renders `<meta name="consent-policy-version">`: client checks
   treat a decision made under another version as undecided (everything off) until the visitor decides again.
4. Wrap every analytics/marketing script: `<ConsentGate category="marketing" policyVersion={policyVersion()}>…</ConsentGate>`
   (`policyVersion` is optional when the banner is on the page); on the server use `hasConsent(cookieHeader, 'analytics')`.
5. With Google tags, render `consentModeDefaultsScript(getConsent(cookieHeader))` inline before them.
6. Verify (browser devtools): before deciding, no request goes to third-party analytics or ad domains.

## What's inside

Paths are relative to `src/lib/consent`.

- `index.ts` — server API: `getConsent`, `hasConsent`, `recordConsent`, `consentModeDefaultsScript`, `consentHistory`, `cookieDomain`.
- `react.ts` — client: `ConsentBanner`, `ConsentGate`, `CookieSettingsButton`, `openConsentPreferences`, `readClientConsent`, `currentPolicyVersion`.
- `adapters/hono.ts` — `consentRoutes()`. `adapters/next.ts` — `consentRoute()` → `{ GET, POST }`.

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db)
- **npm dependencies** (proposed, never installed without asking): `zod`, `react`
- **Environment variables** (added to `.env.example`): `CONSENT_POLICY_VERSION`, `SITE_URL`, `CONSENT_COOKIE_DOMAIN`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/consent`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
