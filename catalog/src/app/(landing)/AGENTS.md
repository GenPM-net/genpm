# @core/kit-landing — rules for AI agents

## Purpose
Conversion landing pages on top of @core/kit-cms: the `landings` collection (blocks, SEO, minimal layout without
site navigation, conversion goal, thank-you page) served at `/lp/<slug>`, lead forms that store the submission with
its UTM parameters and fire one deduplicated `lead` event (server + browser with the same `eventId`, only with
consent), a cookie banner, consent-gated GA4/Meta/TikTok pixels and a real-deadline countdown block.
A/B tests with @core/experiments: a landing can name an experiment and show `blocksB` to variant `b`.

## Map
- `_templates/genpm.md` — the exact lines this kit adds to the project's `src/genpm/*.ts` (generated, always current).
- `lp/[slug]/page.tsx` — landing. `lp/[slug]/lead/[formKey]/route.ts` — form posts. `lp/[slug]/thanks/page.tsx` — thank-you + browser event.
- `api/consent/route.ts` — saves the banner choice and deletes cookies of rejected categories.
- `_lib/landings.ts` — collection and `landingPath`. `_lib/conversion.ts` — lead handling and the `landing.lead-event` job.
- `_components/site-tracking.tsx` — `<SiteTracking />` (banner + pixels) for the root layout. `_blocks/countdown.tsx`.
- `_lib/widgets.ts` — "Leads by landing (7 days)" dashboard widget.

## Integration
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

## Conventions
- One conversion goal per landing; the form block's form decides what is collected.
- Hero images: the first block gets `fetchPriority="high"`; keep LCP under 2.5 s on mobile.
- Lead events carry no personal data in the browser; the server event sends only hashed identifiers (@core/pixels).

## Don't
- No fake urgency: countdowns only with the real end date of a real offer (they disappear afterwards and never reset);
  "only X left" only with real stock (EU Directive 2005/29/EC, DSA).
- Testimonials, ratings and numbers only from real data the person provides; if missing, leave the block out and say so.
- Never load a pixel outside `ConsentGate`, never pre-tick consent boxes, never fire `lead` without a stored submission.
