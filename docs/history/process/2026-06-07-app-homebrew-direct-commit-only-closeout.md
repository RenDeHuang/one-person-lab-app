# App Homebrew direct-commit-only closeout

Owner: `one-person-lab-app`
Purpose: `app_homebrew_direct_commit_only_closeout`
State: `history_closeout`
Machine boundary: Human-readable process closeout. Current Homebrew release truth stays in `contracts/app-release-channel.json`, `.github/workflows/desktop-release.yml`, `.github/workflows/homebrew-tap-update.yml`, `.github/workflows/nightly-standard-release.yml`, `scripts/update-homebrew-tap.ts`, validation scripts, release-boundary tests, readiness summaries, Homebrew tap output, release artifacts, and clean-VM smoke evidence.

## Scope

This lane retired the App repo Homebrew tap pull-request compatibility surface:

```text
write_mode input
pull_request mode
peter-evans/create-pull-request
Nightly App release tap PR job
App release workflow pull-requests permission
```

The current target is direct stable tap updates only from App release workflows. Nightly tap freshness stays owned by the tap repo self-sync path and standard prerelease assets, while Full cask updates remain stable-only after Full release gates pass.

## Change

- `contracts/app-release-channel.json` now names `app_release_direct_workflow`, `app_release_direct_token`, `app_release_pull_request_allowed: false`, and `app_release_workflow_write_mode: direct_commit_only`.
- `.github/workflows/homebrew-tap-update.yml` now writes only direct commits, requires `OPL_HOMEBREW_TAP_TOKEN`, and no longer exposes `write_mode` or PR creation.
- `.github/workflows/desktop-release.yml` now calls the reusable tap workflow without `write_mode` and without `pull-requests: read`.
- `.github/workflows/nightly-standard-release.yml` no longer calls the App tap workflow or requests pull-request permissions.
- Release docs, decisions, active-shell contract validation, release-boundary validation, release-boundary tests, and release-speed tests now point at the direct-commit-only surface.

## Verification

Required verification for this lane:

```bash
rtk npm run validate:release-boundary
rtk node --experimental-strip-types --test tests/release/app-release-boundary-cases/workflow-release-channels.ts tests/release/release-speed-vm-plan.test.ts
rtk node --experimental-strip-types --input-type=module -e "import fs from 'node:fs'; const { validateReleaseChannelContract } = await import('./scripts/validate-active-shell/release-contract-validator.ts'); validateReleaseChannelContract(JSON.parse(fs.readFileSync('contracts/app-release-channel.json', 'utf8')));"
rtk git diff --check
rtk rg -n -I -e '^(<<<<<<< |=======|>>>>>>> |\|\|\|\|\|\|\| )' .github contracts docs scripts tests
```

Observed result:

- `rtk npm run validate:release-boundary`: pass.
- Release channel contract validator smoke: pass.
- `rtk env OPL_APP_SHELL_ROOT=/Users/gaofeng/workspace/one-person-lab-app/.worktrees/release-boundary-doc-prose-guards/shells/aionui node --experimental-strip-types --test tests/release/app-release-boundary-cases/workflow-release-channels.ts tests/release/release-speed-vm-plan.test.ts`: 16/16 pass.
- `rtk env OPL_APP_SHELL_ROOT=/Users/gaofeng/workspace/one-person-lab-app/.worktrees/release-boundary-doc-prose-guards/shells/aionui npm run test:release-boundary -- --runInBand`: 115/115 pass.
- `rtk git diff --check`: pass.
- Conflict-marker scan for `.github contracts docs scripts tests`: no matches.
- `rtk opl-doc-doctor doctor . --format json`: `finding_count=0`.

## Remaining Boundary

This closeout does not claim a new release cohort or live tap update. Direct tap commits still require release-owner credentials, remote asset verification, Homebrew tap plan artifacts, and downstream Homebrew clean-VM evidence before release readiness claims.
