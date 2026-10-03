---
title: Security model
section: Security
order: 50
---
GenPM is secure by design and verifiable by anyone. It never promises "100 % secure"; it guarantees ten invariants, each with a test that blocks every release:

1. **Integrity** — installed bytes are exactly the tree of commit `c`, never a branch.
2. **Zero execution** — no lifecycle scripts, Git hooks, submodules or filters.
3. **Confinement** — writes stay inside the project, in the planned paths.
4. **No executables** — injected files are written with mode `0644`.
5. **Consent** — no MCP config, npm installs or overwrites without your yes.
6. **Secrets** — GenPM never reads `.env` values.
7. **Registry authority** — publishing reads GitHub, never the client.
8. **Signed manifests** — the CLI only installs Ed25519-signed manifests.
9. **Immutability** — a published version never changes.
10. **Tenant isolation** — no query crosses registries.

The same deterministic scanner runs in the registry (on publish) and in the CLI (on every install), so a compromised registry is not enough to bypass it.

## Reporting

Email **hello@genpm.net** with subject `[SECURITY]` or use GitHub Private Vulnerability Reporting. First response within 48 hours. See [/security](/security).
