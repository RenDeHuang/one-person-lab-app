# 2026-06-07 App docs index current-truth foldback closeout

Owner: `one-person-lab-app`
Purpose: `app_docs_index_current_truth_foldback_closeout`
State: `history_provenance`
Machine boundary: Human-readable OPL Doc closeout. Current App truth stays in `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md`, `docs/docs_portfolio_consolidation.md`, App contracts, source, validation scripts, release-boundary tests, active-shell validation, release artifacts, updater metadata, and OPL Framework read-model output consumed by the App.

## Semantic Theme

Theme: `docs/README.md` navigation index versus current App product/release/runtime truth.

The concern is file-role level. `docs/docs_portfolio_consolidation.md` classifies `docs/README.md` as the docs entry and App docs index with a navigation-only machine boundary. The index should help readers reach current owner docs and contracts, but it should not carry detailed product-profile, install/exposure, active-shell, candidate-shell, release, runtime-bridge, or live-conformance truth.

## Single Source Of Truth

| Scope | SSOT owner |
| --- | --- |
| Docs lifecycle and directory role map | `docs/docs_portfolio_consolidation.md` |
| Current App repository and active shell status | `docs/status.md` |
| App/shell/Framework/domain ownership split | `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md` |
| Active product progress, gaps, and next baton | `docs/active/app-ideal-state-gap-plan.md` |
| Product profile and install/exposure policy | `contracts/app-product-profile.json`, `contracts/app-install-exposure-policy.json`, validators, tests, package manifests, and release scripts |
| Active shell, candidate shell, runtime bridge, and live conformance | `contracts/app-shell-adapter.json`, `contracts/app-shell-candidates.json`, `contracts/shell-adapters/*.json`, `contracts/app-runtime-bridge.json`, validation scripts, tests, and release artifacts |
| Docs index | `docs/README.md` |

## Peer Docs And Evidence

| Surface | Classification | Readout |
| --- | --- | --- |
| `docs/docs_portfolio_consolidation.md` | `covered_by_ssot` | Already states `docs/README.md` is navigation only and keeps the directory responsibility map. |
| `docs/README.md` detailed product/profile/shell/runtime paragraphs | `conflicts_with_ssot` | They repeated current machine-truth detail inside the docs index and made it look like a second product/release/runtime truth owner. |
| `docs/status.md` | `covered_by_ssot` | Owns current App repo, active shell, release/runtime bridge, first-run, candidate, and validation status as human-readable current truth. |
| `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md` | `more_specific_detail` | Keep durable boundary and decision detail with machine-truth pointers. |
| App contracts, validation scripts, tests, release artifacts and updater metadata | `machine_ssot` | Own executable and machine-readable behavior. |

## Edit

- Replaced detailed current-truth paragraphs in `docs/README.md` with a compact navigation-role guard.
- Kept the current docs list and GUI reading-order section, because those are index responsibilities.
- Did not change contracts, source, validation scripts, tests, shell implementation, release workflows, release artifacts, updater metadata, active App status, runtime truth, domain truth, domain readiness, App release readiness, or production readiness.

## Coverage Classification

| Classification | Readout |
| --- | --- |
| `covered_by_ssot` | Current App product/profile/install/shell/candidate/runtime truth already has owner docs and machine owners outside the index. |
| `more_specific_detail` | `docs/README.md` remains the reader navigation entry and GUI reading-order pointer. |
| `conflicts_with_ssot` | Detailed current-truth paragraphs were removed from the index because `docs/docs_portfolio_consolidation.md` defines it as navigation only. |
| `history_or_provenance` | This closeout records the index foldback. |
| `stale_or_superseded` | `docs/README.md` no longer owns product profile semantics, install/exposure policy, active-shell currentness, candidate adoption gates, or live-conformance semantics. |
| `out_of_scope` | No behavior, contract, release, shell, runtime, domain, or readiness surface changed. |

## Verification

Commands:

```bash
rtk git diff --check -- docs/README.md docs/history/process/README.md docs/history/process/2026-06-07-app-docs-index-current-truth-foldback-closeout.md
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/README.md docs/history/process/README.md docs/history/process/2026-06-07-app-docs-index-current-truth-foldback-closeout.md
rtk rg -n "product profile lives|install/exposure policy lives|current stable GUI shell|live conformance|A candidate becomes the default release shell" docs/README.md
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
```

Expected result:

- `docs/README.md` no longer carries detailed current-truth paragraphs.
- Diff check, conflict-marker scan, targeted stale-detail scan and OPL Doc doctor pass.
