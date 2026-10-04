---
title: Lockfile
section: Pakete verwenden
order: 13
---
`genpm.lock` hält fest, woher jedes Paket stammt, eine Zeile pro Paket für saubere Diffs:

```json
{"$":1,
"p":{
"@core/auth":{"v":"1.2.0","r":"https://github.com/genpm-net/auth","t":"v1.2.0","c":"1b9d…","d":"src/lib/auth","x":"AGENTS.md","h":"sha256-…","sg":"k1:…","m":0,"by":"cli"}
}}
```

| Schlüssel | Bedeutung |
|---|---|
| `c` | SHA des installierten Commits. |
| `d` | Tatsächliches Ziel (nach `--dest`). |
| `h` | Integrität der injizierten Dateien (SHA-256 über `.genpm/files/<slug>.json`). |
| `sg` | Ed25519-Signatur der Registry über das aufgelöste Manifest. |
| `m` | `1`, wenn MCP-Konfiguration für dieses Paket geschrieben wurde. |
| `by` | `cli` oder `mcp`. |

`.genpm/files/<slug>.json` speichert den SHA-256 jeder injizierten Datei: Committe sie. Bearbeite `genpm.lock` und `.genpm/` nie von Hand; `genpm audit` erkennt das.
