---
title: Lockfile
section: Usando pacotes
order: 13
---
`genpm.lock` registra de onde veio cada pacote, uma linha por pacote para diffs limpos:

```json
{"$":1,
"p":{
"@core/auth":{"v":"1.2.0","r":"https://github.com/genpm-net/auth","t":"v1.2.0","c":"1b9d…","d":"src/lib/auth","x":"AGENTS.md","h":"sha256-…","sg":"k1:…","m":0,"by":"cli"}
}}
```

| Chave | Significado |
|---|---|
| `c` | SHA do commit instalado. |
| `d` | Destino real (depois de `--dest`). |
| `h` | Integridade do conjunto injetado (SHA-256 sobre `.genpm/files/<slug>.json`). |
| `sg` | Assinatura Ed25519 do registry sobre o manifesto resolvido. |
| `m` | `1` se foi escrita configuração MCP para este pacote. |
| `by` | `cli` ou `mcp`. |

`.genpm/files/<slug>.json` guarda o SHA-256 de cada arquivo injetado: faça commit dele. Nunca edite `genpm.lock` nem `.genpm/` à mão; o `genpm audit` detecta.
