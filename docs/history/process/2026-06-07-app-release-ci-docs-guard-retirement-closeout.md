# App release CI docs guard retirement closeout

Owner: `one-person-lab-app`
Purpose: `app_release_ci_docs_guard_retirement_closeout`
State: `history_closeout`
Machine boundary: Human-readable process closeout. Current release CI operations policy truth stays in package scripts, App release workflows, `.github/actions/**`, `contracts/app-release-channel.json`, `scripts/validate-release-boundary.ts`, and release-boundary tests. `docs/testing/README.md` and `scripts/README.md` remain operator guidance, not release-speed machine truth.

## Scope

This lane retired the duplicate release-speed test block that read:

```text
docs/testing/README.md
scripts/README.md
```

from `tests/release/release-speed-vm-plan.test.ts` to assert exact release CI operations guidance around actionlint, YAML parsing, Node 24 action runtime policy, workflow concurrency, telemetry and composite setup actions.

That policy is still covered by `tests/release/app-release-boundary-cases/workflow-release-channels.ts` through `release CI operations policy distinguishes workflow hygiene from release evidence`, while release-speed tests continue to own workflow shape and release-plan concurrency behavior.

## Change

- Removed the standalone `release CI operations docs separate implemented release gates from follow-up workflow hygiene` block from `tests/release/release-speed-vm-plan.test.ts`.
- Kept the release-boundary case as the single test owner for the operator-visible release CI operations policy boundary.
- Changed no package scripts, workflows, contracts, release docs, release artifacts, updater metadata, shell code, candidate records or release evidence.

## Verification

Required verification for this lane:

```bash
rtk node --experimental-strip-types --test tests/release/release-speed-vm-plan.test.ts
rtk npm run test:release-boundary -- --runInBand
rtk npm run validate:release-boundary
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" tests docs scripts contracts .github
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
```

Observed result:

- `rtk node --experimental-strip-types --test tests/release/release-speed-vm-plan.test.ts`: 8/8 pass.
- `rtk npm run test:release-boundary -- --runInBand`: 122/122 pass after `rtk npm run ensure:shell` prepared `shells/aionui@4a1154d4c313`.
- `rtk npm run validate:release-boundary`: pass.
- `rtk git diff --check`: pass.
- Conflict-marker scan for `tests docs scripts contracts .github`: no matches.
- `rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json`: `finding_count=0`.

## Remaining Boundary

This closeout is only a test ownership cleanup. It does not change release CI behavior, release-boundary policy, App release readiness, workflow semantics, release artifacts or future release evidence production.
