---
title: Your first package
section: Publishing
order: 20
---
Your code stays on GitHub; the registry stores the manifest and the commit it points to.

```bash
npx genpm init          # creates genpm.json, AGENTS.md and .genpmignore
npx genpm validate      # same scanner as the registry
git tag v1.0.0 && git push --tags
npx genpm login
npx genpm publish
```

`publish` checks that the working tree is clean and that the tag on `origin` points to the same commit as yours (`E_REF_NOT_PUSHED`). The registry then reads `genpm.json` **from GitHub** at that commit — never from your machine — validates it, scans the tree, signs the resolved manifest and lists the package.

Versions are immutable: `(name, version)` can never be published twice, even after a yank. Branches are always rejected (`E_REF_MUTABLE`).

Try it first without publishing anything:

```bash
npx genpm publish --dry-run
```

## What the registry checks

- The tag exists on GitHub and resolves to the commit you pushed.
- `genpm.json` is valid and its name matches the scope you can publish to.
- The tree passes the scan: no files that run automatically (install scripts, `.npmrc`, `.vscode/tasks.json`, git hooks…), no secrets, no symlinks, safe paths.
- The AI rules are scanned for prompt injection. If something looks suspicious, the version is **quarantined** and a person reviews it within 24 business hours.

## Prereleases and dist-tags

A prerelease such as `1.3.0-beta.1` goes to the `next` dist-tag automatically, so `latest` keeps pointing to your last stable version. Users opt in with `genpm add @acme/billing@next`. Use `--dist-tag` to choose another tag.

## Monorepos

Publish a package that lives in a subdirectory with `--manifest packages/billing/genpm.json`, and set `i` to that directory so only it is injected.

## Withdrawing a version

```bash
npx genpm yank @acme/billing@1.2.0 --reason "breaks webhooks on Stripe API 2026-09"
```

A yanked version stays immutable and verifiable for the projects that already use it, but new installs skip it and the web shows the reason.

## Scopes

Your scope is your GitHub login or one of your organizations. Scopes such as `@core`, `@genpm` or `@official` are reserved.

## CI

`genpm init --workflow` adds a GitHub Actions workflow that publishes when you push a `v*` tag, with `GENPM_TOKEN` as a secret.
