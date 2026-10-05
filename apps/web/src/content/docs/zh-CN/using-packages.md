---
title: 使用包
section: 使用包
order: 10
---
## add

```bash
genpm add @core/billing            # 最新版本
genpm add @core/auth@^1.2          # semver 范围
genpm add @core/db --dest packages/db
genpm add @core/billing --dry-run  # 只显示计划，不写入任何内容
```

GenPM 会分别询问三件事：注入代码、添加 MCP 服务器（显示完整命令），以及为 npm 依赖运行包管理器命令。`--yes` 只回答第一个问题；其余两个用 `--mcp` 和 `--install-deps`。

如果目标目录已存在且不为空，`add` 会以 `E_DEST_CONFLICT` 失败。`--force` 会先把旧内容移到 `.genpm/backup/<timestamp>/`。

## search 和 info

```bash
genpm search stripe
genpm info @core/billing          # 清单、依赖、MCP、环境变量和完整的 AI 规则
genpm info @core/billing --rules  # 只看规则
```

## list 和 remove

```bash
genpm list
genpm remove @core/auth
```

`list` 会把每个注入的文件与记录的 SHA-256 比较（本地修改）。`remove` 拒绝删除你修改过的代码（`E_DRIFT`）：用 `--keep-code` 保留，或用 `--force` 强制删除。被其他包依赖的包不能先删除（`E_REQUIRED_BY`）。删除一个包时，也会删除它的 MCP 服务器，以及 GenPM 创建后变为空的文件。

## outdated 和 audit

```bash
genpm outdated
genpm audit   # 在 CI 中使用：npx @genpm-net/cli audit
```

`audit` 会验证文件完整性、锁文件中每个条目的注册表签名、安全公告、已撤回的版本和隔离状态。发现高危或严重问题时以退出码 6 结束。

## update 和 diff

```bash
genpm diff @core/auth
genpm update @core/auth
```

`diff` 显示自已安装版本以来上游的变更，路径已指向你的目录（可用 `git apply --3way` 应用）。`update` 执行三方合并：你没改过的文件获得新版本，你改过的行会保留；如果双方修改了同样的行，文件中会留下标准的 `<<<<<<<` 标记，命令以退出码 4 结束。上游已删除但你修改过的文件会被保留。

`genpm diff --local` 还会列出你的本地修改；`genpm update --dry-run` 只显示计划，不写入任何内容。

## JSON 输出

所有命令都支持 `--json`（单行、英文、不提问）。没有交互式终端时，任何未回答的问题都会以 `E_CONFIRM_REQUIRED`（退出码 2）失败，并且不会写入任何内容。

## 配方：一次安装多个软件包

配方用一条命令安装多个可协同工作的软件包，计划和确认与 `genpm add` 相同。GenPM 精选的配方列在 [/recipes](/recipes)；你的团队也可以把自己的配方作为 JSON 文件放在仓库里。

```bash
genpm compose --list
genpm compose saas-starter --dry-run
genpm compose ./stack.json
```

```json
{ "name": "my-stack", "p": ["@core/db", "@core/auth@^1.2"] }
```
