# 2026-06-06 App first-run scenario alias retirement closeout

Owner: `one-person-lab-app`
Purpose: `app_first_run_scenario_alias_retirement_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current first-run and release-gate truth stays in `contracts/app-first-run-test-matrix.json`, `contracts/app-release-channel.json`, release workflows, validation scripts, release artifacts, and release-boundary tests.

## Snapshot

- `RUN_SNAPSHOT_TS`: `2026-06-06T14:10:00Z`
- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: `first-run scenario policy versus release VM gate identifiers`
- Governance mode: physical contract metadata retirement with fail-closed validation.

## Single Source Of Truth

- `full_first_install_clean_machine` remains the Full first-install policy scenario: it owns clean-machine missing host tools, bundled-runtime Core readiness, `ready_to_launch` before `/guid`, and deferred Full maintenance.
- `full_dmg_clean_vm_smoke` remains the release VM gate scenario: it owns the Full DMG clean-VM smoke evidence artifact list and Full runtime profile.
- `contracts/app-release-channel.json`, release workflows, release scripts, and release evidence manifests continue to reference the release gate by the canonical `full_dmg_clean_vm_smoke` id.

## Retired Surface

`contracts/app-first-run-test-matrix.json#scenarios[full_dmg_clean_vm_smoke].aliases` previously mapped the release VM gate back to `full_first_install_clean_machine`. That alias was redundant after the release plan, release-channel contract, preflight, readiness summary, and tests had converged on distinct canonical ids for policy and release-gate surfaces.

The alias metadata has been removed. `scripts/validate-active-shell/first-run-matrix-validator.ts` and the focused release-boundary test now fail closed if any first-run scenario reintroduces `aliases`.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk npm run test:release-boundary -- --runInBand
rtk node --experimental-strip-types scripts/validate-active-shell.ts --quick
rtk rg -n '"aliases"|"full_dmg_clean_vm_smoke"[\s\S]{0,120}"aliases"' contracts/app-first-run-test-matrix.json scripts tests
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" contracts scripts tests docs/history/process
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
```

Result:

- `npm run test:release-boundary -- --runInBand`: 124/124 pass.
- `node --experimental-strip-types scripts/validate-active-shell.ts --quick`: pass.
- Active alias scan found no remaining `"aliases"` entries in `contracts/app-first-run-test-matrix.json`, scripts, or tests.
- `git diff --check`: pass.
- Conflict-marker scan for `contracts`, `scripts`, `tests`, and `docs/history/process`: no matches.
- `opl-doc-doctor doctor . --format json`: pass, `finding_count=0`.

## Remaining Scope

This lane does not create Full VM evidence, publish a release, alter release workflows, or close the `full_first_install_vm_evidence` gap. Future cohorts still need real standard/Homebrew/Full VM artifacts, evidence manifests, remote verification, promotion records, and typed blockers where applicable.
