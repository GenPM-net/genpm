# @core/email

[![genpm](https://api.genpm.net/v1/badge/@core/email.svg)](https://genpm.net/p/@core/email) ![license](https://img.shields.io/badge/license-MIT-blue)

> Transactional email with typed React Email templates: Resend, SMTP or console in dev

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/email`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/email
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/email`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/email with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Transactional email with typed templates: `sendEmail('welcome', { to, props })`. Providers: Resend (default), SMTP
(optional, via `nodemailer`) and a console provider for development. Templates use React Email. No marketing lists,
no queues, no tracking pixels.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/email/AGENTS.md` and can do them for you):

1. Env: `EMAIL_FROM` (`"App <hello@yourdomain.com>"`) and `RESEND_API_KEY` (verify the domain in Resend first).
   Without `RESEND_API_KEY`, outside production, emails are printed to the console. In production (`next start`) that
   fallback throws so mail is never lost silently; set `EMAIL_PROVIDER=console` to print them there too (local tests).
   Optional `APP_NAME`: brand name shown in the email layout (default `App`).
   `@types/react` is only needed at build time: move it to devDependencies if GenPM added it to dependencies.
   SMTP instead: `EMAIL_PROVIDER=smtp`, `SMTP_URL=smtps://user:pass@host:465` and install `nodemailer`.
2. Send from server code only:
   ```ts
   import { sendEmail } from './lib/email/index.ts';
   await sendEmail('welcome', { to: user.email, props: { name: user.name, appUrl: 'https://app.example.com' } });
   ```
3. With `@core/auth` (≥ 1.1.0): send `welcome` from its `onLogin` hook when `isNewUser` is true:
   ```ts
   app.route('/auth', authRoutes({
     onLogin: ({ user, isNewUser }) =>
       isNewUser && user.email ? sendEmail('welcome', { to: user.email, props: { name: user.name, appUrl: process.env.APP_URL ?? '' } }).then(() => undefined) : undefined,
   }));
   ```
4. Verify: run the app without `RESEND_API_KEY` and check the console output.

## What's inside

Paths are relative to `src/lib/email`.

- `index.ts` — public API: `sendEmail`, `renderEmail`, `setEmailProvider`, provider factories, `TemplateProps`.
- `send.ts` — the template registry (`templates`) and `sendEmail`.
- `templates/*.ts` — `welcome`, `magicLink`, `receipt`, plus the shared `layout.ts`.
- `providers.ts` — `EmailProvider` interface and implementations.

## At a glance

- **npm dependencies** (proposed, never installed without asking): `resend`, `@react-email/components`, `@react-email/render`, `react`, `@types/react`
- **Environment variables** (added to `.env.example`): `RESEND_API_KEY`, `EMAIL_FROM`, `APP_NAME`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/email`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
