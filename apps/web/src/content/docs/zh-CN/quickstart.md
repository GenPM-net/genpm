---
title: 快速开始
section: 入门
order: 1
---
大约一分钟就能添加你的第一个模块。你只需要 **git 2.25+**（没有时 GenPM 会改用 GitHub 的 tarball）。

## 1. 安装 genpm

macOS 和 Linux：

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

Windows（PowerShell）：

```powershell
irm https://genpm.net/install.ps1 | iex
```

它是单个二进制文件，不需要 Node.js。其他方式（npm、指定版本、镜像）见[安装](/docs/install)。

## 2. 添加一个包

在项目根目录运行。GenPM 会显示完整计划，并在写入任何内容前征求确认。

```bash
genpm add @core/auth
```

GenPM 会解析 `@core/auth` 及其依赖 `@core/db`，验证每个清单的注册表签名，下载确切的提交并在本地扫描，然后再向你展示计划。

## 3. 查看变化

```bash
git status
```

- 代码位于 `src/lib/auth` 和 `src/lib/db`：现在它就是你的代码。
- 你的 AI 读取的规则在 `src/lib/auth/AGENTS.md`。
- `genpm.lock` 把每个包固定到一个 40 个字符的提交 SHA。
- `.env.example` 列出了需要配置的变量（只有名称，从不写入值）。

## 4. 交给你的 AI

打开你的智能体，让它把模块接入项目。它会读取模块规则并按照其中的 **Integration** 部分操作：

```text
按照 src/lib/auth/AGENTS.md 接入 @core/auth，添加 GitHub 登录。
```

连接 [MCP 服务器](/docs/mcp) 后，第 1 步也可以由智能体完成。
