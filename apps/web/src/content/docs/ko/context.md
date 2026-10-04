---
title: 컨텍스트와 IDE
section: 패키지 사용하기
order: 11
---
패키지의 규칙은 **에이전트가 해당 폴더에서 작업할 때만** 불러옵니다.

| 클라이언트 | 감지 기준 | 작성되는 파일 |
|---|---|---|
| 모두(항상) | — | `<d>/AGENTS.md`와 루트 `AGENTS.md`의 색인 블록 |
| Claude Code | `CLAUDE.md` 또는 `.claude/` | `<d>/CLAUDE.md`(`@AGENTS.md`)와 `CLAUDE.md`의 색인 |
| Cursor | `.cursor/` 또는 `.cursorrules` | `globs: <d>/**`가 있는 `.cursor/rules/genpm-<slug>.mdc` |
| GitHub Copilot | `.github/copilot-instructions.md` 또는 `.vscode/` | `.github/instructions/genpm-<slug>.instructions.md` |
| Windsurf | `.windsurf/` 또는 `.windsurfrules` | `.windsurf/rules/genpm-<slug>.md` |

`--clients cursor,claude` 또는 `.genpmrc`의 `clients=`로 감지 결과를 바꿀 수 있습니다.

GenPM은 자신의 표식 사이만 편집하며 파일의 나머지 부분은 건드리지 않습니다.

```md
<!-- genpm:index:start -->
## GenPM packages
- @core/auth@1.2.0 → src/lib/auth (rules: src/lib/auth/AGENTS.md)
<!-- genpm:index:end -->
```
