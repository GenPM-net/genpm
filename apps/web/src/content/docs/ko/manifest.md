---
title: genpm.json 참조
section: 게시하기
order: 21
---
완전한 소스 매니페스트 예시(저장소 루트의 `genpm.json`):

```json
{
  "$": 1,
  "n": "@acme/billing",
  "v": "1.2.0",
  "s": { "en": "Stripe subscriptions with webhooks", "ko": "웹훅이 포함된 Stripe 구독" },
  "d": "src/lib/billing",
  "k": ["stripe", "billing", "subscriptions"],
  "g": { "@core/db": "^1.0.0" },
  "p": { "stripe": "^17.0.0" },
  "e": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "m": [{ "n": "stripe", "c": "npx", "a": ["-y", "@stripe/mcp"], "e": ["STRIPE_SECRET_KEY"] }]
}
```

매니페스트가 토큰을 적게 쓰도록 키는 한 글자입니다. LLM에 매니페스트를 보여 주는 모든 곳에는 다음 범례가 함께 붙습니다.

```text
genpm keys: n=name v=version s=summary r=repo t=git-ref c=commit-sha d=install-dir i=repo-subdir x=ai-rules-file l=license k=keywords g=genpm-deps p=npm-deps e=env-vars m=mcp-servers(n=name c=command a=args u=url e=env)
```

| 키 | 이름 | 필수 | 규칙 |
|---|---|---|---|
| `n` | 이름 | 예 | `@scope/name`, 소문자. |
| `v` | 버전 | 예 | 엄격한 SemVer. `v` 접두사와 빌드 메타데이터는 불가. |
| `d` | 대상 | 예 | 사용자 프로젝트 안의 상대 POSIX 경로. `..`와 절대 경로, `.git/`, `node_modules/`, `.genpm/`은 불가. 최대 8단계. |
| `s` | 요약 | 권장 | 160자 이하, 한 줄. 문자열 또는 `{ "en": "…", "ko": "…" }`(`en` 필수). |
| `r` | 저장소 | 아니요 | HTTPS Git URL. 기본값은 원격 `origin`. |
| `t` | ref | 아니요 | 태그 또는 40자리 16진수 SHA. 기본값은 `v{v}`. 브랜치는 불가. |
| `i` | include | 아니요 | 주입할 저장소 하위 디렉터리(기본값 `.`). |
| `x` | 컨텍스트 | 아니요 | `i` 기준 상대 경로의 AI 규칙 파일(기본값 `AGENTS.md`, 16 KB 이하). |
| `l` | 라이선스 | 아니요 | SPDX 표현식. GitHub가 감지한 라이선스가 우선합니다. |
| `k` | 키워드 | 아니요 | 최대 10개, `^[a-z0-9-]{2,32}$`. |
| `g` | genpm 의존성 | 아니요 | `{ "@core/db": "^1.0.0" }`, 최대 10개. GenPM이 해석합니다. |
| `p` | npm 의존성 | 아니요 | 사용자에게 제안만 하며, 동의 없이는 설치하지 않습니다. |
| `e` | 환경 변수 | 아니요 | 변수 **이름**(`^[A-Z][A-Z0-9_]{1,63}$`). 값은 쓰지 않습니다. |
| `m` | mcp | 아니요 | 최대 5개 서버: `"@stripe/mcp"` 또는 `{ "n", "c", "a", "u", "e" }`. |
| `_*` | 확장 | 아니요 | 공식 도구는 무시합니다. 그 밖의 키는 오류입니다. |

소스 매니페스트에는 `c`(자신의 커밋)를 넣으면 **안 됩니다**. 레지스트리가 해석할 때 `r`, `t`, `c`, `i`, `x`, `l`을 추가합니다.

`.genpmignore`(gitignore 문법, `i` 기준 상대 경로)로 파일을 제외하세요. `.git/`, `.github/`, `node_modules/`, `genpm.json`, `.genpmignore`, `.env*`는 항상 제외됩니다.

## 제한

| 항목 | 제한 |
|---|---|
| 패키지당 파일 수 | 2,000 |
| 패키지 크기 | 20 MB(설치 시 `--max-size`로 조정 가능) |
| 단일 파일 | 1 MB |
| AI 규칙 파일 | 16 KB. 약 1,500토큰 권장, 4,000 초과 시 경고 |
| 경로 길이 / 깊이 | 200자 / 8단계 |
| 키워드 · genpm 의존성 · npm 의존성 · 환경 변수 · MCP 서버 | 10 · 10 · 30 · 30 · 5 |

`genpm validate`는 레지스트리와 같은 코드로 이 모든 것을 로컬에서 확인합니다.

JSON Schema: [`/schema/v1/genpm.json`](/schema/v1/genpm.json)
