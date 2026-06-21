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
The `v26.6.18` candidate/promote timing profile is archived at
`docs/history/process/2026-06-18-stable-release-profile.md`; use it as
post-release tuning provenance only, not as current release authority.

The App repository owns desktop packaging, release assets, updater metadata, release evidence validation, user-facing release notes, GUI smoke, and App-owned release gates. OPL Framework owns runtime/update kernel behavior and module maintenance. MAS/MAG/RCA/OMA own domain truth, artifact authority, quality/export verdicts, owner receipts, and typed blockers.

## Single Source Of Truth

| Theme | Current owner |
| --- | --- |
| Release channel policy, standard/Full separation, updater metadata, managed update plane, release evidence requirements | `contracts/app-release-channel.json` |
| Release workflow shape and publish/promote sequencing | `.github/workflows/desktop-release*.yml`, `.github/workflows/homebrew-tap-update.yml`, release scripts |
| Release evidence classification and boundary validation | `scripts/validate-release-boundary.ts`, `scripts/validate-release.ts`, release-boundary tests |
| Full payload and size budgets | `contracts/app-release-channel.json#full_first_install.size_budget`, `contracts/app-release-channel.json#full_first_install.opl_runtime_bundle_consumer`, Full manifest `opl_runtime_bundle_consumer`, `scripts/verify-remote-release-assets.ts`, `npm run release:full:size`, `scripts/analyze-full-package-size.ts`, and `scripts/release-size-reporting.ts` |
| App/root shell boundary | `contracts/app-shell-adapter.json`, `scripts/app-root-boundary.ts`, `scripts/validate-active-shell.ts` |
| Install exposure and managed agent package visibility | `contracts/app-install-exposure-policy.json`, `npm run validate:agent-installation` |
| Runtime/toolchain managed update execution | OPL Framework `opl update status/check/plan/apply/repair/rollback --json` runner outputs |
| Release history and retired workflow no-resurrection notes | `docs/history/process/` and `docs/history/process/retired-surface-provenance.md` |

## Release Lanes

| Lane | Purpose | Required proof |
| --- | --- | --- |
| Standard macOS App | Ordinary desktop App package and standard updater target. It never carries or updates the OPL runtime bundle. | Standard DMG / ZIP assets, `latest*.yml`, remote asset verification, GUI smoke, local authorization policy, release evidence bundle. |
| Full first-install DMG | Clean-machine package that can reach Core ready without CLT, Homebrew, Node, or Git first. It consumes the OPL runtime bundle manifest/lock/readback and does not own dependency truth. | Full DMG, Full manifest with `opl_runtime_bundle_consumer`, native runtime trust record, VM smoke when requested, Full local authorization policy, remote size and manifest verification. |
| Offline runtime kit | Manual diagnostic or recovery artifact for the same Full runtime bundle payload. It is not updater-visible and is not a release-ready claim. | Runtime archive, checksums, Full manifest refs, and the same OPL bundle consumer boundary as the Full DMG. |
| Stable promotion | Human release-owner promotion from candidate to stable/latest. | Candidate record with `status=ready_to_promote`, release readiness summary, same-cohort evidence, promote workflow output. |
| Homebrew | Cask transport and index for standard and explicit Full first-install packages. | Published release assets, matching local authorization policy asset, tap update output, Homebrew VM smoke where required. |
| WebUI/GHCR | App-owned image publication lane when release contract enables it. | OCI source label, package access, publish output, image smoke/evidence artifacts. |
| Managed runtime/toolchain update | Framework-runner channel for runtime toolchain and managed agent packages. | OPL update runner receipts, lock/runner status, repair/rollback status, post-apply sync status. |

The Stable WebUI path builds the image once in the Docker smoke lane, verifies
the image locally, publishes that same image to GHCR, and leaves the GHCR lane
as a summary-verifier gate. Do not add a second Stable Docker build just to
separate smoke and publish reporting.

## Preflight

Every release starts with `release-preflight`, backed by:

```bash
npm run release:preflight
```

The preflight checks version/mode compatibility, remote tag or release state,
workflow shape, release plan shape, shell/framework ref availability, Codex CLI
plus Darwin arm64 package metadata for VM-smoke runs, Homebrew tap token
availability, the Homebrew VM static trust policy, and the App-owned release
contract. A failing preflight stops the release before standard, Full, VM,
Homebrew, WebUI, or publish jobs run.

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

Every desktop release run also uploads `release-actions-timing-<version>`. Use
that artifact to inspect workflow wall time, failed/canceled run tax, slow jobs,
and slow steps before opening raw job logs.

## Clean VM Diagnostics

The clean first-run VM gate uploads App-wrapper diagnostics alongside the shell
smoke artifacts. The wrapper records host `node`, `npm`, `curl`, npm registry,
`@openai/codex` package metadata, Codex install asset preflight/cache details,
the resolved job/run/smoke timeout settings, the smoke command preview, and
wrapper stdout/stderr logs in `app-wrapper-diagnostics.json` plus companion
`app-wrapper-*.log` files.

Before launching the clean VM, the workflow performs a host-side Codex npm
package preflight. It reads `@openai/codex@latest` metadata, records the npm
registry response status, package version, tarball URL host, tarball sha256,
tarball size, and elapsed time in `codex-package-preflight.json`, stores the
raw registry response as `codex-package-registry-response.json`, downloads the
tarball to `codex-package-tarballs/openai-codex.tgz`, and materializes
`codex-npm-cache`. GitHub Actions cache restores and saves those install assets
to reduce registry dependency, but the clean VM install smoke still runs and
must prove first-run behavior. This is an install asset preseed/cache surface;
it is not App readiness truth, release-owner receipt, runtime truth, or a
replacement for `tart-smoke-summary.json` and shell Codex install diagnostics.

`run_timeout_ms` and `smoke_timeout_ms` are workflow inputs and are passed to
`opl-first-run-tart-smoke.mjs` as `--timeout-ms` and `--smoke-timeout-ms`.
`codex_install_phase_timeout_ms` and `codex_readiness_phase_timeout_ms` are
workflow inputs that default to `smoke_timeout_ms` and are passed through as
`--codex-install-phase-timeout-ms` and
`--codex-readiness-phase-timeout-ms`. The Codex install preseed paths are passed
as `--codex-package-tarball` and `--codex-npm-cache-dir`. Enforcement lives in
the active `opl-aion-shell` smoke scripts; the App wrapper owns validating,
forwarding, and recording the configured values. The App first-run matrix
requires Codex install command preview, stdout, stderr, exit code, phase
timings, shell summary timeout fields, and install asset preseed diagnostics
from `tart-smoke-summary.json` or a shell companion diagnostics artifact.
The VM wrapper performs a shallow sparse checkout of the active shell `scripts/`
directory because it executes only the host Tart smoke helper and its
same-directory guest smoke helper. If the active shell smoke depends on other
shell files, widen the checkout and update release-boundary validation in the
same commit.
Stable release VM gates consume same-run DMG-only artifacts
(`macos-build-arm64-dmg` and
`opl-full-first-install-dmg-<version>-mac-arm64`) while publish jobs keep using
the complete build/package artifacts. Do not route Full or Standard publish
through the DMG-only handoff artifact.
For post-release or branch-lane evidence runs that must not publish assets,
pass `release_artifact_name` together with `release_artifact_run_id` so the VM
workflow downloads the DMG-only artifact from that source Actions run through
`actions/download-artifact@v8` with `run-id`. This is an evidence-only handoff;
stable release workflows still use same-run artifacts and published release
gates still use remote verification.
The complete standard macOS build artifact must retain the updater ZIP and ZIP
blockmap; release builds fail closed or rebuild the prepackaged macOS updater
targets when those files are missing.

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

Full first-install packaging policy is App-owned, but runtime dependency truth is OPL-owned. The App Full package consumes the OPL runtime bundle manifest, lock, env contract, and readback refs through `full-package-manifest.json#opl_runtime_bundle_consumer`; it must not create a second dependency-truth contract. The upstream source surface is OPL Framework `contracts/opl-framework/runtime-environment-substrate-contract.json` and `opl runtime env contract|build|materialize --dry-run|run-context --json` readbacks.

The launch gate is `ready_to_launch` before `/guid`, and Core means workspace root, Codex CLI, and Codex config. A Full first-install package must reach Core ready from bundled runtime on a clean Mac even when Apple Command Line Tools, Homebrew, Node, and Git are absent.

After Core ready, domain modules, Temporal-backed family runtime provider, recommended skills, native helpers, repo sync, module reconcile, CLT installation, companion skills installation, and ecosystem module updates are Full readiness or background maintenance. They cannot block first launch.

Full VM smoke evidence must come from the clean guest after installing the same
Full DMG under review. The accepted evidence is the installed
`/Applications/One Person Lab.app` bundle resources, the guest runtime pointer
and wrapper readback, and live guest `opl system initialize --json` /
`ready_to_launch` output for that installed package. A host `/Applications`
bundle, a developer checkout, a pre-existing runtime pointer, a prebaked Tart
image, Full manifest refs, cache hits, or remote asset presence can provide
provenance or diagnostics only; none of them can replace clean-install installed
App resource/runtime activation evidence.

Full assets are GitHub Release first-install downloads and explicit stable `one-person-lab-full` cask inputs. They are not standard updater targets.

The physical App assembly still records legacy layer buckets for cache and size accounting, but those buckets map to the OPL runtime bundle taxonomy:

| Full assembly bucket | OPL runtime bundle layer ids |
| --- | --- |
| `toolchain` | `base-toolchain`, `python-wheelhouse`, `optional-heavy-tools` |
| `opl-runtime` | `opl-framework-runtime` |
| `domain-runtime` | `domain-pack` |
| `skills` | `companion-skills` |

Runtime cache hits prove only reusable assembly inputs for those buckets. A cache hit, manifest file, lock file, successful Full build, or offline kit upload cannot by itself claim App release readiness, runtime dependency truth, OPL family production readiness, domain readiness, or owner acceptance. The consumer boundary is refs-only and must keep required clean-machine offline payloads in the Full package; it cannot use size review or cache reuse to delete required payloads, materialize an OPL runtime root, or claim runtime/App/family readiness.

## Full Size Policy

Release review records compressed DMG size, uncompressed runtime size, top
component/layer contributors, optimization candidates, App-bundle trim evidence,
and package-boundary audit evidence. The remote verifier measures compressed
Full DMG bytes from the GitHub asset size and the uncompressed runtime bytes
from `full-package-manifest.json`
`size_breakdown.total_runtime_uncompressed_bytes`.

Current policy values live in
`contracts/app-release-channel.json#full_first_install.size_budget`; policy
semantics, package-profile boundaries, measured records, runtime boundary, and
optimization priority live in
`contracts/app-release-channel.json#full_first_install.size_policy`. The Full
manifest copies the threshold-sized `size_budget` object and the
`opl_runtime_bundle_consumer` boundary. Treat the contract and manifest as the
source for warning/review/runtime thresholds and OPL bundle consumer refs; this
guide records the operator path and measurement boundary.

The current target is still a Full DMG under the `750000000`-byte review
threshold, but the review threshold is not a permission to remove required
offline payloads. A Full package that exceeds it must enter size review and
optimization planning; the uncompressed runtime budget remains the
release-blocking size gate. Do not trade away clean-machine first-install
completeness, bundled Core readiness, or native trust evidence to make the DMG
smaller.

The Full package writes `package_optimization` into
`full-package-manifest.json`, plus `full-app-bundle-trim-report.json` and
`full-package-boundary-audit.json`. These artifacts are required Full assets and
checksum entries. They can prove explicit non-runtime pruning, payload boundary
preservation, and size-review release decoupling; they cannot replace the
same-cohort Full clean VM smoke, native trust evidence, remote asset readback, or
release-owner receipt. Full DMG warning/review-threshold status alone must not
block stable clean evidence unless a hard size limit, uncompressed runtime
limit, offline payload boundary, native trust, or Full clean VM gate fails.

The v26.6.21 measured record in the release contract records:

- Full DMG: `1121919153` bytes.
- Standard DMG: `440471386` bytes.
- Top App bundle contributors: `opl-full-runtime` `745M`,
  `bundled-aioncore` `678M`, `app.asar` `367M`, and Electron Framework `249M`.
- zlib level 9 estimate: `844079932` bytes, still above the `750000000`-byte
  review threshold.

Optimization starts with explicit non-runtime pruning in the staged App bundle
and Full runtime tree: source maps, tests, local caches, tmp/temp directories,
logs, coverage, and package docs/fixtures/examples are removable only when the
report preserves `Contents/Resources/opl-full-runtime`,
`Contents/Resources/bundled-aioncore`, `Contents/Resources/app.asar`, and
Electron framework resources. Duplicate or split runtime-layer review across
`opl-full-runtime` and `bundled-aioncore` remains audit-only until same-cohort
Full clean VM evidence proves offline Core readiness and native trust are
unchanged. Compression tuning is secondary; by the current measurement it cannot
restore the target by itself.

Local review:

```bash
npm run release:full:size -- --markdown
```

Remote diagnosis should prefer the small `opl-full-diagnostics-<version>`
artifact. It includes `full-package-size-summary.json` and
`full-package-size-summary.md`; consume `full_package.size_analysis` in
`release-readiness-summary.json` for final gate review without downloading the
Full DMG. Full workflow telemetry is bottleneck tuning input, not release truth.
`full_runtime_cache` telemetry is the same kind of tuning input: it can explain
package build time and reuse, but it cannot make a release-ready or
runtime-ready claim without the same-cohort release gates and owner-resolution
surface.

Timing review must keep two clocks separate. Do not compare agent orchestration wall time to GitHub Actions workflow wall time.
GitHub Actions workflow wall time is the release execution KPI; agent
orchestration wall time includes waiting on runs, artifact downloads, local
readback, documentation, validation, commit/push/cleanup, and tool/model round
trips.

Every desktop release run now produces the closeout by default in the final
`release-readiness-summary` job. That job writes and uploads
`release-closeout-<version>` with `release-closeout.json` and
`release-closeout.md` after `release-candidate-record.json` is written. The same
artifact also carries `release-monitor.json` and `release-notification.json`.
Use `release-monitor.json#state` (`running`, `failed`, `ready_to_promote`, or
`published`, with `published_with_post_publish_followup` when publication is
complete but a later proof gate failed) plus `recommended_next_action` as the
no-watch operator surface instead of leaving a terminal in `gh run watch`. It
reads the same local small
artifacts already used by readiness, runs with `--no-download`, refuses
standard/Full package artifacts, and points the
operator at promotion only after the candidate record passes
`scripts/validate-release-candidate-record.ts --promote-ready`. A candidate
`status=ready_to_promote` without a same-cohort `release_owner_verdict_ref` or
`release_owner_receipt_ref` remains owner-needed: closeout reports the
release-owner typed blocker / owner-resolution action instead of
`promote_from_candidate_record`. Candidate blockers, failed readiness gates, or
raw log inspection are used only after structured evidence is missing or failed.
If a promote workflow publishes the release and then fails a Homebrew VM,
screenshot, docs, or other post-publish proof gate, closeout must classify that
as `resolve_post_publish_followup_gate`; do not conflate the published
GitHub Release/tap state with clean-install proof completion.

The standard clean VM smoke is the fail-fast gate for stable Full release
trains. When `include_full_package=true` and `run_vm_smoke=true`,
`desktop-release.yml` runs `standard-first-run-vm-smoke-after-full` before Full
package build, Full publish/remote verification, Homebrew updates, operator
evidence, or readiness aggregation. If the standard VM fails, stop at that
diagnostic artifact; do not keep queueing Full, Homebrew, operator evidence, or
readiness jobs for the same cohort.

The local command is the rerun/debug path for the same logic, not a separate
release step:

```bash
npm run release:closeout -- --version <version> --run-id <github-actions-run-id> --artifact-profile diagnostics --agent-wall-time <duration>
```

When run locally, the command writes ignored outputs under
`artifacts/release-closeout/v<version>-<run_id>/`, downloads only final summary
and diagnostic artifacts unless `--no-download` is passed, and can record the
Agent orchestration wall time with `--agent-wall-time <duration>`.

Use `desktop-release-diagnostics.yml` for harness-only diagnosis before
starting another full release train. It can run the first-run VM harness against
a published `release_tag`, a direct `release_dmg_url`, or a
`release_artifact_name` from an existing `release_artifact_run_id` via
`actions/download-artifact@v8` with `run-id`. That
workflow is read-only: it may upload `release-diagnostics-*` and
`opl-first-run-vm-<profile>-<run_id>` diagnostic artifacts, but it must not
build standard assets, rebuild Full packages, publish releases, update
Homebrew, or write owner receipts.

## Gate Reuse And VM Base Acceleration

Successful release gates can be considered for reuse only through a small,
auditable decision artifact:

```bash
npm run release:gate-reuse-plan -- --version <version> --release-mode refresh_existing --include-full-package true --run-vm-smoke true --app-commit <sha> --shell-ref <ref> --framework-ref <ref> --current-preflight release-preflight-summary.json --current-remote-verification remote-release-verification.json --previous-candidate-record previous-release-candidate-record.json --previous-readiness previous-release-readiness-summary.json --previous-remote-verification previous-remote-release-verification.json --output release-gate-reuse-plan.json --markdown release-gate-reuse-plan.md
```

The command writes `opl_release_gate_reuse_plan.v1`. A gate becomes
`reuse_allowed` only when the cohort matches on version, release mode,
`include_full_package`, VM-smoke intent, App commit, shell/framework refs,
resolved ref sha, previous promote-ready candidate status, previous passed gate
status, and the remote release asset `{name,size,sha256}` set. It also writes a
stable `reuse_digest` for the exact reuse cohort and evidence inputs.

This artifact does not publish a release, claim release-ready, write runtime
truth, or skip a workflow gate by itself. It is the reviewable input a future
workflow can explicitly consume. Until a workflow has that explicit consumption
step and a real release validates it, unchanged gates may be reported as
reusable but still run.

The same boundary applies to Tart base acceleration. `contracts/app-release-channel.json`
allows pre-baking only host setup layers such as GUI session readiness,
Homebrew prerequisites for the Homebrew profile, Node runtime prerequisites,
and Codex install asset cache seeds. A prebaked image must carry a receipt with
source VM, image digest, profile, prebaked layers, truth boundary, and
validation command. It must not contain `One Person Lab.app`, release DMGs,
Homebrew casks, user workspace state, runtime truth, domain artifact truth, or
owner receipts. The clean App install, first launch, Settings smoke, assistant
route smoke, and release readiness still come from the VM smoke artifact.

This follows the same operational shape used by mature cleanup/cache systems:
Docker prune scopes removal to unused objects, pnpm store prune scopes removal
to unreferenced packages, Hugging Face cache management exposes scan/delete
flows, and Electron separates app data, cache/session, and logs paths instead
of treating all local files as one removable bucket.

No-watch readback:

```bash
gh run view <github-actions-run-id> --repo gaofeng21cn/one-person-lab-app --json status,conclusion,url,updatedAt
gh run download <github-actions-run-id> --repo gaofeng21cn/one-person-lab-app --name release-closeout-<version> --dir artifacts/release-closeout/v<version>-<github-actions-run-id>
jq '.state,.recommended_next_action' artifacts/release-closeout/v<version>-<github-actions-run-id>/release-monitor.json
```

`release-notification.json` is a repo-native notification payload for automation
consumers. It is not a fake push notification service; it mirrors the monitor
state, run URL, artifact name, and recommended next action in a small JSON file.

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

When a desktop release run has already produced complete same-cohort evidence
and is blocked only by the release-owner resolution ref, pass
`release_owner_verdict_ref` or `release_owner_receipt_ref` to
`desktop-release-promote.yml`. The promote workflow downloads the original
run's small preflight/readiness/remote-verification artifacts, rebuilds the
candidate record with `npm run release:candidate-record:resolve-owner`, then
runs the normal promote-ready validator before publishing. This avoids a full
desktop release rerun solely for owner-resolution metadata; it does not skip
failed gates, invent owner receipts, or bypass candidate-record validation.

AI exploratory release checks are non-blocking. They can provide exploratory triage, summaries, risk hints, or follow-up suggestions, but they are not a release gate and must not block standard, Full, Homebrew, WebUI, updater, or promotion lanes.

## GUI Shell Alternatives

Shell alternative work stays outside the default release adapter until the App release owner deliberately changes `contracts/app-shell-adapter.json`. AionUI is the active GUI mainline, and Hermes Desktop / `hermes-codex` is the only foreground alternative. AGUI / `agui-codex` is archived technical proof and is replayed only when AGUI is explicitly requested; it is not a routine validation or polish lane. Use `contracts/app-shell-candidates.json`, `contracts/shell-adapters/<candidate>.json`, replay runbooks, shell artifacts, manifests, and validation scripts for technical proof.

Default release packaging continues to use the active adapter. Foreground alternative validation covers Hermes by default:

```bash
npm run validate:shell-candidates
```

Explicit AGUI replay requires both an explicit registry selection and an explicit adapter override:

```bash
npm run validate:shell-candidates -- --candidate agui-codex
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

Shell alternative or replay smoke does not imply active-shell adoption, domain readiness, clean-VM readiness, Full-release readiness, or production readiness.

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
