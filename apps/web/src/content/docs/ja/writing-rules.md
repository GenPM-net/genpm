---
title: AI ルールの書き方
section: 公開
order: 22
---
`AGENTS.md` は、利用者のエージェントがあなたのモジュールに触れる前に読むものです。300〜1,500 トークンに収め、英語で書いてください。トークンが少なく済み、どのコントリビューターも読めます。

```md
# @acme/auth — rules for agents

## Purpose
Cookie sessions + OAuth (GitHub, Google). Authorization (roles) is out of scope.

## Module map
- `index.ts` — public API. Import only from here.
- `session.ts` — create, validate and rotate sessions.

## Integration (do this after installing)
1. Run the migrations that add `users` and `sessions`.
2. Mount `authRoutes` in the app router.
3. Configure `AUTH_SECRET` (see `.env.example`).

## Conventions
- Never read cookies outside `session.ts`.

## Don't
- Don't store OAuth tokens in plain text.
```

この 5 つのセクション（目的、構成、組み込み手順、規約、禁止事項）が、エージェントに最もよく守られます。

レジストリはルールをスキャンし、8 言語のプロンプトインジェクション表現、データ持ち出しの指示、`curl | sh`、エンコードされた内容、不可視の Unicode を探します。検出されたパッケージは、人が確認するまで隔離されます。
