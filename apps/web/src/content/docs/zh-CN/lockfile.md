---
title: 锁文件
section: 使用包
order: 13
---
`genpm.lock` 记录每个包的来源，每个包占一行，便于查看差异：

```json
{"$":1,
"p":{
"@core/auth":{"v":"1.2.0","r":"https://github.com/genpm-net/auth","t":"v1.2.0","c":"1b9d…","d":"src/lib/auth","x":"AGENTS.md","h":"sha256-…","sg":"k1:…","m":0,"by":"cli"}
}}
```

| 键 | 含义 |
|---|---|
| `c` | 已安装提交的 SHA。 |
| `d` | 实际目标目录（应用 `--dest` 之后）。 |
| `h` | 注入文件集合的完整性（`.genpm/files/<slug>.json` 的 SHA-256）。 |
| `sg` | 注册表对解析后清单的 Ed25519 签名。 |
| `m` | 若为该包写入了 MCP 配置则为 `1`。 |
| `by` | `cli` 或 `mcp`。 |

`.genpm/files/<slug>.json` 保存了每个注入文件的 SHA-256：请提交它。不要手动编辑 `genpm.lock` 或 `.genpm/`，`genpm audit` 会检测出来。
