# 2026-06-20 Stable Release Profile

Owner: `one-person-lab-app`
Purpose: `stable_release_profile`
State: `historical_release_provenance`
Machine boundary: Human-readable release profiling, Codex operator-loop retrospective, and optimization provenance for the `v26.6.20` cohort. Current machine truth remains in GitHub Actions runs, release artifacts, Homebrew tap outputs, contracts, scripts, validators, owner records, and fresh CI output.

## Release

- Version: `26.6.20`
- Tag: `v26.6.20`
- Release URL: `https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/v26.6.20`
- Published at: `2026-06-20T09:54:13Z`
- App commit: `a8761f5431587338dc58f447bacf2ffab067b13f`
- Shell ref: `a6d2103d63402148dfa2d398b78fcb7e1bb65480`
- Framework ref: `b924d799f44b724c433ec57197643adf4c518f53`
- Initial release run: `27865855747`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27865855747`
- Owner-receipt refresh run: `27866803313`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27866803313`
- Promote run: `27867580320`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27867580320`
- Standalone post-publish Homebrew VM proof run: `27868475783`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27868475783`
- Release owner receipt: `docs/release/records/v26.6.20-release-owner-receipt.json`

## Outcome

`v26.6.20` was published as the GitHub latest Stable release. Fresh release
readback reported `isDraft=false`, `isPrerelease=false`,
`publishedAt=2026-06-20T09:54:13Z`, and `gh release list --limit 8` reported
`One Person Lab v26.6.20 Latest v26.6.20`.

The first desktop release run produced passing release evidence but stopped at
the release-owner gate. The candidate record was blocked because the cohort did
not yet include a same-cohort `release_owner_verdict_ref` or
`release_owner_receipt_ref`. The second desktop release run included
`release_owner_receipt_ref://one-person-lab-app/release-owner/v26.6.20/receipt-20260620-owner-verdict`
and produced `status=ready_to_promote`, `decision.can_promote=true`, and
`promote_ready=true`.

The promote workflow verified the candidate record, verified remote release
assets, published the draft release, and updated both Stable Homebrew casks. The
workflow then failed in the post-publish Homebrew Standard clean-VM smoke. This
failure does not undo the GitHub release publication or Homebrew tap update, but
it means the Homebrew post-publish clean-install proof was not complete in the
promote workflow.

A standalone `OPL GUI First-Run VM` run was started for the same published tag
and shell ref to obtain a fresh Homebrew Standard proof without republishing. It
also failed, but at a different boundary: the cask download exited with
`curl: (18) Transferred a partial file` during `homebrew_cask_install`, before
the App was installed or launched.

## Assets

Refresh-run remote verification reported `status=passed` and
`verified_asset_count=14`.

- Standard DMG: `One-Person-Lab-26.6.20-mac-arm64.dmg`, `440481385` bytes, sha256 `7197b1405d1ac808b2e15d8afb9b6cda12e853a385908730f65528fe2bb8d770`
- Standard ZIP: `One-Person-Lab-26.6.20-mac-arm64.zip`, `448918171` bytes, sha256 `29808fa8786ebb36a8f9777ffaceb576a09618d552661bdbab1fba0c1e998b52`
- Standard updater metadata: `latest-mac.yml` and `latest-arm64-mac.yml`, `538` bytes each, sha256 `45663677714074402856686643624bdd6b904cfff0904a25e29d1a4a0d128712`
- Full DMG: `One-Person-Lab-Full-26.6.20-mac-arm64.dmg`, `1118407432` bytes, sha256 `f38eecb1111c59b18a63d6330dbeb864422ccff8bd36984f1a9261c1d6d46ac2`
- Full manifest: `full-package-manifest.json`, `25550` bytes, sha256 `3a6e75a2e5a717038110dac2e327d76d1aeaaee783c1d9e047d0ead890f48c56`
- Runtime cache events: `runtime-cache-events.json`, `16299` bytes, sha256 `aae167fa817c23edb76d557aaf24ee9c595d7ecb66fa4c78f1b15ac2ece7f429`
- `SHA256SUMS.txt`: `589` bytes, sha256 `e72a73633c9a7ae9396512d09b6b431d1e9c62bc235256d60a591b85f8a21a53`

The Full budget gate passed with `runtime_uncompressed_bytes=732463549`, while
`full_dmg_size_status=warning` because the Full DMG exceeded the review
threshold.

## Homebrew

Post-promote remote tap readback showed:

- `Casks/one-person-lab.rb`: version `26.6.20`, sha256 `7197b1405d1ac808b2e15d8afb9b6cda12e853a385908730f65528fe2bb8d770`
- `Casks/one-person-lab-full.rb`: version `26.6.20`, sha256 `f38eecb1111c59b18a63d6330dbeb864422ccff8bd36984f1a9261c1d6d46ac2`

The promote Homebrew VM job failed after the cask install succeeded. Its
`tart-smoke-summary.json` reported `failure_stage=run_guest_smoke`,
`homebrew_cask_install=184191ms`, and `run_guest_smoke=947553ms`. The saved
guest logs showed the packaged App and bundled `aioncore` started quickly, the
managed Node runtime and ACP tools materialized, and GUI accessibility saw the
main App window. The readiness probe timed out waiting for
`opl system initialize --json`; the artifact saved only `status=1` and the
command, not the underlying CLI stdout/stderr.

The standalone follow-up run `27868475783` failed earlier than the promote VM
run. Its `tart-smoke-summary.json` reported
`failure_stage=homebrew_cask_install`, `homebrew_cask_install=210090ms`, and
`copied_guest_artifacts=false`. The direct error was a Homebrew download failure
for the published Standard DMG:
`curl: (18) Transferred a partial file`. That is a transport/download failure,
not evidence that the App bundle or runtime readiness regressed.

Root-cause classification for the post-publish Homebrew evidence:

- Product artifact: not proven broken by current evidence; App process and
  bundled backend startup logs were healthy.
- Homebrew transport: cask install succeeded and tap pointed at the expected
  release asset in the promote run; standalone proof later hit a partial DMG
  download before installation.
- Gate/evaluator: incomplete diagnostic capture. The smoke artifact did not
  preserve enough `opl system initialize` stdout/stderr to classify whether the
  failure was App/runtime initialization, VM base state, CLI path drift, or a
  transient runtime dependency issue.
- Follow-up proof: standalone run `27868475783` did not validate the App either,
  because it failed in Homebrew transport before launch. A future proof should
  rerun the Homebrew Standard VM gate after shell diagnostics preserve failed
  `opl` command output.

## Timing Profile

Initial release run `27865855747` ran from `2026-06-20T08:38:02Z` to
`2026-06-20T09:13:25Z`, for about `35m23s` remote wall time. The closeout
artifact computed `34m47s` workflow wall time from the in-run timestamps and
identified the slowest jobs:

- Full first-install DMG: `20m08s`
- Full clean VM smoke: `8m23s`
- Standard clean VM smoke: `8m17s`
- Standard macOS build: `5m14s`
- Docker WebUI smoke/GHCR staging: `3m37s`
- Active shell DOM tests: `3m23s`

Owner-receipt refresh run `27866803313` ran from `2026-06-20T09:19:26Z` to
`2026-06-20T09:51:11Z`, for about `31m45s` remote wall time. The closeout
artifact computed `31m22s` workflow wall time. Slowest jobs:

- Full first-install DMG: `15m56s`
- Full clean VM smoke: `9m50s`
- Standard clean VM smoke: `6m27s`
- Standard macOS build: `5m22s`
- Docker WebUI smoke/GHCR staging: `3m41s`
- Active shell DOM tests: `3m27s`

Promote run `27867580320` ran from `2026-06-20T09:52:53Z` to
`2026-06-20T10:18:32Z`, for about `25m39s` remote wall time. Publish and tap
steps succeeded quickly, but the Homebrew VM job consumed most of the time
before failing:

- Verify and publish draft release: `1m19s`
- Stable Homebrew tap update: `8s`
- Full Homebrew tap update: `10s`
- Homebrew Standard VM job: about `23m58s`
- Homebrew Standard VM clean launch step: `15m47s`

Standalone Homebrew VM proof run `27868475783` ran from
`2026-06-20T10:31:43Z` to `2026-06-20T10:42:13Z`, for about `10m30s` remote
wall time. Most time went to `Prefetch Codex package install assets` (`5m07s`)
and the failing clean VM launch step (`3m54s`). The underlying smoke summary
shows the run spent `210090ms` in `homebrew_cask_install` before the partial
download failure.

The avoidable same-day full rerun tax was the initial `34m47s` workflow wall
time: the release evidence was valid, but the candidate could not promote until
the same-cohort owner receipt ref was supplied.

## Codex Operator Loop Retrospective

Observed local phase ledger entries show the operator loop started with git
fetch, release URL audit, local preflight, GitHub secret-name preflight, pinned
preflight, workflow dispatch, artifact download/readback, candidate validation,
promote dispatch, release readback, promote final readback, failure artifact
download, and standalone post-publish VM dispatch.

The largest operator-loop waste classes were:

- Owner receipt not supplied up front: this forced a complete second desktop
  release workflow even though first-run, Full, WebUI, and remote verification
  evidence had already passed.
- Profiling artifact generated while the workflow was still `in_progress`:
  `release:actions-timing` treated the unfinished run as failed/cancelled tax.
  This is now fixed by classifying `in_progress` separately from real failure
  conclusions.
- Post-publish Homebrew VM failure artifact lacked the stderr/stdout needed to
  classify the failing `opl system initialize --json` command. The correct
  shell-side fix is to preserve structured command output in
  `system-initialize.json.error.txt` and `modules.json.error.txt`.
- `gh release view --json isLatest` is not supported by the installed `gh`; the
  release closeout should use `gh release list` for Latest readback or avoid the
  unsupported field.
- `release:preflight -- --help`, `release:closeout -- --help`, and
  `release:actions-timing -- --help` previously failed as unknown arguments.
  The scripts now have explicit help output.

## Optimization Landed

- `scripts/summarize-github-actions-timing.ts` now counts only real failure
  conclusions as failed/cancelled run tax. `in_progress` and blank conclusions
  remain visible in `conclusion_counts` but no longer inflate failed-run time.
- `release:preflight`, `release:closeout`, and `release:actions-timing` now
  support `--help`.
- `tests/release/github-actions-timing-summary.test.ts` covers the
  `in_progress` timing case.
- This profile and `docs/release/records/v26.6.20-release-owner-receipt.json`
  preserve the owner gate, release evidence, promote failure, and follow-up VM
  proof route.
- Fresh standalone Homebrew VM evidence is recorded as a transport failure, so
  the App release record does not conflate a partial DMG download with App
  runtime readiness.

## Optimization Queue

- For user-authorized Stable releases, include the same-cohort
  `release_owner_receipt_ref` in the first desktop release dispatch when policy
  allows it. That avoids a full refresh run whose only purpose is owner
  resolution.
- Add shell smoke diagnostics so failed `runOplJson` probes write stdout,
  stderr, exit status, signal, timeout, and command into the failure artifacts.
  This belongs in the AionUI shell checkout after branch hygiene; the current
  shell checkout is on `codex/stable-macos-install-script` and diverges from
  `origin/main`, so this App closeout does not mix that shell patch into App
  `main`.
- Add a promote closeout artifact or post-publish summary that separates
  publication/tap success from post-publish Homebrew VM proof. A failed final
  promote workflow currently hides the fact that publication and tap updates
  already succeeded.
- Keep `release:actions-timing` in the final release closeout, but prefer a
  post-run rebuild for final profile numbers when the in-workflow artifact was
  necessarily generated before the workflow conclusion was available.
- Investigate Full package build time in this order: `shell_build` (`154.644s`
  on refresh), `dmg_package_compression` (`136.192s`), then runtime cache
  misses (`domain-runtime`, `skills`).
- Investigate Full package size from the largest contributors: `toolchain`
  (`539530033` bytes), `toolchain/vendor`, Node, Temporal vendor archive,
  Python, and Codex vendor payload.

## Evidence

- Release owner candidate validator: `promote_ready=true`, no errors.
- Refresh artifact sha256:
  - `release-candidate-record.json`: `fbb2ccbf9bb943f0f80a889eeedfe222b80b4d6eb3fa26b70d851b2f44189498`
  - `release-readiness-summary.json`: `3b1ae95b8cd18ff3542c6595241891c6d24f124ea21d8aa27b7c88aeae99b0e7`
  - `release-preflight-summary.json`: `40e5ba3459799922da951a6354722f9f76842b45010aeb5a5986f17467de334e`
  - `remote-release-verification.json`: `b017d01cafc00087b700a3d2d1a522aae5b039e8618740bc06af34babfc6ca34`
- Fresh release readback: `isDraft=false`, `isPrerelease=false`,
  `publishedAt=2026-06-20T09:54:13Z`, 14 assets.
- Fresh release list readback: `One Person Lab v26.6.20 Latest v26.6.20`.
- Fresh tap readback: Standard and Full casks both at `26.6.20`.
- Promote failure artifact:
  `/tmp/opl-app-promote-26.6.20-artifacts/homebrew-vm/tart-smoke-summary.json`.
- Standalone Homebrew proof artifact:
  `/tmp/opl-app-homebrew-standalone-27868475783/tart-smoke-summary.json`.

## Authority Boundary

This profile records App release evidence and App-owned distribution state only.
It does not write domain truth, claim OPL family production readiness, sign
MAS/MAG/RCA/domain owner receipts, or claim quality/export readiness outside the
App release cohort. The published/latest readback proves GitHub Release state;
it does not by itself prove Homebrew clean first-run readiness.
