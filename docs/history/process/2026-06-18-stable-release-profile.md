# 2026-06-18 Stable Release Profile

Owner: `one-person-lab-app`
Purpose: `stable_release_profile`
State: `historical_release_provenance`
Machine boundary: Human-readable release profiling and optimization provenance for the `v26.6.18` candidate/promote cohort. Current machine truth remains in GitHub Actions runs, release artifacts, Homebrew tap outputs, contracts, scripts, validators, owner records, and fresh CI output.

## Release

- Version: `26.6.18`
- Tag: `v26.6.18`
- First release attempt run: `27732095094`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27732095094`
- Successful main release run: `27740551584`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27740551584`
- Successful promote run: `27741971528`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27741971528`
- App commit: `829e67b971c73e28bc5c81eaeca30617b4f0b458`

## Timing Profile

The reported end-to-end operator loop was `5h45m51s`. The portion that can be
rebuilt from GitHub Actions run timestamps starts at the first release attempt,
`2026-06-18T02:08:57Z`, and ends at the successful promote run completion,
`2026-06-18T07:03:33Z`, for `4h54m36s`. The remaining `51m15s` is outside that
remote Actions span and belongs to local preparation, repo/issue synchronization,
owner-record handling, release readback, and model/tool orchestration time unless
a more precise local phase ledger is present.

Rebuilding the same-day release profile with `release:actions-timing` across the
ten candidate/promote runs gives `4h6m49s` accumulated GitHub Actions workflow
wall time inside that `4h54m36s` span. Successful runs account for `1h19m40s`;
failed or canceled runs account for `2h47m9s` across seven runs.

Same-day Actions timeline:

- `27732095094`: canceled, `2026-06-18T02:08:57Z` to `2026-06-18T02:13:36Z`
- `27732257823`: failed, `2026-06-18T02:13:52Z` to `2026-06-18T02:46:27Z`
- `27733548842`: successful candidate-source run, `2026-06-18T02:52:59Z` to `2026-06-18T03:24:51Z`
- `27734923480`: canceled, `2026-06-18T03:33:30Z` to `2026-06-18T04:12:56Z`
- `27736624335`: canceled, `2026-06-18T04:25:03Z` to `2026-06-18T04:59:59Z`
- `27738456785`: short promote failure, `2026-06-18T05:18:29Z` to `2026-06-18T05:18:45Z`
- `27738535648`: canceled, `2026-06-18T05:20:51Z` to `2026-06-18T06:07:13Z`
- `27740249552`: canceled, `2026-06-18T06:06:09Z` to `2026-06-18T06:15:04Z`
- `27740551584`: successful main release run, `2026-06-18T06:13:49Z` to `2026-06-18T06:46:15Z`
- `27741971528`: successful promote run, `2026-06-18T06:48:11Z` to `2026-06-18T07:03:33Z`

The successful main release workflow ran from `2026-06-18T06:13:49Z` to
`2026-06-18T06:46:15Z`, for about `32m26s` workflow wall time. The successful
promote workflow ran from `2026-06-18T06:48:11Z` to `2026-06-18T07:03:33Z`,
for about `15m22s` workflow wall time. Same-day release attempts also included
multiple canceled or failed runs; those runs consumed operator loop time even
when they did not become release authority.

Main release longest jobs:

- Full first-install DMG job: `13m46s`
- Full clean VM smoke job: `10m33s`
- Standard clean VM smoke job: `8m13s`
- Standard macOS build job: `5m08s`
- WebUI GHCR publish job: `3m27s`
- DOM active-shell tests: `3m12s`
- Docker WebUI smoke: `2m54s`
- Publish standard assets: `2m07s`
- Publish Full assets: `1m28s`
- Remote Standard and Full verification: `1m24s`

Main release longest steps:

- Full package build: `4m47s`
- Standard clean VM first-launch smoke: `4m00s`
- Full clean VM first-launch smoke: `3m47s`
- Full package checksum/signing verification: `3m30s`
- Full VM same-run DMG artifact download: `3m29s`
- Standard electron-builder package: `3m13s`
- WebUI GHCR build and publish: `3m11s`
- Docker WebUI build and verify: `2m40s`
- Full VM active shell checkout: `2m37s`
- DOM active-shell tests: `2m36s`
- Standard VM same-run DMG artifact download: `2m02s`
- Standard VM active shell checkout: `1m29s`
- Remote Standard and Full verification: `1m15s`

Promote longest jobs and steps:

- Homebrew standard first-run VM smoke job: `12m42s`
- Promote verify and publish job: `1m52s`
- Homebrew standard VM first-launch smoke step: `6m08s`
- Homebrew standard VM active shell checkout step: `5m35s`
- Promote remote asset verification step: `1m36s`
- Stable Homebrew tap update: `13s`
- Full Homebrew tap update: `9s`

## Wasted Time Classes

- Duplicate/restarted release attempts: five same-day canceled runs and two
  failed runs consumed `2h47m9s` of accumulated GitHub Actions workflow wall time
  before or around the successful cohort.
- Over-broad shell checkout in VM gates: the VM workflow needed only
  `shells/aionui/scripts/opl-first-run-tart-smoke.mjs` and
  `shells/aionui/scripts/opl-first-run-vm-smoke.mjs`, but checked out the full
  active shell repository. The successful promote Homebrew VM run spent `5m35s`
  in that checkout, and the main Full VM run spent `2m37s`.
- Large artifact movement on the VM path: same-run DMG artifact downloads took
  `2m02s` for Standard and `3m29s` for Full in the main release run.
- Repeated container builds: Docker WebUI smoke and GHCR publish each built the
  WebUI image separately, costing about `2m40s` and `3m11s` respectively.
- Required first-run evidence: VM first-launch smokes were still real user-path
  proof and should not be removed to make the release appear faster.

## Optimization Landed

The landed release-efficiency optimizations are:

- `.github/workflows/opl-first-run-vm.yml` uses a shallow sparse checkout for the
  active shell:

  - `fetch-depth: 1`
  - `sparse-checkout: scripts`

- The standard and Full VM gates consume DMG-only same-run artifacts:
  `macos-build-arm64-dmg` and
  `opl-full-first-install-dmg-<version>-mac-arm64`. Publish jobs keep consuming
  the complete standard and Full artifacts.
- The Stable WebUI release path builds the Docker image once in
  `docker-webui-smoke`, verifies it, pushes the same image to GHCR, writes the
  publish summary, and leaves `webui-ghcr-publish` as a separate summary-verifier
  gate for independent GHCR failure reporting.
- `npm run release:actions-timing` now summarizes one or more
  `gh run view --json ...jobs` payloads, including multi-run span,
  failed/canceled run tax, slow jobs, slow steps, and operator-loop gap.

The release-boundary validator records these workflow invariants. Expected
benefit is lower VM gate setup/download time, removal of the second Stable
WebUI Docker build, and faster post-release timing diagnosis. Actual savings
must be measured on the next GitHub Actions run.

## Remaining Optimization Queue

- Keep using `release-closeout` and the small `release-monitor.json` readback
  instead of manual `gh run watch` loops. Once a candidate record or named gate
  reports a stop condition, stop watching scattered logs and route directly to
  that gate.
- Add a phase ledger at the operator-loop level when a release starts, so the
  `51m15s` non-Actions gap class is automatically split into repo sync, issue
  handling, owner route, local validation, release readback, and tool/model
  orchestration instead of reconstructed after the fact.
