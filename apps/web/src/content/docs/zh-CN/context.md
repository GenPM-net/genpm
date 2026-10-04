---
title: 上下文与 IDE
section: 使用包
order: 11
---
包的规则**只在你的智能体处理该目录时**才会加载：

| 客户端 | 检测依据 | 写入的文件 |
|---|---|---|
| 任意（总是） | — | `<d>/AGENTS.md`，以及根目录 `AGENTS.md` 中的索引块 |
| Claude Code | `CLAUDE.md` 或 `.claude/` | `<d>/CLAUDE.md`（`@AGENTS.md`）和 `CLAUDE.md` 中的索引 |
| Cursor | `.cursor/` 或 `.cursorrules` | 带 `globs: <d>/**` 的 `.cursor/rules/genpm-<slug>.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` 或 `.vscode/` | `.github/instructions/genpm-<slug>.instructions.md` |
| Windsurf | `.windsurf/` 或 `.windsurfrules` | `.windsurf/rules/genpm-<slug>.md` |

可以用 `--clients cursor,claude` 或 `.genpmrc` 中的 `clients=` 覆盖检测结果。

GenPM 只编辑自己标记之间的内容，从不改动文件的其余部分：

```md
<!-- genpm:index:start -->
## GenPM packages
- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)
<!-- genpm:index:end -->
```
