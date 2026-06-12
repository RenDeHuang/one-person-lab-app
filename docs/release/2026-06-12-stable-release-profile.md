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
- Previous same-tag refresh run: `27408169428`,
  `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27408169428`
- Optimization baseline same-tag refresh run: `27410553079`,
  `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27410553079`
- Current same-tag refresh run: `27415765472`,
  `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27415765472`

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
release from App `main` `f1a74d2686b6138b689f83a272d4c46d7a353d18`.
Optimization baseline refresh run `27410553079` then refreshed the same tag from
App `main` `dd8122f7a4c0c861e20e5f2d4b58ef91314cafdd`. It completed
successfully and is retained as the pre-optimization measurement baseline.

Current same-tag refresh run `27415765472` refreshed the published `v26.6.12`
Stable release from App `main` `85b3e74a1c5e2cde65e97e8c6f2db698a4162e92` with
`include_full_package=true`, `run_vm_smoke=true`, `framework_ref=main`, and
`shell_ref=main`. It completed successfully with `status=passed` in
`release-readiness-summary.json`, verified 14 remote release assets, updated
both stable Homebrew tap targets, passed Standard, Full, and Homebrew clean-VM
smoke gates, published the WebUI GHCR image, and produced a ready candidate
record: `status=ready_to_promote`, `decision.can_promote=true`,
`source_status.preflight=passed`, `source_status.readiness=passed`, and
`source_status.remote_verification=passed`. The release-owner readout remains
`release_owner_verdict_pending` by contract, so this document records release
evidence and artifact truth rather than an App release-owner sign-off.

## Assets

- Current Standard DMG: `One-Person-Lab-26.6.12-mac-arm64.dmg`, `440433398`
  bytes, sha256 `f6ffabdfa8f14d9fed40e417febcf3f19007b911df6f53a9118499d072c4b815`
- Current Standard ZIP: `One-Person-Lab-26.6.12-mac-arm64.zip`, `448885850`
  bytes, sha256 `6b7b36d1dfe7dbb6402cf3d99bd36a4e9c8f4af98459de723f12a4141ec0c0ab`
- Current Full DMG: `One-Person-Lab-Full-26.6.12-mac-arm64.dmg`,
  `1111703543` bytes, sha256
  `a839dd9e665c58639c4b5c86d9679dffb0457c3cab3ac212e8921e26ae082b7c`
- Current Standard updater metadata: `latest-mac.yml` and
  `latest-arm64-mac.yml`, `538` bytes each, sha256
  `54f0ed0986f19e352ae084f35047397b4a860f4224667ab0d84ef07df073b78e`
- Current Full manifest: `full-package-manifest.json`, `24462` bytes, sha256
  `526cdd2a526e9e99e3f5199e35b7331aa6f2d243722d2eb04750f686e1253918`

The Full DMG exceeded the release review threshold and was recorded as a
warning, not a publication blocker. CI DMG compression level `1` reduced
packaging time but increased the Full DMG from `1048196588` bytes in
`27410553079` to `1111703543` bytes in `27415765472`, a `63506955` byte
(`6.1%`) increase. The runtime uncompressed payload remains within budget.

Previous optimization-baseline assets from `27410553079` were: Standard DMG
`440433073` bytes sha256
`6e01283bfb371f83e4a8cb733579f17b6cb3b7cda966ee13f4df3483f2c1643a`,
Standard ZIP `448885870` bytes sha256
`abeba6956ecb22cede4ce40295e93e3c2812f82f501c4038f32d4b1fd2039793`, Full DMG
`1048196588` bytes sha256
`0245f275a8d3b9f64b7d8c539251df2203e1900df0e328fc5e6c15fdf02a2752`, updater
metadata sha256 `435fe14289e96f4b956c4f07776e41de69c3e514ef1e4986a1a1efc6fb193509`,
and Full manifest sha256
`c9b14c8ea35c88777afc20243753ab82c5acfaeba9382e27c442f497c8f44314`.

Previous same-tag refresh assets from `27408169428` were: Standard DMG
`440431045` bytes sha256
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

## Initial Timing Profile

- Release preflight: `10s`
- Standard quality gates: lint `57s`, typecheck `58s`, release boundary `45s`,
  Node tests `1m20s`, DOM tests `2m41s`
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

## Refresh Timing Profiles

Timing boundary: the `39m27s` figure belongs to GitHub Actions workflow wall
time for refresh run `27410553079`. The `2h48m55s` figure observed in the Codex
conversation is Agent orchestration wall time: superseded runs, queue waits,
artifact downloads, local verification, document edits, commit/push work, and
model/tool round-trip latency. Treat GitHub Actions workflow wall time as the
release execution KPI and Agent orchestration wall time as the end-to-end
operator loop KPI.

Optimization baseline run `27410553079` ran from `2026-06-12T10:38:58Z` to
`2026-06-12T11:18:25Z`, for `39m27s` workflow wall time.

- Release preflight: `9s`
- Standard quality gates: lint `48s`, typecheck `51s`, release boundary `42s`,
  Node tests `1m13s`, DOM tests `3m30s`, workflow lint `23s`
- Standard macOS build: `7m58s`
- Publish standard assets: `1m18s`
- Docker WebUI smoke: `2m53s`
- One-shot installer smoke: `1m08s`
- Standard clean VM smoke job: `9m25s`
- WebUI GHCR publish: `3m47s`
- Full first-install DMG job: `18m22s`
- Publish Full assets: `1m21s`
- Remote Standard and Full verification: `1m32s`
- Stable Homebrew tap update: `13s`
- Full Homebrew tap update: `9s`
- Full clean VM smoke job: `8m21s`
- Homebrew standard VM smoke job: `7m52s`
- Operator evidence bundle: `42s`
- Readiness summary: `15s`

Current optimized run `27415765472` ran from `2026-06-12T12:30:41Z` to
`2026-06-12T13:20:33Z`, for `49m52s` workflow wall time. The first job started
at `2026-06-12T12:38:28Z`, so the run included `7m47s` queue/admission time;
runner execution from first job start to completion was `42m05s`.

- Release preflight: `10s`
- Standard quality gates: lint `49s`, typecheck `50s`, release boundary `49s`,
  Node tests `1m20s`, DOM tests `3m32s`, workflow lint `26s`
- Standard macOS build: `8m17s`
- Publish standard assets: `1m59s`
- Docker WebUI smoke: `2m56s`
- One-shot installer smoke: `1m12s`
- Standard clean VM smoke job: `9m48s`
- WebUI GHCR publish: `4m43s`
- Full first-install DMG job: `14m42s`
- Publish Full assets: `2m51s`
- Remote Standard and Full verification: `1m30s`
- Stable Homebrew tap update: `14s`
- Full Homebrew tap update: `12s`
- Full clean VM smoke job: `11m31s`
- Homebrew standard VM smoke job: `5m56s`
- Operator evidence bundle: `34s`
- Readiness summary: `13s`

The latest Full package build timing artifact reported `6m45s` inside the
packager itself: DMG package compression `2m55s`, shell build `3m07s`, runtime
materialize `20s`, runtime cache materialize `8s`, payload sync `18s`, and
manifest checksum `5s`. The enclosing GitHub Actions Full job took `14m42s`,
so checkout, tool setup, dependency install, cache restore/save, upload plan,
checksum/signing verification, and artifact upload add about `7m57s` around the
inner packager.

The optimization baseline Full packager took `10m46s`: DMG package compression
`5m10s`, shell build `4m40s`, runtime materialize `36s`, runtime cache
materialize `26s`, payload sync `15s`, and manifest checksum `4s`. The current
run therefore reduced inner packager time by `4m01s`, DMG compression by
`2m15s`, shell build by `1m33s`, runtime materialize by `16s`, and runtime cache
materialize by `18s`.

The latest Full runtime layer cache events were:

- `toolchain`: `hit`, `2.294s`
- `domain-runtime`: `miss_written`, `3.439s`
- `opl-runtime`: `hit`, `2.347s`
- `skills`: `hit`, `0.087s`

The optimization baseline recorded all four Full runtime layer caches as
`miss_written`. The cache work landed for the latest run, but `domain-runtime`
still missed because its source refs changed.

The latest clean VM stage timing artifacts recorded:

- Standard VM: total smoke script `3m54s`; guest smoke `3m26s`, wait for IP
  `9s`, guest Node copy `8s`, input copy `6s`, wait for SSH `4s`
- Full VM: total smoke script `3m53s`; guest smoke `3m25s`, wait for IP `9s`,
  input copy `8s`, guest Node copy `5s`, wait for SSH `4s`
- Homebrew VM: total smoke script `4m55s`; guest smoke `2m57s`, Homebrew cask
  install `1m38s`, wait for IP `9s`, guest Node copy `8s`, wait for SSH `2s`

The optimization baseline clean VM stage timing artifacts recorded:

- Standard VM: total smoke script `6m00s`; guest smoke `5m16s`, guest Node copy
  `15s`, input copy `12s`, wait for IP `9s`, wait for SSH `6s`
- Full VM: total smoke script `5m42s`; guest smoke `5m05s`, input copy `14s`,
  wait for IP `9s`, guest Node copy `7s`, wait for SSH `4s`
- Homebrew VM: total smoke script `6m50s`; guest smoke `3m22s`, Homebrew cask
  install `2m44s`, guest Node copy `21s`, wait for IP `9s`, wait for SSH `9s`

The current Full package size artifact reported compressed Full DMG
`1111703543` bytes and uncompressed runtime `720696534` bytes, using `72.1%` of
the runtime budget. Largest runtime layers were `toolchain` `533564461` bytes
(`74.0%`), `opl-runtime` `114615513` bytes (`15.9%`), `domain-runtime`
`69283593` bytes (`9.6%`), and `skills` `3208505` bytes (`0.4%`). Largest
components were Node `132662000` bytes (`18.4%`), OPL runtime `114615513` bytes
(`15.9%`), Python `101215127` bytes (`14.0%`), `uv` `47747680` bytes (`6.6%`),
OfficeCLI `32344032` bytes (`4.5%`), and MAS `31450542` bytes (`4.4%`).

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

- Implemented and verified on `27415765472`: Full runtime layer cache keys were
  tightened so release wrapper, manifest, and DMG helper edits do not invalidate
  all layer archives when the layer content itself is unchanged; layer restore
  keys now include stable layer prefixes. The first post-change run moved from
  four runtime layer cache misses to three hits and one miss.
- Implemented and verified on `27415765472`: Full fallback DMG compression in
  CI is explicitly set to zlib level `1` and recorded as
  `dmg_compression_level`. This reduced `dmg_package_compression` from `5m10s`
  to `2m55s`, but increased the Full DMG by `6.1%`. Keep this as a deliberate
  speed/size tradeoff, not a free optimization.
- Implemented and verified on `27415765472`: the Full job no longer performs a
  shell-produced DMG followed by App-owned DMG wrapping. It uses shell
  `--dir-only` and then App-owned packaging. The shell build segment fell from
  `4m40s` to `3m07s`, and the Full job wall time fell from `18m22s` to
  `14m42s`.
- Implemented and verified on `27415765472`: Homebrew VM install/smoke improved
  from `6m50s` script time to `4m55s`. Homebrew cask install fell from `2m44s`
  to `1m38s`; guest smoke fell from `3m22s` to `2m57s`; guest Node copy fell
  from `21s` to `8s`.
- Implemented and verified on `27415765472`: Standard and Full VM script times
  improved materially, from `6m00s` to `3m54s` for Standard and from `5m42s` to
  `3m53s` for Full. Their job wall times did not improve equally because runner
  setup, artifact download, and VM prelude are outside `stage_timing`.
- Remaining highest-leverage build optimization: split `domain-runtime` cache
  by domain source or preserve sublayer reuse, because this run still recorded
  `domain-runtime=miss_written` when MAS/MAG/RCA/OMA refs changed.
- Remaining highest-leverage size optimization: reduce the `toolchain` layer.
  It is `533564461` bytes (`74.0%` of runtime), led by Node, Temporal vendor
  archive, Python, Codex vendor payload, `uv`, and OfficeCLI.
- Remaining highest-leverage release-tail optimization: instrument and reduce
  VM job prelude. The Full VM job wall time was `11m31s`, while the measured VM
  smoke script was only `3m53s`; the difference is outside the Tart summary and
  should be made visible before optimizing guest smoke further.
- Standard quality gates are already split and are not the current bottleneck.
  The DOM test lane is around `3m30s`; further gains should target active shell
  DOM test cost only if it preserves release-boundary signal.
- Release monitoring should prefer Actions job metadata and small structured
  artifacts over long `gh run watch` output. The timings above came from job
  boundaries, `full-workflow-telemetry.json`, `runtime-cache-events.json`, and
  `tart-smoke-summary.json`.
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
