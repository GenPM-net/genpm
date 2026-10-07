# @core/consent — rules for AI agents

## Purpose
Cookie consent that meets GDPR/ePrivacy: categories (necessary always on; analytics, marketing, preferences off by
default), a banner where "Reject all" is as prominent as "Accept all", a preferences center, proof of each decision
(`consent_records`: choices, policy version, date; no IP), server checks (`hasConsent`), a client `ConsentGate` and
Google Consent Mode v2 values. Changing `CONSENT_POLICY_VERSION` asks everyone again.

## Map
- `index.ts` — server API: `getConsent`, `hasConsent`, `recordConsent`, `consentModeDefaultsScript`, `consentHistory`, `cookieDomain`.
- `react.ts` — client: `ConsentBanner`, `ConsentGate`, `CookieSettingsButton`, `openConsentPreferences`, `readClientConsent`, `currentPolicyVersion`.
- `adapters/hono.ts` — `consentRoutes()`. `adapters/next.ts` — `consentRoute()` → `{ GET, POST }`.

## Integration
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

## Conventions
- Labels must be translated (`labels` prop); keep both main buttons equal in style and size.
- The consent cookie is first-party, not HttpOnly (scripts must read it), and holds no personal data.
- Keep the cookie policy page listing every cookie per category.

## Don't
- Don't pre-check categories, use "scroll means consent" or hide "Reject all" behind extra clicks.
- Don't load analytics/marketing scripts outside `ConsentGate`, or send hit data server-side without consent.
- Don't block the site behind the banner (cookie walls).
