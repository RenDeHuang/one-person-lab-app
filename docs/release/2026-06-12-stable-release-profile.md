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

## Outcome

The main release run completed successfully and produced a ready candidate record:
`status=ready_to_promote`, `decision.can_promote=true`,
`source_status.preflight=passed`, `source_status.readiness=passed`, and
`source_status.remote_verification=passed`.

The promote workflow published `v26.6.12` and updated both stable Homebrew tap
targets. The post-promote Homebrew standard first-run VM gate then failed at
`failure_stage=homebrew_cask_install` before App first launch. The VM failure was
not an App runtime, first-run, or packaged GUI failure.

## Assets

- Standard DMG: `One-Person-Lab-26.6.12-mac-arm64.dmg`, `440940649` bytes, sha256 `389d0950b534e97a631eab08239d2162aadb1d2faa37fdb0cddbfcae32672466`
- Standard ZIP: `One-Person-Lab-26.6.12-mac-arm64.zip`, `449364337` bytes, sha256 `16050f8a10539407cf900dee35912fa3ffea97741048c1a7908a3482a53dbf52`
- Full DMG: `One-Person-Lab-Full-26.6.12-mac-arm64.dmg`, `1045190008` bytes, sha256 `720cf21b650fcf8e5879fe44fe2b77684283fe99e84ac9acbc8075ced5ff7b10`

The Full DMG exceeded the release review threshold and was recorded as a
warning, not a publication blocker. It remains the largest current packaging
optimization target.

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

## Optimization Notes

- Full DMG build is the dominant build-stage cost at about `21m`, and the Full
  DMG is `1045190008` bytes. Continue profiling payload layer composition,
  cache hits, and DMG compression before adding new Full payloads.
- Clean VM gates are expensive but high-signal. Keep them release-blocking for
  stable, and improve early preflight checks so environment-policy failures
  surface before the VM spends time cloning and booting.
- Standard quality gates are already split and are not the current bottleneck.
  Further gains should target active shell DOM test cost only if it preserves
  release-boundary signal.
- Release monitoring should prefer Actions job metadata and small structured
  artifacts over long `gh run watch` output. The timings above came from job
  boundaries and artifact summaries.
- Homebrew trust behavior is now part of the release contract and VM gate input:
  the standard cask install ref is
  `gaofeng21cn/one-person-lab/one-person-lab`.
