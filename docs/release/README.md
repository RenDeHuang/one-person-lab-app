# App Release

Owner: `one-person-lab-app`
Purpose: `app_release_docs`
State: `active`
Machine boundary: Human-readable release guide. Machine decisions stay in `contracts/app-release-channel.json`, release workflows, scripts, validators, release artifacts, updater metadata, test outputs, Homebrew tap outputs, and OPL Framework CLI/read-model output consumed by the App.

## Read This First

This guide is the release operator map, not a proof ledger. It states the release lanes, stop conditions, required machine surfaces, and verification commands. Dated run ids, branch closeouts, VM transcripts, package-size investigations, candidate smoke logs, GHCR diagnostics, screenshots, and release-by-release evidence belong in release artifacts, CI logs, candidate manifests, or `docs/history/process/`.
The `v26.6.12` same-tag refresh and timing profile is archived at
`docs/history/process/2026-06-12-stable-release-profile.md`; use it as
provenance only, not as current release authority.

The App repository owns desktop packaging, release assets, updater metadata, release evidence validation, user-facing release notes, GUI smoke, and App-owned release gates. OPL Framework owns runtime/update kernel behavior and module maintenance. MAS/MAG/RCA/OMA own domain truth, artifact authority, quality/export verdicts, owner receipts, and typed blockers.

## Single Source Of Truth

| Theme | Current owner |
| --- | --- |
| Release channel policy, standard/Full separation, updater metadata, managed update plane, release evidence requirements | `contracts/app-release-channel.json` |
| Release workflow shape and publish/promote sequencing | `.github/workflows/desktop-release*.yml`, `.github/workflows/homebrew-tap-update.yml`, release scripts |
| Release evidence classification and boundary validation | `scripts/validate-release-boundary.ts`, `scripts/validate-release.ts`, release-boundary tests |
| Full payload and size budgets | `contracts/app-release-channel.json#full_first_install.size_budget`, Full manifest `size_budget`, `scripts/verify-remote-release-assets.ts`, `scripts/release-full-size-report.ts` |
| App/root shell boundary | `contracts/app-shell-adapter.json`, `scripts/app-root-boundary.ts`, `scripts/validate-active-shell.ts` |
| Install exposure and managed agent package visibility | `contracts/app-install-exposure-policy.json`, `npm run validate:agent-installation` |
| Runtime/toolchain managed update execution | OPL Framework `opl update status/check/plan/apply/repair/rollback --json` runner outputs |
| Release history and retired workflow no-resurrection notes | `docs/history/process/` and `docs/history/process/retired-surface-provenance.md` |

## Release Lanes

| Lane | Purpose | Required proof |
| --- | --- | --- |
| Standard macOS App | Ordinary desktop App package and standard updater target. | Standard DMG / ZIP assets, `latest*.yml`, remote asset verification, GUI smoke, local authorization policy, release evidence bundle. |
| Full first-install DMG | Clean-machine package that can reach Core ready without CLT, Homebrew, Node, or Git first. | Full DMG, Full manifest, native runtime trust record, VM smoke when requested, Full local authorization policy, remote size and manifest verification. |
| Stable promotion | Human release-owner promotion from candidate to stable/latest. | Candidate record with `status=ready_to_promote`, release readiness summary, same-cohort evidence, promote workflow output. |
| Homebrew | Cask transport and index for standard and explicit Full first-install packages. | Published release assets, matching local authorization policy asset, tap update output, Homebrew VM smoke where required. |
| WebUI/GHCR | App-owned image publication lane when release contract enables it. | OCI source label, package access, publish output, image smoke/evidence artifacts. |
| Managed runtime/toolchain update | Framework-runner channel for runtime toolchain and managed agent packages. | OPL update runner receipts, lock/runner status, repair/rollback status, post-apply sync status. |

## Preflight

Every release starts with `release-preflight`, backed by:

```bash
npm run release:preflight
```

The preflight checks version/mode compatibility, remote tag or release state,
workflow shape, release plan shape, Homebrew tap token availability, the
Homebrew VM static trust policy, and the App-owned release contract. A failing
preflight stops the release before standard, Full, VM, Homebrew, WebUI, or
publish jobs run.

For the Homebrew standard VM gate, the static policy is:

- Install ref: `gaofeng21cn/one-person-lab/one-person-lab`
- Trusted cask refs: `gaofeng21cn/one-person-lab/one-person-lab`,
  `gaofeng21cn/one-person-lab/one-person-lab-full`, and
  `gaofeng21cn/one-person-lab/one-person-lab-nightly`
- Trust scope:
  `explicit_standard_and_conflicting_cask_refs_not_whole_tap`

The preflight and release-boundary gates fail if the install path falls back to
an unqualified cask, omits a sibling `conflicts_with` cask ref, or trusts the
whole tap.

## GitHub Actions Release Path

Stable release flow:

1. Run the release workflow for the selected version/channel.
2. Produce standard and, when requested, Full artifacts plus the release evidence bundle.
3. Run remote verification against the published draft release assets.
4. Produce `release-candidate-record.json`.
5. Promote only when the promote workflow reads a ready candidate record for the same cohort.
6. Update Homebrew casks after the draft release is published and the matching policy assets exist.
7. Run post-release user-guide/screenshots only after promotion; they are never pre-promotion gates.

Nightly and candidate flows follow the same SSOT contract but do not imply stable/latest promotion.

## Clean VM Diagnostics

The clean first-run VM gate uploads App-wrapper diagnostics alongside the shell
smoke artifacts. The wrapper records host `node`, `npm`, `curl`, npm registry,
`@openai/codex` package metadata, the resolved job/run/smoke timeout settings,
the smoke command preview, and wrapper stdout/stderr logs in
`app-wrapper-diagnostics.json` plus companion `app-wrapper-*.log` files.

`run_timeout_ms` and `smoke_timeout_ms` are workflow inputs and are passed to
`opl-first-run-tart-smoke.mjs` as `--timeout-ms` and `--smoke-timeout-ms`.
`codex_install_phase_timeout_ms` and `codex_readiness_phase_timeout_ms` are
workflow inputs that default to `smoke_timeout_ms` and are passed through as
`--codex-install-phase-timeout-ms` and
`--codex-readiness-phase-timeout-ms`. Enforcement lives in the active
`opl-aion-shell` smoke scripts; the App wrapper owns validating, forwarding,
and recording the configured values. The App first-run matrix requires Codex
install command preview, stdout, stderr, exit code, phase timings, and the shell
summary timeout fields from `tart-smoke-summary.json` or a shell companion
diagnostics artifact.

## Standard Updater

Standard updater metadata is restricted to macOS arm64 standard assets. Full assets must never be written into `latest*.yml`, and assets whose names include `Full` are not updater targets.

The standard updater follows Electron's background-download plus visible restart/install model. Download completion is not installation success. The release contract tracks `update_downloaded`, `update_apply_started`, `update_apply_completed`, and `running_version_switched` separately. After restart, the running App version must be greater than or equal to the downloaded target version; otherwise the shell records `auto-update-diagnostics.json#install-not-applied` and exposes a recovery action to install the downloaded update again or reveal the cached package.

The current macOS install path is App-managed local authorization: the ZIP must contain the expected `One Person Lab.app` bundle, the installer replaces the local App bundle, clears quarantine, records `codesign` / `spctl` diagnostics, and relaunches the App. The active-shell gate requires both the local authorized installer path and the post-restart `quit-and-install` / `install-not-applied` diagnostics so a release cannot regress to a download-only success claim.

The standard updater updates desktop App assets only. It does not update OPL module packages, select Developer Profile checkout sources, publish WebUI images, install `opl-flow`, mutate global Homebrew/system Codex, or claim domain readiness.

## Managed Update Plane

The managed update plane is App consumption of the Framework runner, not an App implementation of the update kernel. The App reads:

```bash
opl update status --json
opl update check --json
opl update plan --json
```

Controlled execution stays in Framework runner outputs:

```bash
opl update apply --component <component_id> --json
opl update repair --receipt <receipt_id> --json
opl update rollback --component <component_id> --json
```

The active shell must expose these commands through the OPL runtime bridge, not
through direct file reads or shell-local update logic. The required bridge
surfaces are `opl-runtime.get-managed-update-status`,
`opl-runtime.get-managed-update-check`, `opl-runtime.get-managed-update-plan`,
`opl-runtime.run-managed-update-apply`,
`opl-runtime.run-managed-update-repair`, and
`opl-runtime.run-managed-update-rollback`.

Background maintenance runs after App Core is ready, during daily background
maintenance, and when the user manually checks updates. It must respect the
Framework idempotency lock, use bounded retry/backoff, and project `last_run_at`,
`next_run_at`, `last_failure`, lock status, execution status, recent actions,
skip reasons, and reload guidance into the Updates & Maintenance surface.

For ordinary users, clean managed agent packages and capability exposure are the
only background auto-apply targets. If `opl update check` or `opl update plan`
reports `agent_package_channel` / `capability_exposure` as clean managed and
updateable, the shell may call the Framework runner to apply those components
and then display the recorded receipt refs, post-apply hooks, skill/plugin sync
result, and reload guidance. Desktop App binary updates and runtime/toolchain
updates remain conservative: they can be checked, staged, repaired, or shown as
requiring restart, but the shell must not silently replace the App bundle,
switch runtime pointers, upgrade Homebrew/system tools, or mutate developer /
dirty checkouts.

The App may display component receipt refs, lock/runner status, repair status,
rollback status, post-apply sync status, and reload guidance. It must not read
managed artifact bodies, write runtime/domain truth, create owner receipts,
mutate dirty/developer checkouts, bypass the Framework update kernel, silently
mutate Homebrew/system tools, or claim MAS/MAG/RCA quality/export verdicts.

## Homebrew Distribution Boundary

Homebrew is cask transport and index only. It points terminal users and automation at the same App release cohorts through `one-person-lab`, `one-person-lab-nightly`, and explicit stable `one-person-lab-full` casks.

Stable standard cask installs use the fully qualified cask ref:

```bash
brew install --cask gaofeng21cn/one-person-lab/one-person-lab
```

This is the user and CI install path under current Homebrew tap trust behavior.
The release VM gate also trusts the standard cask's `conflicts_with` sibling
cask refs, `one-person-lab-full` and `one-person-lab-nightly`, because Homebrew
may load those casks while resolving conflicts. It does not grant broad
`brew trust` approval for the entire tap.

Homebrew does not own App activation, user workspace state, module readiness, agent-pack distribution, skill/plugin semantics, updater policy, stable/latest promotion, or domain readiness. After Homebrew install or upgrade, activation and user-state setup still come from OPL/App surfaces such as:

```bash
opl system initialize --json
opl install
opl system startup-maintenance
opl connect reconcile-modules
opl connect sync-skills
```

Stable desktop releases update the stable cask only after the promote workflow publishes the draft release. Existing published release refreshes may update the tap after remote asset verification and before the Homebrew VM gate. Same-owner App release tap writes use direct commits; do not restore tap pull-request mode as a compatibility path.

## Stable macOS Local Authorization

Stable macOS standard updater releases use App-managed local authorization. Paid Apple Developer ID signing, notarization, and `TeamIdentifier` are optional diagnostics for this lane, not release requirements.

Required local authorization evidence:

- `standard-local-authorization-policy.json` for standard assets.
- `full-local-authorization-policy.json` for Full assets.
- Remote ZIP extraction on a macOS runner.
- Embedded bundle version check.
- `codesign` / `spctl` diagnostics.
- Quarantine clearing evidence for installer/update launch paths.

Gatekeeper rejection is acceptable only when the Stable local authorization policy explicitly records that unsigned/ad-hoc bundles are allowed for the cohort.

## Full First-Install

Full first-install policy is App-owned. The launch gate is `ready_to_launch` before `/guid`, and Core means workspace root, Codex CLI, and Codex config. A Full first-install package must reach Core ready from bundled runtime on a clean Mac even when Apple Command Line Tools, Homebrew, Node, and Git are absent.

After Core ready, domain modules, Temporal-backed family runtime provider, recommended skills, native helpers, repo sync, module reconcile, CLT installation, companion skills installation, and ecosystem module updates are Full readiness or background maintenance. They cannot block first launch.

Full assets are GitHub Release first-install downloads and explicit stable `one-person-lab-full` cask inputs. They are not standard updater targets.

## Full Size Policy

Release review records compressed DMG size, uncompressed runtime size, top
component/layer contributors, and optimization candidates. The remote verifier
enforces the compressed Full DMG budget from the GitHub asset size and the
uncompressed runtime budget from `full-package-manifest.json`
`size_breakdown.total_runtime_uncompressed_bytes`.

Current policy values live in
`contracts/app-release-channel.json#full_first_install.size_budget` and are
copied into the Full manifest `size_budget`. Treat the contract and manifest as
the source for warning/review/runtime thresholds; this guide only records the
operator path and measurement boundary.

Local review:

```bash
npm run release:full:size -- --markdown
```

Remote diagnosis should prefer the small `opl-full-diagnostics-<version>`
artifact. It includes `full-package-size-summary.json` and
`full-package-size-summary.md`; consume `full_package.size_analysis` in
`release-readiness-summary.json` for final gate review without downloading the
Full DMG. Full workflow telemetry is bottleneck tuning input, not release truth.

Timing review must keep two clocks separate. Do not compare agent orchestration wall time to GitHub Actions workflow wall time.
GitHub Actions workflow wall time is the release execution KPI; agent
orchestration wall time includes waiting on runs, artifact downloads, local
readback, documentation, validation, commit/push/cleanup, and tool/model round
trips.

Every desktop release run now produces the closeout by default in the final
`release-readiness-summary` job. That job writes and uploads
`release-closeout-<version>` with `release-closeout.json` and
`release-closeout.md` after `release-candidate-record.json` is written. It reads
the same local small artifacts already used by readiness, runs with
`--no-download`, refuses standard/Full package artifacts, and points the
operator at promotion only after the candidate record passes
`scripts/validate-release-candidate-record.ts --promote-ready`. A candidate
`status=ready_to_promote` without a same-cohort `release_owner_verdict_ref` or
`release_owner_receipt_ref` remains owner-needed: closeout reports the
release-owner typed blocker / owner-resolution action instead of
`promote_from_candidate_record`. Candidate blockers, failed readiness gates, or
raw log inspection are used only after structured evidence is missing or failed.

The local command is the rerun/debug path for the same logic, not a separate
release step:

```bash
npm run release:closeout -- --version <version> --run-id <github-actions-run-id> --artifact-profile diagnostics --agent-wall-time <duration>
```

When run locally, the command writes ignored outputs under
`artifacts/release-closeout/v<version>-<run_id>/`, downloads only final summary
and diagnostic artifacts unless `--no-download` is passed, and can record the
Agent orchestration wall time with `--agent-wall-time <duration>`.

## Purpose-Based Release Validation

Stable is the complete user-install proof lane. Before a stable App Release is treated as smooth, each required artifact must be classified as `present`, `missing`, `typed_blocker`, or `not_applicable`. Only an all-present verified bundle can set `packaged_app_evidence=true`.

Same-cohort release/user-path refs can support release-owner review. They do not promote stable/latest by themselves, prove domain readiness, prove OPL family production readiness, close MAS/MAG/RCA/OMA owner receipts, or replace App release-owner decision.

The release readiness summary must carry `release_owner_verdict` for the same
cohort. Passing evidence produces `status=release_owner_verdict_pending` and a
`release_owner_typed_blocker_ref` plus `install_evidence_ref` that the App
release owner can consume; missing or blocked evidence produces
`status=release_owner_typed_blocker_required`. Stable promotion requires the
candidate record to carry a same-cohort `release_owner_verdict_ref` or
`release_owner_receipt_ref`; pending, typed-blocker, install-evidence, and
human-gate refs are explicit non-ready states.

For `new_release` and `refresh_existing` runs, the workflow dispatch inputs
`release_owner_verdict_ref` and `release_owner_receipt_ref` are the front-door
owner-resolution path. When the App release owner has already recorded a
same-cohort decision or receipt, pass that ref on the initial run so the final
candidate record can be written as `ready_to_promote` without a separate
refresh. The ref must target the same `v<version>` cohort under
`one-person-lab-app/release-owner/`; cross-cohort refs and missing owner
resolution refs keep the candidate `blocked` with an actionable reason.
`draft_candidate` runs still produce diagnostic-only candidate records even when
they carry owner refs.

The App release workflow only consumes these explicit refs and records them in
the candidate readout. It does not create, infer, or backfill App release owner
receipts, and the readout continues to keep `release_ready_claim=false`,
`stable_latest_promotion_claim=false`, and `family_production_ready_claim=false`
until the promote workflow consumes a valid `ready_to_promote` candidate record.

After an App release-owner receipt is recorded, use
`npm run release:owner-candidate-record:verify` with the ignored small
release-closeout artifacts to rebuild and validate the post-owner candidate
record. This verifies the owner-resolution ref path only; it does not publish
the release, mutate updater metadata, or claim App release ready / OPL family
production ready.

AI exploratory release checks are non-blocking. They can provide exploratory triage, summaries, risk hints, or follow-up suggestions, but they are not a release gate and must not block standard, Full, Homebrew, WebUI, updater, or promotion lanes.

## Candidate Shells

Candidate shell work stays outside the default release adapter until the App release owner deliberately changes `contracts/app-shell-adapter.json`. Use `contracts/app-shell-candidates.json`, `contracts/shell-adapters/<candidate>.json`, candidate runbooks, shell artifacts, manifests, and validation scripts for technical proof.

Default release packaging continues to use the active adapter unless explicitly overridden:

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run validate:shell-candidates
```

Candidate smoke does not imply active-shell adoption, domain readiness, clean-VM readiness, Full-release readiness, or production readiness.

## Local Commands

Docs/release-only validation:

```bash
npm run validate:release-boundary
npm run test:release-boundary
git diff --check
```

Release asset preparation and validation:

```bash
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
```

Active shell and App-root boundary:

```bash
npm run ensure:shell
node --experimental-strip-types scripts/validate-active-shell.ts --quick
npm run validate:app-root-boundary
npm run validate:gui-shell
```

Install exposure and managed modules:

```bash
npm run validate:agent-installation
```

Full size review:

```bash
npm run release:full:size -- --markdown
```

## Retired Workflow Guard

Do not restore retired release paths as compatibility surfaces:

- Legacy Build and Release as stable channel owner.
- Optional pre-validation `release-evidence-<version>` seed download.
- Homebrew tap pull-request mode for same-owner App release writes.
- Full assets in standard updater metadata.
- Shell package output replacing the App root wrapper.
- Docs-prose release tests that make wording the machine truth.

Retired-surface provenance lives in `docs/history/process/retired-surface-provenance.md`; machine guards live in release validators, workflow tests, and `contracts/app-release-channel.json`.
