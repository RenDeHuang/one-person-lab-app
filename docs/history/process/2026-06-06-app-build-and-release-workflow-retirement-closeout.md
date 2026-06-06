# App Build and Release workflow retirement closeout

Owner: `one-person-lab-app`
Purpose: `app_build_and_release_workflow_retirement_closeout`
State: `history_closeout`
Machine boundary: Human-readable process closeout. Current Stable release truth stays in `contracts/app-release-channel.json`, `.github/workflows/desktop-release.yml`, `.github/workflows/desktop-release-promote.yml`, release scripts, candidate records, release artifacts, updater metadata, validation scripts, and release-boundary tests.

## Scope

This lane physically retired the legacy tag-push **Build and Release** workflow:

```text
.github/workflows/build-and-release.yml
```

The current Stable release train is **OPL Desktop Release** plus candidate-record promotion. This lane did not change release artifact semantics, updater metadata policy, Homebrew/Full/VM/WebUI gates, release evidence classification, or shell implementation authority.

## Changes

- Deleted `.github/workflows/build-and-release.yml`.
- Removed the old workflow from release workflow enumeration in `scripts/validate-release-boundary.ts` and `tests/release/app-release-boundary.test.ts`.
- Added fail-closed checks so reintroducing `.github/workflows/build-and-release.yml` fails release-boundary validation and tests.
- Moved remaining standard release assertions to `.github/workflows/desktop-release.yml` / `_build-reusable.yml`, where current standard build and publish truth now lives.
- Updated `docs/release/README.md` and `docs/active/app-ideal-state-gap-plan.md` from pending retirement to retired / no-resurrection wording.
- Updated the prior release-train workflow closeout with the physical deletion result.

## Verification

This lane followed a red/green check:

- Red: `npm run test:release-boundary -- --runInBand` failed only on `legacy tag-push Build and Release workflow is retired` while the workflow still existed.
- Green: after deleting the workflow and moving assertions, `npm run test:release-boundary -- --runInBand` passed with `124` tests.

Additional checks:

```bash
rtk npm run validate:release-boundary
rtk rg -n "build-and-release|Build and Release|legacy tag-push|tag-push" .github docs contracts tests scripts package.json README.md README.zh-CN.md || true
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" .github docs scripts tests || true
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
```

Observed results:

- `validate:release-boundary`: pass
- targeted release scan: only fail-closed test / validator entries and retired/history docs remain
- `git diff --check`: pass
- conflict marker scan: no matches
- App doctor: `finding_count=0`

Default `scripts/verify.sh` remains the final gate before absorption.

## Remaining Risk

If an operator pushes an old tag that points to an old commit containing the removed workflow, GitHub may still evaluate the workflow file from that old commit. Mainline no longer carries the live workflow surface, and release-boundary validation now fails closed if it is reintroduced.
