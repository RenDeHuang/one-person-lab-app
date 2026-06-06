# App release-train workflow SSOT closeout

Owner: `one-person-lab-app`
Purpose: `process_history`
State: `history_closeout`
Machine boundary: Human-readable docs-governance closeout. Current release truth stays in `contracts/app-release-channel.json`, `.github/workflows/desktop-release.yml`, release scripts, release artifacts, candidate records, updater metadata, and release-boundary tests.

## Semantic theme

Release workflow authority and the retirement boundary for the older tag-push
workflow.

## Single Source of Truth

- Machine SSOT: `contracts/app-release-channel.json`, `.github/workflows/desktop-release.yml`, `scripts/validate-release-preflight.ts`, `scripts/write-release-candidate-record.ts`, `scripts/summarize-release-readiness.ts`, and `scripts/validate-release-boundary.ts`.
- Human SSOT: `docs/release/README.md`, with `docs/release/release-train-optimization-design.md` as the focused design reference.
- Active gap owner: `docs/active/app-ideal-state-gap-plan.md`.

These win because they define the current Stable release train as preflight,
draft candidate, same-cohort gates, candidate record, and Promote. The legacy
`.github/workflows/build-and-release.yml` file has now been physically retired
from the App mainline.

## Peer classification

| Peer | Classification | Governance action |
| --- | --- | --- |
| `docs/release/README.md` old automatic path paragraph | `conflicts_with_ssot` | Rewrote the paragraph so **Build and Release** is retired, not a valid standard-only Stable path. |
| `docs/release/release-train-optimization-design.md` normal Stable path | `covered_by_ssot` | Kept as the focused design reference for `new_release -> draft candidate -> gates -> candidate record -> promote`. |
| `scripts/README.md` release-plan section | `covered_by_ssot` | No edit needed; it already points operators to the Desktop Release train and `refresh_existing` as emergency-only. |
| `docs/active/app-ideal-state-gap-plan.md` release gaps | `covered_by_ssot` | Removed the `legacy_build_and_release_workflow_retirement` gap after physical deletion and kept a no-resurrection rule in the next-round prompt. |
| `.github/workflows/build-and-release.yml` | `stale_or_superseded` | Deleted the legacy tag-push workflow. |
| `scripts/validate-release-boundary.ts` and release tests | `covered_by_ssot` | Replaced positive checks for the old workflow with fail-closed absence checks and moved standard release assertions to the Desktop Release train. |

## Foldback

- Current docs no longer present tag-push **Build and Release** as a normal
  Stable route.
- `.github/workflows/build-and-release.yml` has been removed from the live
  workflow set.
- `scripts/validate-release-boundary.ts` and release-boundary tests fail closed
  if the legacy workflow is reintroduced.
