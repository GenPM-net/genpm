# @core/consent — rules for AI agents

## Purpose
Cookie consent that meets GDPR/ePrivacy: categories (necessary always on; analytics, marketing, preferences off by
default), a banner where "Reject all" is as prominent as "Accept all", a preferences center, proof of each decision
(`consent_records`: choices, policy version, date; no IP), server checks (`hasConsent`), a client `ConsentGate` and
Google Consent Mode v2 values. Changing `CONSENT_POLICY_VERSION` asks everyone again.

## Map
- `index.ts` — server API: `getConsent`, `hasConsent`, `recordConsent`, `consentModeDefaultsScript`, `consentHistory`.
- `react.ts` — client: `ConsentBanner`, `ConsentGate`, `openConsentPreferences`, `readClientConsent`.
- `adapters/hono.ts` — `consentRoutes()`. `adapters/next.ts` — `consentRoute()` → `{ GET, POST }`.

## Integration
1. Env: `CONSENT_POLICY_VERSION` (bump it when the cookie policy changes). Migrations as in `src/lib/db/AGENTS.md`.
2. Mount `/api/consent` (pass `cookiesByCategory`, e.g. `{ analytics: ['_ga'], marketing: ['_fbp', '_ttp'] }`, so withdrawing deletes them).
3. Root layout: `<ConsentBanner policyVersion={…} policyHref="/legal/cookies" labels={translated} />` and a footer link calling `openConsentPreferences()`.
4. Wrap every analytics/marketing script: `<ConsentGate category="marketing">…</ConsentGate>`; on the server use `hasConsent(cookieHeader, 'analytics')`.
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
