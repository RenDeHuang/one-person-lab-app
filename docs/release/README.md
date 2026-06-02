# App Release

Owner: `one-person-lab-app`
Purpose: `app_release_docs`
State: `active`
Machine boundary: Human-readable release guide. Use
`contracts/app-release-channel.json`, release assets, and updater metadata for
machine decisions.

The App repository owns the macOS arm64 standard desktop package, Full
first-install DMG, updater metadata, GitHub Release uploads, release asset
normalization, GUI smoke, and user-facing release notes.

First-install product policy is App-owned. The launch gate is `ready_to_launch`
before `/guid`, and Core means workspace root, Codex CLI, and Codex config. A
Full first-install package must reach Core ready from the bundled runtime on a
clean Mac even when Apple Command Line Tools, Homebrew, Node, and Git are
absent. After Core ready, domain modules, the family runtime provider,
recommended skills, native helpers, repository sync, module reconcile, CLT
installation, companion skills install, and ecosystem module updates are Full
readiness or best-effort background maintenance after `ready_to_launch`; they
cannot block first launch.
Standard packages bundle the App installer as the standard bootstrap carrier.
On a clean Mac where `opl` is missing, first launch runs that carrier as an
App-managed core setup with modules, GUI open, native-helper repair, and online
family runtime install disabled, then proves `ready_to_launch` through
`opl system initialize --json` before `/guid`. The first screen must not end by
telling the user to install Homebrew, Node, or Git before One Person Lab can
proceed.

All first-install variants share the same progress model. Full DMG, standard
App bootstrap, CLI one-shot install, and Docker/WebUI status surfaces consume
`opl system initialize --json` and its `system_initialize.setup_flow` payload for
phase, Core completed/total count, Full readiness completed/total count,
background maintenance completed/total count, blockers, and next visible step.
Release evidence should prove that mapping; it should not introduce a separate
installer-local progress authority.

The first-run GUI presents that model as a novice-facing launch screen. The
default visible state is limited to the simplified readiness summary, three
setup steps, Core progress, the primary entry action, and the next visible user
step. Technical phase names, refresh controls, runtime settings, raw errors,
maintenance actions, Full readiness, and background maintenance remain available
inside collapsed technical details by default.

The standard updater policy follows Electron's documented autoUpdater pattern:
standard assets use background download, the App prompts for restart only after
the update is downloaded, and the restart/install step is user visible. See
Electron's [Updating Applications](https://www.electronjs.org/docs/latest/tutorial/updates)
guide and [`autoUpdater`](https://www.electronjs.org/docs/latest/api/auto-updater)
API notes for the background-download, `update-downloaded`, and
`quitAndInstall()` flow. Full first-install assets are never written into
`latest*.yml` updater metadata and are not an updater target. The standard
updater updates desktop App assets only; it does not update OPL module packages,
select Developer Mode checkouts, publish the WebUI image, or install `opl-flow`.
Module packages stay under Framework/App maintenance through the stable GHCR
package channel, while GitHub repo/local checkout sources are an explicit
Developer Mode path.

Apple Command Line Tools are a system-owned installation path. The App may
request the installer with `xcode-select --install`, but macOS presents the
installer and requires the user to confirm before CLT is installed. See Apple's
[Installing the command-line tools](https://developer.apple.com/documentation/xcode/installing-the-command-line-tools/)
documentation. CLT remains deferred maintenance; Core ready stays on the
bundled runtime while Settings resumes Git-backed and module maintenance.

The OPL Framework repository is a payload source for the Full DMG
runtime/CLI/contracts layer. It does not own App release workflows.
It may reference the public WebUI image coordinate, but the App repo owns
publishing `ghcr.io/<owner>/one-person-lab-webui:<app_or_opl_version>` and the
stable/latest/nightly tag semantics. The App workflow builds the image with the
OCI source label `org.opencontainers.image.source=https://github.com/gaofeng21cn/one-person-lab-app`
so GitHub Packages can associate the package with the App repository.
For an existing personal GHCR package, that source label is not enough to move
the package repository association or grant workflow write access. The
`one-person-lab-webui` package settings should be associated with
`gaofeng21cn/one-person-lab-app` through the package settings `Connect
repository` surface, and must grant `gaofeng21cn/one-person-lab-app` write
access under GitHub Packages `Manage Actions access`. Without that package-side
grant, App workflows fail at `docker push` with
`permission_denied: write_package` even when the workflow has `packages: write`.
GitHub's public package REST and GraphQL surfaces can read/delete/restore package
versions but do not provide a stable automation endpoint for these personal
package association or Actions-access settings; treat the package settings UI as
the source of truth for those two gates.

The active shell source is `gaofeng21cn/opl-aion-shell`. It is consumed as an
external checkout at `shells/aionui` and is not tracked in the clean App repo
history.

`contracts/app-product-profile.json` is the release-time source of App-owned
desktop defaults. Standard release preparation and Full first-install assembly
sync it into the active shell `shell_contract.paths.product_profile_target`
declared in `contracts/app-shell-adapter.json` before shell packaging. This keeps product decisions such as Codex
model/reasoning, default companion skills, CLT/deferred-maintenance copy, and
Settings presentation policy in the App repo while the shell stays a thin
consumer.

`contracts/app-install-exposure-policy.json` is the release-time source of
App-owned install/exposure policy. Stable installation proof must show that all
install surfaces derive progress from `opl system initialize --json` and that
Codex-visible domain entries do not fork semantics: MAS/MAG/RCA are
plugin-packaged domain skills backed by OPL Framework plugin registry refresh,
not duplicate companion skill mirrors, while shared companion skills are synced
through their own App/CLI-managed path.

## GitHub Actions release path

Use **OPL Desktop Release** from the GitHub Actions tab for App-owned release
builds that should run on GitHub runners instead of this Mac.

- `release_mode=refresh_existing` rebuilds standard macOS arm64 assets, validates
  updater metadata, uploads them to the existing `v<opl_version>` release with
  clobber semantics, then optionally builds and publishes the Full first-install
  assets.
- `release_mode=new_release` builds the same assets, creates and pushes the
  `v<opl_version>` tag from the workflow commit, creates the GitHub Release, and
  optionally adds the Full first-install assets after the standard release exists.
- `release_mode=draft_candidate` builds the same assets into a draft
  `v<opl_version>` Release. Use **OPL Desktop Release Promote** after reviewing
  the draft assets and verification summary.
- **OPL Desktop Release Cleanup Drafts** removes stale candidate Releases after
  the stable `v<opl_version>` Release has been published. It only inspects
  GitHub Release metadata, defaults to dry-run, and deletes matching
  `v<version>-draft.*` and `v<version>-readiness.*` draft Releases with their
  tags when `dry_run=false`.
- Release workflows use GitHub Actions concurrency groups by version and
  purpose. Stable desktop release runs share a stable `v<opl_version>` group and
  do not cancel running jobs; GitHub keeps the newest pending run in that group
  so repeated dispatches do not build a stale queue. Draft candidates,
  standalone remote verification, draft promotion, scheduled Full cache warmup,
  and `dev` branch legacy builds cancel older in-progress runs because they are
  refreshable operator lanes.
- Release and build workflows declare
  `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` at top-level `env`. This is the
  App release policy for checked-in JavaScript actions such as checkout,
  setup-node, artifact, and cache actions, reducing exposure to GitHub Actions
  Node 20 deprecation while keeping packaged App Node versions and release
  readiness logic unchanged.
- `include_full_package=true` delegates to the Full first-install workflow so the
  slower runtime/package assembly runs on GitHub Actions with the runtime layer
  cache.
- `run_vm_smoke=true` is the stable release installation profile. It runs the
  standard DMG clean-VM smoke, Full DMG clean-VM smoke when Full is included,
  the App one-shot installer smoke, Docker/WebUI HTTP smoke, and App-owned WebUI
  GHCR publish after release assets are uploaded. Leave it off only for draft or
  emergency packaging refreshes that are not being treated as stable-complete.
- Scheduled **OPL Nightly Standard Release** builds and publishes standard
  macOS arm64 assets only. It creates a semver prerelease tag such as
  `v26.5.27-nightly`, marks the Release as prerelease, does not mark it
  as latest, excludes Full first-install assets, runs remote standard asset
  verification after upload, and publishes
  `ghcr.io/<owner>/one-person-lab-webui:<app_or_opl_version>` plus the `nightly`
  tag from the App workflow. Its release notes compare against the previous
  Nightly and explain the main user-visible changes in grouped prose. Users only
  see this channel after opting into prerelease/Nightly updates in the App.
- The VM smoke downloads the published DMG for the selected package profile,
  clones a clean no-CLT Tart base VM, fixes the logical display at
  `1920x1080px`, copies the GitHub runner's Node.js runtime into the guest for
  the smoke harness, and sweeps the packaged Settings pages. The standard
  profile checks launch and App-managed bootstrap readiness. The Full profile
  also submits the Codex/OpenAI API key configuration wizard and checks Full
  runtime readiness after `ready_to_launch`. CLT installation, git availability,
  preinstalled Node.js, and managed repo sync are deferred maintenance; domain
  modules, the family runtime provider, recommended skills, native helpers,
  repo sync, CLT, and ecosystem updates must not block the pre-`/guid` Core
  launch gate. The smoke must capture first-run screenshots and run a layout
  gate that proves technical details are collapsed by default and the novice
  first screen is not dominated by phase/debug/maintenance controls. The Full
  clean first-run CDP screenshot is also the source for
  `screenshots/full.png`, and the Runtime page dry-run action evidence capture
  writes `screenshots/action.png` plus `runtime-action-evidence.json` for the
  release evidence bundle. This VM workflow is deterministic
  release-blocking evidence for stable release readiness. When
  `--codex-functional-check` is enabled, the same VM smoke writes
  `artifacts/codex-functional-check-summary.json` as a post-install functional
  receipt for Codex behavior: UI language, App-managed `opl-flow` context,
  user `AGENTS.md` non-override policy, Codex CLI detection, MAS/MAG/RCA route
  receipts, and skill/plugin visibility. The receipt is deterministic and does
  not call an external LLM; missing Codex credentials remain diagnostic state,
  not a network dependency. The `opl-flow` context is injected as localized,
  session-scoped Codex preset context and never mutates the user's workspace
  `AGENTS.md`. With `--codex-ai-self-check`, the smoke then asks Codex CLI to
  read that deterministic evidence plus the target installed working mode and
  write `artifacts/codex-ai-self-check-summary.json`. That is the AI-first
  post-install inspection: programmatic initialization proves the App is
  installed, and Codex CLI judges whether the installed OPL workflow matches the
  intended `opl-flow`, language, AGENTS.md, agent-route, plugin/skill, and module
  update continuity policies. The default mode is read-only `diagnose`; it is
  optional diagnostic evidence and is not the stable blocking release gate.
  The same AI-first concept also has a user-visible App entry: when real
  first-run initialization reaches `ready_to_launch`, or when the user clicks
  the ready entry on the First Run page, the App opens `/guid` with a localized
  Codex task prefilled. That task tells Codex CLI to inspect the installed OPL
  working mode after programmatic initialization, covering Codex CLI callability,
  localized `opl-flow` session context, user `AGENTS.md` non-overwrite policy,
  MAS/MAG/RCA routing, OPL Meta Agent capability, Codex skills/plugins, and
  module-update continuity. It starts as read-only diagnosis and must ask for
  user confirmation before any repair command or file mutation.
  Codex App and Computer Use browser/desktop sessions are allowed only as non-blocking
  exploratory triage; if they reveal release-relevant behavior, the finding
  must be captured as a deterministic contract, workflow, or script gate before
  it can block promotion or be used to clear a release.
- Scheduled **OPL GUI First-Run VM** runs use a dedicated GitHub Actions
  concurrency group with `cancel-in-progress` enabled, so nightly clean-VM
  backlog collapses to the newest scheduled run instead of occupying the
  self-hosted Tart runner for stale release checks. Manual dispatches and
  release-called VM gates use a separate serialized group and are not cancelled
  by the scheduled queue policy; they remain the explicit operator validation
  path.
- Scheduled VM smoke requires repository variable `OPL_FIRST_RUN_TART_SOURCE`
  to name a local Tart base VM on the self-hosted runner. The current runner
  source is `opl-first-run-no-clt-clean-base-26-5-18`. Missing configuration is
  a failed VM gate, not a skipped success. Set `OPL_FIRST_RUN_GUEST_USER` when
  the guest SSH user differs from `runner`, and set `OPL_FIRST_RUN_GUEST_SSH_KEY`
  only when the runner needs a non-default SSH private key. The current source
  VM logs in as `admin` with `/Users/gaofeng/.ssh/opl_first_run_tart_ed25519`
  on the self-hosted runner.

The older automatic path is still valid for standard-only releases: pushing a
`v<version>` tag triggers **Build and Release**. After that completes, run
**OPL Full First-Install Release** with `publish_to_release=true` if the release
also needs Full first-install assets.

Use **OPL Remote Release Verification** when an existing Release needs a fresh
remote audit without rebuilding. It downloads the published assets, checks
GitHub asset size and `sha256:` digest, validates standard updater metadata,
and, when Full is included, checks `SHA256SUMS.txt`, the Full manifest boundary,
and English-only Full companion text.

## Purpose-based release validation

Nightly and stable releases intentionally run different validation profiles.
Nightly is a fast standard-updater confidence lane: release-boundary contract,
standard macOS arm64 build, local standard asset validation, prerelease upload
with `--latest=false`, remote standard asset verification, and App-owned WebUI
GHCR image publish for `ghcr.io/<owner>/one-person-lab-webui:<app_or_opl_version>`
plus the `nightly` tag, with the App repository OCI source label. It does not build Full assets and does not require
clean VM, one-shot installer, Docker/WebUI smoke, or operator evidence gates.

Stable is the complete user-install proof lane. Before a stable App Release is
treated as smooth, it must cover standard DMG clean-VM installation, Full DMG
clean-VM installation, the public App one-shot installer, Docker/WebUI through
HTTP, App-owned WebUI GHCR image publish for
`ghcr.io/<owner>/one-person-lab-webui:<app_or_opl_version>` with `stable` and
`latest`, remote verification for standard and Full assets, and the operator
evidence bundle. The heavy gates are grouped by installation surface so failures
say which user path is broken instead of producing one vague release failure.
Stable validation covers standard DMG, Full DMG, one-shot installer, and
Docker/WebUI evidence as separate installation surfaces, then publishes the
WebUI image from the App workflow after HTTP smoke passes. The published image
must carry `org.opencontainers.image.source=https://github.com/gaofeng21cn/one-person-lab-app`.

The final stable decision entry is the `release-readiness-summary` job in
`.github/workflows/desktop-release.yml`. It runs after the selected remote
verification, standard/Full clean-VM gates, one-shot installer smoke,
Docker/WebUI smoke, WebUI GHCR publish, and evidence bundle validation, then writes
`release-readiness-summary.json` plus a GitHub Step Summary. It fails closed
when any required gate result or small evidence artifact is failed, cancelled,
missing, or unexpectedly skipped.

That final summary is a diagnostic reader, not another package consumer. It
downloads only small artifacts: remote verification JSON, VM smoke summaries,
one-shot installer output, Docker/WebUI smoke output, WebUI GHCR publish
summary, Full diagnostics, and `full-workflow-telemetry.json`. It must not
download the standard DMG artifact,
the large Full DMG workflow artifact, or published DMG assets for diagnosis.
Full build bottleneck analysis uses `duration_seconds.full_package_build` and
`duration_seconds.full_package_build_breakdown` from telemetry, while manifest,
SHA256SUMS, remote verification, and VM gates remain release truth.
The Full workflow also caches active-shell Vite output as a speed aid. A cache
hit enables `--reuse-gui-vite-output`, which passes `--skip-vite` to the shell
build so the Full package can reuse the already bundled main/preload/renderer
output. A cache miss keeps the normal full shell build path and saves the Vite
output for the next run. The Vite cache key includes the release version because
the shell bundle embeds `OPL_RELEASE_VERSION`, and it excludes packager-only
script/config inputs that do not change Vite output. The workflow separately
caches Electron/Electron Builder downloads and records that hit status in
telemetry. These caches are never release truth; DMG verification, manifest
generation, checksums, remote verification, and VM gates still decide release
readiness.

For the one-shot installer gate, `release-readiness-summary.json`
`gates.one_shot_app_installer.fields` records the public entry command
`./install.sh --complete --skip-modules`, the bootstrap status source
(`one-shot-app-installer-smoke` job result), the initialization command
`opl system initialize --json`, the initialization source
`system_initialize.setup_flow`, and the small artifact file
`opl-one-shot-system-initialize.json`. It also exposes the safely extracted
setup flow status, phase, Core/Full/maintenance progress, blockers, next visible
step, `retry_detected`, and `skip_modules` as machine-readable fields. The
Markdown summary mirrors the key one-shot entry, source, artifact, setup flow,
Core progress, retry, and skip-module values for operator triage.

The Full first-install payload must include the latest npm-published Codex CLI,
the packaged Bun CLI, the Temporal CLI, and the Temporal-backed family runtime
provider. The Full workflow resolves the current `@openai/codex` version with
`npm view @openai/codex version`, installs that exact version, records
`OPL_FULL_CODEX_VERSION`, and verifies `codex --version`. It also exports the
resolved `OPL_FULL_BUN_BIN` and `OPL_FULL_TEMPORAL_CLI_BIN` paths before runtime
cache-key calculation and package assembly, so the manifest records
`components.bun` and `components.temporal_cli` from the packaged runtime. The
Full package stores the official `temporalio/cli` macOS arm64 release archive
under `vendor/temporal/` and exposes it through `bin/temporal`; the wrapper
expands the archive locally inside the installed runtime cache, so first-run
setup does not need network access and the DMG does not carry the much larger
Homebrew-expanded Temporal binary.
Temporal runtime packages stay in the Framework production dependency payload,
`@temporalio/testing` is excluded, and the remote verifier requires the Full
manifest to report only the macOS arm64 Temporal core bridge release.

The Runtime page is the operator evidence acceptance path for App release
evidence. It consumes OPL refs-only JSON from
`opl app state --profile fast --json`, refreshes through the same fast App state
surface, keeps `opl app state --profile full --json` for explicit full-state
release evidence, lazy-loads full detail through `opl runtime
app-operator-drilldown --detail full --json`, and executes selected
safe action routes through `opl app action execute`. The App records and displays
those refs; it does not become runtime truth, provider implementation, domain
truth, artifact authority, or quality verdict owner.

GUI release readiness is App-contract first. `contracts/app-gui-product-contract.json`
owns the user-visible GUI requirements and mirrors the stable/nightly gate sets
from `contracts/app-release-channel.json`; `contracts/app-shell-adapter.json`
requires the active shell to implement that contract. Shell implementation or
upstream AionUI changes do not redefine release readiness without an App-owned
contract, docs, and test update.

Each release evidence bundle should follow
`contracts/app-release-channel.json` `operator_evidence_bundle` and contain:

- `evidence-manifest.json`.
- `app-state-summary.json`.
- `app-state-full.json` and `drilldown-full.json`.
- `action-dry-run-result.json` and `action-execute-result.json`.
- `screenshots/runtime.png`, `screenshots/full.png`, and
  `screenshots/action.png`.
- `tart-smoke-summary.json`.
- `artifacts/smoke-summary.json`.
- `artifacts/assistant-route-smoke-summary.json`.
- `artifacts/codex-functional-check-summary.json`.
- Optional diagnostic: `artifacts/codex-ai-self-check-summary.json`.
- `remote-release-verification.json`.

Generate or refresh the manifest after collecting available artifacts:

```bash
node --experimental-strip-types scripts/collect-release-evidence.ts \
  --bundle-dir release-evidence/<version> \
  --action-id <opl-runtime-safe-action-id> \
  --execute-action \
  --overwrite \
  --evidence-source-dir artifacts/opl-first-run-vm \
  --artifact runtime_screenshot=/path/to/runtime.png

npm run release:evidence:manifest -- \
  --bundle-dir release-evidence/<version> \
  --overwrite
```

If a cohort has a real owner-visible typed blocker or an artifact is not
applicable to that cohort, record that explicitly in a small classification
file and pass it to the manifest writer:

```json
{
  "artifact_classifications": [
    {
      "id": "first_run_vm_summary",
      "status": "typed_blocker",
      "reason": "clean VM host is unavailable for this cohort",
      "typed_blocker_ref": "github-actions:opl-first-run-vm#blocked-no-runner"
    },
    {
      "id": "guest_smoke_summary",
      "status": "not_applicable",
      "reason": "draft evidence cohort did not package a launchable app",
      "not_applicable_reason": "draft_evidence_only_no_packaged_app"
    }
  ]
}
```

```bash
npm run release:evidence:manifest -- \
  --bundle-dir release-evidence/<version> \
  --classification release-evidence/<version>/artifact-classifications.json \
  --overwrite
```

The collector writes only OPL-owned runtime snapshot, summary/full
App/operator drilldown, and selected safe-action dry-run/execute JSON. It does
not create screenshots, VM first-run summaries, guest smoke summaries,
assistant route smoke summaries, remote Release verification, runtime truth,
domain truth, artifact authority, or quality verdicts; absent App/VM/remote
artifacts remain `missing` in the manifest unless the cohort explicitly records
`typed_blocker` or `not_applicable`. These non-present statuses are reportable
evidence classifications, not packaged App evidence.

Validate a collected bundle with:

```bash
npm run release:evidence:validate -- \
  --bundle-dir release-evidence/<version>
```

Default validation fails closed when required evidence is absent. If a VM smoke
summary, guest smoke summary, assistant route smoke summary, screenshot, OPL
runtime JSON, or remote Release artifact could not be produced in the current
environment, keep that artifact marked as `missing`, `typed_blocker`, or
`not_applicable` in `evidence-manifest.json` and run:

```bash
npm run release:evidence:validate -- \
  --bundle-dir release-evidence/<version> \
  --allow-missing-evidence
```

That output is a missing-evidence report only. It is not packaged App release
evidence and must not be used to claim that a published App bundle, Full DMG,
clean first-run VM path, packaged Settings navigation, packaged Codex assistant
route, or remote Release has been verified.

Use **OPL Full Runtime Cache Warmup** before release windows or let its scheduled
run keep the content-addressed Full runtime layer cache warm. It builds the
runtime layers on GitHub Actions without publishing a Release, so later Full
packaging spends less time rebuilding shared payloads locally. Warmup runs use a
cancel-in-progress concurrency group because only the latest warm cache matters;
Stable Full packaging keeps `cancel-in-progress=false` and emits both a step
summary and `full-workflow-telemetry.json` JSON artifact for cache
hit/miss and step-duration telemetry. Full runs also upload
`opl-full-diagnostics-<version>`, a small JSON/text artifact containing
`full-workflow-telemetry.json`, `full-package-manifest.json`,
`runtime-cache-events.json`, `SHA256SUMS.txt`, and the Full README so operators
can inspect cache status, manifest commits, and recorded hashes without
downloading the 500 MB class Full DMG. Warmup disables the large
`opl-full-first-install-<version>-mac-arm64` workflow artifact; release-called
Full builds keep that artifact enabled because downstream publish and VM jobs
need the actual DMG.

## Local commands

Release candidate plan:

```bash
npm run release:plan -- --version <version> --include-full-package
```

The plan output separates fast candidate checks, parallel build lanes, the
clean no-CLT VM gate, and the final publish step. Use it as the release runbook
for new versions so standard and Full builds can run concurrently while publish
stays serialized.

```bash
npm run ensure:shell
npm run release:prepare-standard
npm run build-mac:arm64
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
npm run release:publish -- --version <version> --repo gaofeng21cn/one-person-lab-app
```

Full first-install DMG:

```bash
OPL_FULL_RUNTIME_CACHE_MODE=readwrite \
OPL_FRAMEWORK_ROOT=/Users/gaofeng/workspace/one-person-lab \
OPL_FULL_META_AGENT_ROOT=/Users/gaofeng/workspace/opl-meta-agent \
  npm run release:full -- --version <version>
npm run release:publish -- \
  --version <version> \
  --repo gaofeng21cn/one-person-lab-app \
  --full-package-only \
  --include-full-package
```

Full runtime payload assembly uses a content-addressed layer cache by default
under `~/Library/Caches/One Person Lab/full-runtime-layers`. The layer keys cover
the toolchain, domain runtime modules, OPL runtime, skills, packager inputs, and
runtime exclusion policy. Use `--print-runtime-cache-keys` for a fast
preflight. GitHub Actions derives the outer cache key only from the stable
`aggregate_key_input`, records each layer's key inputs in diagnostics, then
restores and saves each runtime layer independently,
so a changed domain or OPL commit does not force Actions to download or rewrite
unchanged toolchain or skills archives. Release version stamps and runner-local
cache paths do not invalidate otherwise identical layer archives. The MinerU
helper binary uses the MinerU source commit time in its embedded build metadata
so the toolchain layer key is not polluted by the current Actions run time. Full
artifacts include `runtime-cache-events.json` for per-layer hit/miss evidence and
for the key-input fields that explain why a layer missed. Use
`OPL_FULL_RUNTIME_CACHE_MODE=readonly` to consume existing layers without
writing, or `OPL_FULL_RUNTIME_CACHE_MODE=off` for a clean rebuild.
Release readiness summarizes this cache evidence into readable layer counts;
`miss_written` names layers that were rebuilt and written back to the cache, so
the next optimization pass can focus on changed layer keys without opening the
raw event JSON first.

## Full size policy

The Full first-install package is allowed to be materially larger than the
standard updater DMG because it carries the declared offline runtime payload.
Release review should track three size surfaces for every Full build:

- compressed DMG size: the GitHub Release asset size for
  `One-Person-Lab-Full-<version>-mac-arm64.dmg`.
- uncompressed runtime size: the installed
  `One Person Lab.app/Contents/Resources/opl-full-runtime` payload size.
- layer breakdown: the manifest/runtime-cache split for framework runtime,
  domain runtime modules, companion tools, skills, and packaging metadata.

The remote verifier size budget is the release-time guardrail for both the
published compressed asset and the packaged runtime payload. With Full included,
`scripts/verify-remote-release-assets.ts` requires manifest v2, enforces
`platform_scope=macos-arm64`, checks the GitHub Full DMG asset size against
the `600MB warning threshold` and the hard budget
`max_full_dmg_bytes=650000000`, and checks
`size_breakdown.total_runtime_uncompressed_bytes` against
`max_runtime_uncompressed_bytes=950000000`. It also compares the GitHub asset
size against the downloaded file size and the recorded `sha256:` digest. Treat
size growth as acceptable only when it is explained by an intentional layer
change, not by duplicated checkouts, stale runtime payloads, or standard-updater
leakage.
When the Full DMG is above `warning_full_dmg_bytes=600000000` and still at or
below `max_full_dmg_bytes=650000000`, the release readiness summary remains
`passed` and records a warning in both JSON and the GitHub Step Summary. Above
the hard budget, remote verification still fails closed.

Run the local size analyzer after a Full build, or read its GitHub Actions step
summary:

```bash
npm run release:full:size -- --markdown
```

Full runtime packaging follows a hygiene-first policy before any domain-specific
runtime allowlist exists. The App packager excludes local indexes, dependency
caches, test folders, and user/runtime state such as `.codegraph`, `.git`,
`.worktrees`, `.venv`, `node_modules`, `runtime`, `runtime-state`, `runs`,
`sessions`, and `tests`. This is an App-owned distribution boundary only: App
packaging may remove local development state, but it must not decide which MAS,
MAG, RCA, or OPL Meta Agent source, prompt, contract, or asset is domain truth.
Any narrower runtime allowlist must be declared by the owning domain repository
and then consumed by the App packager as a contract.

The current size-control design is one step, not a separate research phase:

- package only the standard updater assets for Nightly.
- build Full only for Stable or explicit Full refreshes.
- keep Full runtime layers content-addressed and warm before release windows.
- record component, layer, compressed DMG, and uncompressed runtime sizes on
  every Full build.
- fail remote verification when published assets exceed the manifest budgets.
- treat new large components as acceptable only when the manifest shows the
  intentional owner and layer that grew.

The speed design is one release graph, not separate manual phases:

- Nightly publishes only standard updater assets.
- Stable starts standard and Full builds as early as their gates allow.
- Standard DMG VM, one-shot installer, and Docker/WebUI start after the standard
  assets are published.
- WebUI GHCR publish starts only after Docker/WebUI HTTP smoke passes; draft
  candidates record the intended tags without pushing.
- Full assets publish only after the standard release exists and the Full build
  artifact is available.
- Full remote verification and Full DMG VM stay on the Full path.
- workflow lint, cache hit/miss, step-duration telemetry, and size summaries are
  audit surfaces only; manifest, SHA256SUMS, remote verification, and size
  budget checks still run every time.
- Full cache/timing telemetry is uploaded as `full-workflow-telemetry.json` so
  release operators can compare cache hits and step durations across runs before
  tuning cache keys or test matrix width.
- Runtime cache event summaries surface `miss_written` layer names and counts in
  `release-readiness-summary.json`; this is tuning telemetry, not a release
  authority replacement.
- Shared active-shell setup/cache blocks use a local composite action when the
  reuse is exact and release semantics stay visible in the workflow jobs.

Publishing to an existing tag is intentional for Full first-install refreshes:
`scripts/publish-release.ts` uses `gh release upload --clobber`, so the same
`v<version>` tag can receive rebuilt Full assets after the standard App release
already exists. Use `--full-package-only --include-full-package` for that lane;
it updates the Full release-note section and overwrites matching Full assets
without rebuilding or replacing standard updater assets.

After a stable same-day replacement is published, clean stale candidate draft
Releases explicitly instead of downloading large assets for inspection:

```bash
npm run release:cleanup-drafts -- \
  --version <version> \
  --repo gaofeng21cn/one-person-lab-app \
  --summary-path release-draft-cleanup-summary.json

npm run release:cleanup-drafts -- \
  --version <version> \
  --repo gaofeng21cn/one-person-lab-app \
  --summary-path release-draft-cleanup-summary.json \
  --execute
```

The cleanup script fails closed unless `v<version>` is a published stable
Release. It matches only draft Releases named `v<version>-draft.*` or
`v<version>-readiness.*`, deletes them with `--cleanup-tag`, and writes a JSON
summary artifact. The workflow wrapper, **OPL Desktop Release Cleanup Drafts**,
uses the same script and should be run first with the default dry-run setting.

GitHub Actions standard refreshes use the same publish script with
`--standard-artifacts-dir release-assets`, which publishes the already-built
standard assets from the workflow artifact download instead of rebuilding the
App inside the publish job.

For new same-day versions, prefer a new tag such as `v26.5.19` over deleting and
replacing a previous release. The publish script is resumable: existing release
assets are skipped only when the asset name, size, and GitHub `sha256:` digest
all match the local file. Assets with missing or different digests are uploaded
with `--clobber`. Pass
`--force-upload` only when the release operator intentionally wants to overwrite
all matching asset names.

Uploads run one asset per `gh release upload` command, starting with the largest
assets and then sorting by name. That keeps large DMG/ZIP failures explicit in
operator logs and lets a retry skip any assets that already reached the release
with matching size and digest.

When `release:publish` creates a new draft or Release in the current invocation
and asset upload fails, it deletes that newly-created incomplete Release with
`gh release delete <tag> --cleanup-tag` before returning the upload error. This
cleanup is limited to releases created by the current publish attempt; existing
release refreshes and Full-only refreshes are not deleted on upload failure.

Boundary guard:

```bash
npm run test:release-boundary
npm run validate:release-boundary
```

Standard updater metadata is restricted to macOS arm64 standard package assets.
Full first-install packages must be explicitly named with `Full` and must not
be referenced from `latest*.yml`.
Nightly standard releases use the same standard asset boundary, plus a
prerelease semver tag, `--latest=false`, and no Full first-install payload.
Both Stable and Nightly release notes are generated through
`scripts/generate-release-notes.ts`: Stable compares with the previous Stable
release, Nightly compares with the previous Nightly prerelease, and repeated
channel boilerplate is excluded from the body. Public GitHub Release notes are
English-only and must include the bundled OPL-family agent payloads when a Full
package is published: MAS, MAG, RCA, OPL Meta Agent, OfficeCLI, and MinerU.
The same boundary guard fails closed when any release workflow drops the
top-level `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` policy.

Full companion text assets, including `README-Full-First-Install.txt`, are
English-only release assets. Keep those generated strings professional and free
of Chinese copy so GitHub Release downloads, checksums, and manual diagnostic
instructions present a single public language surface.

Release notes should name the user-visible validation scope when assets are
rebuilt after packaging smoke. For Full first-install refreshes, include the
clean no-CLT VM lane, settings-page coverage, deferred CLT handling, and the
current Codex default profile applied by the packaged App session path.

Standard release builds run `scripts/prepare-standard-release-payload.ts`
before packaging so stale Full runtime payloads cannot leak into standard App
assets and the App product profile is refreshed in the active shell.

Full first-install builds run the same profile sync after runtime payload
assembly and before the GUI build. The generated Full manifest records
`distribution.product_profile_contract=contracts/app-product-profile.json` so
release assets can be traced back to the App-owned contract.

CLT handling is a deferred macOS system installation path: the App requests
`xcode-select --install`, waits for the user to confirm in Apple's installer,
and keeps Core ready on the bundled runtime while Settings resumes any pending
Git-backed maintenance. `officecli`, MinerU, and `opl-meta-agent` are ecosystem
modules managed through App/CLI maintenance, not shell-owned implementation
requirements. Companion skills are managed the same way. App updates download
in the background and prompt for restart after the update is ready; Full
first-install assets remain separate release downloads and are not updater
metadata.

2026-06-01 release policy: the App release channel owns WebUI GHCR publishing.
Stable desktop release workflows publish
`ghcr.io/<owner>/one-person-lab-webui:<app_or_opl_version>`, `stable`, and
`latest` after Docker/WebUI HTTP smoke passes. Nightly publishes
`<app_or_opl_version>` and `nightly`. Both lanes label the image source as
`https://github.com/gaofeng21cn/one-person-lab-app`. The Framework only references this image
coordinate. Full DMG payload assembly must not include the WebUI GHCR image, and
standard updater metadata remains restricted to standard macOS arm64 App assets.
The existing `one-person-lab-webui` GHCR package must separately grant write
Actions access to `gaofeng21cn/one-person-lab-app` from the package settings
page and should be connected to `gaofeng21cn/one-person-lab-app` so the GitHub
Packages page no longer presents the WebUI package as Framework-owned. If the
write gate is missing, the WebUI GHCR publish artifact records
`ghcr_write_package_denied`; fix the package settings gate and rerun the Nightly
or stable workflow rather than moving publishing back to the Framework. WebUI
GHCR retention keeps `latest`, `stable`, `nightly`, the recent stable/nightly
version windows declared in `contracts/app-release-channel.json`, and declared
rollback tags. Deleting package versions is a separate dry-run-first admin
operation with package admin / `delete:packages` permission; it is not part of
ordinary App release publishing.

When the GitHub Packages page is filtered by `repo_name=one-person-lab`, a
historical package association can still show `one-person-lab-webui` beside
Framework packages. That page grouping is not release authority. The live release
authority is the App workflow result plus package tags such as
`<app_or_opl_version>`, `stable`, `latest`, or `nightly`; the page association
should be corrected through the package settings UI when an admin is available.

The `gaofeng21cn/one-person-lab` and `gaofeng21cn/opl-aion-shell` GitHub
Release lists should stay empty so App release ownership has a single remote
entry point.
