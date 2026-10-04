# Security policy

GenPM writes files into your project and feeds rules to your AI agent, so we take security reports seriously.
The design and its invariants are described at <https://genpm.net/security>.

## Reporting a vulnerability

- Email **hello@genpm.net** with the subject `[SECURITY]`, or
- open a private report with [GitHub Private Vulnerability Reporting](https://github.com/genpm-net/genpm/security/advisories/new).

Please do not open public issues for vulnerabilities. Reports in English, Spanish or Portuguese are welcome.

## What to expect

| Step | Target |
|---|---|
| First response | ≤ 48 hours |
| Critical issues contained (malicious package, signing key, cross-tenant leak) | ≤ 1 hour after confirmation |
| High-severity issues fixed | ≤ 24 hours, advisory within 48 hours |

Advisories are published at <https://genpm.net/security/advisories> and as a JSON feed.

## Safe harbor

We will not take legal action against good-faith research that respects user privacy, avoids service disruption,
does not access other users' data beyond what is needed to demonstrate the issue, and gives us reasonable time to fix
it before disclosure.

## Scope

The `genpm` CLI, `@genpm-net/mcp`, the registry API (`api.genpm.net`) and genpm.net. Packages published by third parties
should be reported with the **Report** button on the package page.
