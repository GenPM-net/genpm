---
title: Using packages
section: Using packages
order: 10
---
## add

```bash
genpm add @core/billing            # latest
genpm add @core/auth@^1.2          # semver range
genpm add @core/db --dest packages/db
genpm add @core/billing --dry-run  # show the plan, write nothing
```

GenPM asks three separate questions: inject the code, add MCP servers (showing the full command), and run the package-manager command for npm dependencies. `--yes` only answers the first one; use `--mcp` and `--install-deps` for the others.

If the destination exists and is not empty, `add` fails with `E_DEST_CONFLICT`. `--force` moves the old content to `.genpm/backup/<timestamp>/` first.

## search and info

```bash
genpm search stripe
genpm info @core/billing          # manifest, deps, MCP, env and full AI rules
genpm info @core/billing --rules  # only the rules
```

## list and remove

```bash
genpm list
genpm remove @core/auth
```

`list` compares every injected file with its recorded SHA-256 (drift). `remove` refuses to delete code you changed (`E_DRIFT`): use `--keep-code` to keep it or `--force` to delete it anyway. A package required by another one cannot be removed first (`E_REQUIRED_BY`). Removing a package also removes its MCP servers and any file GenPM created that ends up empty.

## outdated and audit

```bash
genpm outdated
genpm audit   # add it to your CI as: npx @genpm-net/cli audit
```

`audit` verifies file integrity, the registry signature of every lock entry, security advisories, yanked versions and quarantines. It exits with code 6 on high or critical findings.

## update and diff

```bash
genpm diff @core/auth
genpm update @core/auth
```

`diff` shows what changed upstream since your installed version, with paths already pointing at your folder (apply it with `git apply --3way`). `update` does a three-way merge: files you did not touch get the new version, lines you changed are kept, and when both sides changed the same lines the file is left with standard `<<<<<<<` markers and the command exits with code 4. A file removed upstream that you modified is kept.

`genpm diff --local` also lists your local changes; `genpm update --dry-run` shows the plan without writing.

## JSON output

Every command accepts `--json` (one line, English, no prompts). Without a TTY, any unanswered question fails with `E_CONFIRM_REQUIRED` (exit 2) and nothing is written.

## Recipes: several packages at once

A recipe installs several packages that work together in one command, with the same plan and questions as `genpm add`. Recipes curated by GenPM are listed at [/recipes](/recipes); your team can also keep one as a JSON file in the repository.

```bash
genpm compose --list
genpm compose saas-starter --dry-run
genpm compose ./stack.json
```

```json
{ "name": "my-stack", "p": ["@core/db", "@core/auth@^1.2"] }
```

## Private registries

Teams can keep packages from private repositories in a private registry (`genpm registry create acme --owner my-org`, or [Settings › Private registries](/settings/registries)). It does not exist for anyone who is not a member. Point your scope to it in `.genpmrc` and sign in against it; `genpm add` works the same. Members read `internal` packages; `private` ones need a grant (`genpm access grant @acme/api team:my-org/backend read`). The GenPM GitHub App must be installed on the organization so the registry can read its private repositories.

```ini
# .genpmrc
@acme:registry=https://api.genpm.net/r/acme
# ENT-03: policy
policy=https://api.genpm.net/r/acme
```

```bash
genpm login --registry https://api.genpm.net/r/acme
genpm add @acme/payments
```
