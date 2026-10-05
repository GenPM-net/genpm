---
"@genpm-net/cli": minor
---

`genpm publish` en GitHub Actions usa trusted publishing (OIDC) cuando no hay `GENPM_TOKEN`, y `genpm init --workflow` genera el workflow con `id-token: write`.
