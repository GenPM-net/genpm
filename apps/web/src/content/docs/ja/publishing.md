---
title: 最初のパッケージ
section: 公開
order: 20
---
コードは GitHub に置いたままです。レジストリが保存するのはマニフェストと、それが指すコミットだけです。

**Web から（ターミナル不要）:** [genpm.net/publish](/publish) にサインインしてリポジトリを選ぶと、足りないものを GenPM が教えてくれます。`genpm.json` は自動で生成され、各修正ボタンはファイルを用意した状態で GitHub を開きます（GenPM が書き込み権限を求めることはありません）。すべて緑になったら、同じページから公開できます。

**ターミナルから:**

```bash
genpm init          # genpm.json、AGENTS.md、.genpmignore を作成
genpm validate      # レジストリと同じスキャナー
git tag v1.0.0 && git push --tags
genpm login
genpm publish
```

`publish` は、コミットしていない変更がないこと、`origin` 上のタグが手元と同じコミットを指していること（`E_REF_NOT_PUSHED`）を確認します。その後レジストリは、そのコミットの `genpm.json` を（あなたのマシンからではなく）**GitHub から**読み取り、検証し、ツリーをスキャンし、解決済みマニフェストに署名してパッケージを掲載します。

バージョンは不変です。`(名前, バージョン)` は、取り下げた後でも二度と公開できません。ブランチは常に拒否されます（`E_REF_MUTABLE`）。

まずは何も公開せずに試せます。

```bash
genpm publish --dry-run
```

## レジストリが確認すること

- タグが GitHub に存在し、プッシュしたコミットを指していること。
- `genpm.json` が有効で、名前があなたの公開できるスコープと一致すること。
- ツリーがスキャンに合格すること。自動実行されるファイル（インストールスクリプト、`.npmrc`、`.vscode/tasks.json`、git フックなど）、シークレット、シンボリックリンクがなく、パスが安全であること。
- AI ルールにプロンプトインジェクションがないこと。疑わしい場合、そのバージョンは**隔離**され、人が 24 営業時間以内に確認します。

## プレリリースと dist-tag

`1.3.0-beta.1` のようなプレリリースは自動的に dist-tag `next` に入るため、`latest` は最新の安定版を指し続けます。利用者は `genpm add @acme/billing@next` で選べます。別のタグにするには `--dist-tag` を使います。

## モノレポ

サブディレクトリにあるパッケージは `--manifest packages/billing/genpm.json` で公開し、`i` をそのディレクトリにしてそこだけが注入されるようにします。`billing@1.2.0` のようにパッケージごとのタグを使います。

## バージョンの取り下げ

```bash
genpm yank @acme/billing@1.2.0 --reason "Stripe API 2026-09 で webhook が壊れる"
```

取り下げたバージョンも、すでに使っているプロジェクトにとっては不変で検証可能なままですが、新規インストールでは飛ばされ、Web に理由が表示されます。

## スコープ

スコープは GitHub のユーザー名か、所属する組織名です。`@core`、`@genpm`、`@official` などのスコープは予約されています。

## CI

`genpm init --workflow` は、`v*` タグをプッシュしたときに公開する GitHub Actions のワークフローを追加します（シークレットは `GENPM_TOKEN`）。

### トークンなし: 信頼済みパブリッシング

[信頼済みパブリッシング](/settings/publishing) でリポジトリを一度承認します（ワークフローファイルや environment を限定することもできます）。次にジョブへ `id-token: write` を付与して `GENPM_TOKEN` を削除します。`genpm publish` は Actions に OIDC トークンを要求し、GenPM はそのリポジトリからあなたの scope にのみ公開できる 15 分間のトークンと交換します。

```yaml
permissions:
  contents: read
  id-token: write   # trusted publishing
steps:
  - uses: actions/checkout@v4
    with: { fetch-depth: 0 }
  - run: npx -y @genpm-net/cli publish --yes
```

### GitLab から

GitLab のプロジェクトは信頼済みパブリッシングでのみ公開できます。[信頼済みパブリッシング](/settings/publishing) でホストに GitLab を選んで公開プロジェクト（例: `my-group/sub/my-package`）を承認し、audience が `genpm` の `id_tokens` を `GENPM_ID_TOKEN` という名前で宣言します。`genpm publish` はそれを、そのプロジェクトからのみ公開できる 15 分間のトークンに交換します。個人トークンでは GitLab のリポジトリを公開できません。

```yaml
# .gitlab-ci.yml
publish:
  image: node:22
  rules:
    - if: $CI_COMMIT_TAG
  id_tokens:
    GENPM_ID_TOKEN:
      aud: genpm
  script:
    - npx -y @genpm-net/cli publish --yes
```
