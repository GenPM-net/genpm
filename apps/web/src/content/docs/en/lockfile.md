---
title: Lockfile
section: Using packages
order: 13
---
`genpm.lock` records where every package came from, one line per package for clean diffs:

```json
{"$":1,
"p":{
"@core/auth":{"v":"1.2.0","r":"https://github.com/genpm-net/auth","t":"v1.2.0","c":"1b9d…","d":"src/lib/auth","x":"AGENTS.md","h":"sha256-…","sg":"k1:…","m":0,"by":"cli"}
}}
```

| Key | Meaning |
|---|---|
| `c` | Commit SHA that was installed. |
| `d` | Real destination (after `--dest`). |
| `h` | Integrity of the injected set (SHA-256 over `.genpm/files/<slug>.json`). |
| `sg` | Ed25519 signature of the registry over the resolved manifest. |
| `m` | `1` if MCP config was written for this package. |
| `by` | `cli` or `mcp`. |

`.genpm/files/<slug>.json` stores the SHA-256 of every injected file: commit it. Never edit `genpm.lock` or `.genpm/` by hand; `genpm audit` detects it.
