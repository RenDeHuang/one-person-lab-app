# Release Train Optimization Design

Owner: `one-person-lab-app`
Purpose: `release_train_optimization_design`
State: `active_design`
Machine boundary: Human-readable design. Machine truth stays in
`contracts/app-release-channel.json`, release workflows, release scripts, and
release evidence artifacts.

## Goal

The App release path should behave like a release train, not a long interactive
debugging session. A release attempt must fail before expensive builds whenever
the requested cohort, workflow shape, secrets, or release target is invalid. It
must produce small structured evidence at every gate and promote only after
standard, Full, Homebrew, VM, WebUI, and remote asset gates are coherent for the
same version cohort.

The target operator experience is:

1. Run or trigger one preflight.
2. Build standard and Full lanes in parallel only after preflight passes.
3. Publish every normal Stable attempt to a draft candidate.
4. Verify remote assets and checksums before user-path gates.
5. Update Homebrew only after remote asset verification.
6. Run clean installation gates against the same cohort users will install.
7. Write the candidate record from the complete readiness summary.
8. Promote the Stable Release only from that candidate record.
9. Refresh user-guide screenshots and docs after promotion.

## External Lessons

Mature Electron desktop projects and official tooling converge on these
patterns:

- Sign, notarize, and update metadata are release gates, not post-release notes.
  Electron/electron-builder document code signing and notarization as part of
  macOS distribution, and Electron updater flows keep installer metadata
  separate from unrelated payloads.
- GitHub Actions reusable workflows work best when expensive jobs are called
  after a small validation job checks inputs, permissions, and target state.
- Homebrew casks are an index to published assets and checksums. They should not
  become semantic authority for runtime modules or agent behavior.
- Release evidence should be structured and small. Large DMGs should be
  validated by dedicated jobs, while summary jobs download only JSON/markdown
  diagnostics.

For this repo, those lessons map to App-owned contracts: standard updater truth,
Full first-install truth, Homebrew cask truth, and clean VM readiness must remain
separate, then be joined by the readiness summary.

## Target Architecture

`release_preflight` is the first gate for every release train. It checks version
syntax, release mode, remote tag/release state, workflow shape, release plan
shape, Homebrew token availability, and the App-owned preflight contract. It
writes `release-preflight-summary.json` and `release-preflight-summary.md`.

`release_plan` is the deterministic graph. It names lanes, dependencies, and
parallelism. Expensive lanes depend on `release_preflight`, and serialized
promotion gates depend on the exact published cohort.

The normal Stable path is `new_release -> draft candidate -> gates -> candidate
record -> promote`. The candidate record is the only promotion source. Operators should
not reconstruct promotion readiness from scattered job logs, local notes, or a
long-running run page. `refresh_existing` is reserved for emergency repair or
replacement of an already published release cohort, such as replacing a broken
asset after owner approval; it is not the ordinary path for a new Stable
version.

`standard_build` and `full_build` are build lanes. They create artifacts and
diagnostics only. They do not decide release readiness.

`publish_standard` and `publish_full_assets` are upload lanes. They normalize
assets, release notes, and manifest evidence, then publish to the selected tag.

`remote_verify_*` validates the GitHub Release as the user-facing byte source.
This is the source for asset size, checksums, updater metadata, Full manifest,
local authorization policy, and Full runtime native trust.

`homebrew_tap_update` runs only after remote verification, so the tap points at
verified GitHub Release assets. The Homebrew VM gate then installs the same
cohort.

`installation_gates` cover standard DMG, Homebrew standard cask, Full DMG, the
one-shot installer, and Docker WebUI. These jobs write small artifacts consumed
by the summary.

`release_readiness_summary` is the final judge. It downloads only small
diagnostic artifacts and fails closed when required gates are missing, failed,
or inconsistent.

`post_release_user_guide_screenshots` is a post-promotion documentation lane. It
may capture and refresh user-guide screenshots from the promoted Stable cohort,
but it must not become a pre-promotion gate or a release readiness substitute.

## Implementation Layers

Layer 1 is now implemented: App-owned preflight. It prevents common late
failures such as wrong release mode, missing release target, missing Homebrew
token for a stable VM run, deleted preflight workflow steps, and release plan
drift.

Layer 2 is now partially implemented: release triggering and promotion are
joined by `opl_release_candidate_record.v1`. The intended Stable path creates a
draft candidate first, runs the gates against that cohort, writes the candidate
record, and promotes only when the record is `ready_to_promote`; blocked cohorts
keep their gate reasons in the same record.

Layer 3 should make Full package size and DMG fallback compression a local fast
gate. The Full fallback must use electron-builder `--prepackaged`; any plain
`hdiutil -srcfolder` fallback is a release regression because it can pass local
authorization while exceeding the Full DMG size budget.

Layer 4 is now implemented as a default release-train artifact, not as an
optional operator shortcut. The `release-readiness-summary` job writes
`release-readiness-summary.json`, `release-candidate-record.json`, and then
`release-closeout.json/md`, uploading `release-closeout-<version>` for every
desktop release run. It reuses the local small artifacts already downloaded by
readiness, runs the closeout script with `--no-download`, refuses
standard/Full package artifacts, records GitHub Actions workflow wall time
separately from Agent orchestration wall time, and points the operator at
promotion, candidate blockers, failed readiness gates, or raw log inspection
only after structured evidence is missing. The `npm run release:closeout`
command remains the rerun/debug entry for the same logic. For any long-running
release run, stop at the candidate record, readiness summary, closeout summary,
remote verification JSON, or named blocked gate. Do not keep chasing scattered
job logs after the structured artifacts have already identified the stop
condition.

Layer 5 is now implemented as the candidate record. It stores version, App
commit, shell/framework refs, workflow run id, preflight/readiness/remote
verification statuses, Full resolved refs, remote asset summary, job results,
blocked reasons, and the promotion decision.

Layer 6 is now implemented as first-run failure-tax reduction. The 2026-06-18
`v26.6.18` stable refresh took `4h2m50s` of Agent/operator wall time, but the
successful final workflow was `48m32s`. The extra cost came from failed release
runs that exposed problems only after expensive jobs had already started:

- `27766301877` failed after the Full package lane and operator-evidence
  summary had already run.
- `27768289724` failed in the Homebrew standard VM lane during Codex package
  asset prefetch.
- `27771471126` failed in standard clean VM readiness and later in active-shell
  checkout for the Homebrew VM lane.

The release preflight therefore owns fast external availability checks for
`shell_ref`, `framework_ref`, and the Codex CLI plus Darwin arm64 platform
package metadata whenever VM smoke is requested. These checks do not replace
builds, VM smokes, tarball download, or release readback evidence; they only
move common release-blocking failures from the 30-50 minute mark to the first
preflight job.

Layer 7 is now implemented as a default GitHub Actions timing artifact. Every
desktop release run writes `release-actions-timing.json` and
`release-actions-timing.md` from the final readiness job. This artifact records
workflow wall time, failed/cancelled run tax when multiple run IDs are supplied
manually, slow jobs, and slow steps. Operators should use it before opening raw
job logs so performance tuning starts from measured bottlenecks rather than
long `gh run watch` output.

Layer 8 is now implemented as standard/Homebrew critical-path decoupling. The
Homebrew standard VM smoke waits for the stable standard cask tap update only.
It no longer waits for the Full cask tap update, because the standard Homebrew
install gate tests the standard cask and standard release assets. The Full tap
update remains an independent required readiness gate when the Full package is
included.

Layer 9 is now implemented as a gate-reuse decision artifact. The
`npm run release:gate-reuse-plan` command compares the current cohort against a
previous promote-ready candidate record, previous readiness summary, and
previous remote verification artifact. It emits
`opl_release_gate_reuse_plan.v1` with per-gate `reuse_allowed` / `must_run`
decisions, the matched cohort fields, and a stable `reuse_digest`. The command
requires matching version, release mode, Full/VM-smoke intent, App commit,
shell/framework refs, resolved framework sha, previous gate status, previous
candidate status, and remote asset `{name,size,sha256}` set. This is not yet an
automatic workflow skip; workflows must explicitly consume the artifact before
any gate can be skipped.

Layer 10 is now contracted as a Tart base prebake boundary, not claimed as a
current image. The release contract names the standard and Homebrew source VM
variables and allows only host setup layers such as GUI session readiness,
Homebrew prerequisites, Node runtime prerequisites, and Codex install asset
cache seed. It forbids prebaking the App, release DMGs, release Homebrew casks,
workspace state, runtime truth, domain artifact truth, or owner receipts. A real
prebaked base still needs an image receipt with source VM, image digest,
profile, prebaked layers, truth boundary, and validation command before it can
be considered current release infrastructure.

Next optimization candidates must preserve release authority boundaries:

- Teach the release workflows to explicitly consume
  `opl_release_gate_reuse_plan.v1` for selected gates after one real release
  validates the artifact shape and stop conditions.
- Produce and validate actual Tart prebake image receipts for the standard and
  Homebrew profiles, then switch VM source variables only with fresh image
  digest evidence.
- Keep `refresh_existing` as an emergency repair path; ordinary Stable should
  prefer draft candidate promotion so failed attempts do not overwrite the
  already published stable asset set.

## Validation

The minimum local validation for release-train changes is:

```bash
npm run release:preflight -- --version <version> --release-mode new_release --include-full-package true --run-vm-smoke false --offline
npm run validate:release-boundary
npm run test:release-boundary
```

Before a real Stable release with VM smoke, preflight must run without
`--offline` and must have `OPL_HOMEBREW_TAP_TOKEN_PRESENT=true` in the workflow
environment. GitHub Actions sets that from `secrets.OPL_HOMEBREW_TAP_TOKEN`.

Operator stop conditions:

- Promote only when `release-candidate-record.json` has
  `status=ready_to_promote` for the intended version, App commit, shell ref,
  Full refs, remote verification, readiness summary, and job results.
- Stop as blocked when the candidate record is `blocked`, a required small
  artifact is missing, a gate is failed/cancelled/skipped unexpectedly, or the
  release workflow cannot produce a candidate record.
- Use `refresh_existing` only for an owner-approved emergency repair or replace
  lane against an already published release.
- Run user-guide screenshot/docs refresh only after Stable promotion; screenshot
  refresh failure creates a post-release docs task, not a pre-promotion release
  blocker.

## Non-Goals

This design does not move runtime truth, module truth, domain readiness, or
Homebrew semantic authority into the App repo. It also does not make local
authorization equivalent to Developer ID notarization. Those remain separate
distribution policies encoded in the current contracts.
