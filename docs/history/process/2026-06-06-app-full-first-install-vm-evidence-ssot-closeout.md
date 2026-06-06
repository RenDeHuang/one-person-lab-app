# 2026-06-06 App Full first-install VM evidence SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_full_first_install_vm_evidence_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current Full first-install, VM, local authorization, native trust, and size-gate truth stays in `contracts/app-release-channel.json`, `contracts/app-first-run-test-matrix.json`, `contracts/app-install-exposure-policy.json`, release workflows, release scripts, release artifacts, updater metadata, validation scripts, and release-boundary tests.

## Snapshot

- `RUN_SNAPSHOT_TS`: `2026-06-06T10:44:00Z`
- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: `Full first-install VM/local-authorization evidence versus active release status`
- Governance mode: SSOT-first content-level audit. Start from the App-owned release channel contract, first-run matrix, install exposure policy, release workflows, scripts, tests, and current status; classify dated VM proof and Full payload measurements as history/provenance unless machine contracts still own the rule.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-release-channel.json`
  - owns Full first-install separation from updater metadata, Homebrew Full cask policy, Stable local authorization, Full payload size gates, release acceleration, VM gate policy, release evidence, and screenshot capture boundaries.
- `contracts/app-first-run-test-matrix.json`
  - owns `full_first_install_clean_machine` / `full_dmg_clean_vm_smoke`, `ready_to_launch` before `/guid`, bundled-runtime Core readiness, clean no-CLT VM expectations, and required release evidence artifacts.
- `contracts/app-install-exposure-policy.json`
  - owns first-run presentation, local authorized macOS install, setup-flow contract, and Temporal/background-maintenance non-blocking policy.
- Release workflows, release scripts, and release-boundary tests:
  - `.github/workflows/desktop-release.yml`
  - `.github/workflows/full-first-install-release.yml`
  - `.github/workflows/opl-first-run-vm.yml`
  - `scripts/build-full-first-install-package.ts`
  - `scripts/local-authorization-policy.ts`
  - `scripts/validate-release-boundary.ts`
  - `tests/release/app-release-boundary.test.ts`

Human current owner:

- `docs/status.md` keeps only current policy summary.
- `docs/release/README.md` keeps operator release runbook detail.
- `docs/testing/README.md` keeps validation command/readout guidance.
- `docs/active/app-ideal-state-gap-plan.md` keeps the remaining `full_first_install_vm_evidence` gap.

## Peer Surface Classification

| Surface | Classification | Action |
| --- | --- | --- |
| `docs/status.md` dated Homebrew VM and 26.6.5 Full runtime measurement paragraphs | `history_or_provenance` plus current rule residue | Compressed into current policy: Stable local authorization assets, VM gate quarantine/diagnostic policy, Full native runtime trust gate, `SHA256SUMS.txt` inclusion, runtime-size contract gate, and compressed-size warning semantics. |
| `docs/release/README.md` Full/VM/local authorization sections | `more_specific_detail` operator runbook | Kept unchanged; it carries release operator detail under machine contracts and validation scripts. |
| `docs/testing/README.md` Full/VM release matrix | `more_specific_detail` validation guide | Kept unchanged; it lists release-gate commands and artifact expectations without being the machine SSOT. |
| `docs/active/app-ideal-state-gap-plan.md` | `covered_by_ssot` active gap owner | Kept unchanged; it already states Full first-install VM evidence remains a release gate when requested. |
| `contracts/` / workflows / scripts / tests | `machine_ssot` | Read as current truth; not edited in this docs-only lane. |

## Content-Level Consolidation

- Active status no longer carries dated VM base names, dated command transcripts, 26.6.5 runtime-size measurements, or local follow-up evidence.
- Active status now summarizes the durable current rule:
  - Standard and Full Stable assets publish local authorization policy assets.
  - VM gates record Gatekeeper/codesign diagnostics for the same cohort.
  - Full native runtime executables are gated by `full-runtime-native-trust.json`.
  - `SHA256SUMS.txt`, remote verification, VM gates, and contract size gates remain release truth.
  - Full compressed-size thresholds are review warnings, not publication blockers by themselves.
- Dated evidence remains available through this closeout and commit history, not active release status.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/status.md docs/history/process docs/release/README.md docs/testing/README.md
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
rtk npm run test:release-boundary -- --runInBand
```

Result:

- `git diff --check` passed.
- Conflict-marker scan found no matches.
- OPL Doc doctor reported `finding_count=0`.
- Release-boundary test suite passed: `123 passed`.

## Remaining Scope

This lane does not create a new Full VM artifact, publish a release, promote Stable/latest, change release workflows, or close the `full_first_install_vm_evidence` gap. Future cohorts still need real standard/Homebrew/Full VM artifacts, remote verification, evidence manifests, release-owner promotion records, and any required typed blockers before release readiness claims.
