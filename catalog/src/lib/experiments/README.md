# @core/experiments

[![genpm](https://api.genpm.net/v1/badge/@core/experiments.svg)](https://genpm.net/p/@core/experiments) ![license](https://img.shields.io/badge/license-MIT-blue)

> A/B tests with consent: stable assignment, conversion goals and results with significance, no extra cookies

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/experiments`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/experiments
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/experiments`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/experiments with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

A/B tests that respect consent. Visitors who accepted analytics cookies get a stable variant (deterministic hash of
the pseudonymous consent id, no extra cookie); everyone else always sees the control and nothing is stored.
Conversions are recorded once per visitor and goal; results show rates, lift, p-value and a 95 % confidence interval
(two-proportion z-test) and are frozen when the experiment stops. Tables: `experiments`, `experiment_participants`.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/experiments/AGENTS.md` and can do them for you):

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

## What's inside

Paths are relative to `src/lib/experiments`.

- `index.ts` — `getVariant`, `recordConversion`, `upsertExperiment`, `setExperimentStatus`, `experimentResults`, `experimentsAdminResource`, `pruneExperimentsJob`, `compare`.
- `react.ts` — `<Experiment name cookieHeader variants={{ a, b }} />` (server component).
- `stats.ts` — statistics without dependencies. `schema.ts` — tables.

## At a glance

- **GenPM dependencies** (installed with it): [@core/db](https://genpm.net/p/@core/db), [@core/consent](https://genpm.net/p/@core/consent), [@core/contracts](https://genpm.net/p/@core/contracts), [@core/jobs](https://genpm.net/p/@core/jobs)
- **npm dependencies** (proposed, never installed without asking): `zod`, `react`
- **Environment variables** (added to `.env.example`): `EXPERIMENTS_SECRET`
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/experiments`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
