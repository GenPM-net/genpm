---
title: 빠른 시작
section: 시작하기
order: 1
---
약 1분 만에 첫 모듈을 추가할 수 있습니다. 필요한 것은 **git 2.25 이상**뿐입니다(없으면 GenPM이 GitHub tarball을 사용).

## 1. genpm 설치

macOS와 Linux:

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

Windows(PowerShell):

```powershell
irm https://genpm.net/install.ps1 | iex
```

Node.js가 필요 없는 단일 바이너리입니다. 다른 방법(npm, 특정 버전, 미러)은 [설치](/docs/install)를 참고하세요.

## 2. 패키지 추가

프로젝트 루트에서 실행하세요. GenPM은 전체 계획을 보여 주고, 무언가를 쓰기 전에 확인을 받습니다.

```bash
genpm add @core/auth
```

GenPM은 `@core/auth`와 그 의존성 `@core/db`를 해석하고, 각 매니페스트의 레지스트리 서명을 검증한 뒤, 정확한 커밋을 내려받아 로컬에서 스캔하고 나서 계획을 보여 줍니다.

## 3. 변경 사항 확인

```bash
git status
```

- 코드는 `src/lib/auth`와 `src/lib/db`에 있습니다. 이제 여러분의 코드입니다.
- AI가 읽는 규칙은 `src/lib/auth/AGENTS.md`에 있습니다.
- `genpm.lock`은 각 패키지를 40자 커밋 SHA로 고정합니다.
- `.env.example`에는 설정해야 할 변수가 나열됩니다(이름만, 값은 절대 쓰지 않음).

## 4. AI에게 맡기기

에이전트를 열고 모듈 연동을 요청하세요. 에이전트는 모듈의 규칙을 읽고 **Integration** 섹션을 따릅니다.

```text
src/lib/auth/AGENTS.md를 따라 @core/auth를 연동하고 GitHub 로그인을 추가해 줘.
```

[MCP 서버](/docs/mcp)를 연결하면 1단계도 에이전트가 할 수 있습니다.
