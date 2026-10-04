---
title: Instalação
section: Primeiros passos
order: 0
---
Instale o `genpm` uma vez e use-o em qualquer terminal como `genpm …`. É um único binário nativo para macOS, Linux e Windows: **não precisa de Node.js**.

## macOS e Linux

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

## Windows (PowerShell)

```powershell
irm https://genpm.net/install.ps1 | iex
```

O instalador escolhe a build certa para o seu sistema (Apple silicon ou Intel, x64 ou arm64, glibc ou musl), baixa dos [GitHub Releases](https://github.com/genpm-net/genpm-releases/releases) do projeto, **verifica o SHA-256** com os checksums do release e coloca em `~/.genpm/bin` (`%USERPROFILE%\.genpm\bin` no Windows). Depois adiciona essa pasta ao seu `PATH`. Nunca pede `sudo` nem permissões de administrador.

Abra um terminal novo e confira:

```bash
genpm --version
genpm doctor
```

| Plataforma | Builds |
|---|---|
| macOS | Apple silicon (arm64), Intel (x64) |
| Linux | x64 e arm64, glibc e musl (no Alpine: `apk add libstdc++ libgcc`) |
| Windows | x64 e arm64 |

Ainda se recomenda `git` 2.25+: o GenPM o usa para baixar os pacotes por commit (sem ele, usa os tarballs do GitHub).

## Atualizar

```bash
genpm upgrade            # última versão
genpm upgrade --check    # só avisa se há uma mais nova
genpm upgrade 0.2.0      # uma versão específica (também para voltar)
```

`genpm upgrade` baixa o binário novo, verifica o SHA-256 e se substitui de forma atômica. Se o checksum não bater, nada muda.

## Opções

Os instaladores leem estas variáveis de ambiente:

| Variável | Padrão | O que faz |
|---|---|---|
| `GENPM_VERSION` | última | Versão a instalar. Também `sh -s -- 0.2.0` ou `-Version 0.2.0`. |
| `GENPM_INSTALL_DIR` | `~/.genpm/bin` | Onde colocar o binário. |
| `GENPM_NO_MODIFY_PATH=1` | — | Não mexe no perfil do shell nem no `PATH` do usuário. |
| `GENPM_DOWNLOAD_URL` | GitHub Releases | URL base (ou pasta) com os arquivos do release, para mirrors internos. |

Uma versão específica em cada plataforma:

```bash
curl -fsSL https://genpm.net/install.sh | sh -s -- 0.2.0
```

```powershell
& ([scriptblock]::Create((irm https://genpm.net/install.ps1))) -Version 0.2.0
```

## Verificar um download manualmente

Cada release publica `SHA256SUMS`. O instalador e o `genpm upgrade` fazem a verificação por você; para fazer você mesmo:

```bash
curl -fsSLO https://github.com/genpm-net/genpm-releases/releases/latest/download/genpm-linux-x64
curl -fsSL https://github.com/genpm-net/genpm-releases/releases/latest/download/SHA256SUMS | grep genpm-linux-x64 | shasum -a 256 -c
```

## Com npm

Se você já usa Node.js 20.11+, também pode rodar o pacote do npm. Os comandos são os mesmos.

```bash
npm i -g @genpm/cli             # instalação global; atualize com npm i -g @genpm/cli@latest
npx @genpm/cli add @core/auth   # uso pontual, sem instalar nada (útil em CI)
```

## Desinstalar

Apague o binário e a linha `# genpm` que o instalador adicionou ao perfil do seu shell (`~/.zshrc`, `~/.bashrc`, `~/.bash_profile`, `~/.profile` ou `~/.config/fish/conf.d/genpm.fish`):

```bash
rm -rf ~/.genpm   # também remove o cache de downloads e o seu login
```

No Windows, apague `%USERPROFILE%\.genpm` e remova `%USERPROFILE%\.genpm\bin` do `PATH` do usuário (Configurações → Sistema → Sobre → Configurações avançadas do sistema → Variáveis de ambiente).
