# @core/forms

[![genpm](https://api.genpm.net/v1/badge/@core/forms.svg)](https://genpm.net/p/@core/forms) ![license](https://img.shields.io/badge/license-MIT-blue)

> Forms and lead capture: code or admin-built forms, spam checks, GDPR consent, email alerts, signed webhooks, CSV

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/forms`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/forms
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/forms`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/forms with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Contact and lead forms end to end: forms defined in code (`defineForm` with zod) or built by editors in the admin
(`forms` content collection), anti-spam (@core/antispam), GDPR consent with a versioned text, stored submissions with
source page and campaign parameters, and background processing (@core/jobs): team alert email, auto-reply,
HMAC-signed webhook and `onSubmission` handlers. CSV export, retention and erasure helpers. Table: `form_submissions`.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/forms/AGENTS.md` and can do them for you):

1. Env: `EMAIL_FROM` (@core/email), optional `FORMS_NOTIFY_TO` (comma-separated default recipients) and `FORMS_WEBHOOK_SECRET` (≥ 32 chars, only with webhooks). Migrations as in `src/lib/db/AGENTS.md`; the @core/jobs cron must run.
2. Define code forms in a module imported at startup (e.g. `src/genpm/forms.ts`):
   `defineForm({ key: 'contact', label: 'Contact', schema: z.object({ name: z.string().min(1), email: z.email(), message: z.string().min(5) }), emailField: 'email', consent: { required: true, version: '2026-10', text: '…' } })`.
3. Mount `formRoutes()` or `formRoute` at `/api/forms/<key>` and render `<Form formKey="contact" searchParams={await searchParams} />`:
   it includes the anti-spam fields, the consent checkbox (never pre-checked) and shows the result after the 303
   (back to the page with `?form=<key>&form_status=sent|<reason>#form-<key>`: the form's `id` is `form-<key>`).
   Custom markup: post to the same endpoint with `honeypotProps`, `_ts` and `consent`; JSON callers get `{ ok, reason, errors }`.
   In Next.js Server Actions call `submitForm(key, formData, { headers: await headers() })` instead.
4. Translate the messages with `labels` (keys: `formLabels`).
5. Add `...formsAdminResources()` to `src/genpm/admin.ts`.
6. Verify: submit the form, run the cron, the team receives the email and the submission appears in the admin.

## What's inside

Paths are relative to `src/lib/forms`.

- `index.ts` — public API: `defineForm`, `submitForm`, `onSubmission`, `formsAdminResources`, `exportSubmissionsCsv`, `pruneSubmissions`, `deleteSubmissionsByEmail`.
- `definitions.ts` — code and admin-built definitions. `submit.ts` — submission and the `forms.process` job. `admin.ts` — admin, CSV, privacy.
- `react.ts` — `<Form formKey searchParams>` (async server component; works without JavaScript).
- `adapters/hono.ts` — `formRoutes()`. `adapters/next.ts` — `formRoute` (POST; HTML posts get a 303 back to the page).

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db), [@core/antispam](https://genpm.net/p/@core/antispam), [@core/email](https://genpm.net/p/@core/email), [@core/jobs](https://genpm.net/p/@core/jobs), [@core/content](https://genpm.net/p/@core/content), [@core/contracts](https://genpm.net/p/@core/contracts)
- **npm dependencies** (proposed, never installed without asking): `zod`
- **Environment variables** (added to `.env.example`): `FORMS_NOTIFY_TO`, `FORMS_WEBHOOK_SECRET`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/forms`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
