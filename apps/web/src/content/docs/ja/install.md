---
title: インストール
section: はじめに
order: 0
---
`genpm` を一度インストールすれば、どのターミナルからでも `genpm …` で実行できます。macOS、Linux、Windows 向けの単一のネイティブバイナリなので、**Node.js は不要です**。

## macOS と Linux

```bash
curl -fsSL https://genpm.net/install.sh | sh
```

## Windows（PowerShell）

```powershell
irm https://genpm.net/install.ps1 | iex
```

インストーラーはシステムに合ったビルド（Apple シリコンか Intel、x64 か arm64、glibc か musl）を選び、プロジェクトの [GitHub Releases](https://github.com/genpm-net/genpm-releases/releases) からダウンロードし、リリースのチェックサムで **SHA-256 を検証**してから `~/.genpm/bin`（Windows では `%USERPROFILE%\.genpm\bin`）に配置します。その後、このフォルダを `PATH` に追加します。`sudo` や管理者権限を求めることはありません。

新しいターミナルを開いて確認します。

```bash
genpm --version
genpm doctor
```

| プラットフォーム | ビルド |
|---|---|
| macOS | Apple シリコン（arm64）、Intel（x64） |
| Linux | x64 と arm64、glibc と musl（Alpine では `apk add libstdc++ libgcc` が必要） |
| Windows | x64 と arm64 |

`git` 2.25 以上の利用を推奨します。GenPM はパッケージをコミット単位で取得するのに使います（ない場合は GitHub の tarball を使います）。

## 更新

```bash
genpm upgrade            # 最新リリース
genpm upgrade --check    # 新しいバージョンがあるかだけ確認
genpm upgrade 0.2.0      # 特定のバージョン（戻すときにも）
```

`genpm upgrade` は新しいバイナリをダウンロードし、SHA-256 を検証してからアトミックに置き換えます。チェックサムが一致しなければ何も変わりません。

## オプション

インストーラーは次の環境変数を読み取ります。

| 変数 | デフォルト | 役割 |
|---|---|---|
| `GENPM_VERSION` | 最新 | インストールするバージョン。`sh -s -- 0.2.0` や `-Version 0.2.0` でも指定できます。 |
| `GENPM_INSTALL_DIR` | `~/.genpm/bin` | バイナリの配置先。 |
| `GENPM_NO_MODIFY_PATH=1` | — | シェルのプロファイルやユーザーの `PATH` を変更しません。 |
| `GENPM_DOWNLOAD_URL` | GitHub Releases | リリースファイルがあるベース URL（またはフォルダ）。社内ミラー向け。 |

各プラットフォームで特定のバージョンを入れる場合:

```bash
curl -fsSL https://genpm.net/install.sh | sh -s -- 0.2.0
```

```powershell
& ([scriptblock]::Create((irm https://genpm.net/install.ps1))) -Version 0.2.0
```

## ダウンロードを手動で検証する

各リリースには `SHA256SUMS` が公開されています。インストーラーと `genpm upgrade` は自動で確認しますが、自分で確認する場合は次のとおりです。

```bash
curl -fsSLO https://github.com/genpm-net/genpm-releases/releases/latest/download/genpm-linux-x64
curl -fsSL https://github.com/genpm-net/genpm-releases/releases/latest/download/SHA256SUMS | grep genpm-linux-x64 | shasum -a 256 -c
```

## npm を使う場合

すでに Node.js 20.11 以上を使っているなら、npm パッケージでも実行できます。コマンドは同じです。

```bash
npm i -g genpm             # グローバルインストール。更新は npm i -g genpm@latest
npx genpm add @core/auth   # 何もインストールせず一度だけ実行（CI で便利）
```

## アンインストール

バイナリと、インストーラーがシェルのプロファイル（`~/.zshrc`、`~/.bashrc`、`~/.bash_profile`、`~/.profile`、`~/.config/fish/conf.d/genpm.fish`）に追加した `# genpm` の行を削除します。

```bash
rm -rf ~/.genpm   # ダウンロードキャッシュとログイン情報も削除されます
```

Windows では `%USERPROFILE%\.genpm` を削除し、ユーザーの `PATH` から `%USERPROFILE%\.genpm\bin` を外します（設定 → システム → バージョン情報 → システムの詳細設定 → 環境変数）。
