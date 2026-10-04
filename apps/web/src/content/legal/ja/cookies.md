---
title: Cookie ポリシー
updated: 2026-10-03
---
本ポリシーは、情報社会サービスに関するスペイン法 34/2002（LSSI-CE）第 22.2 条およびスペインデータ保護庁の Cookie ガイドラインに準拠しています。内容に相違がある場合は、スペイン語版が優先されます。

## 概要

genpm.net が使用するのは、**ご依頼のサービスを提供するために厳密に必要な技術的 Cookie と、あなた自身が選んだ設定だけ**です。これらは同意が不要（LSSI-CE 第 22.2 条）なため、Cookie バナーは表示していません。自社・第三者を問わず、分析・広告・トラッキング目的の Cookie は使用しません。Web 分析は自社で行い、あなたの端末には何も保存せず、IP アドレスも記録しません。

## ブラウザに保存するもの

| 名前 | 種類 | 管理者 | 目的 | 期間 |
|---|---|---|---|---|
| `__Host-genpm_session` | 技術的 Cookie | GenPM | サインインした場合のみ、ログイン状態を維持する | 30 日 |
| `__Host-genpm_oauth` | 技術的 Cookie | GenPM | GitHub ログインを偽造（CSRF）から守る | 10 分 |
| `genpm-theme` | ローカルストレージ | GenPM | 選んだライト / ダークモードを記憶する | 削除するまで |
| `genpm-lang-dismissed` | ローカルストレージ | GenPM | 通知を閉じた後、別の言語を再度提案しない | 削除するまで |

## Cloudflare によるセキュリティ

本サイトは Cloudflare 経由で配信されています。自動化された攻撃から守るため、Cloudflare がセキュリティ用の技術的 Cookie（例: `__cf_bm`（30 分）、`cf_clearance`）を設定することがあります。また、スポンサーおよび企業向けフォームでは、ボット対策の **Turnstile** が人とボットを見分けるためにブラウザの技術情報を読み取ることがあります。これらの目的はご依頼のサービスの安全確保のみで、広告やサイトをまたいだ追跡には使用しません。詳しくは [Cloudflare の Cookie ポリシー](https://www.cloudflare.com/cookie-policy/)をご覧ください。

## 削除またはブロックする方法

Cookie とローカルストレージは、ブラウザの設定から削除またはブロックできます（[Chrome](https://support.google.com/chrome/answer/95647)、[Firefox](https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox)、[Safari](https://support.apple.com/guide/safari/sfri11471)、[Edge](https://support.microsoft.com/microsoft-edge)）。`__Host-genpm_session` をブロックするとサインインできませんが、パッケージの検索とインストールは引き続き利用できます。

## CLI と MCP サーバー

CLI `genpm` とサーバー `@genpm-net/mcp` は Cookie を使用しません。インストールのテレメトリーとその無効化方法については、[プライバシーポリシー](/privacy)をご覧ください。

同意が必要な Cookie を追加する場合は、使用前に同意をお願いし、本ポリシーを更新します。
