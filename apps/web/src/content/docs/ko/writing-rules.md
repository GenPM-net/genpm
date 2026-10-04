---
title: AI 규칙 작성하기
section: 게시하기
order: 22
---
`AGENTS.md`는 사용자의 에이전트가 여러분의 모듈을 건드리기 전에 읽는 내용입니다. 300~1,500토큰 사이로 유지하고 영어로 작성하세요. 토큰이 적게 들고 어떤 기여자든 읽을 수 있습니다.

```md
# @acme/auth — rules for agents

## Purpose
Cookie sessions + OAuth (GitHub, Google). Authorization (roles) is out of scope.

## Module map
- `index.ts` — public API. Import only from here.
- `session.ts` — create, validate and rotate sessions.

## Integration (do this after installing)
1. Run the migrations that add `users` and `sessions`.
2. Mount `authRoutes` in the app router.
3. Configure `AUTH_SECRET` (see `.env.example`).

## Conventions
- Never read cookies outside `session.ts`.

## Don't
- Don't store OAuth tokens in plain text.
```

이 다섯 섹션(목적, 구조, 연동 방법, 규칙, 금지 사항)이 에이전트가 가장 잘 따르는 형식입니다.

레지스트리는 규칙을 스캔해 8개 언어의 프롬프트 인젝션 문구, 데이터 유출 지시, `curl | sh`, 인코딩된 내용, 보이지 않는 유니코드를 찾습니다. 표시된 패키지는 사람이 검토할 때까지 격리됩니다.
