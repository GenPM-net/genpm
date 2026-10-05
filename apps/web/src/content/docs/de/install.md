---
title: Installation
section: Erste Schritte
order: 0
---
Installiere `genpm` einmal und starte es in jedem Terminal mit `genpm …`. Es ist ein einzelnes natives Binary für macOS, Linux und Windows: **Node.js wird nicht benötigt**.

## macOS und Linux

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

## Windows (PowerShell)

```powershell
irm https://genpm.net/install.ps1 | iex
```

Der Installer wählt den passenden Build für dein System (Apple Silicon oder Intel, x64 oder arm64, glibc oder musl), lädt ihn aus den [GitHub Releases](https://github.com/genpm-net/genpm-releases/releases) des Projekts, **prüft seinen SHA-256** gegen die Prüfsummen des Releases und legt ihn in `~/.genpm/bin` ab (`%USERPROFILE%\.genpm\bin` unter Windows). Danach fügt er den Ordner zu deinem `PATH` hinzu. Er fragt nie nach `sudo` oder Administratorrechten.

Öffne ein neues Terminal und prüfe es:

```bash
genpm --version
genpm doctor
```

| Plattform | Builds |
|---|---|
| macOS | Apple Silicon (arm64), Intel (x64) |
| Linux | x64 und arm64, glibc und musl (Alpine braucht `apk add libstdc++ libgcc`) |
| Windows | x64 und arm64 |

`git` 2.25+ wird weiterhin empfohlen: GenPM lädt Pakete damit per Commit (ohne git nutzt es die Tarballs von GitHub).

## Homebrew und Scoop

```bash
brew install genpm-net/tap/genpm                                        # macOS, Linux
```

```powershell
scoop bucket add genpm https://github.com/GenPM-net/scoop-bucket; scoop install genpm/genpm   # Windows
```

Updates kommen über den Paketmanager (`brew upgrade genpm`, `scoop update genpm`); `genpm upgrade` weist darauf hin.

## Aktualisieren

```bash
genpm upgrade            # neuestes Release
genpm upgrade --check    # nur melden, ob es ein neueres gibt
genpm upgrade 0.2.0      # eine bestimmte Version (auch zum Zurückgehen)
```

`genpm upgrade` lädt das neue Binary, prüft seinen SHA-256 und ersetzt sich atomar. Stimmt die Prüfsumme nicht, ändert sich nichts.

## Optionen

Die Installer lesen diese Umgebungsvariablen:

| Variable | Standard | Wirkung |
|---|---|---|
| `GENPM_VERSION` | neueste | Zu installierende Version. Auch `sh -s -- 0.2.0` oder `-Version 0.2.0`. |
| `GENPM_INSTALL_DIR` | `~/.genpm/bin` | Wohin das Binary kommt. |
| `GENPM_NO_MODIFY_PATH=1` | — | Shell-Profil und Benutzer-`PATH` bleiben unverändert. |
| `GENPM_DOWNLOAD_URL` | GitHub Releases | Basis-URL (oder Ordner) mit den Release-Dateien, für interne Mirrors. |

Eine bestimmte Version auf jeder Plattform:

```bash
curl -fsSL https://genpm.net/install.sh | sh -s -- 0.2.0
```

```powershell
& ([scriptblock]::Create((irm https://genpm.net/install.ps1))) -Version 0.2.0
```

## Einen Download selbst prüfen

Jedes Release veröffentlicht `SHA256SUMS`. Der Installer und `genpm upgrade` prüfen das für dich; selbst geht es so:

```bash
curl -fsSLO https://github.com/genpm-net/genpm-releases/releases/latest/download/genpm-linux-x64
curl -fsSL https://github.com/genpm-net/genpm-releases/releases/latest/download/SHA256SUMS | grep genpm-linux-x64 | shasum -a 256 -c
```

## Mit npm

Wenn du schon Node.js 20.11+ nutzt, kannst du auch das npm-Paket verwenden. Die Befehle sind dieselben.

```bash
npm i -g @genpm-net/cli             # globale Installation; Update mit npm i -g @genpm-net/cli@latest
npx @genpm-net/cli add @core/auth   # einmalig, ohne Installation (praktisch in CI)
```

## Deinstallieren

Lösche das Binary und die Zeile `# genpm`, die der Installer in dein Shell-Profil geschrieben hat (`~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` oder `~/.config/fish/conf.d/genpm.fish`):

```bash
rm -rf ~/.genpm   # entfernt auch den Download-Cache und deine Anmeldung
```

Unter Windows lösche `%USERPROFILE%\.genpm` und entferne `%USERPROFILE%\.genpm\bin` aus dem Benutzer-`PATH` (Einstellungen → System → Info → Erweiterte Systemeinstellungen → Umgebungsvariablen).
