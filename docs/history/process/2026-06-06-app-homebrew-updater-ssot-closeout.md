# 2026-06-06 App Homebrew/updater SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_homebrew_updater_docs_governance_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current Homebrew/updater truth stays in `contracts/app-release-channel.json`, `contracts/app-first-run-test-matrix.json`, release workflows, updater metadata, validation scripts, Homebrew tap casks, tests, release artifacts, and local authorization policy assets.

## Snapshot

- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: `Homebrew transport/index versus updater, Full, module, and signing authority`
- Governance mode: SSOT-first content-level audit. Start from the App-owned release channel contract, first-run matrix, release guide, and release-boundary tests, then classify README/status/decision wording and historical notes.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-release-channel.json#standard_updater`
  - owns standard updater metadata and asset scope.
  - allows only `latest-mac.yml`, `latest-arm64-mac.yml`, standard App DMG/ZIP/blockmaps, and same-tag refresh of standard App assets.
  - forbids Full first-install assets, module package updates, Developer Profile checkout selection, and `opl-flow` install through the standard updater.
- `contracts/app-release-channel.json#homebrew_tap_distribution`
  - owns the Homebrew tap role, cask/formula boundary, stable/nightly/Full cohort separation, tap sync policy, required manifest fields, and agent-pack policy.
  - treats Homebrew as an external App cask index for distribution cohorts, not installer truth, domain semantic authority, user-state activation owner, or module-package distribution surface.
  - requires `local_authorization_policy_asset` in cohort manifests for current Stable local authorization release paths.
- `contracts/app-first-run-test-matrix.json#homebrew_standard_cask_clean_vm_smoke`
  - owns the Homebrew clean-VM smoke expectations for the standard App cask.
  - proves tap/cask install and first-launch readiness through the shared App/CLI setup model without turning Homebrew receipt into readiness evidence.
- `scripts/update-homebrew-tap.ts`, `.github/workflows/homebrew-tap-update.yml`, and `scripts/validate-release-boundary.ts`
  - own tap planning, remote write mode, stable/nightly/Full cask split, required checksum/manifest fields, and fail-closed validation.
- `tests/release/app-release-boundary.test.ts`
  - guards Homebrew transport-only semantics, forbidden module formulae, Full/updater separation, manifest fields, local authorization release path, and no signed-standard-DMG overclaim in the first-run matrix.

Human-doc owners:

- `docs/release/README.md`
  - owns the release operator guide for standard updater, Homebrew tap distribution, stable/nightly/Full cask lanes, and Stable local authorization.
- `README.md` and `README.zh-CN.md`
  - own public install wording, but must not imply paid Apple Developer ID signing is required or currently proven for the standard Homebrew cask path.
- `docs/status.md`, `docs/invariants.md`, and `docs/decisions.md`
  - own current status and durable policy summaries; machine decisions still point back to contracts, release assets, workflows, and tests.

## Peer Docs Classification

| Document / section | Classification | Action |
| --- | --- | --- |
| `contracts/app-release-channel.json#standard_updater` | `covered_by_ssot` machine owner | Already limits updater metadata to standard desktop App assets and excludes Full/modules/Developer checkouts/`opl-flow`. No edit. |
| `contracts/app-release-channel.json#homebrew_tap_distribution` | `covered_by_ssot` machine owner | Already models Homebrew as App cask index/transport with stable/nightly/Full cask separation, no module formulae, and local authorization manifest field. No edit. |
| `contracts/app-first-run-test-matrix.json#homebrew_standard_cask_clean_vm_smoke` | `conflicts_with_ssot` | Removed the stale `signed standard App DMG` wording; the cask now resolves the standard App DMG from App GitHub Releases without asserting Developer ID signing. |
| `tests/release/app-release-boundary.test.ts` / first-run matrix guard | `covered_by_ssot` machine guard | Added assertions that the Homebrew standard cask smoke remains cask/install evidence, resolves the standard App DMG, and does not reintroduce `signed standard App DMG`. |
| `README.md` / Homebrew install section | `conflicts_with_ssot` | Removed `signed` from the standard Homebrew asset wording so the public install path matches current Stable local authorization policy. |
| `README.zh-CN.md` / Homebrew and install sections | `covered_by_ssot` public entry | Already says Stable macOS install does not require paid Apple Developer ID signing and Homebrew is App cask-only. No edit. |
| `docs/release/README.md` / standard updater, Homebrew boundary, Stable local authorization | `covered_by_ssot` release guide | Already separates updater/Homebrew/Full/module boundaries and describes Stable local authorization policy assets. No edit. |
| `docs/status.md` / release state and local authorization | `covered_by_ssot` status | Already treats unsigned local authorization diagnostics as the current Stable release path and keeps Developer ID as a future smoothing enhancement. No edit. |
| `docs/invariants.md`, `docs/decisions.md` | `covered_by_ssot` durable policy | Already keep standard updater, Homebrew, Full, module, and Developer Profile boundaries separate. No edit. |

## Content-Level Consolidation

- Homebrew is the preferred transport/index for App casks, not a second installer truth source.
- Standard Homebrew cask installs the standard App GitHub Release asset and then hands readiness to the App/CLI setup model.
- Standard updater metadata remains desktop-App-only. Full first-install assets, module packages, Developer Profile checkouts, WebUI publishing, `opl-flow`, and agent-pack semantics remain outside updater metadata and Homebrew module formulae.
- Current Stable macOS release evidence uses local authorization policy assets. Public docs and first-run matrix must not imply paid Apple Developer ID signing is required or already proven for the standard Homebrew cask path.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app` after this edit:

```bash
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" README.md README.zh-CN.md docs/release/README.md docs/status.md docs/invariants.md docs/decisions.md docs/history/process contracts/app-release-channel.json contracts/app-first-run-test-matrix.json tests/release/app-release-boundary.test.ts scripts .github
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
rtk npm run test:release-boundary -- --runInBand
```

Result:

- `git diff --check` passed.
- Conflict-marker scan found no matches.
- OPL Doc doctor returned `finding_count = 0`.
- `npm run test:release-boundary -- --runInBand` passed with `123` tests.

## Remaining Scope

This lane covers Homebrew/updater/local-authorization wording and machine guard drift. It does not complete the full App docs portfolio.

Carry forward:

- Runtime page docs, public README paragraph-level portfolio coverage, Full first-install VM evidence, GUI screenshots/user guides, and broader App docs history remain separate lanes.
- Future releases still need real standard or Full local authorization policy assets, remote release verification, Homebrew tap sync evidence, and clean-VM smoke evidence before release readiness claims.
- If paid Developer ID signing becomes the current release path, update the release channel contract, first-run matrix, release workflows, validation scripts, release docs, and tests in the same change.
