# App release-speed doc assertion retirement closeout

Owner: `one-person-lab-app`
Purpose: `app_release_speed_doc_assertion_retirement_closeout`
State: `history_provenance`
Machine boundary: Human-readable process closeout. Current release workflow, release-speed, concurrency, and legacy workflow retirement truth stays in App release workflows, `contracts/app-release-channel.json`, `scripts/validate-release-boundary.ts`, `tests/release/app-release-boundary-cases/ownership-and-installation-contracts.ts`, and focused release-speed tests over workflow shape.

## Scope

This lane retired a test-side coupling from `tests/release/release-speed-vm-plan.test.ts` to specific prose in `docs/release/README.md`.

The old assertion required the human release guide to contain the exact retired wording for the legacy tag-push **Build and Release** workflow. That wording is already governed by the physical workflow absence guard and release-boundary validator. Keeping the release-speed test bound to a human sentence made the release guide a second machine truth source.

## Retired Surface

Removed from `release-speed-vm-plan.test.ts`:

- the direct `docs/release/README.md` read in the release operations workflow serialization test;
- prose assertions for stable/draft cancellation wording;
- the exact `tag-push **Build and Release** workflow has been retired` wording assertion.

The release-speed test now verifies only the workflow surfaces it owns:

- `full-runtime-cache-warmup.yml` is refreshable and cancels in-progress warmup runs;
- `desktop-release-promote.yml` is refreshable and version-scoped;
- `release-verify-remote.yml` is refreshable and version-scoped.

## Single Source Of Truth

- Legacy **Build and Release** no-resurrection truth is owned by `scripts/validate-release-boundary.ts` and `tests/release/app-release-boundary-cases/ownership-and-installation-contracts.ts`.
- Stable release flow truth is owned by `.github/workflows/desktop-release.yml`, `.github/workflows/desktop-release-promote.yml`, release scripts, candidate records, release artifacts, and `contracts/app-release-channel.json`.
- Release-speed workflow concurrency truth is owned by the workflow files and focused release-speed tests.
- `docs/release/README.md` remains an operator guide and may mirror durable release policy, but it is not the machine assertion surface for retired workflow absence or concurrency semantics.

## Verification

Commands run from the isolated worktree:

```bash
rtk node --experimental-strip-types --test tests/release/release-speed-vm-plan.test.ts
rtk npm run test:release-boundary -- --runInBand
rtk npm run validate:release-boundary
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" tests docs/history/process
```

Observed result:

- `node --experimental-strip-types --test tests/release/release-speed-vm-plan.test.ts`: 9/9 pass.
- `npm run test:release-boundary -- --runInBand`: 124/124 pass, including `legacy tag-push Build and Release workflow is retired`.
- `npm run validate:release-boundary`: pass.
- `opl-doc-doctor doctor . --format json`: pass, `finding_count=0`.
- `git diff --check`: pass.
- Conflict-marker scan for `tests` and `docs/history/process`: no matches.

## Remaining Scope

This lane does not change release workflows, release contracts, release docs wording, VM smoke behavior, candidate promotion, Homebrew release gates, or Full package behavior. It only removes the stale test-to-prose coupling from the release-speed test.
