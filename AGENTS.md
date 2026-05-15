# One Person Lab App Repository Guide

This repository is the One Person Lab App product repository. It owns desktop
App packaging, release assets, updater metadata, user guides, screenshots,
first-run checks, and GUI page-state tests.

The OPL Framework remains in `gaofeng21cn/one-person-lab`. App code must consume
framework-owned machine-readable contracts, CLI JSON, provider receipts, and
domain-owned projections. Do not copy runtime truth, domain truth, provider
implementation, or domain artifact authority into this repository.

## Repository Boundaries

- `origin/main` is the clean One Person Lab App product mainline.
- `shells/aionui/` is an external checkout of the OPL-maintained AionUI shell
  repository, currently `gaofeng21cn/opl-aion-shell`.
- The App repo must not merge or vendor the AionUI Git history into its default
  branch. Keep AionUI upstream intake and shell implementation commits in the
  shell repository.
- Future GUI candidates belong under `shells/<candidate>/` until their contracts
  and tests are complete.

Root `docs/`, `contracts/`, and `scripts/` describe the App product layer.
AionUI-specific source, package metadata, tests, shell release hooks, and
upstream intake rules live in the shell repository and are consumed here through
the active shell checkout.

## Working Rules

- Start App product work from `origin/main`.
- Use the shell repository for AionUI upstream-intake work.
- Keep App-level changes at the root when they define product, release, testing,
  or user documentation behavior.
- Keep shell implementation changes in the shell repository unless they are
  changing the active shell contract or root release wrapper.
- Run root contract validation after changing App-level contracts or wrappers:

```bash
bun run validate:active-shell
```

Run `npm run ensure:shell` before local build or validation if
`shells/aionui/` has not been checked out yet.
