# 2026-06-06 App Runtime page SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_runtime_page_docs_governance_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current Runtime page truth stays in `contracts/app-runtime-bridge.json`, `contracts/app-page-state-matrix.json`, `contracts/app-gui-product-contract.json`, `contracts/fixtures/opl-app-state-fast.fixture.json`, active-shell validation, release/runtime tests, and OPL Framework `opl app state` / `opl runtime app-operator-drilldown` outputs consumed by the App.

## Snapshot

- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: `Runtime page user-task-status projection versus runtime truth and provider diagnostics`
- Governance mode: SSOT-first content-level audit. Start from runtime bridge and page-state contracts, then classify current docs that mention Runtime page, owner delta, provider diagnostics, active project lines, Stage Artifact refs, and State Index sidecar refs.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-runtime-bridge.json`
  - owns `opl app state --profile fast --json` as the default summary/refresh surface.
  - owns `current_owner_delta` as the default operator payload.
  - keeps `opl app state --profile full --json` and `opl runtime app-operator-drilldown --detail full --json` as explicit diagnostic or release-evidence surfaces.
  - keeps provider/projection/ref/ledger/current-control-state detail secondary and forbids the App from owning runtime truth, provider implementation, domain truth, quality verdicts, artifact body, memory body, owner receipts, or artifact authority.
- `contracts/app-page-state-matrix.json#runtime` and `contracts/app-gui-product-contract.json#pages.runtime_status`
  - own page-state acceptance, user-task-status-first view model, active-project-line separation, refs-only actions, State Index sidecar refs, and Stage Artifact refs.
- `tests/release/app-runtime-bridge-boundary.test.ts`, `tests/release/app-release-boundary.test.ts`, and `scripts/validate-active-shell.ts`
  - fail closed when Runtime page defaults drift from fast App state, when full drilldown becomes ordinary state, when provider attempts become user running-task counts, or when refs-only drilldown grows domain/artifact authority.

Human-doc owners:

- `docs/status.md`
  - owns current status summary and compact product rationale.
- `docs/active/app-ideal-state-gap-plan.md`
  - owns active Runtime evidence gaps and next evidence tail.
- `docs/active/app-interaction-logic-command-center.md`
  - owns App interaction handoff requirements for active shell work.
- `docs/decisions.md`, `docs/invariants.md`, `docs/project.md`, and `README*`
  - own durable policy summaries and public/operator pointers, not the runtime bridge contract itself.
  - must mirror user-task-status-first ordering rather than the old project-progress / owner-action-first summary.

## Peer Docs Classification

| Document / section | Classification | Action |
| --- | --- | --- |
| `contracts/app-runtime-bridge.json` | `covered_by_ssot` machine owner | Already owns fast/full/detail/action bridge, current owner delta default, projection policies, and forbidden authority. No edit. |
| `contracts/app-page-state-matrix.json#runtime` and `contracts/app-gui-product-contract.json#pages.runtime_status` | `covered_by_ssot` machine owner | Already own page-state and GUI product acceptance. No edit. |
| `tests/release/app-runtime-bridge-boundary.test.ts` and `tests/release/app-release-boundary.test.ts` | `covered_by_ssot` machine guards | Already assert user-task-status-first, refs-only, no runtime truth, no active-worker-run overclaim, State Index sidecar refs, and Stage Artifact refs. No edit. |
| `docs/active/app-interaction-logic-command-center.md` / Source Of Truth | `more_specific_detail` | Added `contracts/app-runtime-bridge.json` so the active interaction handoff points to the actual Runtime bridge owner instead of only GUI/page-state contracts. |
| `docs/status.md` / Runtime progress display | `history_or_provenance` mixed into current status | Compressed the dated external status-page reference list into a compact current product principle. Status now keeps the current rule, while one-time research provenance stays out of active truth. |
| `docs/active/app-ideal-state-gap-plan.md` / Runtime owner-action default and evidence | `covered_by_ssot` active plan | Already points to bridge/page-state/product contracts and separates test/evidence gaps from landed behavior. No edit. |
| `README.md` / Runtime bridge summary | `more_specific_detail` public entry | Added the four default Runtime counts and task-row fields so the public summary mirrors the machine contract. |
| `README.zh-CN.md` / 运行状态页 summary | `conflicts_with_ssot` | Replaced the old project-progress / owner-action-first summary with user-task-status-first wording and secondary diagnostics. |
| `docs/project.md` / Runtime page summary | `conflicts_with_ssot` | Replaced the old running-activity/project-progress summary with the contract-owned count-first and task-row ordering. |
| `docs/decisions.md`, `docs/invariants.md`, `docs/release/README.md` | `covered_by_ssot` durable/operator support | Already keep Runtime page display-only, refs-only, user-task-first, no runtime/domain/artifact authority, and release evidence boundaries. No edit. |

## Content-Level Consolidation

- Runtime page current truth is contract/test-owned, not prose-owned.
- The default page answers user task status first: running, active, queued, attention, next step, next owner, progress, and blocker state.
- Public/core summaries now mirror that ordering and no longer make project progress or owner action the default Runtime first-screen anchor.
- Provider runs, Temporal, projections, refs, ledger, stage attempts, and `current_control_state` remain secondary diagnostic terms.
- Full App state and full Operator drilldown are explicit diagnostic/audit/release-evidence paths, not ordinary Runtime page state.
- Stage Artifact and State Index sidecar data are refs-only read-model projections. The App does not read artifact bodies, mutate sidecars, create owner receipts, or declare domain quality/export/readiness.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app` after this edit:

```bash
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" README.md README.zh-CN.md docs/project.md docs/status.md docs/active/app-interaction-logic-command-center.md docs/history/process contracts/app-runtime-bridge.json contracts/app-page-state-matrix.json contracts/app-gui-product-contract.json tests/release/app-runtime-bridge-boundary.test.ts tests/release/app-release-boundary.test.ts
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
rtk npm run test:release-boundary -- --runInBand
```

Result:

- `git diff --check` passed.
- Conflict-marker scan found no matches.
- OPL Doc doctor returned `finding_count = 0`.
- `npm run test:release-boundary -- --runInBand` passed with `123` tests.

## Remaining Scope

This lane covers Runtime page docs SSOT and current prose compression. It does not complete the full App docs portfolio.

Carry forward:

- Broader public README paragraph coverage, Full first-install VM evidence, GUI screenshots/user guides, and broader App docs history remain separate lanes.
- Future Runtime page behavior changes must update runtime bridge/page-state/product contracts, active-shell validation, tests, and supporting docs in one change.
