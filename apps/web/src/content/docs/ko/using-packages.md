---
title: 패키지 사용하기
section: 패키지 사용하기
order: 10
---
## add

```bash
genpm add @core/billing            # 최신 버전
genpm add @core/auth@^1.2          # semver 범위
genpm add @core/db --dest packages/db
genpm add @core/billing --dry-run  # 계획만 보여 주고 아무것도 쓰지 않음
```

GenPM은 세 가지를 따로 묻습니다. 코드 주입, MCP 서버 추가(전체 명령 표시), npm 의존성을 위한 패키지 매니저 명령 실행입니다. `--yes`는 첫 번째 질문에만 답하며, 나머지에는 `--mcp`와 `--install-deps`를 사용합니다.

대상이 이미 있고 비어 있지 않으면 `add`는 `E_DEST_CONFLICT`로 실패합니다. `--force`는 기존 내용을 먼저 `.genpm/backup/<timestamp>/`로 옮깁니다.

## search와 info

```bash
genpm search stripe
genpm info @core/billing          # 매니페스트, 의존성, MCP, 환경 변수, AI 규칙 전체
genpm info @core/billing --rules  # 규칙만
```

## list와 remove

```bash
genpm list
genpm remove @core/auth
```

`list`는 주입된 각 파일을 기록된 SHA-256과 비교합니다(로컬 변경). `remove`는 여러분이 수정한 코드는 삭제하지 않습니다(`E_DRIFT`). 유지하려면 `--keep-code`, 그래도 삭제하려면 `--force`를 사용하세요. 다른 패키지가 의존하는 패키지는 먼저 제거할 수 없습니다(`E_REQUIRED_BY`). 패키지를 제거하면 그 MCP 서버와, GenPM이 만들었다가 비게 된 파일도 함께 제거됩니다.

## outdated와 audit

```bash
genpm outdated
genpm audit   # CI에 추가할 때: npx @genpm-net/cli audit
```

`audit`은 파일 무결성, 잠금 파일 각 항목의 레지스트리 서명, 보안 권고, 철회된 버전, 격리 상태를 검증합니다. 높음 또는 치명적 문제가 있으면 종료 코드 6으로 끝납니다.

## update와 diff

```bash
genpm diff @core/auth
genpm update @core/auth
```

`diff`는 설치된 버전 이후 upstream에서 바뀐 내용을 내 폴더를 가리키는 경로로 보여줍니다(`git apply --3way`로 적용). `update`는 3-way 병합을 합니다. 건드리지 않은 파일은 새 버전을 받고, 내가 바꾼 줄은 유지되며, 양쪽이 같은 줄을 바꾸면 파일에 표준 `<<<<<<<` 표시가 남고 명령은 종료 코드 4로 끝납니다. upstream에서 삭제됐지만 내가 수정한 파일은 유지됩니다.

`genpm diff --local`은 로컬 변경도 보여주고, `genpm update --dry-run`은 아무것도 쓰지 않고 계획만 보여줍니다.

## JSON 출력

모든 명령은 `--json`(한 줄, 영어, 질문 없음)을 지원합니다. 대화형 터미널이 없으면 답하지 않은 질문은 `E_CONFIRM_REQUIRED`(종료 코드 2)로 실패하며 아무것도 쓰지 않습니다.

## 레시피: 여러 패키지를 한 번에

레시피는 함께 동작하는 여러 패키지를 명령 하나로 설치하며, 계획과 확인 절차는 `genpm add`와 같습니다. GenPM이 엄선한 레시피는 [/recipes](/recipes)에 있고, 팀의 레시피를 저장소의 JSON 파일로 둘 수도 있습니다.

```bash
genpm compose --list
genpm compose saas-starter --dry-run
genpm compose ./stack.json
```

```json
{ "name": "my-stack", "p": ["@core/db", "@core/auth@^1.2"] }
```

## 비공개 레지스트리

팀은 비공개 저장소의 패키지를 비공개 레지스트리에 둘 수 있습니다(`genpm registry create acme --owner my-org` 또는 [설정 › 비공개 레지스트리](/settings/registries)). 멤버가 아니면 존재하지 않는 것처럼 보입니다. `.genpmrc`에서 scope를 이 레지스트리로 지정하고 로그인하면 `genpm add`는 그대로 동작합니다. 멤버는 `internal` 패키지를 읽을 수 있고 `private` 패키지는 권한이 필요합니다(`genpm access grant @acme/api team:my-org/backend read`). 레지스트리가 비공개 저장소를 읽으려면 조직에 GenPM GitHub App이 설치되어 있어야 합니다.

```json
// .genpmrc
{ "scopes": { "acme": "https://api.genpm.net/r/acme" } }
```

```bash
genpm login --registry https://api.genpm.net/r/acme
genpm add @acme/payments
```
