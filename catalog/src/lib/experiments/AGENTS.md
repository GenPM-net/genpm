# @core/experiments — rules for AI agents

## Purpose
A/B tests that respect consent. Visitors who accepted analytics cookies get a stable variant (deterministic hash of
the pseudonymous consent id, no extra cookie); everyone else always sees the control and nothing is stored.
Conversions are recorded once per visitor and goal; results show rates, lift, p-value and a 95 % confidence interval
(two-proportion z-test) and are frozen when the experiment stops. Tables: `experiments`, `experiment_participants`.

## Map
- `index.ts` — `getVariant`, `recordConversion`, `upsertExperiment`, `setExperimentStatus`, `experimentResults`, `experimentsAdminResource`, `pruneExperimentsJob`, `compare`.
- `react.ts` — `<Experiment name cookieHeader variants={{ a, b }} />` (server component).
- `stats.ts` — statistics without dependencies. `schema.ts` — tables.

## Integration
1. Requires @core/consent (the banner) and its cookie. Env: `EXPERIMENTS_SECRET` (≥ 32 random chars).
2. Migrations as in `src/lib/db/AGENTS.md`. Add `experimentsAdminResource` to `src/genpm/admin.ts` (with kit-landing:
   its "A/B tests (optional)" lines).
3. Create the experiment in the admin (key, goal, variants: the first is the control), then press "Start".
4. Render: `const { variant } = await getVariant('hero-test', cookieHeader)` (cookie header of the request) and show
   the matching content; or `<Experiment name="hero-test" cookieHeader={…} variants={{ a: <A />, b: <B /> }} />`.
5. Conversion: where the goal happens on the server, `await recordConversion('lead', req.headers.get('cookie'))`.
6. Schedule `experiments.prune` daily (@core/jobs `schedule`) to delete participants 30 days after an experiment stops
   (with kit-cms, its `setup-schedules.ts` does it).
7. Verify: with analytics accepted the same browser always sees the same variant; with cookies rejected, always the control.

## Conventions
- Decide only when `significant` is true and the test ran at least one or two full weeks (weekday effects).
- Change one thing per experiment; don't edit variants or weights while it runs (blocked; stop and create a new one).

## Don't
- Don't assign or record visitors without analytics consent, and don't store emails or ids in experiments.
- Don't stop a test early because one variant "looks better" (peeking inflates false positives).
- Don't use experiments to show different prices to different people.
