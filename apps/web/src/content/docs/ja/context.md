---
title: コンテキストと IDE
section: パッケージを使う
order: 11
---
パッケージのルールは、**エージェントがそのフォルダで作業しているときだけ**読み込まれます。

| クライアント | 検出条件 | 書き込まれるファイル |
|---|---|---|
| すべて（常に） | — | `<d>/AGENTS.md` と、ルートの `AGENTS.md` 内のインデックスブロック |
| Claude Code | `CLAUDE.md` または `.claude/` | `<d>/CLAUDE.md`（`@AGENTS.md`）と `CLAUDE.md` 内のインデックス |
| Cursor | `.cursor/` または `.cursorrules` | `globs: <d>/**` 付きの `.cursor/rules/genpm-<slug>.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` または `.vscode/` | `.github/instructions/genpm-<slug>.instructions.md` |
| Windsurf | `.windsurf/` または `.windsurfrules` | `.windsurf/rules/genpm-<slug>.md` |

`--clients cursor,claude` または `.genpmrc` の `clients=` で検出を上書きできます。

GenPM が編集するのは自分のマーカーの間だけで、ファイルのそれ以外の部分には触れません。

```md
<!-- genpm:index:start -->
## GenPM packages
- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)
<!-- genpm:index:end -->
```
