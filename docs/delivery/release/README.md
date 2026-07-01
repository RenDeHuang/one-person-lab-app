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
| Release channel policy, standard/Full separation, seven-layer install/update taxonomy, updater metadata, release evidence requirements | `contracts/app-release-channel.json` |
| Release workflow shape and publish/promote sequencing | `.github/workflows/desktop-release*.yml`, `.github/workflows/homebrew-tap-update.yml`, release scripts |
| Release evidence classification and boundary validation | `scripts/validate-release-boundary.ts`, `scripts/validate-release.ts`, release-boundary tests |
| Full payload and size budgets | `contracts/app-release-channel.json#full_first_install.size_budget`, `contracts/app-release-channel.json#full_first_install.opl_runtime_bundle_consumer`, Full manifest `opl_runtime_bundle_consumer`, `scripts/verify-remote-release-assets.ts`, `npm run release:full:size`, `scripts/analyze-full-package-size.ts`, and `scripts/release-size-reporting.ts` |
| App/root shell boundary | `contracts/app-shell-adapter.json`, `scripts/app-root-boundary.ts`, `scripts/validate-active-shell.ts` |
| Install exposure and Capability Packages visibility | `contracts/app-install-exposure-policy.json`, `npm run validate:agent-installation` |
| OPL Runtime Fabric and OPL Packages managed execution | OPL Framework `opl update status/check/plan/apply/repair/rollback --json` runner outputs |
| OPL Framework runtime artifact gate | `contracts/app-release-channel.json#runtime_substrate_updater.framework_artifact_gate`, Framework artifact channel/readback/checksum/rollback receipts |
| Release history and retired workflow no-resurrection notes | `docs/history/process/` and `docs/history/process/retired-surface-provenance.md` |

## Install And Update Taxonomy

Release docs and user docs use seven user-facing layers. Contract/readback ids
may stay machine-readable, but they must not become the primary user taxonomy.

| Layer | User-facing meaning | Update boundary |
| --- | --- | --- |
| Installation Carrier | The host/container installation carrier: macOS App bundle, Docker/WebUI image, or Linux package carrier. | macOS uses standard updater/Homebrew. Docker/WebUI image updates require carrier status, host update route, `host_executor_required` or `manual_required`, and mounted data/projects preservation proof. Local and optional remote image digests are status readbacks only; they do not prove release-ready/current/latest. Linux package carriers expose read-only host package-manager/package metadata fields and route through the host package manager or a documented host executor; OPL does not ship a privileged Linux host executor until an explicit operator opt-in policy exists. |
| OPL Runtime Fabric | App-owned runtime foundation needed to launch or recover OPL. User-facing grouping is Agent Execution Core (Codex executor, Temporal task runner, OPL Framework runtime), Environment Materializer (managed language runtimes, package/env resolvers, env cache, isolated prefixes, and receipts), and OPL System Bridge (native helper only where platform boundaries require it). | Managed by OPL/App startup maintenance; `runtime_substrate` remains the machine id. Ordinary defaults use the App-owned runtime. System PATH, Homebrew, global tools, and developer checkouts are diagnostic or explicit expert opt-in unmanaged sources, not default sources. |
| Capability Packages | MAS/MAG/RCA/OMA/BookForge/ScholarSkills OPL Packages. | Clean managed roots may update silently; dirty checkouts, developer checkouts, locks, verification failures, and manual-required states are not overwritten. |
| Companion Tools | OfficeCLI, MinerU, PDF/UI helpers, Superpowers, cron, and similar workflow helpers. | Maintained as helper payloads/skills, not domain-authority or Installation Carrier assets. |
| Codex Surface | Codex plugin registry, plugin-packaged skills, generated OMA/BookForge surfaces, post-apply sync, readiness, and reload guidance. | A visibility/readiness projection over one semantic entry; it is not a separate update channel. |
| Workflow Profile | OPL Flow workflow/profile guidance and Codex profile material. | Profile sync must not silently overwrite existing `AGENTS.md` or `TASTE.md`; existing profiles route through a Codex semantic merge packet. |
| User Data/Artifacts | Workspaces, conversations, generated deliverables, logs, caches, receipts, and archive/restore state. | Never a silent updater target; destructive cleanup requires inventory, archive/restore proof, and explicit confirmation. |

Full first-install assets are preloaded payloads for clean machines. They can
carry OPL Runtime Fabric, Capability Packages, Companion Tools, Codex Surface
seeds, and Workflow Profile material so first launch can reach Core readiness,
but Full is not a long-term update channel and must never be selected by
standard updater metadata.

## Release Lanes

| Lane | Purpose | Required proof |
| --- | --- | --- |
| Standard macOS App | Ordinary desktop App package and standard updater target. It never carries or updates the OPL runtime bundle. | Standard DMG / ZIP assets, `latest-arm64-mac.yml`, ZIP blockmap, remote asset verification, GUI smoke, local authorization policy, release evidence bundle. |
| Full first-install DMG | Clean-machine package that can reach Core ready without CLT, Homebrew, Node, or Git first. It consumes the OPL runtime bundle manifest/lock/readback and does not own dependency truth. | Full DMG, `opl-release-manifest.json` with `opl_runtime_bundle_consumer`, native runtime trust record, VM smoke when requested, manifest-carried local authorization policy, remote size and manifest verification. |
| Offline runtime kit | Manual diagnostic or recovery artifact for the same Full runtime bundle payload. It is not updater-visible and is not a release-ready claim. | Runtime archive, checksums, Full manifest refs, and the same OPL bundle consumer boundary as the Full DMG. |
| Stable promotion | Human release-owner promotion from candidate to stable/latest. | Candidate record with `status=ready_to_promote`, release readiness summary, same-cohort evidence, promote workflow output. |
| Homebrew | Cask transport and index for standard and explicit Full first-install packages. | Published release assets, standard local authorization policy asset or Full manifest ref, tap update output, Homebrew VM smoke where required. |
| WebUI/GHCR | App-owned preheated Docker/WebUI runtime image for browser-first Linux/container deployment. It is not the desktop App GUI shell install path and is not an OPL Packages member. | OCI source label, package access, publish output, image manifest/volume boundary, image smoke/evidence artifacts. |
| Managed maintenance | Framework-runner maintenance for OPL Runtime Fabric, Capability Packages, Companion Tools, and Codex Surface readiness. | OPL update runner receipts, lock/runner status, Framework artifact channel/readback/checksum/rollback evidence, repair/rollback status, post-apply sync status. |

Standard macOS DMGs use electron-builder-supported `ULFO` / LZFSE compression
by default. Current electron-builder 26.8.1 does not accept `ULMO` in
`dmg.format`; treating `ULMO` as a standard default would require a separate
postprocess patch, with focused proof that canonical `latest-arm64-mac.yml`,
the ZIP blockmap, and the DMG format/readability still match the published
assets. `latest-mac.yml` is a deliberate legacy alias only when published; a
DMG blockmap is not part of the required Standard public updater asset set.

GitHub Release public assets stay limited to install, updater, checksum, and
small machine-verification entrypoints. Release-note evidence, Full size
summaries, build timing, and workflow telemetry belong in Actions artifacts or
job summaries, not the public download list.

The Stable WebUI path builds the image once in the Docker smoke lane, verifies
the image locally, publishes that same image to GHCR, and leaves the GHCR lane
as a summary-verifier gate. Do not add a second Stable Docker build just to
separate smoke and publish reporting.
The standalone WebUI GHCR workflow must expose the same work as separate
prepare, build, inspect/readback, smoke, tag, publish, and upload steps. A
single long `Build, verify, and publish Docker WebUI` step is not acceptable
operator evidence because GitHub does not expose live step logs or partial
artifacts until the active step completes.

Desktop users get the AionUI shell through the App package itself. The
`one-person-lab-webui` container exists only for Docker/server deployment and
release smoke evidence; Framework package workflows must not publish it. The
container image is a preheated WebUI runtime image: it carries the WebUI shell,
launcher, bundled AionCore, bootstrap, image manifest, and optional seed
metadata so a user can open the browser quickly. User state, OPL runtime
maintenance receipts, Codex configuration, logs, cache, and managed runtime
state belong under the mounted `/data`; project files belong under `/projects`.
Image replacement updates the WebUI/container entry layer, while OPL Framework
owns managed reconciliation and module/toolchain updates inside `/data`.
The OPL Framework runtime artifact is a release gate under OPL Runtime Fabric:
the candidate must carry Framework artifact channel readback, artifact ref
readback, sha256 checksum evidence, and a rollback ref/receipt. The App consumes
those refs and checksums only. This gate does not authorize the App or Framework
to update the Docker/WebUI image from inside Docker; image replacement remains
the Installation Carrier host route.

## Preflight

Every release starts with `release-preflight`, backed by:

```bash
npm run release:preflight
```

The preflight checks version/mode compatibility, remote tag or release state,
workflow shape, release plan shape, shell/framework ref availability, Codex CLI
plus Darwin arm64 package metadata for VM-smoke runs, the Homebrew VM static
trust policy, stage-appropriate Homebrew tap token availability, and the
App-owned release contract. A failing preflight stops the release before
standard, Full, VM, Homebrew, WebUI, or publish jobs run.

Homebrew token absence is release-blocking only for a path that updates the tap
inside the current desktop release workflow, such as published-release
`refresh_existing`. A normal `new_release` creates and verifies a draft release
first; its Homebrew tap update belongs to the promote workflow after the draft
is published, so preflight must not block App assets, Full assets, or
Docker/WebUI candidate evidence on that token.

Promote must read back the just-published Stable release before it starts
Homebrew. The required readback is the remote `gh release view v<version>`
payload plus `refs/tags/v<version>`: non-draft, non-prerelease, latest,
published, and with readable assets. If GitHub publication visibility lags or
the tag/release binding drifts, the promote job retries briefly and fails at
that boundary instead of letting Homebrew fail later with an ambiguous
`release not found`.

Homebrew tap writes remain direct commits, not pull requests, but same
channel/version writes are serialized across Standard and Full casks. If the
tap main branch still advances between checkout and push, the workflow fetches
`origin/main`, rebases the local cask commit, and retries before classifying the
tap update as failed. A non-fast-forward tap push is a recoverable write
conflict, not release evidence failure.

Docker/WebUI releases are gated by Docker build, GHCR publish, and clean Linux
Docker runtime smoke. `docker_webui_clean_windows_evidence_artifact` is optional
diagnostic input; missing Windows evidence must not block a macOS App stable
release or a Docker/WebUI image release.

The source gate is the next fail-fast boundary after preflight:

```bash
npm run validate:release-boundary
npm run release:source-gate -- --version <version> --app-ref <app-sha> --shell-ref <shell-ref> --framework-ref <framework-ref>
```

`release:source-gate` is the App-owned source/readiness front door for the
candidate cohort. It must check App release-boundary policy, shell format/type,
active shell node/dom tests, shell source ref, and framework ref resolution
before expensive standard build, Full build, VM, Homebrew, or WebUI work starts.
If it fails, stop the train, repair the source gate, and dispatch a new cohort
after the pinned refs are valid. Do not wait for downstream build or VM jobs to
prove a source-gate failure again.

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

1. Run sync preparation outside the release train: update the OPL-family repos,
   run each repo's cheap owner/source gate, and resolve the candidate refs.
2. Freeze the candidate cohort by recording App SHA, shell ref plus resolved
   shell SHA, framework ref plus resolved framework SHA, release mode, Full
   intent, VM intent, owner refs, and any gate-reuse inputs.
3. Run preflight and `release:source-gate` for that pinned cohort.
4. Run the release workflow for the selected version/channel.
5. Produce standard and, when requested, Full artifacts plus the release
   evidence bundle.
6. Run remote verification against the published draft release assets.
7. Produce `release-candidate-record.json`.
8. Promote only when the promote workflow reads a ready candidate record for
   the same cohort.
9. Update Homebrew casks after the draft release is published and the matching
   policy assets exist.
10. Run post-release user-guide/screenshots only after promotion; they are never
   pre-promotion gates.

Nightly and candidate flows follow the same SSOT contract but do not imply stable/latest promotion.

The stable candidate is valid only for the pinned App/Shell/Framework SHA
cohort. If `main`, the active shell ref, or the framework ref advances after the
run starts, the old run is an obsolete/stale candidate. It can remain diagnostic
evidence for that old cohort, but it cannot continue as the current stable
candidate or be promoted as latest. Dispatch a new cohort instead of trying to
reinterpret old artifacts against newer source.
Moving `main`, shell `main`, and framework `main` are allowed only as
preparation-time ref-resolution sources. They are not final Stable release
inputs. The final train input is the pinned cohort lock: App SHA, shell SHA,
framework SHA, version, release mode, Full/VM intent, owner refs, and any
same-cohort reuse inputs.

Every desktop release run also uploads `release-actions-timing-<version>`. Use
that artifact to inspect workflow wall time, failed/canceled run tax, slow jobs,
and slow steps before opening raw job logs.

## No-Watch Operator Runbook

Do not watch a release page as the control loop. Use the operator readout as
the first status surface:

```bash
npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha> --summary
```

Interpret the result as follows:

- `stale_candidate`: stop waiting. The run head is not the expected App SHA;
  keep it only as old-cohort diagnostics and dispatch a new pinned cohort.
- `failed_gate_draining`: stop waiting for unrelated downstream work; inspect
  the primary blocker and repair that gate.
- `waiting_for_run_completion` with `Budget: within_budget`: wait or check the
  current job normally.
- `waiting_for_run_completion` with `Budget: attention`: the active job/step or
  run update age crossed the release-operator budget. Inspect the current step,
  runner availability, and workflow shape before continuing to wait.
- `ready_for_closeout_review`: inspect closeout, readiness, candidate record,
  and remote verification artifacts before any release-owner decision.

The 2026-06-29/30 stable attempt exposed two design traps that this runbook
guards against: a WebUI GHCR run can sit inside one opaque Docker step with no
downloadable live logs, and GitHub `updatedAt` may stop moving while the run is
still active. Operator elapsed time therefore uses the current read time for
active runs, not `updatedAt`, and the WebUI GHCR workflow is split into named
steps so the Actions job itself identifies the slow boundary.

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

The reusable VM workflow has two explicit `diagnostic_scope` values. Stable
release workflows use `release_gate`, which keeps the Codex install asset
preseed, Settings sweep, assistant route smoke, Codex functional check, and
Codex AI self-check on the deterministic gate path. The workflow also records
wrapper preflight diagnostics, the exact Tart smoke command, stdout and stderr
logs, and `tart-smoke-summary.json`. Those wrapper artifacts support debugging,
but the release gate still passes or fails on the deterministic VM readiness,
Settings, route, and Codex checks. The diagnostics workflow defaults to
`bootstrap_only`: it still resolves the supplied or same-run DMG, installs the
App, verifies the packaged main bootstrap marker, launches the App, and uploads
wrapper diagnostics, but skips Codex cache restore/prefetch/save and secondary
route checks so it does not occupy the release lane longer than necessary.
`bootstrap_only` artifacts are diagnostic-only and cannot be used as
release-ready, owner receipt, or runtime truth evidence.

Release VM gates must write the small critical failure summary
`vm-gate-failure-summary.json` and `vm-gate-failure-summary.md` before uploading
large screenshots, videos, or wrapper bundles. If the large VM artifact is
missing or its upload finalization fails, closeout should classify the evidence
gap as `diagnostic_artifact_missing` and recommend
`rerun_diagnostic_same_artifact`. That rerun must use the same release tag,
direct DMG URL, or `release_artifact_name` plus `release_artifact_run_id`; it is
diagnostic evidence only unless a release workflow explicitly consumes it as a
same-cohort gate.

Scheduled `OPL GUI First-Run VM` runs are maintenance diagnostics, not stable
release evidence. They default to `package_profile=standard` and
`diagnostic_scope=bootstrap_only`; before occupying the self-hosted VM runner
they check whether `OPL Desktop Release` is in progress or queued. If a release
is active, queued, or cannot be checked, the scheduled run exits from the
GitHub-hosted preflight with a skip summary instead of competing with the
release's standard, Full, or Homebrew VM gates.

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

Standard updater metadata is restricted to macOS arm64 standard assets. Full assets must never be written into `latest-arm64-mac.yml` or any deliberate legacy alias, and assets whose names include `Full` are not updater targets.

The standard updater follows Electron's background-download plus visible restart/install model. Download completion is not installation success. The release contract tracks `update_downloaded`, `update_apply_started`, `update_apply_completed`, and `running_version_switched` separately. After restart, the running App version must be greater than or equal to the downloaded target version; otherwise the shell records `auto-update-diagnostics.json#install-not-applied` and exposes a recovery action to install the downloaded update again or reveal the cached package.

The current macOS install path is App-managed local authorization: the ZIP must contain the expected `One Person Lab.app` bundle, the installer replaces the local App bundle, clears quarantine, records `codesign` / `spctl` diagnostics, and relaunches the App. The active-shell gate requires both the local authorized installer path and the post-restart `quit-and-install` / `install-not-applied` diagnostics so a release cannot regress to a download-only success claim.

The standard updater updates only the macOS App carrier variant. It does not update Runtime
Substrate, OPL Packages, Companion Tools, Codex Surface, Workflow Profile,
Developer Profile checkout sources, WebUI images, Homebrew/system tools, global
Codex, user artifacts, or domain readiness.

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

For ordinary users, clean managed OPL Packages and Codex Surface readiness are
the only background auto-apply targets. The legacy internal ids
`agent_package_channel` and `capability_exposure` may appear in contract JSON or
Framework readbacks, but user surfaces label them as OPL Packages and Codex
Surface readiness. If `opl update check` or `opl update plan` reports those
components as clean managed and updateable, the shell may call the Framework
runner to apply them and then display the recorded receipt refs, post-apply
hooks, skill/plugin sync result, and reload guidance. Installation Carrier updates and
OPL Runtime Fabric updates remain conservative: they can be checked, staged,
repaired, or shown as requiring restart, but the shell must not silently replace
the App bundle, replace Docker/WebUI images, switch runtime pointers, upgrade Homebrew/system tools, or
mutate developer / dirty checkouts.

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
`release-readiness-admission` reads `release-preflight.outputs.homebrew_tap_update_required`. When preflight says the tap update is required, the stable tap update, the Homebrew standard VM gate, and the Full tap update for Full releases must pass before readiness aggregation. When preflight says the tap update is not required, those Homebrew jobs may be `skipped`; readiness must not fail at the summary stage only because the tap was already current.

## Stable macOS Local Authorization

Stable macOS standard updater releases use App-managed local authorization. Paid Apple Developer ID signing, notarization, and `TeamIdentifier` are optional diagnostics for this lane, not release requirements.

Required local authorization evidence:

- `standard-local-authorization-policy.json` for standard assets.
- `opl-release-manifest.json#evidence.local_authorization_policy` for Full
  assets. Existing releases that still publish `full-local-authorization-policy.json`
  remain accepted during the transition.
- Remote ZIP extraction on a macOS runner.
- Embedded bundle version check.
- `codesign` / `spctl` diagnostics.
- Quarantine clearing evidence for installer/update launch paths.

Gatekeeper rejection is acceptable only when the Stable local authorization policy explicitly records that unsigned/ad-hoc bundles are allowed for the cohort.

## Full First-Install

Full first-install packaging policy is App-owned, but runtime dependency truth is OPL-owned. The App Full package consumes the OPL runtime bundle manifest, lock, env contract, and readback refs through `opl-release-manifest.json#manifest.opl_runtime_bundle_consumer`; it must not create a second dependency-truth contract. The upstream source surface is OPL Framework `contracts/opl-framework/runtime-environment-substrate-contract.json` and `opl runtime env contract|build|materialize --dry-run|run-context --json` readbacks.

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

Full public release assets are the Full DMG install carrier and
`opl-release-manifest.json`. The manifest consolidates the previous separate
Full package manifest, runtime cache events, runtime currentness probe, native
trust, local authorization policy, and package optimization evidence. Existing
releases that still expose those files separately remain accepted by remote
verification during the transition. Full assets are GitHub Release first-install
downloads and explicit stable `one-person-lab-full` cask inputs. They are not
standard updater targets.

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
from `opl-release-manifest.json#manifest`
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
`opl-release-manifest.json#manifest.package_optimization` and carries the trim
report and boundary audit under `#evidence.app_bundle_trim_report` and
`#evidence.package_boundary_audit`. Legacy `full-package-manifest.json`,
`full-app-bundle-trim-report.json`, and `full-package-boundary-audit.json`
release assets are accepted only as transition alternatives. This evidence can
prove explicit non-runtime pruning, payload boundary preservation, and
size-review release decoupling; it cannot replace the same-cohort Full clean VM
smoke, native trust evidence, remote asset readback, or release-owner receipt.
Full DMG warning/review-threshold status alone must not block stable clean
evidence unless a hard size limit, uncompressed runtime limit, offline payload
boundary, native trust, or Full clean VM gate fails.

Full runtime pruning is governed by
`contracts/full-runtime-prune-policy.json`. This is the single machine-readable
source for runtime tree filters, production dependency package filters, Node
toolchain package filters, expected pruned-path assertions, and validation
examples. The build scripts, cache key, Full manifest `runtime_prune_policy`,
runtime assertions, and `npm run release:full:prune-audit -- --markdown` derive
from that contract. Operators should run the prune audit before changing rules;
with `--runtime-root <path>` it reports excluded paths, largest excluded entries,
runtime assertions, and optional baseline diff.

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

Timing review must keep two clocks separate. Do not compare agent orchestration
wall time to GitHub Actions workflow wall time. GitHub Actions workflow wall
time is the release execution KPI; agent orchestration wall time includes
waiting on runs, artifact downloads, local readback, documentation, validation,
commit/push/cleanup, and tool/model round trips.

Track release profiling from the same cohort artifacts instead of reconstructing
it from chat or terminal scrollback:

- `workflow_wall_time_seconds` from GitHub Actions run timestamps: the workflow
  execution KPI.
- `agent_orchestration_wall_time_seconds` from `--agent-wall-time` or
  agent start/finish timestamps: the operator-loop KPI.
- Phase elapsed from job/step timing, `release-monitor.json#state`, and
  `recommended_next_action`: the one-screen blocker and next-action readout.
- DORA-style lead time: first accepted release-cohort SHA freeze to stable/latest
  publication or owner-recorded stop.
- DORA-style MTTR: first same-cohort failed gate or typed blocker to a passing
  same-cohort gate, diagnostic classification, owner resolution, or explicit
  abort.
- DORA-style change failure: same-cohort runs that fail a required gate, become
  stale, need owner-blocker resolution, or publish with post-publish follow-up.

Passing tests, green source gates, or a successful Docker/WebUI publish are
inputs to those metrics. They are not release-ready, stable/latest, runtime
truth, or owner-acceptance claims unless the same-cohort release artifacts and
release-owner refs support that exact claim.

This release flow intentionally folds external CI/CD practice into local owner
surfaces instead of importing a separate release system. DORA-style metrics are
derived only from same-cohort release artifacts; SRE-style monitoring is applied
as a simple no-watch operator readout that names the symptom, primary blocker,
and next action; GitHub Actions job/step timing and timeout boundaries are used
as phase budgets and diagnostics, while release truth remains the candidate
record, owner receipt, and same-cohort evidence.

Every desktop release run now produces the closeout by default in the final
`release-readiness-summary` job. That job writes and uploads
`release-closeout-<version>` with `release-closeout.json` and
`release-closeout.md` after `release-candidate-record.json` is written. The same
artifact also carries `release-monitor.json` and `release-notification.json`.
Use `release:operator status` and `release-monitor.json#state` (`running`,
`failed_gate_draining`, `failed`, `ready_to_promote`, or `published`, with
`published_with_post_publish_followup` when publication is complete but a later
proof gate failed) plus `recommended_next_action` as the no-watch operator
surface instead of leaving a terminal in `gh run watch`. Once a primary blocker
is known, stop watching: source-gate failures should return
`repair_source_gate`; stale cohorts should return `dispatch_new_cohort`; VM or
artifact diagnostic gaps should return a same-artifact diagnostic action. The
closeout reads the same local small
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

The standard clean VM smoke is the fail-fast gate for stable release trains. In
standard-only runs, `desktop-release.yml` runs
`standard-first-run-vm-smoke-after-standard-only` immediately after standard
asset publish and before remote verification, Homebrew updates, operator
evidence, or readiness aggregation. When `include_full_package=true` and
`run_vm_smoke=true`, it runs `standard-first-run-vm-smoke-after-full` before
Full package build, Full publish/remote verification, Homebrew updates,
operator evidence, or readiness aggregation. If the standard VM fails, stop at
that diagnostic artifact; the artifact should already include the early
bootstrap/native-modal summaries needed to classify launch blockers. Do not keep
queueing Full, Homebrew, operator evidence, or readiness jobs for the same
cohort.

The local command is the rerun/debug path for the same logic, not a separate
release step:

```bash
npm run release:closeout -- --version <version> --run-id <github-actions-run-id> --artifact-profile diagnostics --agent-wall-time <duration>
```

When run locally, the command writes ignored outputs under
`artifacts/release-closeout/v<version>-<run_id>/`, downloads only final summary
and diagnostic artifacts unless `--no-download` is passed, and can record the
Agent orchestration wall time with `--agent-wall-time <duration>`.

No-watch operator runbook:

1. Read the current run once:

   ```bash
   npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha> --output release-operator-state.json --markdown release-operator-state.md
   ```

2. Read the closeout monitor when the artifact exists:

   ```bash
   gh run download <github-actions-run-id> --repo gaofeng21cn/one-person-lab-app --name release-closeout-<version> --dir artifacts/release-closeout/v<version>-<github-actions-run-id>
   jq '{state, run: .run, next: .recommended_next_action, failed_gate_count, failed_job_count}' artifacts/release-closeout/v<version>-<github-actions-run-id>/release-monitor.json
   ```

3. Decide from one screen:
   `release-operator-state.json#status` or `release-monitor.json#state` gives
   the current phase (`running`, `failed_gate_draining`, `failed`,
   `stale_candidate`, `ready_to_promote`, `published`, or
   `published_with_post_publish_followup`); `run.workflow_wall_time_seconds` and
   job/step timings give elapsed time; `primary_blocker` or failed gate counts
   name the blocker; `recommended_next_action.action` and
   `recommended_next_action.command` name the next action.

4. Stop watching once the primary blocker or stale cohort is known. Use
   `gh run view --log-failed` only for the named blocker after structured
   state is missing or insufficient; do not keep an unbounded `gh run watch`
   open while downstream jobs drain. If the release process itself needs a fix
   mid-run, stop the old run and dispatch a new pinned cohort after the fix.
   Record the old run as `cancelled` or `superseded`, not as a source-gate
   failure.

Pinned cohort runbook:

1. Sync preparation:

   - Fetch and fast-forward each OPL-family repo that will contribute source,
     then run its cheap owner/source gate.
   - Resolve moving refs to immutable values: App SHA, shell ref plus shell
     SHA, and framework ref plus framework SHA.
   - Stop here for shell type/format/DOM failures, unresolved refs, dirty source
     checkouts, or release-boundary/source-gate failures. These are root causes
     to repair before dispatch, not reasons to start a full release train.

2. Write the cohort lock:

```bash
npm run release:cohort-lock -- --app-ref <app-sha> --shell-ref <shell-ref> --framework-ref <framework-ref> --output release-cohort-lock.json --markdown release-cohort-lock.md
npm run release:cohort-plan -- --version <version> --release-mode new_release --include-full-package true --run-vm-smoke true --output release-cohort-plan.json --markdown release-cohort-plan.md
```

The cohort lock records the immutable App/Shell/Framework SHA tuple. The cohort
plan embeds that lock with the release intent, cheap source gates, and typed
next action. For stable candidates, treat those refs as the frozen candidate
cohort: App SHA, shell SHA, and framework SHA must match all release-ready
evidence and the candidate record. Neither file is release evidence and neither
can publish, promote, or claim readiness.

3. Dispatch and observe through the controller:

```bash
npm run release:operator -- plan --version <version> --release-mode new_release --include-full-package true --run-vm-smoke true --output release-operator-state.json --markdown release-operator-state.md
npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha> --output release-operator-state.json --markdown release-operator-state.md
npm run release:operator -- diagnose-vm --version <version> --release-artifact-name <artifact> --release-artifact-run-id <run-id> --package-profile full --diagnostic-scope bootstrap_only --output release-operator-state.json --markdown release-operator-state.md
```

`release:operator` is a controller surface over existing scripts, workflows, and
artifacts. It may emit typed next actions such as
`rerun_diagnostic_same_artifact`, `repair_source_gate`,
`dispatch_new_cohort`, or `promote_candidate`; it must not become release truth,
write runtime/domain truth, or turn a diagnostic rerun into a release-ready
claim. The operator status path is primary-blocker first: after a critical gate
failure it should report `failed_gate_draining` while downstream already-queued
jobs settle, then `failed`, instead of asking the release owner to keep waiting
on `gh run watch`.

4. Handle stale or draining runs:

   - `failed_gate_draining` means the release decision has already stopped on a
     primary blocker while queued jobs finish or artifact upload settles. Wait
     only for cleanup/artifact finalization; do not infer readiness from later
     unrelated job success.
   - `stale_candidate` means the run head or pinned source refs no longer match
     the cohort lock. Keep its artifacts as old-cohort diagnostics only. Do not
     promote it, patch it into a newer cohort, or use it as current release
     evidence.
   - `cancelled` and `superseded` are typed operator outcomes for
     stop-and-redispatch. They preserve old-run diagnostics and failed-run tax,
     but they do not prove a source gate failed.
   - Source-gate blockers are repaired at the source gate. A stale App head,
     unresolved shell/framework ref, wrong shell type/format, dirty source
     checkout, or missing release-boundary policy should lead to
     `repair_source_gate` or `dispatch_new_cohort`, not another broad release
     dispatch.

When a run's `headSha` no longer matches the expected App SHA, or when a newer
same-version cohort supersedes it, treat the old run as stale. Its artifacts and
logs can remain diagnostic background for the old cohort, but they cannot be
promoted, patched into the new cohort, or reinterpreted as current release
evidence. Re-freeze App/Shell/Framework refs, run the cohort plan again, and
dispatch a new cohort.

Desktop stable, WebUI GHCR, and diagnostics are separate lanes. Desktop stable
owns the App package, updater metadata, Full first-install path, Homebrew gates,
same-cohort candidate record, and stable/latest promotion. WebUI GHCR owns only
the preheated container image publish and image smoke evidence; it does not
replace desktop install evidence or promote a desktop stable candidate.
Diagnostics lanes are read-only or temporary-artifact harness runs for blocker
classification; they can recommend repair or rerun actions but cannot publish,
promote, update Homebrew, or convert old evidence into the current stable
cohort.

For example, Desktop Release run `28391573356` is desktop-stable evidence:
preflight and source gate passed, then the standard clean VM smoke failed and
the workflow fail-fast gate skipped Full, WebUI, Homebrew, evidence, and
readiness jobs. WebUI GHCR run `28391599033` is WebUI/container evidence:
its failure is a Docker/WebUI runtime image publish failure after its own source
gate passed. Do not label that WebUI GHCR failure as an App source-gate failure
or as a desktop stable install blocker unless a same-cohort desktop gate
actually fails.

Use `desktop-release-diagnostics.yml` for harness-only diagnosis before
starting another full release train. It can run the first-run VM harness against
a published `release_tag`, a direct `release_dmg_url`, or a
`release_artifact_name` from an existing `release_artifact_run_id` via
`actions/download-artifact@v8` with `run-id`. That
workflow is read-only: it may upload `release-diagnostics-*` and
`opl-first-run-vm-<profile>-<run_id>` diagnostic artifacts. If explicitly
requested, it may build a temporary standard DMG diagnostic artifact for the VM
harness only. It must not rebuild Full packages, publish releases, update
Homebrew, write owner receipts, or claim release-ready.

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

Release-doc validation:

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
