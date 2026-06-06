# App release-notes Full first-install wording closeout

Owner: `one-person-lab-app`
Purpose: `release_notes_full_first_install_wording_closeout`
State: `history_provenance`
Machine boundary: Human-readable release-note wording closeout. Machine truth stays in App release contracts, release-note generators, release scripts, release artifacts, validation scripts, updater metadata, and release-boundary tests.

## Semantic Theme

This lane retires stale release-note wording that described Full assets as `Full clean-install`. Current App release truth consistently treats the Full distribution as the explicit `Full first-install` surface.

## Single Source of Truth

- `contracts/app-release-channel.json` owns standard updater versus Full first-install release-channel boundaries.
- `contracts/app-first-run-test-matrix.json` owns first-run scenario policy.
- `scripts/release-notes.ts` and `scripts/release-notes/payload.ts` own generated release-note wording.
- `tests/release/release-notes.test.ts` and `tests/release/app-release-boundary-cases/release-plan-and-publishing.ts` own focused release-note output assertions.

## Classification

| Classification | Readout |
| --- | --- |
| `covered_by_ssot` | Full release-note wording now uses `Full first-install DMG` / `Full first-install assets` in stable, nightly and payload sections. |
| `more_specific_detail` | Stable release notes may still mention standard macOS arm64 updater packages, but Full assets remain the explicit first-install surface and stay out of standard updater metadata. |
| `conflicts_with_ssot` | `Full clean-install` wording made release notes sound like a different distribution surface from the App-owned Full first-install policy. |
| `history_or_provenance` | This file records the wording foldback; current release truth remains source/test/contract-owned. |
| `stale_or_superseded` | Active release-note generator and focused tests no longer preserve positive `Full clean-install` wording. |
| `out_of_scope` | This lane did not change release workflows, package building, Homebrew casks, updater metadata, release-channel contracts, Full first-install artifacts, VM evidence, candidate/default shell adoption, App release readiness, or domain readiness. |

## Changes

- Replaced `Full clean-install DMG` release-scope wording with `Full first-install DMG`.
- Replaced Full payload description wording with `Full first-install DMG payload`.
- Replaced Nightly exclusion wording with `Full first-install assets`.
- Updated focused release-note and release publishing assertions.
- Added negative assertions so generated notes do not reintroduce `Full clean-install`.

## Verification

Baseline before edits:

- `rtk node --experimental-strip-types --test tests/release/release-notes.test.ts` passed with `2` tests.
- `rtk node --experimental-strip-types --test tests/release/app-release-boundary-cases/release-plan-and-publishing.ts` passed with `11` tests.

Post-edit focused verification:

- `rtk node --experimental-strip-types --test tests/release/release-notes.test.ts` passed with `2` tests.
- `rtk node --experimental-strip-types --test tests/release/app-release-boundary-cases/release-plan-and-publishing.ts` passed with `11` tests.
- Targeted scan over release-note source and focused tests left `Full clean-install` only in negative no-resurrection assertions.
- `rtk npm run ensure:shell` prepared `shells/aionui` from `gaofeng21cn/opl-aion-shell@4a1154d4c313`.
- `rtk npm run validate:release-boundary` passed.
- `rtk npm run test:release-boundary -- --runInBand` passed with `124` tests.
- `rtk git diff --check` passed.
- Conflict-marker scan over `scripts tests docs contracts` returned `conflict_marker_scan=clean`.
- Active retired-wording scan over release-note source, active release docs, status, active docs and contracts returned `active_retired_wording_scan=clean`.
- `rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json` returned `finding_count=0` and `active_truth_health.status=pass`.

An initial over-broad `npm run test:release-boundary -- --runInBand --testNamePattern ...` baseline attempt ran the whole release-boundary suite. It exposed unrelated failures from missing `shells/aionui` files in the isolated worktree plus one unrelated updater metadata assertion. The scoped release-note tests above are the verification authority for this wording lane.

## Remaining Scope

Broader release-boundary verification that needs `shells/aionui` remains a separate full App release validation concern. This closeout only retires stale release-note wording.
