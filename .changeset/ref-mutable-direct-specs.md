---
"@genpm-net/cli": patch
"@genpm-net/mcp": patch
---

`genpm add gh:owner/repo` without a ref, or with a branch (`#main`), now fails with `E_REF_MUTABLE` (exit 6) as the spec says, instead of a generic `E_USAGE`.
