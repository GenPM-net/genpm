---
title: Install
section: Getting started
order: 0
---
Install `genpm` once and run it from any terminal as `genpm …`. It is a single native binary for macOS, Linux and Windows: **Node.js is not needed**.

## macOS and Linux

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

## Windows (PowerShell)

```powershell
irm https://genpm.net/install.ps1 | iex
```

The installer picks the right build for your system (Apple silicon or Intel, x64 or arm64, glibc or musl), downloads it from the project's [GitHub Releases](https://github.com/genpm-net/genpm-releases/releases), **verifies its SHA-256** against the release checksums and puts it in `~/.genpm/bin` (`%USERPROFILE%\.genpm\bin` on Windows). Then it adds that folder to your `PATH`. It never asks for `sudo` or admin rights.

Open a new terminal and check it:

```bash
genpm --version
genpm doctor
```

| Platform | Builds |
|---|---|
| macOS | Apple silicon (arm64), Intel (x64) |
| Linux | x64 and arm64, glibc and musl (Alpine needs `apk add libstdc++ libgcc`) |
| Windows | x64 and arm64 |

`git` 2.25+ is still recommended: GenPM uses it to fetch packages by commit (without it, it falls back to GitHub tarballs).

## Update

```bash
genpm upgrade            # latest release
genpm upgrade --check    # only tell me if there is a newer one
genpm upgrade 0.2.0      # a specific version (also to go back)
```

`genpm upgrade` downloads the new binary, verifies its SHA-256 and replaces itself atomically. If the checksum does not match, nothing changes.

## Options

The installers read these environment variables:

| Variable | Default | What it does |
|---|---|---|
| `GENPM_VERSION` | latest | Version to install. Also `sh -s -- 0.2.0` or `-Version 0.2.0`. |
| `GENPM_INSTALL_DIR` | `~/.genpm/bin` | Where to put the binary. |
| `GENPM_NO_MODIFY_PATH=1` | — | Do not touch your shell profile or user `PATH`. |
| `GENPM_DOWNLOAD_URL` | GitHub Releases | Base URL (or folder) with the release files, for internal mirrors. |

A specific version on each platform:

```bash
curl -fsSL https://genpm.net/install.sh | sh -s -- 0.2.0
```

```powershell
& ([scriptblock]::Create((irm https://genpm.net/install.ps1))) -Version 0.2.0
```

## Verify a download by hand

Every release publishes `SHA256SUMS` and a build provenance attestation signed by GitHub Actions. With the [GitHub CLI](https://cli.github.com):

```bash
gh attestation verify genpm-linux-x64 --repo genpm-net/genpm
```

## With npm instead

If you already use Node.js 20.11+ you can also run the npm package. The commands are the same.

```bash
npm i -g genpm          # global install, update with npm i -g genpm@latest
npx genpm add @core/auth   # one-off, nothing installed (handy in CI)
```

## Uninstall

Delete the binary and the `# genpm` line the installer added to your shell profile (`~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` or `~/.config/fish/conf.d/genpm.fish`):

```bash
rm -rf ~/.genpm   # also removes the download cache and your login
```

On Windows, delete `%USERPROFILE%\.genpm` and remove `%USERPROFILE%\.genpm\bin` from your user `PATH` (Settings → System → About → Advanced system settings → Environment Variables).
