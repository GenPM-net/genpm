---
title: Lockfile
section: Utiliser des paquets
order: 13
---
`genpm.lock` enregistre la provenance de chaque paquet, une ligne par paquet pour des diffs propres :

```json
{"$":1,
"p":{
"@core/auth":{"v":"1.2.0","r":"https://github.com/genpm-net/auth","t":"v1.2.0","c":"1b9d…","d":"src/lib/auth","x":"AGENTS.md","h":"sha256-…","sg":"k1:…","m":0,"by":"cli"}
}}
```

| Clé | Signification |
|---|---|
| `c` | SHA du commit installé. |
| `d` | Destination réelle (après `--dest`). |
| `h` | Intégrité de l’ensemble injecté (SHA-256 de `.genpm/files/<slug>.json`). |
| `sg` | Signature Ed25519 du registry sur le manifeste résolu. |
| `m` | `1` si une configuration MCP a été écrite pour ce paquet. |
| `by` | `cli` ou `mcp`. |

`.genpm/files/<slug>.json` stocke le SHA-256 de chaque fichier injecté : committez-le. Ne modifiez jamais `genpm.lock` ni `.genpm/` à la main ; `genpm audit` le détecte.
