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
genpm audit   # CI に追加する場合: npx @genpm-net/cli audit
```

`audit` はファイルの完全性、ロックの各エントリのレジストリ署名、セキュリティアドバイザリー、取り下げられたバージョン、隔離を検証します。重大度が高いまたは致命的な問題があると終了コード 6 で終わります。

## update と diff

```bash
genpm diff @core/auth
genpm update @core/auth
```

`diff` はインストール済みバージョン以降に upstream で変わった内容を、あなたのフォルダーを指すパスで表示します（`git apply --3way` で適用できます）。`update` は 3 方向マージを行います。触れていないファイルは新しいバージョンになり、あなたが変更した行は保持され、両方が同じ行を変更した場合はファイルに標準の `<<<<<<<` マーカーが残り、コマンドは終了コード 4 で終わります。upstream で削除されてもあなたが変更したファイルは残ります。

`genpm diff --local` はローカルの変更も表示し、`genpm update --dry-run` は何も書き込まずに計画を表示します。

## JSON 出力

すべてのコマンドが `--json`（1 行、英語、確認なし）に対応しています。対話できる端末がない場合、未回答の確認は `E_CONFIRM_REQUIRED`（終了コード 2）で失敗し、何も書き込まれません。

## レシピ: 複数のパッケージをまとめて

レシピは、一緒に動く複数のパッケージを 1 つのコマンドでインストールします。プランと確認は `genpm add` と同じです。GenPM が選んだレシピは [/recipes](/recipes) にあります。チームのレシピをリポジトリ内の JSON ファイルとして持つこともできます。

```bash
genpm compose --list
genpm compose saas-starter --dry-run
genpm compose ./stack.json
```

```json
{ "name": "my-stack", "p": ["@core/db", "@core/auth@^1.2"] }
```

## プライベートレジストリ

チームはプライベートリポジトリのパッケージをプライベートレジストリに置けます（`genpm registry create acme --owner my-org`、または [設定 › プライベートレジストリ](/settings/registries)）。メンバー以外には存在しないように見えます。`.genpmrc` で scope をそこに向けてサインインすれば、`genpm add` はいつも通り動きます。メンバーは `internal` のパッケージを読めます。`private` には権限が必要です（`genpm access grant @acme/api team:my-org/backend read`）。レジストリがプライベートリポジトリを読むには、組織に GenPM の GitHub App をインストールしておく必要があります。

```ini
# .genpmrc
@acme:registry=https://api.genpm.net/r/acme
# ENT-03: policy
policy=https://api.genpm.net/r/acme
```

```bash
genpm login --registry https://api.genpm.net/r/acme
genpm add @acme/payments
```
