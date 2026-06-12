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
- Latest same-tag refresh run: `27410553079`,
  `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27410553079`
- Previous same-tag refresh run: `27408169428`,
  `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27408169428`,
  superseded by the latest-main refresh above.

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
release from App `main` `f1a74d2686b6138b689f83a272d4c46d7a353d18`. After that
run completed, App `origin/main` advanced to
`dd8122f7a4c0c861e20e5f2d4b58ef91314cafdd`, including additional release-path
refactors and this profile note, so `27408169428` is retained as superseded
same-day evidence rather than the current Stable refresh.

Latest same-tag refresh run `27410553079` refreshed the published `v26.6.12`
Stable release from App `main` `dd8122f7a4c0c861e20e5f2d4b58ef91314cafdd` with
`include_full_package=true`, `run_vm_smoke=true`, `framework_ref=main`, and
`shell_ref=main`. It completed successfully with `status=passed` in
`release-readiness-summary.json`, verified 14 remote release assets, updated
both stable Homebrew tap targets, and produced a ready candidate record:
`status=ready_to_promote`, `decision.can_promote=true`,
`source_status.preflight=passed`, `source_status.readiness=passed`, and
`source_status.remote_verification=passed`. The release-owner readout remains
`release_owner_verdict_pending` by contract, so this document records release
evidence and artifact truth rather than an App release-owner sign-off.

## Assets

- Current Standard DMG: `One-Person-Lab-26.6.12-mac-arm64.dmg`, `440433073` bytes, sha256 `6e01283bfb371f83e4a8cb733579f17b6cb3b7cda966ee13f4df3483f2c1643a`
- Current Standard ZIP: `One-Person-Lab-26.6.12-mac-arm64.zip`, `448885870` bytes, sha256 `abeba6956ecb22cede4ce40295e93e3c2812f82f501c4038f32d4b1fd2039793`
- Current Full DMG: `One-Person-Lab-Full-26.6.12-mac-arm64.dmg`, `1048196588` bytes, sha256 `0245f275a8d3b9f64b7d8c539251df2203e1900df0e328fc5e6c15fdf02a2752`
- Current Standard updater metadata: `latest-mac.yml` and
  `latest-arm64-mac.yml`, `538` bytes each, sha256
  `435fe14289e96f4b956c4f07776e41de69c3e514ef1e4986a1a1efc6fb193509`
- Current Full manifest: `full-package-manifest.json`, `24462` bytes, sha256
  `c9b14c8ea35c88777afc20243753ab82c5acfaeba9382e27c442f497c8f44314`

The Full DMG exceeded the release review threshold and was recorded as a
warning, not a publication blocker. It remains the largest current packaging
optimization target.

Previous same-tag refresh assets from `27408169428` before the latest-main
refresh were: Standard DMG `440431045` bytes sha256
`17d77b6b3c06e9f65a1693b730fdeb261426eb13fed9f4d024defc78cbad9911`, Standard
ZIP `448884785` bytes sha256
`c82aa07034fd33f0a8832c43758d292db501ce8c505026439f693a4e3fda252f`, and Full
DMG `1038272075` bytes sha256
`c43904443cd07ac894463eaeb76be0ba911c6c111b71fbb24056558835fe8ef0`.

Initial publication assets before the same-tag refreshes were: Standard DMG
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

Same-tag refresh run `27410553079` ran from `2026-06-12T10:38:58Z` to
`2026-06-12T11:18:25Z`, for `39m27s` wall time. This superseded
`27408169428`, which took `42m22s` and was built from the earlier
`f1a74d2686b6138b689f83a272d4c46d7a353d18` App commit.

- Release preflight: `9s`
- Standard quality gates: lint `48s`, typecheck `51s`, release boundary `42s`,
  Node tests `1m13s`, DOM tests `3m30s`, workflow lint `23s`
- Standard macOS build: `7m58s`
- Publish standard assets: `1m18s`
- Docker WebUI smoke: `2m53s`
- One-shot installer smoke: `1m08s`
- Standard clean VM smoke: `9m25s`
- WebUI GHCR publish: `3m47s`
- Full first-install DMG build: `18m22s`
- Publish Full assets: `1m21s`
- Remote Standard and Full verification: `1m32s`
- Stable Homebrew tap update: `13s`
- Full Homebrew tap update: `9s`
- Full clean VM smoke: `8m21s`
- Homebrew standard VM smoke: `7m52s`
- Operator evidence bundle: `42s`
- Readiness summary: `15s`

The latest Full package build timing artifact reported `10m46s` inside the
packager itself: DMG package compression `5m10s`, shell build `4m40s`, runtime
materialize `36s`, runtime cache materialize `26s`, payload sync `15s`, and
manifest checksum `4s`. The enclosing GitHub Actions Full job took `18m22s`,
so checkout, tool setup, dependency install, cache restore/save, upload plan,
and artifact upload add about `7m36s` around the inner packager. The Full shell
Vite output cache hit, but all Full runtime layer caches reported
`miss_written` for this run.

The latest clean VM stage timing artifacts recorded:

- Standard VM: total smoke script `6m00s`; guest smoke `5m16s`, guest Node copy
  `15s`, input copy `12s`, wait for IP `9s`, wait for SSH `6s`
- Full VM: total smoke script `5m42s`; guest smoke `5m05s`, input copy `14s`,
  wait for IP `9s`, guest Node copy `7s`, wait for SSH `4s`
- Homebrew VM: total smoke script `6m50s`; guest smoke `3m22s`, Homebrew cask
  install `2m44s`, guest Node copy `21s`, wait for IP `9s`, wait for SSH `9s`

The Full package size artifact reported compressed Full DMG `1048196588` bytes
and uncompressed runtime `720537710` bytes, using `72.1%` of the runtime budget.
Largest runtime layers were `toolchain` `533564461` bytes (`74.1%`),
`opl-runtime` `114493506` bytes (`15.9%`), `domain-runtime` `69246776` bytes
(`9.6%`), and `skills` `3208505` bytes (`0.4%`). Largest components were Node
`132662000` bytes (`18.4%`), OPL runtime `114493506` bytes (`15.9%`), Python
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

- Full DMG build remains the dominant build-stage cost, but the latest-main
  refresh reduced the Full job from `21m39s` in `27408169428` to `18m22s` in
  `27410553079`. The inner packager dropped from `12m59s` to `10m46s`, mostly
  because shell build time fell from `6m50s` to `4m40s`.
- The latest inner packager is now dominated by DMG compression `5m10s` and
  shell build `4m40s`; tool/materialization work is under `1m30s`. Practical
  next optimizations are compression tuning, reliable shell build caching, and
  avoiding unnecessary native rebuild/setup around the Full job.
- The Full runtime layer cache did not hit in the latest run
  (`toolchain:false;domain-runtime:false;opl-runtime:false;skills:false` with
  `miss_written` layer events). Making those layer caches reusable is a higher
  leverage release-time optimization than small script dispatch changes.
- The Full DMG is now `1048196588` bytes and still above the review threshold.
  The size hotspots remain the toolchain layer `533564461` bytes, Node
  `132662000` bytes, Temporal vendor archive `114835528` bytes, OPL runtime
  `114493506` bytes, Python `101215127` bytes, and OPL `node_modules`
  `88450200` bytes.
- The latest refresh validates that the standard macOS build is no longer the
  primary wall-time bottleneck, but it regressed from `5m39s` in `27408169428`
  to `7m58s` in `27410553079`. Treat it as a cache/build variability signal,
  not the first optimization lane.
- Clean VM gates are expensive but high-signal. Keep them release-blocking for
  stable. In the latest run the VM stage scripts were slower than the
  superseded refresh even though total workflow time improved; the slowest
  stages are guest smoke for Standard/Full and guest smoke plus Homebrew cask
  install for Homebrew.
- The Homebrew clean-VM path is now clearly split: cask install `2m44s`,
  packaged guest smoke `3m22s`, guest Node copy `21s`, and VM IP/SSH wait under
  `20s`. Future efficiency work should target Homebrew install/cache behavior,
  guest smoke phase visibility, and whether guest Node can be reused instead of
  copied each smoke run.
- Standard quality gates are already split and are not the current bottleneck.
  The current DOM test lane is `3m30s`; further gains should target active shell
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
