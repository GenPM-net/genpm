---
title: 쿠키 정책
updated: 2026-10-05
---
이 정책은 정보사회 서비스에 관한 스페인 법률 34/2002(LSSI-CE) 제22.2조와 스페인 개인정보보호청의 쿠키 가이드를 준수합니다. 내용이 다를 경우 스페인어판이 우선합니다.

## 요약

genpm.net은 **요청하신 서비스 제공에 꼭 필요한 기술적 쿠키와 직접 선택한 설정만** 사용합니다. 이는 동의가 필요 없으므로(LSSI-CE 제22.2조) 쿠키 배너를 표시하지 않습니다. 자사·제3자를 막론하고 분석, 광고, 추적용 쿠키는 사용하지 않습니다. 분석은 요청하신 페이지(검색, 조회한 패키지)를 기준으로 서버에서 이루어집니다. 이를 위해 브라우저가 보내는 것은 없으며, 기기에 아무것도 저장하지 않고 IP나 어떤 식별자도 기록하지 않습니다.

## 브라우저에 저장하는 항목

| 이름 | 유형 | 주체 | 목적 | 기간 |
|---|---|---|---|---|
| `__Host-genpm_session` | 기술적 쿠키 | GenPM | 로그인한 경우에만 로그인 상태 유지 | 30일 |
| `__Host-genpm_oauth` | 기술적 쿠키 | GenPM | GitHub 로그인 위조(CSRF) 방지 | 10분 |
| `genpm-theme` | 로컬 스토리지 | GenPM | 선택한 라이트 또는 다크 모드 기억 | 삭제할 때까지 |
| `genpm-lang-dismissed` | 로컬 스토리지 | GenPM | 안내를 닫은 뒤 다른 언어를 다시 제안하지 않음 | 삭제할 때까지 |

## Cloudflare 보안

이 사이트는 Cloudflare를 통해 제공됩니다. 자동화된 공격으로부터 보호하기 위해 Cloudflare가 기술적 보안 쿠키(예: `__cf_bm`(30분), `cf_clearance`)를 설정할 수 있으며, 스폰서 및 기업용 양식에서는 봇 방지 검사 **Turnstile**이 사람과 봇을 구분하기 위해 브라우저의 기술 정보를 읽을 수 있습니다. 그 유일한 목적은 요청하신 서비스의 보안이며, 광고나 사이트 간 추적에는 사용하지 않습니다. 자세한 내용은 [Cloudflare 쿠키 정책](https://www.cloudflare.com/cookie-policy/)을 참고하세요.

## 삭제 또는 차단 방법

브라우저 설정에서 쿠키와 로컬 스토리지를 삭제하거나 차단할 수 있습니다([Chrome](https://support.google.com/chrome/answer/95647), [Firefox](https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox), [Safari](https://support.apple.com/guide/safari/sfri11471), [Edge](https://support.microsoft.com/microsoft-edge)). `__Host-genpm_session`을 차단하면 로그인할 수 없지만, 패키지 검색과 설치는 계속 이용할 수 있습니다.

## CLI와 MCP 서버

CLI `genpm`과 서버 `@genpm-net/mcp`는 쿠키를 사용하지 않습니다. 설치 원격 측정과 이를 끄는 방법은 [개인정보 처리방침](/privacy)을 참고하세요.

동의가 필요한 쿠키를 추가하게 되면 사용 전에 동의를 구하고 이 정책을 업데이트하겠습니다.
