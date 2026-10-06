# @core/antispam — rules for AI agents

## Purpose
Protects public endpoints that write (forms, comments, newsletter, login): honeypot field, signed minimum-time token,
captcha (Cloudflare Turnstile or hCaptcha, optional) and fixed-window rate limits stored in Postgres with HMAC-hashed
keys (no plain IPs or emails). Not a WAF or DDoS protection. Table: `rate_limits`.

## Map
- `index.ts` — public API: `verifyHuman`, `rateLimit`, `formTimingToken`, `honeypotProps`, `verifyCaptcha`, `clientIp`, `pruneRateLimits`.
- `verify.ts` — the full check. `checks.ts` — individual checks. `rate-limit.ts` — limiter. `schema.ts` — table.

## Integration
1. Env: `ANTISPAM_SECRET` (≥ 32 random chars). Optional captcha: `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`
   (or `HCAPTCHA_SECRET_KEY`). Generate and apply migrations (see `src/lib/db/AGENTS.md`).
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

## Conventions
- Every public write endpoint calls `verifyHuman` (or at least `rateLimit`) with its own `scope`.
- Show users a generic error; don't reveal which check failed beyond "try again later".
- `clientIp` is only reliable behind a proxy that sets the headers; use it for limits, never for authorization.

## Don't
- Don't store raw IPs, emails or captcha tokens; `rateLimit` already hashes keys.
- Don't hide the honeypot with `type="hidden"` (bots skip those); use `honeypotProps`.
- Don't skip the captcha check when the provider is down: `verifyCaptcha` fails closed on purpose.
