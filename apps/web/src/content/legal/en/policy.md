---
title: Package Policy
updated: 2026-10-03
---
This policy keeps GenPM safe for everyone who installs packages and for the AI agents that read their rules. It is part of the [Terms of Service](/terms) and sets out our content moderation rules under Regulation (EU) 2022/2065 (Digital Services Act, DSA). The Spanish version prevails in case of discrepancy.

## 1. Not allowed

- Malware, credential stealers, cryptominers or code that exfiltrates data.
- AI rules that try to override the user's instructions, hide actions from the user, or ask the agent to send data elsewhere (*prompt injection*).
- Files that run automatically when a project is opened or installed: install scripts, `.npmrc`, `.envrc`, `.vscode/tasks.json`, git hooks and similar.
- Secrets: API keys, tokens or private keys, even revoked ones.
- Content infringing third-party intellectual or industrial property rights, or any other unlawful content.
- Typosquatting or impersonating another publisher or brand.
- Spam, placeholder packages or name squatting.

## 2. How we detect it

- **Automatically:** every version is scanned on publish and again by the CLI on install (auto-run files, secrets, unsafe paths, symlinks and signs of prompt injection in AI rules).
- **Through reports** from anyone (see §4).
- **Human review:** flagged versions are put under review and cannot be installed until a person reviews them, within 24 business hours. No final withdrawal is decided by automated means alone.

## 3. Possible measures

Depending on severity: put the version under review, withdraw it (*yank*), put the whole package or scope under review, publish a security advisory at [/security/advisories](/security/advisories) and, for serious or repeated violations, suspend the account. Measures are proportionate and consider the rights and interests of all parties.

## 4. How to report content

Anyone can report a package, also without an account:

- with the **Report** button on the package page (requires signing in with GitHub), or
- by emailing {{email}} with the subject "[REPORT]".

So we can act, include: the package and version (or its URL), why you believe it is unlawful or breaches this policy, your name and email, and a statement that the information is accurate and complete to the best of your knowledge. For vulnerabilities in GenPM itself, see [/security](/security).

We will acknowledge receipt and tell you our decision and the means of redress. If we find evidence of a criminal offence threatening people's life or safety, we will inform the competent authorities (art. 18 DSA).

## 5. If we act on your content

If we withdraw or restrict a package of yours or suspend your account, we will send you a statement of reasons (art. 17 DSA): the measure, why, the facts relied on, whether automated means were involved, and the rule or clause applied.

**Appeal:** you can ask us to review the decision by emailing {{email}} with the subject "[APPEAL]" within 6 months. A person, not the automatic scanner, will review it and we will reply with reasons. You can also go to court.

## 6. Transparency

We publish security advisories at [/security/advisories](/security/advisories) and as a JSON feed.
