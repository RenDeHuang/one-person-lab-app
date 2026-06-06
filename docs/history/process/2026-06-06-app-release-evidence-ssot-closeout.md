# 2026-06-06 App release evidence SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_release_evidence_docs_governance_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current release evidence truth stays in `contracts/app-release-channel.json`, release evidence manifests, validation scripts, release workflows, tests, release artifacts, updater metadata, and release owner promotion records.

## Snapshot

- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: `release cohort evidence versus release-ready claims`
- Governance mode: SSOT-first content-level audit. Start from the release evidence contract and validator, then classify release docs and historical smoke/proof mentions.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-release-channel.json#operator_evidence_bundle`
  - owns required artifact ids, paths, allowed artifact classifications, refs-only authority boundary, and release cohort scope.
  - requires required artifacts to be classified as `present`, `missing`, `typed_blocker`, or `not_applicable`.
  - requires `packaged_app_evidence=true` only when every required artifact is present and verified.
  - forbids converting App release/user-path evidence into runtime truth, domain truth, artifact authority, quality/export verdict, stable/latest promotion, domain readiness, or family production readiness.
- `scripts/validate-release-evidence-bundle.ts`
  - validates the manifest path, required artifacts, image dimensions, JSON shapes, MAS/MAG/RCA assistant route receipts, Codex functional check receipt, remote release verification, typed blocker fields, and not-applicable fields.
- `scripts/write-release-evidence-manifest.ts` and `scripts/collect-release-evidence.ts`
  - write/import evidence into contract-owned paths without treating source paths or partial collection as release-ready proof.
- `tests/release/app-release-boundary.test.ts`
  - guards release evidence artifact ids and paths, assistant-route screenshots, missing/typed/not-applicable classification, and no-readiness overclaim boundaries.

Human-doc owners:

- `docs/release/README.md`
  - owns the release operator guide and evidence bundle checklist, but must mirror the machine contract instead of defining a second artifact list.
- `docs/testing/README.md`
  - owns stable testing commands and installed-App smoke guidance.
- `docs/status.md` and `docs/active/app-ideal-state-gap-plan.md`
  - own current status and active evidence tail language.
- `docs/docs_portfolio_consolidation.md`
  - owns the docs lifecycle rule that release truth returns to assets, manifests, CI/logs, validation commands, and release artifacts.

## Peer Docs Classification

| Document / section | Classification | Action |
| --- | --- | --- |
| `contracts/app-release-channel.json#operator_evidence_bundle` | `covered_by_ssot` machine owner | Already owns required artifacts and evidence scope. No edit. |
| `scripts/validate-release-evidence-bundle.ts` | `covered_by_ssot` machine validator | Already validates MAS/MAG/RCA assistant-route screenshots and fail-closed classifications. No edit. |
| `tests/release/app-release-boundary.test.ts` | `covered_by_ssot` machine guard | Already locks artifact ids/paths and no-overclaim boundaries. No edit. |
| `docs/release/README.md` / evidence bundle checklist | `conflicts_with_ssot` | Added missing `artifacts/assistant-route-smoke/{mas,mag,rca}.png` entries so the human checklist mirrors the contract. |
| `docs/testing/README.md` / installed App smoke and release matrix | `covered_by_ssot` support guidance | Already says installed smoke is cohort-bound and must be paired with contracted manifests, screenshots, VM summaries, remote verification, and release evidence bundle classification. No edit. |
| `docs/status.md` / release evidence collection | `covered_by_ssot` current status | Already says only an all-present verified bundle can set `packaged_app_evidence=true` and forbids stable/latest or domain readiness inference. No edit. |
| `docs/active/app-ideal-state-gap-plan.md` / release evidence gaps | `covered_by_ssot` active plan | Already keeps `repeat_release_evidence` and packaged GUI evidence cohort-bound. No edit. |
| `README.md`, `README.zh-CN.md` | `more_specific_detail` public entry | Installation and release entry points remain high-level and do not own the evidence bundle artifact list. No edit. |
| `docs/history/process/*.md` previous release/candidate smoke records | `history_or_provenance` | Dated local smoke and generated guide records remain provenance, not current release evidence. |

## Content-Level Consolidation

- The App release evidence artifact list is contract-owned. `docs/release/README.md` mirrors it for operators.
- Release evidence remains same-cohort App evidence. Missing, typed-blocked, or not-applicable artifacts are explicit classifications and cannot be promoted to packaged App evidence.
- Assistant route smoke now has two required layers in the human release guide: the route smoke summary JSON plus MAS/MAG/RCA screenshot artifacts.
- This lane did not change release readiness semantics, updater metadata, Full first-install gates, Homebrew tap policy, or App release workflows.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app` after this edit:

```bash
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/release docs/history/process docs/status.md docs/active/app-ideal-state-gap-plan.md docs/testing/README.md README.md README.zh-CN.md
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
rtk node - <<'NODE'
const fs = require('fs');
const contract = JSON.parse(fs.readFileSync('contracts/app-release-channel.json', 'utf8'));
const releaseDoc = fs.readFileSync('docs/release/README.md', 'utf8');
const missing = contract.operator_evidence_bundle.required_artifacts
  .map((artifact) => artifact.path)
  .filter((artifactPath) => !releaseDoc.includes(artifactPath));
console.log(JSON.stringify({ required_count: contract.operator_evidence_bundle.required_artifacts.length, missing }, null, 2));
if (missing.length) process.exit(1);
NODE
rtk npm run test:release-boundary -- --runInBand
```

Result:

- `git diff --check` passed.
- Conflict-marker scan found no matches.
- OPL Doc doctor passed with `finding_count = 0`.
- Contract-vs-guide artifact checklist reported `required_count = 16` and `missing = []`.
- `npm run test:release-boundary -- --runInBand` passed with `123` tests.

## Remaining Scope

This lane covers the App release evidence bundle checklist and no-overclaim boundary. It does not complete the full App docs portfolio.

Carry forward:

- Homebrew/updater boundary, runtime page docs, public README install narrative, Full first-install VM evidence, and broader App docs portfolio remain separate lanes.
- Future release cohorts still need real artifacts or explicit artifact classifications before `packaged_app_evidence=true`.
- If `operator_evidence_bundle.required_artifacts` changes, update `docs/release/README.md` in the same change or replace the checklist with a generated source-of-truth table.
