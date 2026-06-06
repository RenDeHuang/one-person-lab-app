# App Build and Release test guard retirement closeout

Owner: `one-person-lab-app`
Purpose: `app_build_release_test_guard_retirement_closeout`
State: `history_closeout`
Machine boundary: Human-readable process closeout. Current legacy Build and Release no-resurrection truth stays in `scripts/validate-release-boundary.ts`, package scripts and release-boundary tests that execute the validator. Current release truth stays in `contracts/app-release-channel.json`, Desktop Release workflows, release scripts, candidate records, release artifacts, updater metadata and validation output.

## Scope

This lane retired the duplicate release-boundary test block that directly checked:

```text
.github/workflows/build-and-release.yml
```

The workflow absence remains fail-closed in `scripts/validate-release-boundary.ts` through `retired_build_and_release_workflow_absent`, and the release-boundary suite still runs that validator through `release boundary guard keeps App release ownership in App repo`.

## Change

- Removed the standalone `legacy tag-push Build and Release workflow is retired` `fs.existsSync` assertion from `tests/release/app-release-boundary-cases/ownership-and-installation-contracts.ts`.
- Kept the validator-owned retired workflow check as the single machine no-resurrection owner.
- Changed no contracts, workflows, release scripts, release artifacts, updater metadata, shell code, candidate records or release evidence.

## Verification

Required verification for this lane:

```bash
rtk npm run validate:release-boundary
rtk npm run test:release-boundary -- --runInBand
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" tests docs scripts contracts .github
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
```

## Remaining Boundary

This closeout is only a test ownership cleanup. It does not change the retired status of the legacy tag-push workflow, does not claim App release readiness, and does not produce release cohort evidence. Reintroducing `.github/workflows/build-and-release.yml` must continue to fail release-boundary validation.
