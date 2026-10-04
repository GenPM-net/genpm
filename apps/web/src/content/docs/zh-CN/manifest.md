---
title: genpm.json 参考
section: 发布
order: 21
---
一个完整的源清单（仓库根目录下的 `genpm.json`）：

```json
{
  "$": 1,
  "n": "@acme/billing",
  "v": "1.2.0",
  "s": { "en": "Stripe subscriptions with webhooks", "zh-CN": "带 webhook 的 Stripe 订阅" },
  "d": "src/lib/billing",
  "k": ["stripe", "billing", "subscriptions"],
  "g": { "@core/db": "^1.0.0" },
  "p": { "stripe": "^17.0.0" },
  "e": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "m": [{ "n": "stripe", "c": "npx", "a": ["-y", "@stripe/mcp"], "e": ["STRIPE_SECRET_KEY"] }]
}
```

键名只有一个字符，以减少清单消耗的 token。凡是向 LLM 展示清单的地方，都会附上这段图例：

```text
genpm keys: n=name v=version s=summary r=repo t=git-ref c=commit-sha d=install-dir i=repo-subdir x=ai-rules-file l=license k=keywords g=genpm-deps p=npm-deps e=env-vars m=mcp-servers(n=name c=command a=args u=url e=env)
```

| 键 | 名称 | 必填 | 规则 |
|---|---|---|---|
| `n` | 名称 | 是 | `@scope/name`，小写。 |
| `v` | 版本 | 是 | 严格的 SemVer，不带 `v` 前缀，也不带构建元数据。 |
| `d` | 目标目录 | 是 | 使用者项目中的相对 POSIX 路径。不能有 `..` 或绝对路径，不能是 `.git/`、`node_modules/` 或 `.genpm/`，最多 8 段。 |
| `s` | 简介 | 建议 | ≤ 160 个字符，一行。字符串或 `{ "en": "…", "zh-CN": "…" }`（必须包含 `en`）。 |
| `r` | 仓库 | 否 | HTTPS Git URL；默认为远程 `origin`。 |
| `t` | ref | 否 | 标签或 40 位十六进制 SHA；默认为 `v{v}`。不能是分支。 |
| `i` | include | 否 | 要注入的仓库子目录（默认 `.`）。 |
| `x` | 上下文 | 否 | 相对于 `i` 的 AI 规则文件（默认 `AGENTS.md`，≤ 16 KB）。 |
| `l` | 许可证 | 否 | SPDX 表达式；以 GitHub 检测到的许可证为准。 |
| `k` | 关键词 | 否 | 最多 10 个，`^[a-z0-9-]{2,32}$`。 |
| `g` | genpm 依赖 | 否 | `{ "@core/db": "^1.0.0" }`，最多 10 个，由 GenPM 解析。 |
| `p` | npm 依赖 | 否 | 只向用户提议；未经同意绝不安装。 |
| `e` | 环境变量 | 否 | 变量**名称**（`^[A-Z][A-Z0-9_]{1,63}$`），从不写值。 |
| `m` | mcp | 否 | 最多 5 个服务器：`"@stripe/mcp"` 或 `{ "n", "c", "a", "u", "e" }`。 |
| `_*` | 扩展 | 否 | 官方工具会忽略。其他任何键都会报错。 |

源清单**不能**包含 `c`（它自己的提交）；注册表在解析时会添加 `r`、`t`、`c`、`i`、`x` 和 `l`。

用 `.genpmignore`（gitignore 语法，相对于 `i`）排除文件。`.git/`、`.github/`、`node_modules/`、`genpm.json`、`.genpmignore` 和 `.env*` 总是被排除。

## 限制

| 项目 | 限制 |
|---|---|
| 每个包的文件数 | 2,000 |
| 包大小 | 20 MB（安装时可用 `--max-size` 调整） |
| 单个文件 | 1 MB |
| AI 规则文件 | 16 KB；建议约 1,500 token，超过 4,000 会警告 |
| 路径长度 / 深度 | 200 个字符 / 8 段 |
| 关键词 · genpm 依赖 · npm 依赖 · 环境变量 · MCP 服务器 | 10 · 10 · 30 · 30 · 5 |

`genpm validate` 会在本地用与注册表相同的代码检查以上所有内容。

JSON Schema：[`/schema/v1/genpm.json`](/schema/v1/genpm.json)
