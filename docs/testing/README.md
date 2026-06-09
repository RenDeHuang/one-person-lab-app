# App Testing

Owner: `one-person-lab-app`
Purpose: `app_testing_docs`
State: `active`
Machine boundary: Human-readable testing guide. Test code, contracts, and
artifacts are the executable truth.

## Active Shell Checks

```bash
bun install --cwd shells/aionui --frozen-lockfile
bun run --cwd shells/aionui i18n:types
cd shells/aionui && node scripts/check-i18n.js
bun run test
bun run --cwd shells/aionui lint
bun run --cwd shells/aionui validate:opl-package
npm run validate:gui-shell
```

`bun run test` is the App-level stable runner. It reads
`contracts/app-shell-adapter.json`, enumerates the active shell Vitest suites,
and runs them as isolated sequential `node` / `dom` chunks. The upstream shell
entrypoint remains available as `bun run --cwd shells/aionui test` for direct
AionUI intake work.

`validate:gui-shell` is the App-root gate for active shell health plus GUI
compile evidence. It runs the full active shell validation list from
`contracts/app-shell-adapter.json`, syncs App-owned release payloads into the
active shell, and compiles the Electron main, preload, and renderer bundles
through the shell `bun run package` entry.

## App-Level Checks

```bash
node --experimental-strip-types scripts/validate-active-shell.ts --quick
npm run validate:app-root-boundary
npm run test:release-boundary
npm run validate:release-boundary
node --experimental-strip-types scripts/collect-release-evidence.ts --bundle-dir release-evidence/<version> --action-id <opl-runtime-safe-action-id> --execute-action --overwrite --evidence-source-dir artifacts/opl-first-run-vm --artifact runtime_screenshot=/path/to/runtime.png
npm run release:evidence:manifest -- --bundle-dir release-evidence/<version> --overwrite
npm run release:evidence:validate -- --bundle-dir release-evidence/<version>
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
npm run hygiene:fallow -- --format json --summary
```

The App page-state matrix is declared in
`contracts/app-page-state-matrix.json`. The first-run matrix is declared in
`contracts/app-first-run-test-matrix.json`.
The App GUI product contract is declared in
`contracts/app-gui-product-contract.json`; `validate-active-shell.ts --quick`
checks the Codex CLI fixed executor, purpose-first Research/Grant/Presentation
home entries routed to MAS/MAG/RCA, hidden home-path executor/provider/permission
selectors with App-owned Codex model selector/status, home prompt, App-owned
ordinary Settings navigation for General, Access, Agents & Capabilities, Local
Environment, Appearance, Advanced, and About & Updates, legacy upstream route
redirects, module path source explanation, stable/nightly release gating, MDS
non-default display, and OPL Flow context before shell validation runs.
The App product profile is declared in
`contracts/app-product-profile.json`; `validate-active-shell.ts --quick` and
`npm run test:release-boundary` verify that the profile still owns only
desktop product defaults and still excludes runtime/provider/domain authority.
The App install/exposure policy is declared in
`contracts/app-install-exposure-policy.json`; `validate-active-shell.ts --quick`
verifies that `skill` remains the public semantic ABI, MAS/MAG/RCA stay
plugin-visible domain routes rather than companion skill mirrors, OPL Meta
Agent stays an OPL-generated surface outside the default home path, and all
installer surfaces use the shared first-run progress model.
The runtime page matrix also verifies the App/operator evidence path: a
multi-task runtime base view, action queue refs, vertical dynamic map refs,
single-task drilldown refs, MAS paper lens refs, summary read model first, lazy
full-detail load, 5-10 second lightweight polling fallback when push projection
is unavailable, refs-only dry-run/execute action commands, receipt/count refresh
after execute, State Index / SQLite sidecar refs-only consumption through the
OPL App/operator projection, Stage Artifact Runtime refs-only drilldown, and
explicit non-authority boundary fields. The gate rejects direct SQLite sidecar
access, State Index mutation authority, domain truth, owner receipt authority,
artifact bodies, artifact authority, and domain/readiness verdict claims in App
contracts, page-state matrices, and the fast App-state fixture.

Release evidence bundle validation requires `evidence-manifest.json` plus the
contracted artifact files. When a local lane cannot produce clean VM smoke
summaries, remote Release verification, OPL runtime JSON, or screenshots, the
manifest must mark those entries as `missing`; `--allow-missing-evidence` then
validates the gap report without treating it as packaged App evidence.
`collect-release-evidence.ts` can fill the OPL runtime JSON and selected
safe-action dry-run/execute artifacts from the live Framework CLI and runs that
same missing-evidence validation before reporting collection success. It can
also import standard packaged/VM/remote smoke outputs with
`--evidence-source-dir <dir>` and attach explicit overrides with repeated
`--artifact <artifact_id>=<source_path>` flags. Explicit artifact mappings take
precedence over source-dir discovery. Every imported file is copied into the
contract path and then validated through the release evidence bundle validator
instead of trusting its original path.

`hygiene:fallow` is scoped to App-owned root wrappers, contracts, and docs.
`.fallowrc.json` excludes the ignored `shells/aionui/**` external checkout so
App hygiene does not report shell-owned dependency or source findings. It is
not GUI shell build or runtime evidence; use `npm run validate:gui-shell` for
active shell validation and GUI compile proof. Run shell hygiene in the
`gaofeng21cn/opl-aion-shell` repository.

Line-budget or Sentrux checks are scheduled maintenance signals for daily or
strict hygiene lanes. They must not be added to ordinary App development gates,
default smoke checks, active-shell validation, package smoke, or release-boundary
validation. If a maintenance lane needs hard enforcement, keep it explicit and
separately named so normal feature, docs, and release-boundary work is not
blocked by advisory source-size budgeting.

## Installed App Smoke

After a standard macOS build, run the packaged GUI smoke against the built DMG
and write a fresh artifact directory for the release cohort under review:

```bash
node shells/aionui/scripts/opl-first-run-vm-smoke.mjs \
  --dmg shells/aionui/out/One-Person-Lab-<version>-mac-arm64.dmg \
  --artifacts artifacts/opl-installed-smoke-<stamp> \
  --timeout-ms 180000 \
  --settings-smoke \
  --assistant-route-smoke
```

Treat this as cohort-bound installed-App evidence. The smoke output can support
release review only when the same cohort also has the contracted manifests,
screenshots, VM summaries, remote verification, and release evidence bundle
classification. Older local installed-smoke transcripts and absolute artifact
paths are history/provenance, not current release proof; the old local-smoke
examples are compressed under
`docs/history/process/retired-surface-provenance.md`.

## Release Validation Matrix

This file lists the testing entry points. Release policy, gate membership,
Homebrew sequencing, Full first-install scope, VM profiles, release notes,
candidate records, and promotion rules are owned by
[`docs/release/README.md`](../release/README.md),
`contracts/app-release-channel.json`, release workflows, release validators, and
release-boundary tests.

| Surface | Testing entry point | What it proves |
| --- | --- | --- |
| Contract and release-boundary unit gates | `npm run test:release-boundary` | App contracts, workflow shape, release evidence policy, updater/Full separation, and release-note rules remain aligned. |
| App-owned release boundary | `npm run validate:release-boundary` | Workflows, scripts, release assets, and checked-in release contracts match the App-owned release surface. |
| Standard release assets | `node --experimental-strip-types scripts/validate-release.ts release-assets` | Local release assets and updater metadata have the expected App shape before publish. |
| Active GUI shell validation | `npm run validate:gui-shell` | App-owned product profile and release payload sync into the active shell, and the shell validates/compiles through the App wrapper. |
| Full first-install package | `npm run release:full -- --version <version>` | The Full package builder can assemble declared runtime payloads and manifests for the selected cohort. |
| Evidence bundle | `npm run release:evidence:manifest` and `npm run release:evidence:validate` | The current cohort's artifacts are classified as `present`, `missing`, `typed_blocker`, or `not_applicable`; only all-present verified bundles become packaged App evidence. |
| Root wrapper hygiene | `npm run hygiene:fallow -- --format json --summary` | App-root wrappers, contracts, and docs are free of scoped production hygiene findings; this is not shell build or release evidence. |

Nightly, Stable, refresh, Homebrew, Full, WebUI, one-shot installer, VM smoke,
and promote flows use different release profiles. Treat the release guide and
contract as the SSOT for those profiles; this testing guide should not duplicate
their full workflow policy.

## Release Cohort Evidence Boundary

Release evidence is current only for the named App cohort that produced it.
Remote verification, VM smoke, screenshots, assistant route smoke,
`release-readiness-summary.json`, `release-candidate-record.json`, Homebrew VM
summaries, Docker/WebUI smoke, Full diagnostics, telemetry, and release notes are
release artifacts or CI outputs, not durable truth in this testing guide.

Local testing lanes can validate shape and collect partial evidence. When a lane
cannot produce clean VM summaries, screenshots, remote verification, or packaged
route receipts, leave the artifact classified as `missing`, `typed_blocker`, or
`not_applicable`. `--allow-missing-evidence` reports those gaps only; it does not
prove App release readiness, Stable/latest promotion, Full clean-machine
installability, domain readiness, or family production readiness.

Deterministic VM automation is the blocking installed-App release proof once a
Stable cohort enters the release workflow. Codex App, Computer Use, and Codex
CLI AI self-checks are diagnostic or exploratory until their findings are
converted into contract, workflow, VM, Playwright, shell, or release-boundary
tests.
