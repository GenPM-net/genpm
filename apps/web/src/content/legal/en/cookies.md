---
title: Cookie Policy
updated: 2026-10-05
---
This policy complies with article 22.2 of Spanish Law 34/2002 on Information Society Services (LSSI-CE) and the cookie guidelines of the Spanish Data Protection Agency. The Spanish version prevails in case of discrepancy.

## Summary

genpm.net uses **technical cookies and preferences you choose yourself**, exempt from consent (art. 22.2 LSSI-CE), and **optional analytics that only run if you accept them** in the notice you see on your first visit. "Accept" and "Reject" carry the same weight: if you reject or do not choose, no analytics script loads and nothing of it is stored on your device. We use no advertising cookies. Separately, we count on our servers the pages you request (page views, searches, packages, referring domain and country, no IP or identifiers): that stores nothing in your browser.

## What we store in your browser

| Name | Type | Owner | Purpose | Duration |
|---|---|---|---|---|
| `__Host-genpm_session` | Technical cookie | GenPM | Keep you signed in, only if you sign in | 30 days |
| `__Host-genpm_oauth` | Technical cookie | GenPM | Protect GitHub sign-in against forgery (CSRF) | 10 minutes |
| `genpm-theme` | Local storage | GenPM | Remember the light or dark mode you choose | Until you clear it |
| `genpm-lang-dismissed` | Local storage | GenPM | Stop suggesting another language once you dismissed it | Until you clear it |
| `genpm_consent` | Preference cookie | GenPM | Remember whether you accepted or rejected optional analytics | 6 months |

## Optional analytics (only if you accept)

If you press "Accept", we use **PostHog** (PostHog, Inc., with data hosted in the EU) to see heatmaps of clicks and scrolling and anonymous session recordings, with form fields hidden. Account pages (sign-in, tokens, dashboard and publishing) are never recorded, and requests go through our own domain without forwarding your IP.

| Name | Type | Owner | Purpose | Duration |
|---|---|---|---|---|
| `ph_<key>_posthog` | Analytics cookie and local storage | PostHog (third party, GenPM's processor) | Random identifier to group your visits and the recorded session | 12 months |
| `ph_*` in `sessionStorage` | Analytics session storage | PostHog | Keep the recording of the current session | Until you close the tab |

**Changing your mind:** press "Cookie preferences" in the footer of any page. If you withdraw consent, we stop loading PostHog and delete its cookies and storage from your browser. Withdrawing is as easy as giving consent and does not limit anything you can do on the site.

## Cloudflare security

The site is served through Cloudflare. To protect it against automated attacks, Cloudflare may set technical security cookies (for example `__cf_bm`, 30 minutes, or `cf_clearance`) and, on the sponsors and enterprise forms, the **Turnstile** anti-bot challenge may read technical browser information to tell people from bots. Their only purpose is the security of the service you request: they are not used for advertising or to track you across sites. More in [Cloudflare's cookie policy](https://www.cloudflare.com/cookie-policy/).

## How to delete or block them

You can delete or block cookies and local storage in your browser settings ([Chrome](https://support.google.com/chrome/answer/95647), [Firefox](https://support.mozilla.org/kb/clear-cookies-and-site-data-firefox), [Safari](https://support.apple.com/guide/safari/sfri11471), [Edge](https://support.microsoft.com/microsoft-edge)). If you block `__Host-genpm_session` you cannot sign in, but you can still search and install packages.

## The CLI and the MCP server

The `genpm` CLI and the `@genpm-net/mcp` server use no cookies. For install telemetry and how to turn it off, see the [Privacy Policy](/privacy).

If we change the cookies we use, we will update this policy and, if the purpose changes, ask for your consent again.
