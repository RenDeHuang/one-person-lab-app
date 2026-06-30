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
than product-specific: GitHub Actions reusable workflow and artifact behavior,
DORA software delivery metrics, and Google SRE release/canary guidance. The
local implementation must keep using App-owned contracts and release artifacts
as the machine truth.

## Target Architecture

`release_preflight` is the first gate for every release train. It checks version
syntax, release mode, remote tag/release state, workflow shape, release plan
shape, Homebrew token availability, and the App-owned preflight contract. It
writes `release-preflight-summary.json` and `release-preflight-summary.md`.

Docker/WebUI release readiness is scoped to the image and Docker runtime: Docker
build, GHCR publish, and clean Linux Docker runtime smoke are blocking evidence.
Clean Windows VM evidence is optional diagnostic input because Windows Docker
host readiness belongs to Docker and Windows, not the macOS App stable release.

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

Layer 7 is now implemented as release-operator progress correction. The
2026-06-29/30 stable attempt showed that an in-progress GitHub run may keep an
old `updatedAt` while the current step is still active. The operator therefore
computes active elapsed time against its own `generated_at`, reports current
step elapsed time and run update age, and changes the next action from passive
waiting to current-step inspection when the attention budget is crossed.

Layer 8 is now implemented for the standalone WebUI GHCR lane. The old
standalone workflow put build, runtime inspection, smoke, tagging, and GHCR
push into one long step, so an operator could only see
`Build, verify, and publish Docker WebUI` while logs and artifacts were
unavailable. The workflow now calls the App-owned
`scripts/webui-ghcr-release-step.sh` helper from separate GitHub Actions steps,
preserving existing artifact names while making the slow or failed boundary
visible in the Actions job list.

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

Layer 11 is now implemented as promote-time owner-resolution rebuild. When a
desktop release run has already produced complete same-cohort evidence and the
candidate is blocked only because the owner receipt/verdict ref arrived after
the run, `desktop-release-promote.yml` can accept
`release_owner_verdict_ref` or `release_owner_receipt_ref`, download the
original run's small preflight/readiness/remote-verification artifacts, rebuild
the candidate with `npm run release:candidate-record:resolve-owner`, and then
run the same promote-ready validator before publication. This removes the full
desktop release refresh tax for owner metadata only. It does not skip failed
release gates, create owner receipts, or make release-ready/family-production
claims.

Layer 12 is now implemented as post-publish follow-up classification. Closeout
distinguishes a completed publication/readback from a later Homebrew VM,
screenshot, docs, or other proof gate failure by reporting
`published_with_post_publish_followup` and `resolve_post_publish_followup_gate`.
Operators should use this state to chase the failed proof artifact without
reconstructing whether the GitHub Release or Homebrew tap already changed.

Layer 13 is now the release operator controller surface. The 2026-06-29 release
attempt showed that the repository has many correct gates, but the human/agent
still had to synchronize repositories, dispatch releases, poll Actions,
classify failures, repair a shell gate, redispatch, switch from high-noise
`gh run watch` to narrow JSON polling, and then manually discover the right
diagnostic rerun. The default front door is a repo-native command pair:
`npm run release:cohort-plan` records the pinned cohort, and
`npm run release:operator` reads or writes the local operator state.

The controller default flow is:

1. resolve and record the cohort plan, including App commit, shell ref, shell
   resolved SHA, framework ref, framework resolved SHA, Full intent, VM intent,
   owner-resolution inputs, and any reusable gate candidates;
2. run only the cheap local/currentness, release-boundary, and source-gate
   checks before dispatch;
3. dispatch the release workflow only for that pinned cohort;
4. poll only `release-operator-state.json`, the closeout/monitor artifact, or
   structured job JSON; never poll the whole job matrix by default;
5. on failure, emit a typed stop state with exactly one next action:
   `repair_source_gate`, `dispatch_new_cohort`,
   `rerun_diagnostic_same_artifact`, `provide_owner_receipt`,
   `wait_for_runner_capacity`, `retry_transient_upload`, or
   `promote_candidate`;
6. never require the operator to infer whether publish, promotion, or user-path
   proof has happened from scattered logs.

This controller must remain thin. It should orchestrate existing scripts,
workflows, and artifacts; it must not become a second release truth source.
Moving `main` is allowed only as a ref-resolution source during preparation. It
is not a final release train input. The release train input is the cohort lock:
version, release mode, App SHA, shell ref plus resolved shell SHA, framework ref
plus resolved framework SHA, Full/VM intent, owner refs, and gate-reuse inputs.

Layer 14 should make failed VM diagnostics durable even when GitHub artifact
upload finalization fails. The 2026-06-29 Full VM gate failed after the window
opened but before usable-entry labels were exposed; the artifact upload then
hit an `ECONNRESET`, leaving only partial log evidence. For release gates, the
diagnostic path should be designed as if artifact upload can fail:

- always write a small `vm-gate-failure-summary.json/md` before uploading large
  bundles;
- split VM diagnostics into small critical JSON/log artifacts and large optional
  screenshots/videos;
- upload the small critical artifact with fail-closed behavior, and upload
  large evidence with retry/compression settings chosen for recovery rather
  than convenience;
- when running on a self-hosted Tart runner, optionally copy critical summaries
  to a bounded local retention directory before workspace cleanup;
- make the closeout state name `diagnostic_artifact_missing` separately from
  the underlying VM failure, so the next action is a targeted diagnostic rerun
  against the same release artifact, not another full release rebuild.

Layer 15 should promote diagnostic reruns to first-class recovery lanes. A Full
VM failure after remote asset verification should not force another standard
build, Full build, and release asset upload just to learn more. The existing
`OPL GUI First-Run VM` inputs already support `release_artifact_run_id`,
`release_artifact_name`, `release_tag`, `package_profile`, `diagnostic_scope`,
and `keep_vm`; the controller should expose a single command that dispatches
the correct same-artifact diagnostic lane and records its output next to the
failed release closeout. Diagnostic reruns remain non-authoritative unless the
release workflow explicitly consumes them for a same-cohort gate decision, but
they should be the default next step for missing VM evidence.

Layer 16 is now the pinned cohort release flow. It separates "sync everything to
latest" from "release a stable cohort." Syncing every OPL-family repository
immediately before release is good for currentness, but it maximizes batch size
and can import unrelated shell or domain regressions into the release train. The
stable release flow has two phases:

1. a sync preparation phase that updates the OPL family, runs each repo's cheap
   owner/source gate, and records a candidate ref set;
2. a stable release phase that pins those refs, writes the cohort lock, and
   releases that exact cohort.

If preparation finds a shell type/format/DOM failure, it should stop before the
App release workflow starts. If the release phase fails, recovery should keep
the same pinned cohort unless the typed blocker explicitly requires a source
change. This reduces rework tax and makes gate reuse auditable.
The source-gate root-cause rule is fail-fast: a stale App head, unresolved shell
ref, wrong shell type/format, unresolved framework ref, dirty source checkout,
or missing release-boundary policy is a preparation/source-gate failure. Do not
redispatch a full release train to rediscover it in standard, Full, VM,
Homebrew, WebUI, or readiness jobs.

Stale run draining is a stop state, not a watch strategy. If a critical gate has
failed while already-queued jobs are still settling, the controller should
report `failed_gate_draining` with the primary blocker and next action. The
operator waits for drain only to avoid racing cleanup or artifact finalization;
the release decision has already stopped on the typed blocker. If the run head
or source refs no longer match the cohort lock, the run becomes
`stale_candidate`: keep its artifacts for diagnosis of the old cohort, but
never promote it or reinterpret it as evidence for a newer cohort.

Layer 17 is now the release-session control loop. The 2026-06-29/30
`v26.6.29` stable release finally published and promoted, but the operator
experience took about 14 hours. Fresh readback on 2026-06-30 showed the
successful Desktop Release run `28412088570` took `3251s`, the Promote run
`28414244139` took `619s`, and a multi-run `release:actions-timing` profile
over `28399013653`, `28409816179`, `28412088570`, and `28414244139` counted
`6864s` of accumulated Actions run wall time inside a `20652s` Actions span,
with two failed release runs consuming `2994s`. With a 14-hour operator clock,
`29748s` remained outside the Actions span. That residual time is the new
optimization target: not faster Bash alone, but less waiting, fewer manual
branch/context switches, faster typed stop states, and fewer ambiguous
diagnostic decisions.

The ideal release session has one durable state file and one next action at any
time:

- `release_session_id`: version plus pinned cohort digest, not a conversation
  id or a moving branch.
- `session_budget`: target, attention, and stop thresholds for total operator
  wall time, accumulated Actions wall time, and no-progress time.
- `run_set`: all related Desktop Release, diagnostic, GHCR, Windows VM,
  Promote, Homebrew, and docs follow-up run ids with their role and cohort.
- `current_authority`: `preflight`, `source_gate`, `release_run`,
  `candidate_record`, `owner_receipt`, `promote_run`, `published_release`,
  or `post_publish_followup`; this avoids treating logs, docs, or an old run
  as the active truth.
- `typed_next_action`: exactly one of wait, inspect current step, repair source
  gate, run same-artifact diagnostic, provide owner receipt, promote candidate,
  resolve post-publish follow-up, or start a new cohort.
- `session_timing`: generated by `release:actions-timing` across the full run
  set, including failed/cancelled run tax and unaccounted operator time when an
  Agent wall-time clock is supplied.

This layer should land as an extension of the thin operator controller, not as a
second release truth source. `release:operator status` remains the one-run
readout; the next controller increment should add a session manifest that calls
the existing one-run status, closeout, candidate-record, and actions-timing
commands. It should make the 14-hour path visible while it is happening: after
the first failed gate, after every diagnostic rerun, after owner receipt
arrival, before promote, and after post-publish follow-up. A completed release
should close with both machine truth and delivery health: published release
readback, Homebrew tap readback, owner receipt, candidate/promote evidence,
run-set timing, failed-run tax, and exactly which future work would reduce the
next session.

Next optimization candidates must preserve release authority boundaries:

- Continue hardening the thin release controller described in Layer 13. It
  should read and write only structured release artifacts, dispatch existing
  workflows, and produce a small `release-operator-state.json` for local/agent
  use.
- Split Full/standard VM failure evidence as described in Layer 14, then make
  closeout recognize `diagnostic_artifact_missing` with a same-artifact
  diagnostic rerun command.
- Add a first-class same-artifact diagnostic command for Full VM failures,
  backed by `OPL GUI First-Run VM` with `diagnostic_scope=bootstrap_only` or
  `release_gate` as appropriate.
- Keep extending the release cohort preparation command so it records the exact
  App, shell, framework, and family refs after currentness sync, and runs cheap
  source gates before the expensive release workflow.
- Teach the release workflows to explicitly consume
  `opl_release_gate_reuse_plan.v1` for selected gates after one real release
  validates the artifact shape and stop conditions.
- Produce and validate actual Tart prebake image receipts for the standard and
  Homebrew profiles, then switch VM source variables only with fresh image
  digest evidence.
- Keep `refresh_existing` as an emergency repair path; ordinary Stable should
  prefer draft candidate promotion so failed attempts do not overwrite the
  already published stable asset set.
- Add the release-session manifest described in Layer 17, with a focused test
  fixture for the `v26.6.29` shape: two failed Desktop Release runs, one
  successful Desktop Release run, one Promote run, owner receipt closeout, and
  a 14-hour supplied operator clock.

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
