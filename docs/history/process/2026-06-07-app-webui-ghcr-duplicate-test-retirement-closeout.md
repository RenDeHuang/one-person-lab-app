# 2026-06-07 App WebUI GHCR duplicate test retirement closeout

Owner: `one-person-lab-app`
Purpose: `app_webui_ghcr_duplicate_release_boundary_test_retirement_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current WebUI GHCR release truth stays in `contracts/app-release-channel.json`, release workflows, validation scripts, release-boundary tests, release artifacts, and GHCR package settings.

## Snapshot

- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Worktree: `.worktrees/app-webui-ghcr-duplicate-test-retirement`
- Branch: `codex/app-webui-ghcr-duplicate-test-retirement`
- Semantic theme: `WebUI GHCR release-boundary duplicate test guard retirement`

## Single Source Of Truth

- `contracts/app-release-channel.json#webui_ghcr_image` owns App-side WebUI GHCR image coordinates, publish workflows, stable/nightly tags, GHCR package access, retention, and Framework references-only role.
- `.github/workflows/desktop-release.yml` and `.github/workflows/nightly-standard-release.yml` own the executable WebUI publish jobs and tag behavior.
- `tests/release/app-release-boundary-cases/workflow-release-channels.ts` keeps one release-boundary assertion for `releaseContract.webui_ghcr_image`.

## Retired Surface

The `manual desktop release workflow supports new releases and same-tag refreshes in GitHub Actions` test carried two identical `assert.deepEqual(releaseContract.webui_ghcr_image, ...)` blocks. The second block sat after the `first_run_vm_workflow` assertion and provided no separate release, VM, or GHCR gate. It has been removed.

No contract, workflow, release script, release guide, release artifact, GHCR package setting, or active-shell implementation changed.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app/.worktrees/app-webui-ghcr-duplicate-test-retirement`:

```bash
rtk npm run ensure:shell
rtk node --experimental-strip-types --test tests/release/app-release-boundary.test.ts --test-name-pattern "manual desktop release workflow supports new releases and same-tag refreshes in GitHub Actions" --test-reporter=dot
```

Result:

- `npm run ensure:shell` checked out the active `gaofeng21cn/opl-aion-shell` shell at `shells/aionui`, head `4a1154d4c313`.
- Before the shell checkout existed in the isolated worktree, the release-boundary test entrypoint failed on missing `shells/aionui` files; this was an environment baseline issue, not a test semantic failure.
- After `ensure:shell`, the release-boundary entrypoint passed with `85` tests.

## Remaining Scope

This lane only retires the duplicate WebUI GHCR assertion block. It does not retire `release_acceleration.vm_gate`, because that singular compatibility-looking field remains an active contract field guarded by `scripts/validate-active-shell/release-contract-validator.ts` and release-boundary tests.
