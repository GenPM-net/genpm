---
title: ロックファイル
section: パッケージを使う
order: 13
---
`genpm.lock` は各パッケージの出どころを記録します。差分が読みやすいよう、1 パッケージ 1 行です。

```json
{"$":1,
"p":{
"@core/auth":{"v":"1.2.0","r":"https://github.com/genpm-net/auth","t":"v1.2.0","c":"1b9d…","d":"src/lib/auth","x":"AGENTS.md","h":"sha256-…","sg":"k1:…","m":0,"by":"cli"}
}}
```

| キー | 意味 |
|---|---|
| `c` | インストールしたコミットの SHA。 |
| `d` | 実際の配置先（`--dest` 適用後）。 |
| `h` | 注入したファイル群の完全性（`.genpm/files/<slug>.json` の SHA-256）。 |
| `sg` | 解決済みマニフェストに対するレジストリの Ed25519 署名。 |
| `m` | このパッケージの MCP 設定を書き込んだ場合は `1`。 |
| `by` | `cli` または `mcp`。 |

`.genpm/files/<slug>.json` には注入した各ファイルの SHA-256 が保存されます。これもコミットしてください。`genpm.lock` や `.genpm/` を手で編集しないでください。`genpm audit` が検出します。
