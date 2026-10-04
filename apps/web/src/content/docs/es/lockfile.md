---
title: Lockfile
section: Usar paquetes
order: 13
---
`genpm.lock` registra de dónde viene cada paquete, una línea por paquete para que los diffs sean limpios:

```json
{"$":1,
"p":{
"@core/auth":{"v":"1.2.0","r":"https://github.com/genpm-net/auth","t":"v1.2.0","c":"1b9d…","d":"src/lib/auth","x":"AGENTS.md","h":"sha256-…","sg":"k1:…","m":0,"by":"cli"}
}}
```

| Clave | Significado |
|---|---|
| `c` | SHA del commit instalado. |
| `d` | Destino real (después de aplicar `--dest`). |
| `h` | Integridad del conjunto inyectado (SHA-256 sobre `.genpm/files/<slug>.json`). |
| `sg` | Firma Ed25519 del registry sobre el manifiesto resuelto. |
| `m` | `1` si se escribió configuración MCP para este paquete. |
| `by` | `cli` o `mcp`. |

`.genpm/files/<slug>.json` guarda el SHA-256 de cada archivo inyectado: haz commit de él. Nunca edites `genpm.lock` ni `.genpm/` a mano; `genpm audit` lo detecta.
