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
- GitHub Actions job outputs and reusable workflow inputs make the release
  cohort explicit: resolve moving refs once, pass fixed SHAs through `needs`
  outputs, and make downstream jobs consume those values instead of re-reading
  branch names.
- GitHub Actions is a good executor, but a weak live control surface for one
  opaque long shell step. Use step boundaries, `$GITHUB_STEP_SUMMARY`, small
  artifacts, and job timeouts as observability and recovery tools instead of
  expecting an operator to infer progress from a static run page.
- Homebrew casks are an index to published assets and checksums. They should not
  become semantic authority for runtime modules or agent behavior.
- SLSA-style provenance treats resolved source dependencies as part of build
  integrity. App, shell, and Framework SHAs therefore belong in the release
  cohort and candidate record, not only in operator notes.
- Release evidence should be structured and small. Large DMGs should be
  validated by dedicated jobs, while summary jobs download only JSON/markdown
  diagnostics.
- Software delivery health should be measured as a system, not by whether one
  operator waited long enough. DORA-style metrics map directly to this release
  train: workflow wall time is lead time, failed refresh/new-release attempts
  are change-failure or rework tax, and recovery from a failed gate is measured
  by time to a typed blocker or a green same-cohort rerun.
- The release clock must be measured at two levels. GitHub Actions run wall
  time measures executor critical path, while release-session wall time measures
  the complete operator experience across failed runs, diagnostics, owner
  receipt, promotion, runner capacity, and post-publish follow-up. Optimizing
  only the successful run can hide the actual user pain.
- Canary/progressive delivery patterns still apply to desktop packages. The
  equivalent of a service canary is a draft candidate plus standard and Full
  clean-install gates against the exact bytes users will install, followed by
  explicit promotion. No user-visible stable/latest state should depend on an
  operator mentally reconstructing a long run.

For this repo, those lessons map to App-owned contracts: standard updater truth,
Full first-install truth, Homebrew cask truth, and clean VM readiness must remain
separate, then be joined by the readiness summary.

The external sources behind these lessons are intentionally operational rather
than product-specific: GitHub Actions reusable workflow, concurrency, artifact,
and artifact-attestation behavior; SLSA provenance guidance; DORA software
delivery metrics; and Google SRE release/canary guidance. Fresh source check on
2026-06-30: GitHub Actions workflow syntax/reusable workflow/artifact
attestation docs, DORA metrics guide, SLSA build provenance spec, and Google SRE
release engineering/canarying material. The local implementation must keep using
App-owned contracts and release artifacts as the machine truth.

## Target Architecture

`release_preflight` is the first gate for every release train. It checks version
syntax, release mode, remote tag/release state, workflow shape, release plan
shape, Homebrew token availability, and the App-owned preflight contract. It
writes `release-preflight-summary.json` and `release-preflight-summary.md`.

Docker/WebUI release readiness is scoped to the image and Docker runtime: Docker
build, GHCR publish, and clean Linux Docker runtime smoke are blocking evidence.
Clean Windows VM evidence is optional diagnostic input because Windows Docker
host readiness belongs to Docker and Windows, not the macOS App stable release.
The Docker/WebUI lane starts after standard asset publish, not after the macOS
standard VM gate. Final Stable readiness still requires both the macOS App gate
and the Docker/WebUI gates when Docker/WebUI publishing is enabled, but one lane
must not suppress the other's evidence collection.

`release_source_gate` runs after preflight and before expensive lanes. It checks
the App release-boundary contract, active shell format/type, active shell
node/dom tests, shell ref resolution, and framework ref resolution. Shell test
failures such as Settings DOM regressions are source-gate failures, not release
lane failures.

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

`release_operator_status` is the no-watch control surface. It reads GitHub
Actions live state, the expected App SHA, current job/step, elapsed time, active
step age, run update age, stale-candidate state, and primary blockers. Its
output is not a release-ready claim; it is an operator state machine that
chooses between wait, inspect current step, repair source gate, repair WebUI
runtime image, repair GHCR access, inspect closeout evidence, or start a new
cohort.

`webui_ghcr_publish` must be observable as a pipeline, not a monolith. The
standalone WebUI lane is split into prepare, build, inspect/readback, smoke,
tag, publish, and upload steps. Desktop release may still build once and reuse
that image for smoke plus publish, but the action boundary must reveal whether
time is being spent in Docker build, runtime validation, HTTP smoke, GHCR
authentication, or package push.

`release_readiness_summary` is the final judge. It downloads only small
diagnostic artifacts and fails closed when required gates are missing, failed,
or inconsistent.

`post_release_user_guide_screenshots` is a post-promotion documentation lane. It
may capture and refresh user-guide screenshots from the promoted Stable cohort,
but it must not become a pre-promotion gate or a release readiness substitute.

## Implementation Surface

This section records the current release-control design, not a proof ledger.
Specific run ids, timing profiles, failed-gate transcripts, and release-by-
release investigation detail belong in release artifacts, CI logs, release
records, or `docs/history/process/`.

| Control surface | Current design role | Authority boundary |
| --- | --- | --- |
| App-owned preflight | Fail fast on release mode, target, workflow shape, release-plan drift, external ref availability, Homebrew token requirements, and VM-smoke package metadata before expensive jobs run. | Preflight is an admission gate only; it does not replace build, VM, remote verification, or owner evidence. |
| Candidate record and promotion | Join release triggering, readiness, remote verification, owner-resolution refs, and promotion decision through `opl_release_candidate_record.v1`. Stable promotion must read a same-cohort `ready_to_promote` record. | Candidate records cannot skip failed gates, create owner receipts, or claim family/domain production readiness. |
| Readiness summary and closeout | The final readiness job writes `release-readiness-summary.json`, `release-candidate-record.json`, `release-closeout.json/md`, monitor state, and notification state from small structured artifacts. | Operators stop at structured blockers, readiness, closeout, remote verification, or candidate record before opening raw logs. |
| Release operator status | `npm run release:operator` is the no-watch control surface for current job/step, elapsed time, run update age, stale candidate state, primary blocker, and typed next action. | It is an operator state machine, not a release-ready claim or second release truth source. |
| WebUI GHCR lane | Standalone WebUI publish is split into prepare, build, inspect/readback, smoke, tag, publish, and upload steps so the slow or failed boundary is visible. | WebUI/container evidence does not replace desktop App install evidence or stable promotion evidence. |
| Release actions timing | `release-actions-timing.json/md` measures workflow wall time, failed/cancelled run tax, slow jobs, slow steps, and optional operator-loop gap. | Timing artifacts are delivery-health evidence, not release readiness or owner acceptance. |
| Standard/Homebrew critical path | The Homebrew standard VM gate waits only for the stable standard cask tap update. Full cask update remains an independent required gate when Full is included. | Standard and Full release lanes stay separate; standard evidence cannot prove Full first-install readiness. |
| Gate reuse plan | `npm run release:gate-reuse-plan` can emit `opl_release_gate_reuse_plan.v1` with per-gate `reuse_allowed` / `must_run` decisions and a stable digest. | It is advisory until workflows explicitly consume the artifact; no gate is skipped by prose. |
| Tart prebake boundary | The release contract allows only host setup layers such as GUI session readiness, Homebrew prerequisites, Node prerequisites, and Codex install cache seed. | A prebaked base is not current release infrastructure until it has an image receipt, digest, profile, truth boundary, and validation command. |
| Owner-resolution rebuild | Promote workflow may rebuild a candidate record from existing same-cohort small artifacts when only owner receipt/verdict refs arrived after the run. | It cannot repair failed gates or generate owner authority. |
| Post-publish follow-up | Closeout distinguishes published/readback state from later Homebrew VM, screenshot, docs, or proof-gate follow-up via `published_with_post_publish_followup`. | Follow-up gates must not rewrite whether the release/tap was already published. |
| Pinned cohort flow | Stable release separates sync preparation from release execution: resolve App/Shell/Framework refs, run cheap owner/source gates, write a cohort lock, then release that exact cohort. | Moving `main`, shell `main`, and framework `main` are preparation inputs only, never final release train truth. |
| Stale/draining/stop-and-redispatch states | `failed_gate_draining` stops the decision while queued jobs settle; `stale_candidate` keeps old artifacts diagnostic-only when source refs no longer match the cohort lock; queued same-mode/same-version runs wait by default, while `cancelled` and `superseded` record explicit operator stop-and-redispatch after process repair or a newer cohort dispatch. | Old-cohort artifacts cannot be promoted or reinterpreted as current release evidence, and cancellation/supersession is not a source-gate failure. |

## Open Design Work

| Work item | Purpose | Completion signal |
| --- | --- | --- |
| Full package size fast gate | Catch size-budget and DMG fallback regressions locally before remote release work. | Full fallback uses electron-builder `--prepackaged`; plain `hdiutil -srcfolder` fallback fails release-boundary validation. |
| Durable VM diagnostic summaries | Preserve small critical VM failure summaries even when large artifact upload finalization fails. | `vm-gate-failure-summary.json/md` is written before large uploads, and closeout can report `diagnostic_artifact_missing` separately from the underlying VM failure. |
| Same-artifact diagnostic rerun command | Debug Full/standard VM failures after remote verification without rebuilding and reuploading the full release cohort. | One command dispatches the correct `OPL GUI First-Run VM` diagnostic lane for a release tag, direct DMG URL, or existing artifact run/name, and records the result next to the failed closeout. |
| Workflow gate-reuse consumption | Turn advisory `opl_release_gate_reuse_plan.v1` into explicit workflow skip behavior for selected gates only after artifact shape and stop conditions are proven. | The workflow consumes the reuse plan and records which gates were reused or rerun for the same cohort. |
| Tart prebake image receipts | Make standard/Homebrew base images current release infrastructure only when they have image digest evidence and validation output. | Release contract source variables change only alongside fresh image receipts. |
| Release-session manifest | Add a durable session-level state file around existing one-run status, closeout, candidate-record, and timing commands. | The manifest records session id, run set, current authority, typed next action, timing, failed-run tax, owner receipt state, and post-publish follow-up without becoming a second release truth source. |

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
- Dispatch Stable only from a pinned cohort lock. Moving `main`, shell `main`,
  and framework `main` may be used to resolve SHA values during sync
  preparation, but the final release train must consume resolved App/Shell/
  Framework SHAs.
- Stop as blocked when the candidate record is `blocked`, a required small
  artifact is missing, a gate is failed/cancelled/skipped unexpectedly, or the
  release workflow cannot produce a candidate record.
- Treat `failed_gate_draining` as a stopped decision with queued jobs still
  settling. Do not wait on broad `gh run watch` once the primary blocker and
  typed next action are known.
- Treat `stale_candidate` and `obsolete_candidate` artifacts as old-cohort
  diagnostics only. They cannot be promoted, patched into the new cohort, or
  used as current release evidence.
- If the release process needs a mid-run fix, explicitly stop or supersede the
  old run before redispatching from a new pinned cohort. Default GitHub Actions
  concurrency queues same-mode/same-version desktop releases instead of
  cancelling them. Classify the old run as `cancelled` or `superseded`; do not
  count that outcome as a source-gate failure.
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
