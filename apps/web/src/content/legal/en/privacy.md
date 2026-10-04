---
title: Privacy Policy
updated: 2026-10-03
---
This policy explains which personal data GenPM (genpm.net, the `api.genpm.net` API, the `genpm` CLI and the `@genpm-net/mcp` server) processes, why, on what legal basis and what your rights are. It complies with Regulation (EU) 2016/679 (GDPR) and Spanish Organic Law 3/2018 (LOPDGDD). The Spanish version prevails in case of discrepancy.

## 1. Data controller

- **Controller:** {{name}}
- **Tax ID (NIF):** {{nif}}
- **Address:** {{address}}
- **Contact:** {{email}} (put "[PRIVACY]" in the subject)

Appointing a data protection officer is not required (art. 37 GDPR, art. 34 LOPDGDD); write to the contact above for any question.

## 2. What we process, why and on what basis

| Data | Purpose | Legal basis | Retention |
|---|---|---|---|
| GitHub id, login, name, avatar and organizations (when you sign in) | Create and keep your account, show who publishes each package and authorize publishing to your scopes | Performance of the contract (art. 6.1.b GDPR): the Terms of Service | While your account exists |
| Your GitHub account email (never shown) | Security and service notices about your packages | Contract and legitimate interest in ecosystem security (art. 6.1.f) | While your account exists |
| API tokens (only their hash is stored) | Authenticate the CLI and CI | Contract | Until they expire or you revoke them |
| Published packages: manifest, repository, commit and your GitHub login | Run the registry: search, verify and install packages | Contract | Indefinitely: published versions are immutable so projects using them stay verifiable (see §6) |
| Install events: package, version, client (`cli`/`mcp`), CLI version and country (derived from the IP, which is not stored) | Public install counters and aggregated statistics | Legitimate interest in measuring registry usage | Aggregated daily; individual events, 90 days |
| IP address, turned into a hash with a daily-rotated salt | Rate limiting and abuse prevention | Legitimate interest in service security (art. 6.1.f, recital 49) | 30 days at most |
| Technical server logs (Cloudflare Workers) | Diagnose errors and attacks | Legitimate interest in service security and continuity | 7 days at most |
| Sponsors or enterprise form: email, company, team size, IDE and message | Answer your request | Pre-contractual steps at your request (art. 6.1.b) | 12 months unless we reach an agreement |
| Package reports: your account, the package, the reason and your description | Review the reported content and communicate the decision | Legal obligation under the EU Digital Services Act, art. 16 (art. 6.1.c GDPR) | 2 years after the decision |
| Emails you send us | Handle your request or the exercise of your rights | Legitimate interest in answering you or, where applicable, a legal obligation | As long as needed and up to 2 years afterwards |

**What we never process:** the contents of your project, your `.env` files or your environment variable values. We use no advertising or cross-site tracking cookies: web analytics are first-party, cookie-free and IP-free (see the [Cookie Policy](/cookies)).

**CLI and MCP telemetry:** with `GENPM_TELEMETRY=0` or `DO_NOT_TRACK=1` the client sends `client=none` and the registry does not store the event. You can object this way at any time.

We do not make decisions based solely on automated processing that produce legal effects on you (art. 22 GDPR). The automatic scanner may put a package under review, but a person makes the final decision to withdraw it (see the [Package Policy](/policy)).

Providing your GitHub data is required to create an account; without it you cannot publish, but you can still search and install packages, which needs no account.

## 3. Recipients and processors

We do not sell or share your data with third parties. These providers process it on our behalf under data processing agreements (art. 28 GDPR):

| Provider | Service | Location |
|---|---|---|
| Cloudflare, Inc. | Hosting (Workers), database (D1), delivery network, anti-bot protection (Turnstile) and aggregated analytics | EU and US |
| Piensa Solutions (Arsys Internet, S.L.U.) | Domain and email | Spain |

**GitHub, Inc.** acts as an independent controller when you sign in with GitHub and when the registry reads public repositories; its own [privacy statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement) applies.

Public package data (name, versions, repository and the publisher's GitHub login) is shown to every visitor and to AI agents using the registry, because that is the purpose of the service.

We only disclose data to authorities when a law requires it.

## 4. International transfers

Cloudflare, Inc. and GitHub, Inc. participate in the EU-US Data Privacy Framework, recognized by the European Commission's adequacy decision of 10 July 2023 (art. 45 GDPR). Their contracts also include the Commission's standard contractual clauses (art. 46 GDPR).

## 5. Your rights

You can exercise your rights of **access, rectification, erasure, objection, restriction and portability**, and withdraw any consent you gave, at any time by writing to {{email}} with the subject "[PRIVACY]". We will answer within one month (art. 12.3 GDPR). If we cannot identify you with what you send, we will ask for the minimum needed.

If you think we have not handled your request properly, you can lodge a complaint with the **Spanish Data Protection Agency** ([www.aepd.es](https://www.aepd.es), C/ Jorge Juan 6, 28001 Madrid) or the authority of your country of residence.

## 6. Closing your account

If you ask us to close your account, we anonymize your personal data within 30 days; backups are overwritten within another 30. Packages you published stay available, assigned to a system account, because other projects depend on them and their versions are immutable. Each package's GitHub repository URL, which may contain your login, is part of the published package; if you want them to stop being installed, yank them before closing your account.

## 7. Minors

GenPM is a service for developers. You must be at least 14 to create an account (art. 7 LOPDGDD); below that age you need consent from your parents or guardians.

## 8. Security

We apply technical and organizational measures appropriate to the risk: encryption in transit (HTTPS with HSTS), tokens stored only as hashes, `HttpOnly` and `Secure` cookies, pseudonymized IP addresses, access restricted with two-factor authentication and signed manifests. If a breach puts your rights at risk, we will notify the AEPD within 72 hours and, where required, you (arts. 33 and 34 GDPR).

## 9. Changes

If we change this policy materially, we will announce it on genpm.net and, if you have an account, by email in advance.
