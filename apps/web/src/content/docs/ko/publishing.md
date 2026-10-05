---
title: 첫 번째 패키지
section: 게시하기
order: 20
---
코드는 GitHub에 그대로 있습니다. 레지스트리는 매니페스트와 그것이 가리키는 커밋만 저장합니다.

**웹에서, 터미널 없이:** [genpm.net/publish](/publish)에 로그인해 저장소를 고르면 GenPM이 부족한 것을 알려 줍니다. `genpm.json`을 대신 만들어 주고, 각 수정 버튼은 파일이 준비된 상태로 GitHub를 엽니다(GenPM은 쓰기 권한을 요구하지 않습니다). 모두 초록색이 되면 같은 페이지에서 게시하면 됩니다.

**터미널에서:**

```bash
genpm init          # genpm.json, AGENTS.md, .genpmignore 생성
genpm validate      # 레지스트리와 같은 스캐너
git tag v1.0.0 && git push --tags
genpm login
genpm publish
```

`publish`는 커밋하지 않은 변경이 없는지, 그리고 `origin`의 태그가 로컬과 같은 커밋을 가리키는지(`E_REF_NOT_PUSHED`) 확인합니다. 그다음 레지스트리는 해당 커밋의 `genpm.json`을 (여러분의 컴퓨터가 아니라) **GitHub에서** 읽어 검증하고, 트리를 스캔하고, 해석된 매니페스트에 서명한 뒤 패키지를 등록합니다.

버전은 변경할 수 없습니다. 같은 `(이름, 버전)`은 철회한 뒤에도 두 번 게시할 수 없습니다. 브랜치는 항상 거부됩니다(`E_REF_MUTABLE`).

먼저 아무것도 게시하지 않고 시험해 보세요.

```bash
genpm publish --dry-run
```

## 레지스트리가 확인하는 것

- 태그가 GitHub에 있고, 여러분이 푸시한 커밋을 가리키는지.
- `genpm.json`이 유효하고, 이름이 게시할 수 있는 스코프와 일치하는지.
- 트리가 스캔을 통과하는지: 자동으로 실행되는 파일(설치 스크립트, `.npmrc`, `.vscode/tasks.json`, git 훅 등), 시크릿, 심볼릭 링크가 없고 경로가 안전한지.
- AI 규칙에 프롬프트 인젝션이 없는지. 의심스러우면 해당 버전은 **격리**되고, 사람이 영업일 기준 24시간 안에 검토합니다.

## 프리릴리스와 dist-tag

`1.3.0-beta.1` 같은 프리릴리스는 자동으로 dist-tag `next`에 들어가므로 `latest`는 계속 최신 안정 버전을 가리킵니다. 사용자는 `genpm add @acme/billing@next`로 선택할 수 있습니다. 다른 태그를 쓰려면 `--dist-tag`를 사용하세요.

## 모노레포

하위 디렉터리에 있는 패키지는 `--manifest packages/billing/genpm.json`으로 게시하고, `i`를 그 디렉터리로 설정해 그것만 주입되게 합니다. `billing@1.2.0`처럼 패키지별 태그를 사용하세요.

## 버전 철회

```bash
genpm yank @acme/billing@1.2.0 --reason "Stripe API 2026-09에서 webhook이 깨짐"
```

철회된 버전도 이미 사용 중인 프로젝트에서는 변경 불가하고 검증 가능한 상태로 남지만, 새 설치에서는 건너뛰며 웹에 이유가 표시됩니다.

## 스코프

스코프는 여러분의 GitHub 로그인이나 소속 조직입니다. `@core`, `@genpm`, `@official` 같은 스코프는 예약되어 있습니다.

## CI

`genpm init --workflow`는 `v*` 태그를 푸시하면 게시하는 GitHub Actions 워크플로를 추가합니다(시크릿은 `GENPM_TOKEN`).

### 토큰 없이: 신뢰할 수 있는 게시

[신뢰할 수 있는 게시](/settings/publishing)에서 저장소를 한 번 승인하세요(워크플로 파일이나 environment 하나로 제한할 수도 있습니다). 그런 다음 job에 `id-token: write`를 주고 `GENPM_TOKEN`을 제거하세요. `genpm publish`가 Actions에 OIDC 토큰을 요청하면 GenPM이 그 저장소에서 내 scope에만 게시할 수 있는 15분짜리 토큰으로 교환합니다.

```yaml
permissions:
  contents: read
  id-token: write   # trusted publishing
steps:
  - uses: actions/checkout@v4
    with: { fetch-depth: 0 }
  - run: npx -y @genpm-net/cli publish --yes
```
