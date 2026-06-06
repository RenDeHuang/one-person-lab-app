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
3. Publish to a draft or existing release according to the requested mode.
4. Verify remote assets and checksums before user-path gates.
5. Update Homebrew only after remote asset verification.
6. Run clean installation gates against the same cohort users will install.
7. Publish or promote only from a complete readiness summary.

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

## Implementation Layers

Layer 1 is now implemented: App-owned preflight. It prevents common late
failures such as wrong release mode, missing release target, missing Homebrew
token for a stable VM run, deleted preflight workflow steps, and release plan
drift.

Layer 2 is now partially implemented: release triggering and promotion are
joined by `opl_release_candidate_record.v1`. A Stable release can only promote
when the record is `ready_to_promote`; blocked cohorts keep their gate reasons
in the same record.

Layer 3 should make Full package size and DMG fallback compression a local fast
gate. The Full fallback must use electron-builder `--prepackaged`; any plain
`hdiutil -srcfolder` fallback is a release regression because it can pass local
authorization while exceeding the Full DMG size budget.

Layer 4 should reduce CI polling cost. Release triage should prefer downloaded
summary artifacts and job-result JSON over repeated `gh run view` loops. The
interactive agent should inspect failed job logs only after summary artifacts
identify the failing gate.

Layer 5 is now implemented as the candidate record. It stores version, App
commit, shell/framework refs, workflow run id, preflight/readiness/remote
verification statuses, Full resolved refs, remote asset summary, job results,
blocked reasons, and the promotion decision.

## Validation

The minimum local validation for release-train changes is:

```bash
npm run release:preflight -- --version <version> --release-mode draft_candidate --include-full-package true --run-vm-smoke false --offline
npm run validate:release-boundary
npm run test:release-boundary
```

Before a real Stable release with VM smoke, preflight must run without
`--offline` and must have `OPL_HOMEBREW_TAP_TOKEN_PRESENT=true` in the workflow
environment. GitHub Actions sets that from `secrets.OPL_HOMEBREW_TAP_TOKEN`.

## Non-Goals

This design does not move runtime truth, module truth, domain readiness, or
Homebrew semantic authority into the App repo. It also does not make local
authorization equivalent to Developer ID notarization. Those remain separate
distribution policies encoded in the current contracts.
