---
title: genpm.json リファレンス
section: 公開
order: 21
---
完全なソースマニフェストの例（リポジトリのルートの `genpm.json`）:

```json
{
  "$": 1,
  "n": "@acme/billing",
  "v": "1.2.0",
  "s": { "en": "Stripe subscriptions with webhooks", "ja": "Webhook 付きの Stripe サブスクリプション" },
  "d": "src/lib/billing",
  "k": ["stripe", "billing", "subscriptions"],
  "g": { "@core/db": "^1.0.0" },
  "p": { "stripe": "^17.0.0" },
  "e": ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  "m": [{ "n": "stripe", "c": "npx", "a": ["-y", "@stripe/mcp"], "e": ["STRIPE_SECRET_KEY"] }]
}
```

マニフェストのトークン消費を抑えるため、キーは 1 文字です。LLM にマニフェストを見せる場所には、必ず次の凡例が付きます。

```text
genpm keys: n=name v=version s=summary r=repo t=git-ref c=commit-sha d=install-dir i=repo-subdir x=ai-rules-file l=license k=keywords g=genpm-deps p=npm-deps e=env-vars m=mcp-servers(n=name c=command a=args u=url e=env)
```

| キー | 名前 | 必須 | ルール |
|---|---|---|---|
| `n` | 名前 | はい | `@scope/name`、小文字。 |
| `v` | バージョン | はい | 厳密な SemVer。`v` の接頭辞やビルドメタデータは不可。 |
| `d` | 配置先 | はい | 利用者のプロジェクト内の相対 POSIX パス。`..` や絶対パス、`.git/`、`node_modules/`、`.genpm/` は不可。最大 8 セグメント。 |
| `s` | 概要 | 推奨 | 160 文字以内の 1 行。文字列または `{ "en": "…", "ja": "…" }`（`en` は必須）。 |
| `r` | リポジトリ | いいえ | HTTPS の Git URL。デフォルトはリモート `origin`。 |
| `t` | ref | いいえ | タグまたは 40 桁の 16 進数 SHA。デフォルトは `v{v}`。ブランチは不可。 |
| `i` | include | いいえ | 注入するリポジトリのサブディレクトリ（デフォルトは `.`）。 |
| `x` | コンテキスト | いいえ | `i` からの相対パスの AI ルールファイル（デフォルトは `AGENTS.md`、16 KB 以内）。 |
| `l` | ライセンス | いいえ | SPDX 式。GitHub が検出したライセンスが優先されます。 |
| `k` | キーワード | いいえ | 最大 10 個、`^[a-z0-9-]{2,32}$`。 |
| `g` | genpm の依存関係 | いいえ | `{ "@core/db": "^1.0.0" }`、最大 10 個。GenPM が解決します。 |
| `p` | npm の依存関係 | いいえ | 利用者に提案するだけで、同意なしにはインストールしません。 |
| `e` | 環境変数 | いいえ | 変数の**名前**（`^[A-Z][A-Z0-9_]{1,63}$`）。値は書きません。 |
| `m` | mcp | いいえ | 最大 5 サーバー: `"@stripe/mcp"` または `{ "n", "c", "a", "u", "e" }`。 |
| `_*` | 拡張 | いいえ | 公式ツールは無視します。それ以外のキーはエラーです。 |

ソースマニフェストに `c`（自身のコミット）を含めては**いけません**。レジストリが解決時に `r`、`t`、`c`、`i`、`x`、`l` を追加します。

`.genpmignore`（gitignore と同じ書式、`i` からの相対パス）でファイルを除外できます。`.git/`、`.github/`、`node_modules/`、`genpm.json`、`.genpmignore`、`.env*` は常に除外されます。

## 上限

| 項目 | 上限 |
|---|---|
| パッケージあたりのファイル数 | 2,000 |
| パッケージのサイズ | 20 MB（インストール時に `--max-size` で変更可） |
| 1 ファイル | 1 MB |
| AI ルールファイル | 16 KB。推奨は約 1,500 トークン、4,000 を超えると警告 |
| パスの長さ / 深さ | 200 文字 / 8 セグメント |
| キーワード · genpm 依存 · npm 依存 · 環境変数 · MCP サーバー | 10 · 10 · 30 · 30 · 5 |

`genpm validate` は、これらすべてをレジストリと同じコードでローカルに確認します。

JSON Schema: [`/schema/v1/genpm.json`](/schema/v1/genpm.json)
