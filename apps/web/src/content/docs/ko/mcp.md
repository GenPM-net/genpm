---
title: MCP 서버
section: MCP 서버
order: 30
---
GenPM MCP 서버는 CLI와 같은 엔진을 에이전트에게 제공합니다. 모듈을 검색·검사·주입할 수 있으며, 코드 밖의 무언가를 건드리기 전에는 항상 먼저 묻습니다.

가장 빠른 방법은 프로젝트에서 감지한 클라이언트의 설정을 GenPM이 작성하게 하는 것입니다.

```bash
genpm mcp setup
```

정확한 변경 내용을 보여 주고 쓰기 전에 확인을 받습니다. `--client`와 `--scope`로 대상을 고르거나, 아래처럼 직접 설정하세요.

서버는 [`genpm` 바이너리](/docs/install)에 내장되어 있어 클라이언트가 `genpm mcp serve`를 실행합니다(Node.js 불필요). 바이너리가 없으면 npm 패키지를 사용하세요. 아래 예시의 `genpm mcp serve`를 `npx -y @genpm-net/mcp`(`"command": "npx", "args": ["-y", "@genpm-net/mcp"]`)로 바꾸면 됩니다. npm이나 npx로 실행한 `genpm mcp setup`은 이를 자동으로 처리합니다.

## Claude Code

```bash
claude mcp add genpm -- genpm mcp serve
```

이렇게 하면 사용자 단위로 등록됩니다. 팀과 공유하려면 프로젝트 루트에 `.mcp.json`을 커밋하세요(`genpm mcp setup --client claude --scope project`가 작성합니다).

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

## Cursor

프로젝트: `.cursor/mcp.json`. 사용자: `~/.cursor/mcp.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client cursor                # 프로젝트
genpm mcp setup --client cursor --scope user   # 사용자
```

## VS Code(GitHub Copilot)

프로젝트: `.vscode/mcp.json`(`servers` 키와 `type`에 주의).

```json
{
  "servers": {
    "genpm": { "type": "stdio", "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

사용자:

```bash
code --add-mcp '{"name":"genpm","command":"genpm","args":["mcp","serve"]}'
```

## Windsurf

사용자 전용: `~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client windsurf
```

## Codex

사용자 전용: `~/.codex/config.toml`.

```toml
[mcp_servers.genpm]
command = "genpm"
args = ["mcp", "serve"]
```

```bash
genpm mcp setup --client codex
```

## Gemini CLI

프로젝트: `.gemini/settings.json` · 사용자: `~/.gemini/settings.json`. `mcpServers`만 바뀌고 Gemini의 다른 설정은 그대로 유지됩니다.

```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

```bash
genpm mcp setup --client gemini --scope project
```

## 도구

| 도구 | 하는 일 |
|---|---|
| `genpm_search` | 필요에 맞는 패키지를 검색합니다. 스폰서 결과는 반환하지 않습니다. |
| `genpm_info` | 매니페스트, 의존성, 환경 변수, MCP 서버, AI 규칙. |
| `genpm_add` | 계획(`dryRun: true`)하고 주입합니다. `allowMcp`와 `installNpmDeps`에는 여러분의 동의가 필요합니다. |
| `genpm_list` | 설치된 패키지와 로컬 변경 사항. |
| `genpm_remove` | 패키지를 제거합니다. 여러분이 수정한 코드는 삭제하지 않습니다. |
| `genpm_outdated` | 사용 가능한 새 버전. |
| `genpm_diff` | 설치된 패키지의 upstream 패치와 로컬 변경. |
| `genpm_update` | 3-way 병합으로 업데이트하거나 에이전트가 이미 적용한 패치를 기록합니다(`strategy: "ai"`). |
| `genpm_audit` | 무결성, 서명, 보안 권고. |
| `genpm_validate` | 작성 중인 패키지를 검증합니다. |

서버에는 `force`, `publish`, `login`이 없습니다. 패키지 규칙은 서드파티 콘텐츠(`<package-rules trust="third-party">`)로 반환됩니다. 모듈을 설명할 뿐, 여러분이 요청하지 않은 작업을 허가하지 않습니다.

## 프롬프트

- `genpm-find`: 검색 → 정보 → 시험 실행 → 확인 → 설치.
- `genpm-integrate`: `<d>/AGENTS.md`를 읽고 모듈을 앱에 연동합니다.

## 패키지가 선언하는 MCP 서버

패키지는 필요한 MCP 서버(예: Stripe 서버)를 선언할 수 있습니다. 이 서버들은 **절대** 몰래 추가되지 않습니다. `genpm add`가 먼저 묻고, `--no-mcp`로 건너뛸 수 있으며, 나중에 `genpm mcp add <패키지>`로 추가할 수 있습니다. 시크릿은 환경 변수로 참조되며(`.mcp.json`에서는 `${STRIPE_SECRET_KEY}`, Cursor와 VS Code에서는 `${env:STRIPE_SECRET_KEY}`), 값이 기록되지 않습니다.

## 문제 해결

- **클라이언트에 도구가 보이지 않음**: 설정을 바꾼 뒤 클라이언트를 다시 시작하고, 터미널에서 `genpm mcp serve`가 실행되는지 확인하세요(입력을 기다립니다. Ctrl+C로 종료).
- **클라이언트가 `genpm`을 찾지 못함**: 일부 앱은 셸의 `PATH`를 읽지 않습니다. 명령에 절대 경로를 쓰세요. macOS와 Linux에서는 `which genpm`(예: `/Users/you/.genpm/bin/genpm`), Windows에서는 `where.exe genpm`으로 확인할 수 있습니다.
- **원격 측정**: 서버의 `env`에 `GENPM_TELEMETRY=0`(또는 `DO_NOT_TRACK=1`)을 설정하세요.
- **다른 레지스트리**: 서버의 `env`에 `GENPM_REGISTRY`를 설정하세요.
