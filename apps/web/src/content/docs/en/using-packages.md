---
title: Using packages
section: Using packages
order: 10
---
## add

```bash
npx genpm add @core/billing            # latest
npx genpm add @core/auth@^1.2          # semver range
npx genpm add @core/db --dest packages/db
npx genpm add @core/billing --dry-run  # show the plan, write nothing
```

GenPM asks three separate questions: inject the code, add MCP servers (showing the full command), and run the package-manager command for npm dependencies. `--yes` only answers the first one; use `--mcp` and `--install-deps` for the others.

If the destination exists and is not empty, `add` fails with `E_DEST_CONFLICT`. `--force` moves the old content to `.genpm/backup/<timestamp>/` first.

## search and info

```bash
npx genpm search stripe
npx genpm info @core/billing          # manifest, deps, MCP, env and full AI rules
npx genpm info @core/billing --rules  # only the rules
```

## list and remove

```bash
npx genpm list
npx genpm remove @core/auth
```

`list` compares every injected file with its recorded SHA-256 (drift). `remove` refuses to delete code you changed (`E_DRIFT`): use `--keep-code` to keep it or `--force` to delete it anyway. A package required by another one cannot be removed first (`E_REQUIRED_BY`).

## outdated and audit

```bash
npx genpm outdated
npx genpm audit   # add it to your CI
```

`audit` verifies file integrity, the registry signature of every lock entry, security advisories, yanked versions and quarantines. It exits with code 6 on high or critical findings.

## JSON output

Every command accepts `--json` (one line, English, no prompts). Without a TTY, any unanswered question fails with `E_CONFIRM_REQUIRED` (exit 2).
