# 2026-06-16 Stable Release Profile

Owner: `one-person-lab-app`
Purpose: `stable_release_profile`
State: `historical_release_provenance`
Machine boundary: Human-readable release profiling and optimization provenance for the `v26.6.16` cohort. Current machine truth remains in GitHub Actions runs, release artifacts, Homebrew tap plans, contracts, scripts, owner records, and validation output.

## Release

- Version: `26.6.16`
- Tag: `v26.6.16`
- Release URL: `https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/v26.6.16`
- Published at: `2026-06-16T11:58:50Z`
- App commit: `c564597fd5b95f6e63faa24d092cf8dce49fa420`
- Initial release run: `27605943004`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27605943004`
- Failed owner-receipt refresh run: `27609356225`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27609356225`
- Successful owner-receipt refresh run: `27613954912`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27613954912`
- Promote run: `27615808579`, `https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/27615808579`
- Release owner receipt: `docs/release/records/v26.6.16-release-owner-receipt.json`

## Outcome

The initial release run completed successfully and produced release/install
evidence for Standard, Full, WebUI, remote verification, and operator evidence,
but the candidate record remained blocked for promotion because it carried no
same-cohort `release_owner_verdict_ref` or `release_owner_receipt_ref`.

The first owner-receipt refresh run failed in the Standard clean-VM gate:
`Run clean standard first-run VM smoke / Clean VM first launch`. Its
`tart-smoke-summary.json` reported `status=failed`,
`failure_stage=run_guest_smoke`, and `blocking_items=["codex","codex_config"]`
after `opl system initialize --json` did not reach first-launch readiness. The
guest first-run log recorded only `Failed to run codex install command for OPL.`,
so the artifact set was sufficient to localize the failure to Standard first-run
Codex installation, but not sufficient to prove whether the trigger was registry
availability, VM network, npm tooling, or an installer implementation defect.

The second owner-receipt refresh run completed successfully and produced a ready
candidate record: `status=ready_to_promote`, `decision.can_promote=true`,
`source_status.preflight=passed`, `source_status.readiness=passed`, and
`source_status.remote_verification=passed`. The candidate record embedded
`release_owner_receipt_ref://one-person-lab-app/release-owner/v26.6.16/receipt-20260616-owner-verdict`
and passed the repo validator with `promote_ready=true`.

The promote workflow published `v26.6.16`, verified remote release assets,
updated both stable Homebrew tap casks, and passed the Homebrew Standard clean-VM
first-run smoke. The stable release is App-owned evidence only; it does not
claim OPL family production readiness or MAS/MAG/RCA/domain readiness.

## Workspace Sync

Before release completion, the canonical local OPL repos were fetched and
confirmed at `origin/main`, with CodeGraph indexes up to date:

- `one-person-lab`: `debaa4480e37d01be6fae058354505cd4962c3cb`
- `one-person-lab-app`: `c564597fd5b95f6e63faa24d092cf8dce49fa420`
- `opl-hermes-shell`: `39d2ac18b50224c9f2bb97cc284cef07325cbdee`
- `homebrew-one-person-lab`: `8e584ebabe247ae822b89e69a8fc57e93a2e1d24` before promote, `cfca5f62bf78fd6018714571fb70bde359d41b72` after Homebrew tap update
- `opl-meta-agent`: `989a4d55cfa549d9a4ae586a54f4b5d077b82db8`
- `opl-aion-shell`: `7d7963a47bd7e5719601f8428164fd2aa9ba4b8d`
- `opl-doc`: `329246a354708cceb52b742e22a56cd86fe63673`
- `opl-flow`: `764d1ab3f3610f98834dff4485203c798d62ec75`

The legacy `/Users/gaofeng/workspace/opl-doc-governance` directory was not
present.

## Assets

Post-promote `npm run verify-remote-release -- --version 26.6.16
--include-full-package` verified 14 remote assets.

- Standard DMG: `One-Person-Lab-26.6.16-mac-arm64.dmg`, `440407862` bytes, sha256 `c8d753b2acf008e752f28fc67a070010ad986e64badad9ba8d7b3684ea147cb3`
- Standard ZIP: `One-Person-Lab-26.6.16-mac-arm64.zip`, `448897483` bytes, sha256 `2e0ec031fc24bbe21f2bac6b27dbfd89faec1c9806912b78c7f02bcc24e06264`
- Standard DMG blockmap: `459103` bytes, sha256 `e1bf0f49073d64a6625e03e62e48d7bea6aca0640dec53ea60a2e50426259584`
- Standard ZIP blockmap: `465719` bytes, sha256 `204f916cf943f2dc6be1051294501cfc5afb66d9190a6a88dcad404983034a32`
- Standard updater metadata: `latest-mac.yml` and `latest-arm64-mac.yml`, `538` bytes each, sha256 `becb426bb91ba8f9ed02e4d68e6ed0870955f19b5e83aa7fcc74fa31a1cf34e7`
- Full DMG: `One-Person-Lab-Full-26.6.16-mac-arm64.dmg`, `1108165270` bytes, sha256 `dbdde28198d1efbe0f8008ebc192a2f61943cf7fc0b23d65640fd515f14dcf4e`
- Full manifest: `full-package-manifest.json`, `24462` bytes, sha256 `0aa1ee4f40e96fed83cc217c343c93b878dace3afd41fc8e982b860556964698`
- Runtime cache events: `runtime-cache-events.json`, `15902` bytes, sha256 `952570b9c9d2f5a5e614529d9b0c7e2a1c1a6ade28633ce6cd5231c5ae405e2c`
- Full local authorization policy: `full-local-authorization-policy.json`, `910` bytes, sha256 `7618c14403100f6c0e807accc1236c2e41e342eb33a3f7ac303aafc3349e1d1a`
- `SHA256SUMS.txt`: `589` bytes, sha256 `a49008fa2eabeef23a7b83dc6796491dcced248b2f4039fe66e2240462b8c5f3`

The Full DMG exceeded the release review threshold and was recorded as a warning,
not a publication blocker. Post-promote verification recorded
`full_first_install_budget.status=passed`, `full_dmg_size_status=warning`,
`full_dmg_size_bytes=1108165270`, and
`runtime_uncompressed_bytes=728207810`.

## Homebrew

Promote run `27615808579` committed both stable Homebrew casks directly to
`gaofeng21cn/homebrew-one-person-lab`:

- `2325beb` `Update OPL Homebrew tap for 26.6.16 app_standard`
- `cfca5f6` `Update OPL Homebrew tap for 26.6.16 app_full_first_install`

The local tap checkout was fast-forwarded to
`cfca5f62bf78fd6018714571fb70bde359d41b72`, matching `origin/main`.

- `Casks/one-person-lab.rb`: version `26.6.16`, sha256 `c8d753b2acf008e752f28fc67a070010ad986e64badad9ba8d7b3684ea147cb3`
- `Casks/one-person-lab-full.rb`: version `26.6.16`, sha256 `dbdde28198d1efbe0f8008ebc192a2f61943cf7fc0b23d65640fd515f14dcf4e`

The promote Homebrew Standard clean-VM smoke passed with
`codex_config_wizard_seen=true`, `codex_config_wizard_submitted=true`, and
`codex_api_key_present=true`.

## Timing Profile

Refresh run `27613954912` ran from `2026-06-16T11:22:09Z` to
`2026-06-16T11:54:28Z`, for `32m19s` workflow wall time.

- Release preflight: `12s`
- Standard quality gates: lint `48s`, typecheck `58s`, release boundary `45s`, Node tests `1m21s`, DOM tests `3m17s`, workflow lint `24s`
- Standard macOS build: `7m41s`
- Publish standard assets: `1m27s`
- One-shot installer smoke: `2m03s`
- Docker WebUI smoke: `2m43s`
- Standard clean VM smoke: `6m22s`
- WebUI GHCR publish: `3m45s`
- Full first-install DMG job: `20m38s`
- Publish Full assets: `2m11s`
- Remote Standard and Full verification: `1m17s`
- Full clean VM smoke: `6m13s`
- Operator evidence bundle: `37s`
- Readiness summary and candidate record: `30s`

Promote run `27615808579` ran from `2026-06-16T11:57:46Z` to
`2026-06-16T12:04:43Z`, for `6m57s` workflow wall time.

- Verify and publish draft release: `1m01s`
- Stable Homebrew tap update: `9s`
- Full Homebrew tap update: `13s`
- Homebrew Standard clean VM smoke: `5m04s`

The operator path after the successful refresh started at
`2026-06-16T11:22:09Z` and ended at `2026-06-16T12:04:43Z`, for `42m34s`
remote workflow wall time excluding local artifact download, readback, and
documentation.

## Profiling Notes

- The failed refresh run `27609356225` spent about `31m01s` before failing the
  Standard clean-VM gate. The successful refresh run completed the same gate in
  `6m22s`; this points to an intermittent or environment-sensitive Standard
  first-run Codex-install path, not a deterministic package-wide regression.
- The saved failed VM artifact did not include the underlying `stdout`/`stderr`
  from the Codex install command inside `runOplEngineAction`. Future diagnosis
  would be faster if the first-run log preserved the structured
  `FrameworkContractError.details.command_preview`, `stdout`, and `stderr` for
  installer action failures.
- Full DMG size remains the largest package-pressure signal. The release passed
  because runtime uncompressed bytes were within budget, but the Full DMG stayed
  above the review threshold.
- Draft refresh runs correctly skipped Homebrew tap and Homebrew VM artifacts.
  Homebrew distribution evidence belongs to the promote workflow after the
  draft is published.

## Evidence

- Candidate record sha256:
  `61166d2b56ab12db03aa127cf1d61a05a2f99dd20e59d828934b694e0f108882`
- Refresh readiness summary sha256:
  `b7b70e61920579b1b190aec2a6f43c885c69f0a1a05f6549824863d5a17aff5e`
- Remote verification sha256:
  `7ec348e228297fb4db12b7d01609fd09c7f1fb57cac306ce501e1d0ef29df818`
- Candidate validator:
  `status=ready_to_promote`, `promote_ready=true`,
  `release_owner_verdict_status=release_owner_receipt_recorded`, no errors
- Fresh release readback:
  `isDraft=false`, `isPrerelease=false`, `publishedAt=2026-06-16T11:58:50Z`,
  14 assets
- Fresh post-promote remote verification:
  `status=passed`, `verified_asset_count=14`, no failed assets
- Standard, Full, and Homebrew clean-VM smoke summaries:
  `status=passed`, `codex_config_wizard_seen=true`,
  `codex_config_wizard_submitted=true`, `codex_api_key_present=true`

## Authority Boundary

This profile records App release evidence and App-owned distribution state only.
It does not write domain truth, claim OPL family production readiness, sign
MAS/MAG/RCA/domain owner receipts, or claim quality/export readiness outside the
App release cohort.
