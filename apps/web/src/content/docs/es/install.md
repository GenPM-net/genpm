---
title: Instalación
section: Primeros pasos
order: 0
---
Instala `genpm` una vez y ejecútalo desde cualquier terminal como `genpm …`. Es un único binario nativo para macOS, Linux y Windows: **no necesitas Node.js**.

## macOS y Linux

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

## Windows (PowerShell)

```powershell
irm https://genpm.net/install.ps1 | iex
```

El instalador elige la compilación adecuada para tu sistema (Apple silicon o Intel, x64 o arm64, glibc o musl), la descarga de los [GitHub Releases](https://github.com/genpm-net/genpm-releases/releases) del proyecto, **verifica su SHA-256** contra los checksums del release y la deja en `~/.genpm/bin` (`%USERPROFILE%\.genpm\bin` en Windows). Después añade esa carpeta a tu `PATH`. Nunca pide `sudo` ni permisos de administrador.

Abre una terminal nueva y compruébalo:

```bash
genpm --version
genpm doctor
```

| Plataforma | Compilaciones |
|---|---|
| macOS | Apple silicon (arm64), Intel (x64) |
| Linux | x64 y arm64, glibc y musl (Alpine necesita `apk add libstdc++ libgcc`) |
| Windows | x64 y arm64 |

Sigue siendo recomendable tener `git` 2.25+: GenPM lo usa para descargar los paquetes por commit (sin él, usa los tarballs de GitHub).

## Actualizar

```bash
genpm upgrade            # última versión
genpm upgrade --check    # solo avisa si hay una más nueva
genpm upgrade 0.2.0      # una versión concreta (también para volver atrás)
```

`genpm upgrade` descarga el binario nuevo, verifica su SHA-256 y se reemplaza a sí mismo de forma atómica. Si el checksum no coincide, no cambia nada.

## Opciones

Los instaladores leen estas variables de entorno:

| Variable | Por defecto | Qué hace |
|---|---|---|
| `GENPM_VERSION` | la última | Versión a instalar. También `sh -s -- 0.2.0` o `-Version 0.2.0`. |
| `GENPM_INSTALL_DIR` | `~/.genpm/bin` | Dónde dejar el binario. |
| `GENPM_NO_MODIFY_PATH=1` | — | No tocar el perfil de tu shell ni el `PATH` de usuario. |
| `GENPM_DOWNLOAD_URL` | GitHub Releases | URL base (o carpeta) con los archivos del release, para mirrors internos. |

Una versión concreta en cada plataforma:

```bash
curl -fsSL https://genpm.net/install.sh | sh -s -- 0.2.0
```

```powershell
& ([scriptblock]::Create((irm https://genpm.net/install.ps1))) -Version 0.2.0
```

## Verificar una descarga a mano

Cada release publica `SHA256SUMS`. El instalador y `genpm upgrade` lo comprueban por ti; para hacerlo tú:

```bash
curl -fsSLO https://github.com/genpm-net/genpm-releases/releases/latest/download/genpm-linux-x64
curl -fsSL https://github.com/genpm-net/genpm-releases/releases/latest/download/SHA256SUMS | grep genpm-linux-x64 | shasum -a 256 -c
```

## Con npm

Si ya usas Node.js 20.11+ también puedes ejecutar el paquete de npm. Los comandos son los mismos.

```bash
npm i -g @genpm-net/cli             # instalación global; se actualiza con npm i -g @genpm-net/cli@latest
npx @genpm-net/cli add @core/auth   # puntual, sin instalar nada (útil en CI)
```

## Desinstalar

Borra el binario y la línea `# genpm` que el instalador añadió al perfil de tu shell (`~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` o `~/.config/fish/conf.d/genpm.fish`):

```bash
rm -rf ~/.genpm   # borra también la caché de descargas y tu sesión
```

En Windows, borra `%USERPROFILE%\.genpm` y quita `%USERPROFILE%\.genpm\bin` del `PATH` de usuario (Configuración → Sistema → Información → Configuración avanzada del sistema → Variables de entorno).
