# @core/antispam

[![genpm](https://api.genpm.net/v1/badge/@core/antispam.svg)](https://genpm.net/p/@core/antispam) ![license](https://img.shields.io/badge/license-MIT-blue)

> Spam protection for public forms: honeypot, signed timing, Turnstile or hCaptcha and Postgres rate limits

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/antispam`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/antispam
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/antispam`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/antispam with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Protects public endpoints that write (forms, comments, newsletter, login): honeypot field, signed minimum-time token,
captcha (Cloudflare Turnstile or hCaptcha, optional) and fixed-window rate limits stored in Postgres with HMAC-hashed
keys (no plain IPs or emails). Not a WAF or DDoS protection. Table: `rate_limits`.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/antispam/AGENTS.md` and can do them for you):

1. Env: `ANTISPAM_SECRET` (≥ 32 random chars). Optional captcha: `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
   (or `HCAPTCHA_SECRET_KEY`). Generate and apply migrations (see `src/lib/db/AGENTS.md`).
   Client IP source (rate limits): by default the right-most `x-forwarded-for` hop, skipping
   `ANTISPAM_TRUSTED_PROXIES - 1` more hops (default `1`: the address your last proxy saw). Behind a platform that sets
   a dedicated header, set `ANTISPAM_IP_HEADER` (`cf-connecting-ip` on Cloudflare, `x-vercel-forwarded-for` on Vercel,
   `x-real-ip`, `fly-client-ip`…). Platform headers are never trusted unless configured: clients can send them.
2. When rendering the form (server), add two fields:
   `<input {...honeypotProps} />` and `<input type="hidden" name="_ts" value={await formTimingToken()} />`.
   With Turnstile, also render its widget (`<div class="cf-turnstile" data-sitekey={TURNSTILE_SITE_KEY}>` and its script).
3. In the handler, before doing anything else:
   ```ts
   const check = await verifyHuman(request.headers, formData, { scope: 'forms:contact' });
   if (!check.ok) return Response.json({ error: check.reason }, { status: check.reason === 'rate_limited' ? 429 : 400 });
   ```
4. Per-account limits (login, password reset): `await rateLimit(`login:${email}`, { limit: 5, windowMs: 900_000 })`.
5. Schedule `pruneRateLimits()` daily (e.g. with @core/jobs).
6. Verify: submitting within 2 s or with the honeypot filled is rejected; a normal submission passes.

## What's inside

Paths are relative to `src/lib/antispam`.

- `index.ts` — public API: `verifyHuman`, `rateLimit`, `formTimingToken`, `honeypotProps`, `verifyCaptcha`, `clientIp`, `pruneRateLimits`.
- `verify.ts` — the full check. `checks.ts` — individual checks. `rate-limit.ts` — limiter. `schema.ts` — table.
- `react.ts` — `<AntispamFields />` (async server component) with the honeypot and the signed timing field for HTML forms.

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db)
- **npm dependencies** (proposed, never installed without asking): `react`
- **Environment variables** (added to `.env.example`): `ANTISPAM_SECRET`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `ANTISPAM_IP_HEADER`, `ANTISPAM_TRUSTED_PROXIES`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/antispam`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
