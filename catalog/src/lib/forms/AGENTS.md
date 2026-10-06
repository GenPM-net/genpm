# @core/forms — rules for AI agents

## Purpose
Contact and lead forms end to end: forms defined in code (`defineForm` with zod) or built by editors in the admin
(`forms` content collection), anti-spam (@core/antispam), GDPR consent with a versioned text, stored submissions with
source page and campaign parameters, and background processing (@core/jobs): team alert email, auto-reply,
HMAC-signed webhook and `onSubmission` handlers. CSV export, retention and erasure helpers. Table: `form_submissions`.

## Map
- `index.ts` — public API: `defineForm`, `submitForm`, `onSubmission`, `formsAdminResources`, `exportSubmissionsCsv`, `pruneSubmissions`, `deleteSubmissionsByEmail`.
- `definitions.ts` — code and admin-built definitions. `submit.ts` — submission and the `forms.process` job. `admin.ts` — admin, CSV, privacy.
- `react.ts` — `<Form formKey searchParams>` (async server component; works without JavaScript).
- `adapters/hono.ts` — `formRoutes()`. `adapters/next.ts` — `formRoute` (POST; HTML posts get a 303 back to the page).

## Integration
1. Env: `EMAIL_FROM` (@core/email), optional `FORMS_NOTIFY_TO` (comma-separated default recipients) and `FORMS_WEBHOOK_SECRET` (≥ 32 chars, only with webhooks). Migrations as in `src/lib/db/AGENTS.md`; the @core/jobs cron must run.
2. Define code forms in a module imported at startup (e.g. `src/genpm/forms.ts`):
   `defineForm({ key: 'contact', label: 'Contact', schema: z.object({ name: z.string().min(1), email: z.email(), message: z.string().min(5) }), emailField: 'email', consent: { required: true, version: '2026-10', text: '…' } })`.
3. Mount `formRoutes()` or `formRoute` at `/api/forms/<key>` and render `<Form formKey="contact" searchParams={await searchParams} />`:
   it includes the anti-spam fields, the consent checkbox (never pre-checked) and shows the result after the 303.
   Custom markup: post to the same endpoint with `honeypotProps`, `_ts` and `consent`; JSON callers get `{ ok, reason, errors }`.
   In Next.js Server Actions call `submitForm(key, formData, { headers: await headers() })` instead.
4. Translate the messages with `labels` (keys: `formLabels`).
5. Add `...formsAdminResources()` to `src/genpm/admin.ts`.
6. Verify: submit the form, run the cron, the team receives the email and the submission appears in the admin.

## Conventions
- Field names are the keys stored in `data`; keep them stable (exports and webhooks depend on them).
- Webhook receivers must verify `x-genpm-signature` (`t=<unix>,v1=<hmac>` over `"<t>.<body>"`) and reject old timestamps.
- Ask only for the data you need; define a retention period and schedule `pruneSubmissions(days)`.
- Permissions: `submissions:read|update|delete|export`, `forms:*` for admin-built forms.

## Don't
- Don't send emails or call webhooks inside the request; `submitForm` queues them.
- Don't put submission values into HTML without escaping, or open CSV exports from other tools without the formula guard.
- Don't add hidden fields that collect data the user didn't type.
