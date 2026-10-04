---
title: 你的第一个包
section: 发布
order: 20
---
你的代码留在 GitHub 上；注册表只保存清单及其指向的提交。

**在网页上发布，无需终端：** 登录 [genpm.net/publish](/publish)，选择你的一个仓库，GenPM 会告诉你还缺什么。它会为你生成 `genpm.json`，每个修复按钮都会打开已准备好文件的 GitHub 页面，你只需提交（GenPM 从不要求写入权限）。全部变绿后，在同一页面发布即可。

**在终端中发布：**

```bash
genpm init          # 创建 genpm.json、AGENTS.md 和 .genpmignore
genpm validate      # 与注册表相同的扫描器
git tag v1.0.0 && git push --tags
genpm login
genpm publish
```

`publish` 会检查没有未提交的改动，并且 `origin` 上的标签与你本地指向同一个提交（`E_REF_NOT_PUSHED`）。随后注册表**从 GitHub** 读取该提交中的 `genpm.json`（从不读取你的机器），进行校验、扫描文件树、签名解析后的清单，并上架该包。

版本不可变：同一个 `(名称, 版本)` 永远不能发布两次，即使撤回后也不行。分支总会被拒绝（`E_REF_MUTABLE`）。

可以先试运行，不发布任何内容：

```bash
genpm publish --dry-run
```

## 注册表检查什么

- 标签在 GitHub 上存在，并指向你推送的提交。
- `genpm.json` 有效，且名称与你有权发布的作用域一致。
- 文件树通过扫描：没有会自动运行的文件（安装脚本、`.npmrc`、`.vscode/tasks.json`、git 钩子……），没有密钥，没有符号链接，路径安全。
- AI 规则中没有提示注入。如有可疑之处，该版本会被**隔离**，并由人工在 24 个工作小时内审核。

## 预发布版本和 dist-tag

像 `1.3.0-beta.1` 这样的预发布版本会自动进入 dist-tag `next`，因此 `latest` 仍指向你最新的稳定版本。用户可以通过 `genpm add @acme/billing@next` 选择它。用 `--dist-tag` 可以指定其他标签。

## Monorepo

用 `--manifest packages/billing/genpm.json` 发布位于子目录中的包，并把 `i` 设为该目录，这样只会注入它。为每个包使用单独的标签，例如 `billing@1.2.0`。

## 撤回一个版本

```bash
genpm yank @acme/billing@1.2.0 --reason "在 Stripe API 2026-09 下 webhook 失效"
```

被撤回的版本对已在使用的项目仍然不可变且可验证，但新的安装会跳过它，网站上会显示原因。

## 作用域

你的作用域是你的 GitHub 用户名或你所在的组织。`@core`、`@genpm`、`@official` 等作用域是保留的。

## CI

`genpm init --workflow` 会添加一个 GitHub Actions 工作流，在推送 `v*` 标签时发布，并使用 `GENPM_TOKEN` 作为密钥。
