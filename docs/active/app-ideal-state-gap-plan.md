# One Person Lab App Ideal-State Gap Plan

Owner: `one-person-lab-app`
Purpose: `app_ideal_state_gap_plan`
State: `active_plan`
Machine boundary: Human-readable active truth and gap plan. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.
Date: `2026-05-27`

## Current Completion Progress

| Area | Current status | Current readout |
| --- | --- | --- |
| App product boundary | `active_truth` | App owns desktop packaging, release assets, updater metadata, first-run checks, screenshots, user guides, App contracts, and GUI page-state validation. |
| Framework / domain split | `active_truth` | OPL Framework owns runtime/provider/read-model/action execution; MAS/MAG/RCA/OMA own domain truth, quality/export verdicts, memory body, artifact body, owner receipts, and typed blockers. |
| Active shell boundary | `active_external_checkout` | `shells/aionui/` is an external checkout from `gaofeng21cn/opl-aion-shell`; shell implementation history is not merged into the App repo default branch. |
| Product contracts | `landed_with_release_evidence_tail` | `contracts/app-product-profile.json`, `contracts/app-page-state-matrix.json`, `contracts/app-first-run-test-matrix.json`, and `contracts/app-release-channel.json` hold App-owned machine policy. |
| Docs lifecycle | `single_active_truth_owner` | This file holds current App product gaps and next-round baton; `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, and `docs/decisions.md` hold durable current truth. |

## Current-State vs Ideal-State Gaps

| Gap | Current state | Completion gate |
| --- | --- | --- |
| `repeat_release_evidence` | App release evidence collector and manifest validation exist; screenshots, clean first-run VM smoke, settings smoke, remote Release verification, and runtime JSON can still be missing per bundle. | Each release cohort has real artifacts or explicit missing evidence entries; no missing artifact is written as release-ready proof. |
| `full_first_install_vm_evidence` | Full first-install policy is contract-backed; clean no-CLT VM evidence remains a release gate when requested. | Full first-install reaches Core ready from bundled runtime on a clean Mac, with deferred maintenance proven by VM smoke artifacts. |
| `runtime_page_operator_evidence` | Runtime page consumes OPL App/operator drilldown and refs-only safe action routes. | Page-state tests and GUI smoke show summary-first read model, lazy full detail, dry-run/execute controls, receipt/count refresh, and authority-boundary fields. |
| `active_shell_sync` | App root wrappers prepare App-owned payloads and call the external shell. | Product profile and release contracts are generated into the active shell before build/release, without merging shell history into App mainline. |

## Next-Round Agent Prompt

Objective:

- Govern the One Person Lab App product docs and evidence lifecycle without moving runtime/provider/domain authority into the App repo.

Write scope:

- `docs/active/app-ideal-state-gap-plan.md`, `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md`, App contracts, release scripts, testing docs, and focused App tests that affect App product boundary, release evidence, first-run policy, or page-state validation.

Live truth inputs:

- `AGENTS.md`, `TASTE.md`, `README.md`, `docs/README.md`, `docs/status.md`, this plan, App contracts, release/test scripts, shell adapter contract, release evidence manifests, and active shell validation outputs.
- OPL Framework runtime/App drilldown CLI JSON only as consumed input; it remains framework-owned truth.

Required actions:

- Keep App docs, contracts, release wrappers, evidence manifests, and page-state tests aligned with the App product boundary.
- For each release cohort, classify evidence as present, missing, typed blocker, or not applicable; never promote missing evidence to release-ready proof.
- Keep active shell intake explicit: App-owned product/release contract changes stay here, shell implementation changes stay in `opl-aion-shell`.

Non-goals:

- Do not own OPL runtime truth, provider implementation, action-route authority, domain truth, domain quality/export verdict, memory body, artifact body, artifact authority, owner receipt authority, or shell implementation history.
- Do not use App UI rendering, provider completion, updater metadata, or release artifact existence as proof of MAS/MAG/RCA readiness or family production readiness.

Verification commands:

- Docs-only: `rtk git diff --check`, `rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs`, `python3 /Users/gaofeng/workspace/opl-doc-governance/scripts/opl_doc_doctor.py doctor /Users/gaofeng/workspace/one-person-lab-app --format json`.
- App contract/release boundary changes: `rtk npm run test:release-boundary`, `rtk node --experimental-strip-types scripts/validate-active-shell.ts --quick`, and the touched release/evidence validation script.

Completion gate:

- The App active plan, status, project, architecture, invariants, decisions, contracts, and test docs agree on App ownership and non-ownership.
- Release evidence gaps are explicit; no App doc claims runtime truth, domain ready, release ready, or production ready beyond the available artifacts and contracts.

Foldback target:

- Durable product truth folds back to `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md`, or App contracts.
- Release proof, screenshots, VM logs, remote verification, and command traces stay in release artifacts, evidence manifests, CI logs, history docs, or commit history, not in active docs as execution logs.
