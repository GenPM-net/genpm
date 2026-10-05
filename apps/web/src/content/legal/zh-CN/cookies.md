---
title: Cookie 政策
updated: 2026-10-05
---
本政策符合西班牙关于信息社会服务的第 34/2002 号法律（LSSI-CE）第 22.2 条以及西班牙数据保护局的 Cookie 使用指南。如有不一致，以西班牙语版本为准。

## 概要

genpm.net 使用**你自己选择的技术性 Cookie 和偏好设置**（依据 LSSI-CE 第 22.2 条无需同意），以及**仅在你于首次访问的提示中接受后才启用的可选分析**。“接受”和“拒绝”同等对待：如果你拒绝或不作选择，不会加载任何分析脚本，也不会在你的设备上保存任何相关数据。我们不使用广告 Cookie。此外，我们会在服务器上统计你请求的页面（页面浏览、搜索、软件包、来源和国家，不含 IP 或标识符），这不会在你的浏览器中保存任何内容。

## 我们在你的浏览器中存储的内容

| 名称 | 类型 | 所有方 | 目的 | 期限 |
|---|---|---|---|---|
| `__Host-genpm_session` | 技术性 Cookie | GenPM | 保持登录状态，仅在你登录时使用 | 30 天 |
| `__Host-genpm_oauth` | 技术性 Cookie | GenPM | 防止 GitHub 登录被伪造（CSRF） | 10 分钟 |
| `genpm-theme` | 本地存储 | GenPM | 记住你选择的浅色或深色模式 | 直到你清除 |
| `genpm-lang-dismissed` | 本地存储 | GenPM | 关闭提示后不再推荐其他语言 | 直到你清除 |
| `genpm_consent` | 偏好 Cookie | GenPM | 记住你接受还是拒绝了可选分析 | 6 个月 |

## 可选分析（仅在你接受后）

如果你点击“接受”，我们会使用 **PostHog**（PostHog, Inc.，数据存储在欧盟）查看点击和滚动热力图以及隐藏表单内容的匿名会话录制。账号相关页面（登录、令牌、控制台和发布）从不录制，请求通过我们自己的域名转发，不会转发你的 IP。

| 名称 | 类型 | 提供方 | 用途 | 期限 |
|---|---|---|---|---|
| `ph_<密钥>_posthog` | 分析 Cookie 和本地存储 | PostHog（第三方，GenPM 的处理者） | 用于归并你的访问和录制会话的随机标识符 | 12 个月 |
| `sessionStorage` 中的 `ph_*` | 分析会话存储 | PostHog | 保存当前会话的录制 | 直到关闭标签页 |

**更改选择：** 点击任意页面页脚的“Cookie 偏好”。撤回同意后，我们将停止加载 PostHog，并从你的浏览器中删除其 Cookie 和存储。撤回与给予同意一样简单，且不影响你在网站上的任何操作。

## Cloudflare 安全

本网站通过 Cloudflare 提供服务。为防范自动化攻击，Cloudflare 可能设置技术性安全 Cookie（例如 `__cf_bm`，30 分钟，或 `cf_clearance`）；在赞助和企业表单中，反机器人验证 **Turnstile** 可能读取浏览器的技术信息，以区分真人和机器人。它们的唯一目的是保障你所请求服务的安全，不用于广告，也不用于跨站跟踪。详见 [Cloudflare 的 Cookie 政策](https://www.cloudflare.com/cookie-policy/)。

## 如何删除或屏蔽

你可以在浏览器设置中删除或屏蔽 Cookie 和本地存储（[Chrome](https://support.google.com/chrome/answer/95647)、[Firefox](https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox)、[Safari](https://support.apple.com/guide/safari/sfri11471)、[Edge](https://support.microsoft.com/microsoft-edge)）。如果屏蔽 `__Host-genpm_session`，你将无法登录，但仍可以搜索和安装包。

## CLI 和 MCP 服务器

`genpm` CLI 和 `@genpm-net/mcp` 服务器不使用 Cookie。关于安装遥测及如何关闭，请参阅[隐私政策](/privacy)。

如果我们更改所使用的 Cookie，会更新本政策；如果用途发生变化，会再次征求你的同意。
