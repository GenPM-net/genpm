---
title: MCP サーバー
section: MCP サーバー
order: 30
---
GenPM の MCP サーバーは、CLI と同じエンジンをエージェントに提供します。モジュールの検索・確認・注入ができ、コード以外のものに触れる前には必ず確認します。

一番手軽なのは、プロジェクトで検出したクライアントの設定を GenPM に書かせる方法です。

```bash
genpm mcp setup
```

変更内容を正確に表示し、書き込む前に確認します。`--client` と `--scope` で対象を選ぶか、以下の手順で手動設定してください。

サーバーは [`genpm` バイナリ](/docs/install)に組み込まれており、クライアントは `genpm mcp serve` を起動します（Node.js 不要）。バイナリがない場合は npm パッケージを使います。以下の例の `genpm mcp serve` を `npx -y @genpm-net/mcp`（`"command": "npx", "args": ["-y", "@genpm-net/mcp"]`）に置き換えてください。npm や npx 経由で実行した `genpm mcp setup` は自動でそうします。

## Claude Code

```bash
claude mcp add genpm -- genpm mcp serve
```

これでユーザー単位で登録されます。チームで共有するには、プロジェクトのルートに `.mcp.json` をコミットします（`genpm mcp setup --client claude --scope project` が書き込みます）。

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

## Cursor

プロジェクト: `.cursor/mcp.json`。ユーザー: `~/.cursor/mcp.json`。

```json
{
  "mcpServers": {
    "genpm": { "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

```bash
genpm mcp setup --client cursor                # プロジェクト
genpm mcp setup --client cursor --scope user   # ユーザー
```

## VS Code（GitHub Copilot）

プロジェクト: `.vscode/mcp.json`（`servers` キーと `type` に注意）。

```json
{
  "servers": {
    "genpm": { "type": "stdio", "command": "genpm", "args": ["mcp", "serve"] }
  }
}
```

ユーザー:

```bash
code --add-mcp '{"name":"genpm","command":"genpm","args":["mcp","serve"]}'
```

## Windsurf

ユーザーのみ: `~/.codeium/windsurf/mcp_config.json`。

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

ユーザーのみ: `~/.codex/config.toml`。

```toml
[mcp_servers.genpm]
command = "genpm"
args = ["mcp", "serve"]
```

```bash
genpm mcp setup --client codex
```

## Gemini CLI

プロジェクト: `.gemini/settings.json` · ユーザー: `~/.gemini/settings.json`。変更するのは `mcpServers` だけで、Gemini のほかの設定はそのままです。

```json
{ "mcpServers": { "genpm": { "command": "genpm", "args": ["mcp", "serve"] } } }
```

```bash
genpm mcp setup --client gemini --scope project
```

## ツール

| ツール | 内容 |
|---|---|
| `genpm_search` | 必要なものからパッケージを検索します。スポンサー結果は返しません。 |
| `genpm_info` | マニフェスト、依存関係、環境変数、MCP サーバー、AI ルール。 |
| `genpm_add` | 計画（`dryRun: true`）と注入。`allowMcp` と `installNpmDeps` にはあなたの同意が必要です。 |
| `genpm_list` | インストール済みのパッケージとローカルの変更。 |
| `genpm_remove` | パッケージを削除します。あなたが変更したコードは削除しません。 |
| `genpm_outdated` | 利用できる新しいバージョン。 |
| `genpm_diff` | インストール済みパッケージの upstream パッチとローカルの変更。 |
| `genpm_update` | 3 方向マージで更新するか、エージェントが適用済みのパッチを記録します（`strategy: "ai"`）。 |
| `genpm_audit` | 完全性、署名、セキュリティアドバイザリー。 |
| `genpm_validate` | 作成中のパッケージを検証します。 |

サーバーには `force`、`publish`、`login` はありません。パッケージのルールはサードパーティのコンテンツ（`<package-rules trust="third-party">`）として返されます。モジュールを説明するだけで、あなたが頼んでいない操作を許可することはありません。

## プロンプト

- `genpm-find`: 検索 → 情報 → ドライラン → 確認 → インストール。
- `genpm-integrate`: `<d>/AGENTS.md` を読み、モジュールをアプリに組み込みます。

## パッケージが宣言する MCP サーバー

パッケージは必要な MCP サーバー（Stripe のものなど）を宣言できます。それらが黙って追加されることは**決してありません**。`genpm add` はまず確認し、`--no-mcp` で省略でき、後から `genpm mcp add <パッケージ>` で追加できます。シークレットは環境変数として参照され（`.mcp.json` では `${STRIPE_SECRET_KEY}`、Cursor と VS Code では `${env:STRIPE_SECRET_KEY}`）、値が書き込まれることはありません。

## トラブルシューティング

- **クライアントにツールが表示されない**: 設定を変えたらクライアントを再起動し、ターミナルで `genpm mcp serve` が起動するか確認してください（入力待ちになります。Ctrl+C で終了）。
- **クライアントが `genpm` を見つけられない**: シェルの `PATH` を読まないアプリがあります。コマンドに絶対パスを指定してください。macOS と Linux では `which genpm`（例: `/Users/you/.genpm/bin/genpm`）、Windows では `where.exe genpm` で確認できます。
- **テレメトリー**: サーバーの `env` に `GENPM_TELEMETRY=0`（または `DO_NOT_TRACK=1`）を設定します。
- **別のレジストリ**: サーバーの `env` に `GENPM_REGISTRY` を設定します。
