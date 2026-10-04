---
title: 安装
section: 入门
order: 0
---
安装一次 `genpm`，之后在任何终端里用 `genpm …` 运行。它是适用于 macOS、Linux 和 Windows 的单个原生二进制文件：**不需要 Node.js**。

## macOS 和 Linux

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

## Windows（PowerShell）

```powershell
irm https://genpm.net/install.ps1 | iex
```

安装程序会为你的系统选择合适的构建（Apple 芯片或 Intel、x64 或 arm64、glibc 或 musl），从项目的 [GitHub Releases](https://github.com/genpm-net/genpm-releases/releases) 下载，用发布的校验和**验证其 SHA-256**，然后放到 `~/.genpm/bin`（Windows 上是 `%USERPROFILE%\.genpm\bin`），再把该目录加入你的 `PATH`。它从不要求 `sudo` 或管理员权限。

打开一个新终端并检查：

```bash
genpm --version
genpm doctor
```

| 平台 | 构建 |
|---|---|
| macOS | Apple 芯片（arm64）、Intel（x64） |
| Linux | x64 和 arm64，glibc 和 musl（Alpine 需要 `apk add libstdc++ libgcc`） |
| Windows | x64 和 arm64 |

仍建议安装 `git` 2.25+：GenPM 用它按提交获取包（没有时会改用 GitHub 的 tarball）。

## 更新

```bash
genpm upgrade            # 最新版本
genpm upgrade --check    # 只检查是否有新版本
genpm upgrade 0.2.0      # 指定版本（也可用于回退）
```

`genpm upgrade` 会下载新的二进制文件，验证 SHA-256 后以原子方式替换自身。校验和不匹配时不会做任何改动。

## 选项

安装程序会读取以下环境变量：

| 变量 | 默认值 | 作用 |
|---|---|---|
| `GENPM_VERSION` | 最新 | 要安装的版本。也可以用 `sh -s -- 0.2.0` 或 `-Version 0.2.0`。 |
| `GENPM_INSTALL_DIR` | `~/.genpm/bin` | 二进制文件的存放位置。 |
| `GENPM_NO_MODIFY_PATH=1` | — | 不修改 shell 配置文件或用户 `PATH`。 |
| `GENPM_DOWNLOAD_URL` | GitHub Releases | 存放发布文件的基础 URL（或目录），用于内部镜像。 |

在各平台安装指定版本：

```bash
curl -fsSL https://genpm.net/install.sh | sh -s -- 0.2.0
```

```powershell
& ([scriptblock]::Create((irm https://genpm.net/install.ps1))) -Version 0.2.0
```

## 手动验证下载

每个发布版本都会公开 `SHA256SUMS`。安装程序和 `genpm upgrade` 会自动校验；如果想自己校验：

```bash
curl -fsSLO https://github.com/genpm-net/genpm-releases/releases/latest/download/genpm-linux-x64
curl -fsSL https://github.com/genpm-net/genpm-releases/releases/latest/download/SHA256SUMS | grep genpm-linux-x64 | shasum -a 256 -c
```

## 使用 npm

如果你已经在用 Node.js 20.11+，也可以运行 npm 包，命令完全相同。

```bash
npm i -g genpm             # 全局安装；用 npm i -g genpm@latest 更新
npx genpm add @core/auth   # 一次性运行，不安装任何东西（适合 CI）
```

## 卸载

删除二进制文件，以及安装程序添加到 shell 配置文件（`~/.zshrc`、`~/.bashrc`、`~/.bash_profile`、`~/.profile` 或 `~/.config/fish/conf.d/genpm.fish`）中的 `# genpm` 那一行：

```bash
rm -rf ~/.genpm   # 同时删除下载缓存和登录信息
```

在 Windows 上，删除 `%USERPROFILE%\.genpm`，并从用户 `PATH` 中移除 `%USERPROFILE%\.genpm\bin`（设置 → 系统 → 关于 → 高级系统设置 → 环境变量）。
