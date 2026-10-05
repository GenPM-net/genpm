---
"@genpm-net/cli": minor
"@genpm-net/mcp": minor
---

Organization policies: with `policy=<registry url>` in `.genpmrc`, installs outside the allowed packages, without a passed security scan, with a denied license or straight from Git fail with `E_POLICY`. Registry admins manage them with `genpm registry policy`; also `genpm registry domain|verify|audit`.
