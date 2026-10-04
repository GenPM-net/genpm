---
title: パッケージの使い方
section: パッケージを使う
order: 10
---
## add

```bash
genpm add @core/billing            # 最新版
genpm add @core/auth@^1.2          # semver の範囲
genpm add @core/db --dest packages/db
genpm add @core/billing --dry-run  # 計画を表示するだけで何も書き込まない
```

GenPM は 3 つのことを別々に確認します。コードの注入、MCP サーバーの追加（コマンド全体を表示）、npm 依存関係のためのパッケージマネージャーコマンドの実行です。`--yes` が答えるのは最初の 1 つだけで、残りには `--mcp` と `--install-deps` を使います。

配置先が存在して空でない場合、`add` は `E_DEST_CONFLICT` で失敗します。`--force` は既存の内容をまず `.genpm/backup/<timestamp>/` に移します。

## search と info

```bash
genpm search stripe
genpm info @core/billing          # マニフェスト、依存関係、MCP、環境変数、AI ルール全文
genpm info @core/billing --rules  # ルールだけ
```

## list と remove

```bash
genpm list
genpm remove @core/auth
```

`list` は注入した各ファイルを記録済みの SHA-256 と比較します（ローカルの変更）。`remove` はあなたが変更したコードの削除を拒否します（`E_DRIFT`）。残すには `--keep-code`、それでも削除するには `--force` を使います。他のパッケージが依存しているパッケージは先に削除できません（`E_REQUIRED_BY`）。パッケージを削除すると、その MCP サーバーと、GenPM が作成して空になったファイルも削除されます。

## outdated と audit

```bash
genpm outdated
genpm audit   # CI に追加する場合: npx genpm audit
```

`audit` はファイルの完全性、ロックの各エントリのレジストリ署名、セキュリティアドバイザリー、取り下げられたバージョン、隔離を検証します。重大度が高いまたは致命的な問題があると終了コード 6 で終わります。

## JSON 出力

すべてのコマンドが `--json`（1 行、英語、確認なし）に対応しています。対話できる端末がない場合、未回答の確認は `E_CONFIRM_REQUIRED`（終了コード 2）で失敗し、何も書き込まれません。
