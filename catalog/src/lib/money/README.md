# @core/money

[![genpm](https://api.genpm.net/v1/badge/@core/money.svg)](https://genpm.net/p/@core/money) ![license](https://img.shields.io/badge/license-MIT-blue)

> Money in integer minor units: ISO currencies, safe parsing, rounding, lossless allocation, charm prices, formatting

A [GenPM](https://genpm.net) module: **source code + AI rules + MCP config**, injected into your project instead of hidden in `node_modules`. The code lands in `src/lib/money`, pinned to a verified commit, and you own it.

## Install

```bash
genpm add @core/money
```

No genpm yet? `curl -fsSL https://genpm.net/install.sh | sh` (macOS/Linux), `irm https://genpm.net/install.ps1 | iex` (Windows), or one-off with `npx @genpm-net/cli add @core/money`.

Or let your AI agent do it: run `genpm mcp setup` once, then ask *"add @core/money with genpm"* in Claude Code, Cursor, VS Code, Windsurf, Codex or Gemini CLI. It shows you a dry-run plan before writing anything.

## What it does

Money as `{ amount, currency }` with `amount` an integer of minor units (cents) and an ISO 4217 code, so commerce
modules never use floats. Parsing from decimal strings, safe arithmetic that refuses mixed currencies, rounding,
percentages, lossless allocation (splitting a discount across lines), charm prices (`.99`, never below the input; `…9` in zero-decimal currencies), formatting with `Intl`
and conversion with a rates table. Pure functions: no tables, no network.

## Setup

After `genpm add`, follow these steps (your AI agent finds the same steps in `src/lib/money/AGENTS.md` and can do them for you):

1. Nothing to configure. Store money in two columns: `amount integer` (minor units) and `currency text`.
2. User input: `parseMoney('19,99', 'EUR')` (never `Number(input) * 100`).
3. Display: `format(price, locale)`; APIs/JSON-LD: `toDecimalString(price)`.
4. Split amounts: `allocate(discount, lines.map((l) => l.subtotal.amount))`.
5. Verify: `add(money(1, 'EUR'), money(1, 'USD'))` throws.

## What's inside

Paths are relative to `src/lib/money`.

- `index.ts` — public API: `money`, `parseMoney`, `add`, `sub`, `sum`, `multiply`, `percent`, `allocate`, `charmPrice`, `format`, `toDecimalString`, `convert`, `currencyDecimals`.
- `money.ts` — implementation. The `Money` type comes from @core/contracts.

## At a glance

- **GenPM dependencies** (installed with it): [@core/contracts](https://genpm.net/p/@core/contracts)
- **AI rules**: [`AGENTS.md`](AGENTS.md), loaded by your agent only when it works in `src/lib/money`

## Security

GenPM installs a 40-character commit SHA (never a branch), verifies an Ed25519-signed manifest, never runs install scripts and scans AI rules for prompt injection. Details: [genpm.net/docs/security](https://genpm.net/docs/security).

## License

MIT — see [LICENSE](LICENSE). Browse the full catalog at [genpm.net](https://genpm.net).
