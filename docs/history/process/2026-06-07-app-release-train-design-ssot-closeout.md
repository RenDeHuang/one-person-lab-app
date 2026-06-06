# 2026-06-07 App release train design closeout

Owner: `one-person-lab-app`
Purpose: `app_release_train_design_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable no-rewrite closeout. Current release train, preflight, candidate-record, promotion, remote verification, Full cache, and post-release user-guide screenshot truth stays in `contracts/app-release-channel.json`, App release workflows, release scripts, candidate records, release readiness summaries, validation scripts, release-boundary tests, and release artifacts.

## Semantic Theme

`release_train_design_vs_release_workflow_truth`: `docs/release/release-train-optimization-design.md` is an active design/support document. It may describe intended release-train architecture and operator stop conditions, but it must not become the machine owner for release-channel policy, workflow shape, candidate promotion, readiness, screenshots, or Stable/latest publication.

## Single Source Of Truth

- Release train contract SSOT: `contracts/app-release-channel.json#release_preflight` and `#release_acceleration`.
- Plan graph SSOT: `scripts/plan-release-candidate.ts`.
- Candidate record SSOT: `scripts/write-release-candidate-record.ts` and `scripts/validate-release-candidate-record.ts`.
- Workflow SSOT: `.github/workflows/desktop-release.yml`, `.github/workflows/desktop-release-promote.yml`, `.github/workflows/release-verify-remote.yml`, `.github/workflows/full-runtime-cache-warmup.yml`, and related release workflows.
- Validation SSOT: `scripts/validate-release-boundary.ts`, release-speed tests, release readiness tests, and release-boundary cases.
- Human operator owner: `docs/release/README.md`.

These owners beat the design doc because they execute or validate the release graph, promotion source, workflow concurrency, remote verification, candidate record, and post-release screenshot lane.

## Peer Docs / Evidence

| Surface | Classification | Decision |
| --- | --- | --- |
| `docs/release/release-train-optimization-design.md` | `more_specific_detail` / `active_design` | No rewrite. It describes the target architecture and current implemented layers without carrying dated run logs, release-ready claims, or promotion authority. |
| `docs/release/README.md` | `more_specific_detail` / operator runbook | No rewrite. It points to the design and keeps operational release instructions under contracts/workflows/scripts. |
| `docs/active/app-ideal-state-gap-plan.md` | `covered_by_ssot` | No rewrite. It keeps active release evidence gaps and forbids legacy Build and Release resurrection without becoming the release train design owner. |
| `docs/status.md` | `covered_by_ssot` | No rewrite. It keeps compact release status and evidence-boundary statements. |
| `contracts/app-release-channel.json` | `machine_ssot` | Owns release preflight, acceleration, workflow refs, VM policy, Full cache, remote verification, and screenshot evidence contract fields. |
| Release scripts, workflows, and tests | `machine_ssot` / `more_specific_detail` | Own deterministic release plan, candidate record generation/validation, promotion gate, workflow concurrency, and post-release screenshot lane guards. |

## No-Rewrite Decision

No current App doc in the audited peer set needs compression or rewrite for this lane:

- The design doc remains bounded as `State: active_design`.
- The operator runbook remains `docs/release/README.md`.
- Release train machine truth stays in contracts, workflows, scripts, tests, candidate records, readiness summaries, and release artifacts.
- The older tag-push **Build and Release** path is already retired and guarded elsewhere.
- `post_release_user_guide_screenshots` is already a post-promotion documentation lane, not a pre-promotion gate or release-readiness substitute.
- No current release-train design/support doc contains old run ids, dated WebUI policy residue, or claims that design prose alone can promote Stable/latest.

## Retired / Guarded Surface

The retired semantic surface is promotion/readiness reconstructed from design prose, scattered job logs, local notes, dated run ids, or screenshot/docs refresh output. The current surface requires `release-candidate-record.json` with `status=ready_to_promote`, matching version/provenance, and release owner promotion through the Desktop Release Promote workflow. No compatibility workflow, alias, facade, wrapper, or second promotion truth owner was added.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk rg -n "release-train|release train|ready_to_promote|ready-to-promote|post_release_user_guide_screenshots|Build and Release|desktop-release|desktop-release-promote|release-verify-remote|full-runtime-cache|screenshot|run id|019e|2026-06-01|legacy" docs/release/release-train-optimization-design.md docs/release/README.md docs/status.md docs/active/app-ideal-state-gap-plan.md contracts/app-release-channel.json .github scripts tests -g '*.md' -g '*.json' -g '*.yml' -g '*.yaml' -g '*.ts'
rtk rg -n "release_train|post_release_user_guide_screenshots|ready_to_promote|desktop-release-promote|release evidence|screenshot" tests/release scripts contracts .github -g '*.ts' -g '*.json' -g '*.yml' -g '*.yaml'
```

Result:

- The scans show the design doc, release guide, active plan, status, contracts, workflows, scripts, and tests all keep the same release-train roles.
- Candidate promotion truth is script/test/workflow-owned and requires `ready_to_promote`.
- `post_release_user_guide_screenshots` is test/plan-owned as `after_promotion_not_pre_promotion_gate`.
- No stale `019e*` run id or `2026-06-01 release policy` residue appears in the design doc.

Additional scoped verification for this closeout:

```bash
rtk node --experimental-strip-types --test tests/release/release-speed-vm-plan.test.ts --test-name-pattern "release plan exposes depends_on|release CI operations docs separate implemented release gates"
rtk node --experimental-strip-types --test tests/release/app-release-boundary.test.ts --test-name-pattern "release plan exposes parallel lanes and the serialized no-CLT VM gate|release CI operations policy distinguishes workflow hygiene from release evidence"
rtk git diff --check
rtk sh -lc '! rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/history/process/README.md docs/history/process/2026-06-07-app-release-train-design-ssot-closeout.md'
python3 /Users/gaofeng/workspace/opl-doc/scripts/opl_doc_doctor.py doctor /Users/gaofeng/workspace/one-person-lab-app --format json
```

## Remaining Scope

This lane does not run a release, change workflows, publish assets, promote Stable/latest, generate a candidate record, refresh user-guide screenshots, alter release contracts, or close future release evidence gaps. Broader App docs portfolio coverage remains open under the global OPL series goal.
