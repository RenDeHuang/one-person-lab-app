# One Person Lab App Status

Owner: `one-person-lab-app`
Purpose: `app_status`
State: `active`
Machine boundary: Human-readable status. Use `contracts/` and release/test
artifacts for machine decisions.

## Current State

- GitHub repo: `gaofeng21cn/one-person-lab-app`.
- App product repo history policy: clean App-owned history only.
- Active shell: `aionui`.
- Active shell root: `shells/aionui` as an external checkout.
- Active shell source repo: `gaofeng21cn/opl-aion-shell`.
- Framework dependency: `gaofeng21cn/one-person-lab`.
- Local App repo path on the maintainer Mac:
  `/Users/gaofeng/workspace/one-person-lab-app`.
- Local shell repo path on the maintainer Mac:
  `/Users/gaofeng/workspace/opl-aion-shell`.

The App repo must not merge AionUI history into its default branch. AionUI
upstream-following work stays in `opl-aion-shell`; App product release and user
docs stay in `one-person-lab-app`.

## Release State

Standard App release assets and updater metadata are App-owned. Full
first-install assets remain explicitly separate from standard updater metadata.
The updater must not select assets whose names include `Full`.
GitHub Release uploads, standard DMG, Full DMG, GUI smoke, and user tutorials
are all App-owned. The Framework repo is only a runtime/CLI/contracts payload
source for Full DMG and a machine-interface provider for the App.

Current release validation is App-root first: root wrappers call the active shell
build/release scripts, then the produced standard package can replace
`/Applications/One Person Lab.app` for a real local GUI startup smoke.

2026-05-15 migration note: this local checkout is the clean App repo. It has
one App-owned root commit, no tracked `shells/aionui` source, and a local
`shells/aionui` link to `/Users/gaofeng/workspace/opl-aion-shell`. Remote
migration should keep `gaofeng21cn/opl-aion-shell` as the history-rich shell
repo and create or replace `gaofeng21cn/one-person-lab-app` from this clean App
repo.

## Validation Entry Points

```bash
npm run ensure:shell
bun install --cwd shells/aionui --frozen-lockfile
node scripts/validate-active-shell.mjs --quick
npm run test:release-boundary
node scripts/validate-release-boundary.mjs
bun run i18n:types
bun run test
node scripts/prepare-release-assets.mjs build-artifacts release-assets
node scripts/validate-release.mjs release-assets
```

Page-state and first-run expectations are declared in
`contracts/app-page-state-matrix.json` and
`contracts/app-first-run-test-matrix.json`.
