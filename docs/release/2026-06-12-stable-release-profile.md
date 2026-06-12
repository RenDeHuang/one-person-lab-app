# 2026-06-12 Stable Release Profile

Owner: `one-person-lab-app`
Purpose: `stable_release_profile`
State: `active_evidence_note`
Machine boundary: Human-readable release profiling and optimization notes for `v26.6.12`. Machine truth remains in GitHub Actions runs, release artifacts, Homebrew tap plans, contracts, scripts, and validation output.

## Release

- Version: `26.6.12`
- Tag: `v26.6.12`
- Release URL: `https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/v26.6.12`
- Published at: `2026-06-12T03:01:39Z`
- Main release run: `27390375446`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27390375446`
- Promote run: `27391621253`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27391621253`
- Post-fix Homebrew standard VM gate run: `27393124605`,
  `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27393124605`
- Latest same-tag refresh run: `27408169428`,
  `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27408169428`

## Outcome

The main release run completed successfully and produced a ready candidate record:
`status=ready_to_promote`, `decision.can_promote=true`,
`source_status.preflight=passed`, `source_status.readiness=passed`, and
`source_status.remote_verification=passed`.

The promote workflow published `v26.6.12` and updated both stable Homebrew tap
targets. The initial post-promote Homebrew standard first-run VM gate failed at
`failure_stage=homebrew_cask_install` before App first launch. The failure was
an App-owned release gate policy gap around Homebrew cask trust refs, not an App
runtime, first-run, or packaged GUI failure.

The release gate was repaired in App release contracts/workflow expectations and
in the active shell smoke implementation. Post-fix rerun `27393124605` completed
successfully against App `main` `a5fedf89fe63eae0adf09c3e38ee23de49a95ee1` and
shell `main` `f11e5f047efacf831f77ee5f9c029b10fef032a2`.

Same-tag refresh run `27408169428` refreshed the published `v26.6.12` Stable
release from App `main` `f1a74d2686b6138b689f83a272d4c46d7a353d18` with
`include_full_package=true`, `run_vm_smoke=true`, `framework_ref=main`, and
`shell_ref=main`. It completed successfully with `status=passed` in
`release-readiness-summary.json` and produced a ready candidate record:
`status=ready_to_promote`, `decision.can_promote=true`,
`source_status.preflight=passed`, `source_status.readiness=passed`, and
`source_status.remote_verification=passed`. This is the current Stable refresh
evidence for the small App and shell fixes landed after the first publication.

## Assets

- Current Standard DMG: `One-Person-Lab-26.6.12-mac-arm64.dmg`, `440431045` bytes, sha256 `17d77b6b3c06e9f65a1693b730fdeb261426eb13fed9f4d024defc78cbad9911`
- Current Standard ZIP: `One-Person-Lab-26.6.12-mac-arm64.zip`, `448884785` bytes, sha256 `c82aa07034fd33f0a8832c43758d292db501ce8c505026439f693a4e3fda252f`
- Current Full DMG: `One-Person-Lab-Full-26.6.12-mac-arm64.dmg`, `1038272075` bytes, sha256 `c43904443cd07ac894463eaeb76be0ba911c6c111b71fbb24056558835fe8ef0`
- Current Standard updater metadata: `latest-mac.yml` and
  `latest-arm64-mac.yml`, `538` bytes each, sha256
  `7a09292116040e81ca26721faeb5b21d72d9a35e9821474353d77c098c59f349`
- Current Full manifest: `full-package-manifest.json`, `24462` bytes, sha256
  `0c78637dc50de9fd166eae680f26abf6aa29c6b5c2796a88cdf3640c0c916a59`

The Full DMG exceeded the release review threshold and was recorded as a
warning, not a publication blocker. It remains the largest current packaging
optimization target.

Initial publication assets before the latest same-tag refresh were: Standard DMG
`440940649` bytes sha256
`389d0950b534e97a631eab08239d2162aadb1d2faa37fdb0cddbfcae32672466`, Standard
ZIP `449364337` bytes sha256
`16050f8a10539407cf900dee35912fa3ffea97741048c1a7908a3482a53dbf52`, and Full
DMG `1045190008` bytes sha256
`720cf21b650fcf8e5879fe44fe2b77684283fe99e84ac9acbc8075ced5ff7b10`.

## Timing Profile

- Release preflight: `10s`
- Standard quality gates: lint `57s`, typecheck `58s`, release boundary `45s`, Node tests `1m20s`, DOM tests `2m41s`
- Standard macOS build: `7m08s`
- Publish standard assets: `1m28s`
- Docker WebUI smoke: `2m55s`
- One-shot installer smoke: `1m08s`
- Standard clean VM smoke: `9m07s`
- Full first-install DMG build: `20m56s`
- Publish Full assets: `2m01s`
- Remote Standard and Full verification: `2m15s`
- Full clean VM smoke: `6m50s`
- Operator evidence bundle: `43s`
- Readiness summary: `25s`
- Main release wall time: about `33m46s`
- Promote release publish and remote verification: `1m38s`
- Stable Homebrew tap update: `12s`
- Full Homebrew tap update: `13s`
- Failed Homebrew VM gate elapsed before failure: about `1m42s`
- Post-fix Homebrew standard VM gate wall time: `7m29s`
- Post-fix Homebrew standard VM smoke step: `6m13s`
- Post-fix Homebrew stage timings from `tart-smoke-events.jsonl`:
  clone/config/start to SSH `15s`, guest prep and input copy `6s`,
  Homebrew cask install `2m13s`, packaged guest smoke `3m36s`, artifact copy and
  summary under `1s`, artifact upload `5s`

## Latest Refresh Timing Profile

Same-tag refresh run `27408169428` ran from `2026-06-12T09:48:51Z` to
`2026-06-12T10:31:13Z`, for `42m22s` wall time.

- Release preflight: `9s`
- Standard quality gates: lint `46s`, typecheck `57s`, release boundary `41s`,
  Node tests `1m17s`, DOM tests `3m16s`, workflow lint `21s`
- Standard macOS build: `5m39s`
- Publish standard assets: `2m14s`
- Docker WebUI smoke: `2m48s`
- One-shot installer smoke: `1m24s`
- Standard clean VM smoke: `11m19s`
- WebUI GHCR publish: `3m42s`
- Full first-install DMG build: `21m39s`
- Publish Full assets: `1m31s`
- Remote Standard and Full verification: `1m28s`
- Stable Homebrew tap update: `10s`
- Full Homebrew tap update: `9s`
- Full clean VM smoke: `6m56s`
- Homebrew standard VM smoke: `5m52s`
- Operator evidence bundle: `37s`
- Readiness summary: `30s`

The latest Full package build timing artifact reported `12m59s` inside the
packager itself: shell build `6m50s`, DMG package compression `4m56s`, runtime
materialize `48s`, runtime cache materialize `26s`, payload sync `21s`, and
manifest checksum `4s`. The enclosing GitHub Actions Full job took `21m39s`,
so checkout, tool setup, dependency install, cache restore/save, upload plan,
and artifact upload add about `8m40s` around the inner packager.

The latest clean VM stage timing artifacts recorded:

- Standard VM: total smoke script `3m57s`; guest smoke `3m29s`, input copy
  `11s`, wait for IP `9s`, guest Node copy `4s`, wait for SSH `3s`
- Full VM: total smoke script `3m44s`; guest smoke `3m18s`, input copy `9s`,
  wait for IP `9s`, guest Node copy `4s`, wait for SSH `3s`
- Homebrew VM: total smoke script `4m51s`; guest smoke `2m33s`, Homebrew cask
  install `1m56s`, wait for IP `9s`, guest Node copy `7s`, wait for SSH `4s`

The Full package size artifact reported compressed Full DMG `1038272075` bytes
and uncompressed runtime `720531674` bytes, using `72.1%` of the runtime budget.
Largest runtime layers were `toolchain` `533564509` bytes (`74.1%`),
`opl-runtime` `114487422` bytes (`15.9%`), `domain-runtime` `69246776` bytes
(`9.6%`), and `skills` `3208505` bytes (`0.4%`). Largest components were Node
`132662000` bytes (`18.4%`), OPL runtime `114487422` bytes (`15.9%`), Python
`101215127` bytes (`14.0%`), `uv` `47747680` bytes (`6.6%`), OfficeCLI
`32344032` bytes (`4.5%`), and MAS `31413725` bytes (`4.4%`).

## Failure Chain

The failed Homebrew VM used Homebrew `5.1.14-27-g028c262` and attempted:

```bash
brew install --cask one-person-lab
```

Homebrew refused to load the cask from the untrusted tap
`gaofeng21cn/one-person-lab`. The tap plan itself was correct and pointed the
standard cask at the published `v26.6.12` standard DMG with sha256
`389d0950b534e97a631eab08239d2162aadb1d2faa37fdb0cddbfcae32672466`.

The release gate fix is to install the standard cask through the fully qualified
ref:

```bash
brew install --cask gaofeng21cn/one-person-lab/one-person-lab
```

This keeps the install explicit without broad `brew trust` approval for the
whole tap.

Follow-up rerun `27392430848` confirmed the workflow passed the fully qualified
standard cask ref to the VM and Homebrew trusted
`gaofeng21cn/one-person-lab/one-person-lab`. The next failure was still at
`homebrew_cask_install`, but the refused cask changed to
`gaofeng21cn/one-person-lab/one-person-lab-full`. Homebrew loads
`conflicts_with` sibling casks while resolving the install, so the final gate
policy is to explicitly trust the standard cask plus its sibling cask refs:
`one-person-lab`, `one-person-lab-full`, and `one-person-lab-nightly`. The gate
must not trust the whole tap.

Final rerun `27393124605` used the repaired App workflow and active shell smoke
implementation. It checked out App `main`
`a5fedf89fe63eae0adf09c3e38ee23de49a95ee1`, checked out shell `main`
`f11e5f047efacf831f77ee5f9c029b10fef032a2`, passed
`--homebrew-cask gaofeng21cn/one-person-lab/one-person-lab`, and completed
`status=passed` with `smoke_profile=homebrew-standard-cask`.

The final artifact `tart-smoke-summary.json` recorded:

- packaged first launch `status=passed`
- settings smoke `status=passed` across general, environment, capabilities,
  access, appearance, advanced, about, and runtime-status pages
- assistant route smoke `status=passed` for MAS, MAG, and RCA
- deterministic Codex functional check `status=passed`
- Codex AI self-check `skipped_missing_codex_config`, marked
  `blocking_release_gate=false`

## Optimization Notes

- Full DMG build is the dominant build-stage cost at about `21m`, and the Full
  DMG is now `1038272075` bytes. Continue profiling payload layer composition,
  cache hits, and DMG compression before adding new Full payloads.
- The latest refresh validates that the standard macOS build optimization moved
  the build-stage bottleneck: standard macOS build improved from `8m31s` in run
  `27405661917` to `5m39s` in run `27408169428`, while Full build remained
  near `22m`. Further release wall-time gains should target Full shell build,
  DMG compression, and non-packager overhead rather than the standard build.
- The latest Full build shows the inner packager is dominated by shell build
  `6m50s` and DMG compression `4m56s`; tool/materialization work is under
  `2m`. Practical next optimizations are cacheable shell build output,
  compression tuning, and reducing the toolchain layer, not small script
  dispatch changes.
- Clean VM gates are expensive but high-signal. Keep them release-blocking for
  stable, and improve early preflight checks so environment-policy failures
  surface before the VM spends time cloning and booting.
- The Homebrew clean-VM path is now profiled enough to split optimization work:
  current cask install is `1m56s`, packaged guest smoke is `2m33s`, and VM
  startup/prep remains under `30s`. Future efficiency work should first target
  Homebrew install/cache behavior and guest smoke phase visibility.
- Standard quality gates are already split and are not the current bottleneck.
  The current DOM test lane is `3m16s`; further gains should target active shell
  DOM test cost only if it preserves release-boundary signal.
- Release monitoring should prefer Actions job metadata and small structured
  artifacts over long `gh run watch` output. The timings above came from job
  boundaries and artifact summaries.
- Homebrew trust behavior is now part of the release contract and VM gate input:
  the standard cask install ref is
  `gaofeng21cn/one-person-lab/one-person-lab`, and the VM gate trusts only the
  standard plus `conflicts_with` sibling cask refs.
- The same Homebrew rule is now a static preflight/release-boundary gate:
  `release-preflight-summary.json` includes
  `homebrew.vm_gate_static_policy`, and `homebrew_vm_gate_static_policy` fails
  before VM startup if the install ref, explicit trusted standard/full/nightly
  cask refs, or `explicit_standard_and_conflicting_cask_refs_not_whole_tap`
  scope drift.
- The active shell Tart host smoke summary now records `stage_timing` directly
  in `tart-smoke-summary.json` for passed, failed, and interrupted runs. Future
  release profiling can consume per-stage durations and slowest stages from the
  small summary artifact instead of reconstructing timings from JSONL logs.
