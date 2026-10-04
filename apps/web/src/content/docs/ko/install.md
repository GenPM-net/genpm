---
title: 설치
section: 시작하기
order: 0
---
`genpm`을 한 번 설치하면 어떤 터미널에서든 `genpm …`으로 실행할 수 있습니다. macOS, Linux, Windows용 단일 네이티브 바이너리이므로 **Node.js가 필요 없습니다**.

## macOS와 Linux

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

## Windows(PowerShell)

```powershell
irm https://genpm.net/install.ps1 | iex
```

설치 프로그램은 시스템에 맞는 빌드(Apple 실리콘 또는 Intel, x64 또는 arm64, glibc 또는 musl)를 골라 프로젝트의 [GitHub Releases](https://github.com/genpm-net/genpm-releases/releases)에서 내려받고, 릴리스 체크섬으로 **SHA-256을 검증**한 뒤 `~/.genpm/bin`(Windows에서는 `%USERPROFILE%\.genpm\bin`)에 둡니다. 그런 다음 이 폴더를 `PATH`에 추가합니다. `sudo`나 관리자 권한은 절대 요구하지 않습니다.

새 터미널을 열고 확인하세요.

```bash
genpm --version
genpm doctor
```

| 플랫폼 | 빌드 |
|---|---|
| macOS | Apple 실리콘(arm64), Intel(x64) |
| Linux | x64와 arm64, glibc와 musl(Alpine은 `apk add libstdc++ libgcc` 필요) |
| Windows | x64와 arm64 |

`git` 2.25 이상을 권장합니다. GenPM은 커밋 단위로 패키지를 가져올 때 이를 사용합니다(없으면 GitHub tarball을 사용).

## 업데이트

```bash
genpm upgrade            # 최신 릴리스
genpm upgrade --check    # 새 버전이 있는지만 확인
genpm upgrade 0.2.0      # 특정 버전(되돌릴 때도 사용)
```

`genpm upgrade`는 새 바이너리를 내려받아 SHA-256을 검증한 뒤 원자적으로 자신을 교체합니다. 체크섬이 맞지 않으면 아무것도 바뀌지 않습니다.

## 옵션

설치 프로그램은 다음 환경 변수를 읽습니다.

| 변수 | 기본값 | 역할 |
|---|---|---|
| `GENPM_VERSION` | 최신 | 설치할 버전. `sh -s -- 0.2.0` 또는 `-Version 0.2.0`으로도 지정할 수 있습니다. |
| `GENPM_INSTALL_DIR` | `~/.genpm/bin` | 바이너리를 둘 위치. |
| `GENPM_NO_MODIFY_PATH=1` | — | 셸 프로필이나 사용자 `PATH`를 건드리지 않습니다. |
| `GENPM_DOWNLOAD_URL` | GitHub Releases | 릴리스 파일이 있는 기본 URL(또는 폴더). 내부 미러용. |

플랫폼별로 특정 버전 설치:

```bash
curl -fsSL https://genpm.net/install.sh | sh -s -- 0.2.0
```

```powershell
& ([scriptblock]::Create((irm https://genpm.net/install.ps1))) -Version 0.2.0
```

## 다운로드 직접 검증하기

모든 릴리스에는 `SHA256SUMS`가 공개됩니다. 설치 프로그램과 `genpm upgrade`가 자동으로 확인하며, 직접 확인하려면 다음과 같이 합니다.

```bash
curl -fsSLO https://github.com/genpm-net/genpm-releases/releases/latest/download/genpm-linux-x64
curl -fsSL https://github.com/genpm-net/genpm-releases/releases/latest/download/SHA256SUMS | grep genpm-linux-x64 | shasum -a 256 -c
```

## npm으로 사용하기

이미 Node.js 20.11 이상을 쓰고 있다면 npm 패키지로도 실행할 수 있습니다. 명령은 같습니다.

```bash
npm i -g @genpm-net/cli             # 전역 설치. 업데이트는 npm i -g @genpm-net/cli@latest
npx @genpm-net/cli add @core/auth   # 아무것도 설치하지 않고 한 번만 실행(CI에서 유용)
```

## 제거

바이너리와, 설치 프로그램이 셸 프로필(`~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` 또는 `~/.config/fish/conf.d/genpm.fish`)에 추가한 `# genpm` 줄을 삭제하세요.

```bash
rm -rf ~/.genpm   # 다운로드 캐시와 로그인 정보도 함께 삭제됩니다
```

Windows에서는 `%USERPROFILE%\.genpm`을 삭제하고 사용자 `PATH`에서 `%USERPROFILE%\.genpm\bin`을 제거하세요(설정 → 시스템 → 정보 → 고급 시스템 설정 → 환경 변수).
