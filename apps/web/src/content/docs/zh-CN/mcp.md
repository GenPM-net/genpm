---
title: MCP 服务器
section: MCP 服务器
order: 30
---
GenPM 的 MCP 服务器为你的智能体提供与 CLI 相同的引擎：它可以搜索、检查和注入模块，并且在改动你代码以外的任何内容之前都会先询问你。

最快的方式是让 GenPM 为它在项目中检测到的客户端写入配置：

```bash
genpm mcp setup
```

它会显示确切的改动，并在写入前征求确认。用 `--client` 和 `--scope` 选择目标，或按下文手动配置。

服务器内置在 [`genpm` 二进制文件](/docs/install)中：你的客户端启动 `genpm mcp serve`，无需 Node.js。没有二进制文件时，改用 npm 包：把下面示例中的 `genpm mcp serve` 换成 `npx -y @genpm-net/mcp`（`"command": "npx", "args": ["-y", "@genpm-net/mcp"]`）；通过 npm 或 npx 运行的 `genpm mcp setup` 会自动这样做。

## Claude Code

```bash
claude mcp add genpm -- genpm mcp serve
```

这会为你的用户注册它。要与团队共享，在项目根目录提交一个 `.mcp.json`（`genpm mcp setup --client claude --scope project` 会写入它）：

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

## Cursor

项目：`.cursor/mcp.json`。用户：`~/.cursor/mcp.json`。

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client cursor                # 项目
genpm mcp setup --client cursor --scope user   # 用户
```

## VS Code（GitHub Copilot）

项目：`.vscode/mcp.json`（注意 `servers` 键和 `type`）：

```json
{
  "servers": {
    "genpm": { "type": "stdio", "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

用户：

```bash
code --add-mcp '{"name":"genpm","command":"genpm","args":["mcp","serve"]}'
```

## Windsurf

仅用户：`~/.codeium/windsurf/mcp_config.json`。

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

仅用户：`~/.codex/config.toml`。

```toml
[mcp_servers.genpm]
command = "genpm"
args = ["mcp", "serve"]
```

```bash
genpm mcp setup --client codex
```

## Gemini CLI

项目：`.gemini/settings.json` · 用户：`~/.gemini/settings.json`。只修改 `mcpServers`，Gemini 的其他设置保持不变。

```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

```bash
genpm mcp setup --client gemini --scope project
```

## 远程服务器（只读）

支持通过 Streamable HTTP 连接远程 MCP 服务器的客户端，无需安装任何东西即可连接 `https://mcp.genpm.net`。它只提供 `genpm_search` 和 `genpm_info`（不接触文件和凭据）：要安装时，代理会给出 `genpm add` 命令，或者改用上面的本地服务器。

```json
{ "mcpServers": { "genpm": { "url": "https://mcp.genpm.net" } } }
```

## 工具

| 工具 | 作用 |
|---|---|
| `genpm_search` | 按需求搜索包。从不返回赞助结果。 |
| `genpm_info` | 清单、依赖、环境变量、MCP 服务器和 AI 规则。 |
| `genpm_add` | 计划（`dryRun: true`）并注入。`allowMcp` 和 `installNpmDeps` 需要你的同意。 |
| `genpm_list` | 已安装的包及本地改动。 |
| `genpm_remove` | 删除一个包；从不删除你修改过的代码。 |
| `genpm_outdated` | 可用的新版本。 |
| `genpm_diff` | 已安装软件包的上游补丁和你的本地修改。 |
| `genpm_update` | 通过三方合并更新，或记录代理已应用的补丁（`strategy: "ai"`）。 |
| `genpm_audit` | 完整性、签名和安全公告。 |
| `genpm_validate` | 验证你正在编写的包。 |

服务器没有 `force`、`publish` 或 `login`。包的规则作为第三方内容返回（`<package-rules trust="third-party">`）：它们只描述模块，从不授权你没有要求的操作。

## 提示词

- `genpm-find`：搜索 → 信息 → 试运行 → 确认 → 安装。
- `genpm-integrate`：读取 `<d>/AGENTS.md` 并把模块接入应用。

## 包声明的 MCP 服务器

一个包可以声明它需要的 MCP 服务器（例如 Stripe 的）。它们**绝不会**被悄悄添加：`genpm add` 会先询问，`--no-mcp` 会跳过它们，之后你也可以用 `genpm mcp add <包名>` 添加。密钥以环境变量的形式引用（`.mcp.json` 中为 `${STRIPE_SECRET_KEY}`，Cursor 和 VS Code 中为 `${env:STRIPE_SECRET_KEY}`），从不写入实际值。

## 故障排查

- **客户端看不到工具**：修改配置后重启客户端；检查 `genpm mcp serve` 能否在终端中启动（它会等待输入，按 Ctrl+C 退出）。
- **客户端找不到 `genpm`**：有些应用不读取 shell 的 `PATH`。请用绝对路径作为命令：在 macOS 和 Linux 上用 `which genpm` 查看（例如 `/Users/you/.genpm/bin/genpm`），在 Windows 上用 `where.exe genpm`。
- **遥测**：在服务器的 `env` 中设置 `GENPM_TELEMETRY=0`（或 `DO_NOT_TRACK=1`）。
- **其他注册表**：在服务器的 `env` 中设置 `GENPM_REGISTRY`。
