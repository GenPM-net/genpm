---
title: genpm.json reference
section: Publishing
order: 21
---
A complete source manifest (`genpm.json` at the root of your repo):

```json
{
  "$": 1,
  "n": "@acme/billing",
  "v": "1.2.0",
  "s": { "en": "Stripe subscriptions with webhooks", "es": "Suscripciones de Stripe con webhooks" },
  "d": "src/lib/billing",
  "k": ["stripe", "billing", "subscriptions"],
  "g": { "@core/db": "^1.0.0" },
  "p": { "stripe": "^17.0.0" },
  "e": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "m": [{ "n": "stripe", "c": "npx", "a": ["-y", "@stripe/mcp"], "e": ["STRIPE_SECRET_KEY"] }]
}
```

Keys are one character long to keep manifests cheap in tokens. Every surface that shows manifests to an LLM includes this legend:

```text
genpm keys: n=name v=version s=summary r=repo t=git-ref c=commit-sha d=install-dir i=repo-subdir x=ai-rules-file l=license k=keywords g=genpm-deps p=npm-deps e=env-vars m=mcp-servers(n=name c=command a=args u=url e=env)
```

| Key | Name | Required | Rules |
|---|---|---|---|
| `n` | name | yes | `@scope/name`, lowercase. |
| `v` | version | yes | Strict SemVer, no `v` prefix, no build metadata. |
| `d` | dest | yes | Relative POSIX path in the consumer project. No `..`, no absolute paths, never `.git/`, `node_modules/` or `.genpm/`, at most 8 segments. |
| `s` | summary | recommended | ≤ 160 chars, one line. String or `{ "en": "…", "es": "…" }` (must include `en`). |
| `r` | repo | no | HTTPS Git URL; defaults to the `origin` remote. |
| `t` | ref | no | A tag or a 40-hex SHA; defaults to `v{v}`. Never a branch. |
| `i` | include | no | Repo subdirectory to inject (default `.`). |
| `x` | context | no | AI rules file relative to `i` (default `AGENTS.md`, ≤ 16 KB). |
| `l` | license | no | SPDX expression; the license detected by GitHub wins. |
| `k` | keywords | no | Up to 10, `^[a-z0-9-]{2,32}$`. |
| `g` | genpm deps | no | `{ "@core/db": "^1.0.0" }`, up to 10. Resolved by GenPM. |
| `p` | npm deps | no | Proposed to the user; never installed without consent. |
| `e` | env | no | Variable **names** (`^[A-Z][A-Z0-9_]{1,63}$`), never values. |
| `m` | mcp | no | Up to 5 servers: `"@stripe/mcp"` or `{ "n", "c", "a", "u", "e" }`. |
| `_*` | extensions | no | Ignored by official tools. Any other key is an error. |

The source manifest **must not** contain `c` (its own commit); the registry adds `r`, `t`, `c`, `i`, `x` and `l` when it resolves it.

Exclude files with `.genpmignore` (gitignore syntax, relative to `i`). `.git/`, `.github/`, `node_modules/`, `genpm.json`, `.genpmignore` and `.env*` are always excluded.

## Limits

| What | Limit |
|---|---|
| Files per package | 2,000 |
| Package size | 20 MB (override with `--max-size` when installing) |
| Single file | 1 MB |
| AI rules file | 16 KB; ~1,500 tokens recommended, warning above 4,000 |
| Path length / depth | 200 characters / 8 segments |
| Keywords · genpm deps · npm deps · env vars · MCP servers | 10 · 10 · 30 · 30 · 5 |

`genpm validate` checks all of this locally with the same code the registry runs.

JSON Schema: [`/schema/v1/genpm.json`](/schema/v1/genpm.json).
