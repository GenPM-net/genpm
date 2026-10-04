---
title: 编写 AI 规则
section: 发布
order: 22
---
`AGENTS.md` 是你的用户的智能体在改动你的模块前会读的内容。请控制在 300 到 1,500 个 token 之间，并用英文编写：这样更省 token，任何贡献者都能读懂。

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

这五个部分（目的、结构、集成步骤、约定和禁止事项）是智能体最能遵循的写法。

注册表会扫描规则，查找八种语言的提示注入措辞、外泄数据的指令、`curl | sh`、编码内容和不可见的 Unicode 字符。被标记的包会被隔离，直到人工审核。
