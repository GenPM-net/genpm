---
title: 잠금 파일
section: 패키지 사용하기
order: 13
---
`genpm.lock`은 각 패키지의 출처를 기록합니다. diff를 깔끔하게 보도록 패키지당 한 줄입니다.

```json
{"$":1,
"p":{
"@core/auth":{"v":"1.2.0","r":"https://github.com/genpm-net/auth","t":"v1.2.0","c":"1b9d…","d":"src/lib/auth","x":"AGENTS.md","h":"sha256-…","sg":"k1:…","m":0,"by":"cli"}
}}
```

| 키 | 의미 |
|---|---|
| `c` | 설치된 커밋의 SHA. |
| `d` | 실제 대상(`--dest` 적용 후). |
| `h` | 주입된 파일 집합의 무결성(`.genpm/files/<slug>.json`의 SHA-256). |
| `sg` | 해석된 매니페스트에 대한 레지스트리의 Ed25519 서명. |
| `m` | 이 패키지의 MCP 설정을 작성했으면 `1`. |
| `by` | `cli` 또는 `mcp`. |

`.genpm/files/<slug>.json`에는 주입된 각 파일의 SHA-256이 저장됩니다. 이 파일도 커밋하세요. `genpm.lock`이나 `.genpm/`을 직접 수정하지 마세요. `genpm audit`이 감지합니다.
