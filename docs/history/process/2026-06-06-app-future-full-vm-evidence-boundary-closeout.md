# 2026-06-06 App future Full VM evidence boundary closeout

Owner: `one-person-lab-app`
Purpose: `app_future_full_vm_evidence_boundary_closeout`
State: `history_provenance`
Machine boundary: Human-readable no-rewrite closeout. Current Full first-install, clean VM, local authorization, native trust, release evidence, and promotion truth stays in `contracts/app-release-channel.json`, `contracts/app-first-run-test-matrix.json`, `contracts/app-install-exposure-policy.json`, release workflows, release scripts, release artifacts, validation scripts, release-boundary tests, and cohort evidence manifests.

## Snapshot

- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: future release cohort Full first-install VM / local authorization evidence boundary
- Governance mode: SSOT-first content-level audit. The goal was to check whether current App docs still keep a second truth source for future Full VM evidence, dated proof logs, local authorization state, or release-ready promotion.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-release-channel.json`
  - owns Standard versus Full updater separation, Stable validation lanes, Full first-install assets, remote verification, local authorization policy assets, Full native trust, VM gate policy, release validation profiles, and forbidden readiness inferences.
- `contracts/app-first-run-test-matrix.json`
  - owns `full_first_install_clean_machine`, `full_dmg_clean_vm_smoke`, clean no-CLT VM expectations, `ready_to_launch` before `/guid`, bundled-runtime Core readiness, and required release evidence artifacts.
- `contracts/app-install-exposure-policy.json`
  - owns first-run exposure, App/CLI-managed setup, Full first-install install surface, Homebrew Full cask exposure, and deterministic evidence expectations.
- Release workflows, release scripts, validators, tests, and evidence manifests own execution truth:
  - `.github/workflows/desktop-release.yml`
  - `.github/workflows/full-first-install-release.yml`
  - `.github/workflows/opl-first-run-vm.yml`
  - `scripts/validate-release-boundary.ts`
  - `scripts/summarize-release-readiness.ts`
  - `scripts/write-release-evidence-manifest.ts`
  - `tests/release/app-release-boundary*.ts`

Human current owners:

- `docs/status.md` keeps compact current release policy and evidence-boundary summary.
- `docs/active/app-ideal-state-gap-plan.md` keeps the future `full_first_install_vm_evidence` gap and completion gate.
- `docs/release/README.md` keeps operator runbook detail for release lanes, VM gates, local authorization, and Full package diagnostics.
- `docs/testing/README.md` keeps validation matrix guidance.
- Existing `docs/history/process/2026-06-06-app-full-first-install-vm-evidence-ssot-closeout.md` keeps the earlier dated compression provenance.

## Peer Surface Classification

| Surface | Classification | Action |
| --- | --- | --- |
| `docs/status.md` release state / evidence collection sections | `covered_by_ssot` plus compact current summary | No rewrite. It states Full assets are separate from updater metadata, local authorization assets are required per cohort, Full native trust and `SHA256SUMS.txt` are release gates, and release evidence is cohort-bound. |
| `docs/active/app-ideal-state-gap-plan.md#full_first_install_vm_evidence` | `current_active_gap_owner` | No rewrite. It already keeps future Full VM evidence as a release gate and does not claim the gap is closed for all cohorts. |
| `docs/release/README.md` Full / VM / local authorization sections | `more_specific_detail` operator runbook | No rewrite. It carries release-operator detail under contracts, workflows, validators, and tests; it does not own release truth by itself. |
| `docs/testing/README.md` release matrix and VM boundary | `more_specific_detail` validation guide | No rewrite. It lists the test matrix, VM evidence expectations, telemetry boundary, and deterministic gate policy without becoming machine SSOT. |
| `docs/history/process/2026-06-06-app-full-first-install-vm-evidence-ssot-closeout.md` | `history_or_provenance` | Keep as prior compression proof. It records removal of dated VM / 26.6.5 measurement residue from active status. |
| Contracts, workflows, scripts, tests, evidence manifests | `machine_ssot` | Read as current truth; not edited in this docs-only lane. |

## No-Rewrite Decision

No current App doc in the audited peer set needs content compression in this lane:

- There is one active gap owner for future Full VM evidence: `docs/active/app-ideal-state-gap-plan.md`.
- Current release policy stays compact in `docs/status.md`.
- Operator detail stays in `docs/release/README.md`.
- Validation detail stays in `docs/testing/README.md`.
- Dated VM proof and 26.6.5 measurement residue already live in history/provenance.
- Machine contracts and release-boundary tests own the acceptance rules.

The audit found no active doc claiming that future Full VM evidence, Stable/latest promotion, App release readiness, MAS/MAG/RCA domain readiness, or OPL family production readiness is already closed by prior cohort evidence.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app/.worktrees/codex/app-full-vm-future-evidence-boundary-20260606`:

```bash
rtk rg -n "Full VM|VM|local authorization|local-authorization|first-install|future cohort|Full first-install|authorization|macOS trust|26\\.6\\.5|Full package" README* docs/**/*.md docs/*.md
rtk rg -n "full_first_install|full_dmg_clean_vm|local authorization|local-authorization|full-runtime-native-trust|SHA256SUMS|Full.*VM|VM.*Full|first-run VM|release_evidence_artifacts" contracts scripts .github tests docs/release docs/testing docs/status.md docs/active/app-ideal-state-gap-plan.md
```

Result:

- The first scan showed the relevant current docs and history/provenance surfaces; current status and active plan keep compact policy/gap wording, while detailed release/VM material is in release/testing docs or history.
- The second scan confirmed machine truth is present in App contracts, workflows, validators, release scripts, and release-boundary tests.

Additional verification after this closeout should include:

```bash
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/history/process/README.md docs/history/process/2026-06-06-app-future-full-vm-evidence-boundary-closeout.md
rtk opl-doc-doctor doctor . --format json
```

## Remaining Scope

This lane does not create a new Full VM artifact, run a VM, publish a release, promote Stable/latest, change release workflows, alter contracts, or close `full_first_install_vm_evidence` for future cohorts.

Future release cohorts still need real standard/Homebrew/Full VM artifacts, remote verification, release evidence manifests, local authorization assets, Full native trust evidence, release-owner promotion records, and explicit typed blockers for any missing evidence before readiness claims.
