# One Person Lab App Repository Guide

This repository is the One Person Lab App product repository. It owns desktop
App packaging, release assets, updater metadata, user guides, screenshots,
first-run checks, GUI product requirements, and GUI page-state tests.

The OPL Framework remains in `gaofeng21cn/one-person-lab`. App code must consume
framework-owned machine-readable contracts, CLI JSON, provider receipts, and
domain-owned projections. Do not copy runtime truth, domain truth, provider
implementation, or domain artifact authority into this repository.

Root `TASTE.md` records the shared OPL family maintenance taste for architecture,
code, docs, tests, review, cleanup, and closeout decisions. Use it as the
preference layer, then apply this App repository guide, contracts, docs, and
source truth.

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

## GUI Product Authority

- The App repo is the authority for what the One Person Lab App GUI should be,
  regardless of which shell implementation is currently active.
- Product-level GUI decisions, user-facing page behavior, model-selection
  policy, onboarding flow, release screenshots, and page-state expectations must
  be documented, contracted, or tested from this repo when they define App truth.
- `shells/aionui/` is the current implementation carrier and upstream-sync
  surface. It may change shape as AionUI evolves, but it must implement the App
  repo's GUI truth rather than become the source of product authority.
- When a GUI behavior is implemented in the shell repo, keep the App-level
  rationale and acceptance boundary in this repo, then apply the shell code
  change in the shell checkout.
- Upstream AionUI behavior can be reused as implementation material only after
  checking it against App-owned GUI requirements and contracts.

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
