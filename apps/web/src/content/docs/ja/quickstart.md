---
title: クイックスタート
section: はじめに
order: 1
---
最初のモジュールを 1 分ほどで追加できます。必要なのは **git 2.25 以上**だけです（ない場合、GenPM は GitHub の tarball を使います）。

## 1. genpm をインストール

macOS と Linux:

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

Windows（PowerShell）:

```powershell
irm https://genpm.net/install.ps1 | iex
```

Node.js 不要の単一バイナリです。その他の方法（npm、特定のバージョン、ミラー）は[インストール](/docs/install)を参照してください。

## 2. パッケージを追加

プロジェクトのルートで実行します。GenPM は計画全体を表示し、何かを書き込む前に確認します。

```bash
genpm add @core/auth
```

GenPM は `@core/auth` とその依存先 `@core/db` を解決し、各マニフェストのレジストリ署名を検証し、正確なコミットをダウンロードしてローカルでスキャンしてから計画を表示します。

## 3. 変更を確認

```bash
git status
```

- コードは `src/lib/auth` と `src/lib/db` にあります。これはもうあなたのコードです。
- AI が読むルールは `src/lib/auth/AGENTS.md` にあります。
- `genpm.lock` は各パッケージを 40 文字のコミット SHA に固定します。
- `.env.example` には設定すべき変数が並びます（名前だけで、値は書きません）。

## 4. AI に任せる

エージェントを開き、モジュールの組み込みを頼みます。エージェントはモジュールのルールを読み、**Integration** セクションに従います。

```text
src/lib/auth/AGENTS.md に従って @core/auth を組み込んで。GitHub ログインを追加して。
```

[MCP サーバー](/docs/mcp)をつなげば、手順 1 もエージェントが行えます。
