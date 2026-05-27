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

The standard updater policy follows Electron's documented autoUpdater pattern:
standard assets use background download, the App prompts for restart only after
the update is downloaded, and the restart/install step is user visible. See
Electron's [Updating Applications](https://www.electronjs.org/docs/latest/tutorial/updates)
guide and [`autoUpdater`](https://www.electronjs.org/docs/latest/api/auto-updater)
API notes for the background-download, `update-downloaded`, and
`quitAndInstall()` flow. Full first-install assets are never written into
`latest*.yml` updater metadata and are not an updater target.

Apple Command Line Tools are a system-owned installation path. The App may
request the installer with `xcode-select --install`, but macOS presents the
installer and requires the user to confirm before CLT is installed. See Apple's
[Installing the command-line tools](https://developer.apple.com/documentation/xcode/installing-the-command-line-tools/)
documentation. CLT remains deferred maintenance; Core ready stays on the
bundled runtime while Settings resumes Git-backed and module maintenance.

The OPL Framework repository is a payload source for the Full DMG
runtime/CLI/contracts layer. It does not own App release workflows.

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
- Release workflows use GitHub Actions concurrency groups by version and
  purpose. Stable desktop release runs share a stable `v<opl_version>` group and
  do not cancel running jobs; GitHub keeps the newest pending run in that group
  so repeated dispatches do not build a stale queue. Draft candidates,
  standalone remote verification, draft promotion, scheduled Full cache warmup,
  and `dev` branch legacy builds cancel older in-progress runs because they are
  refreshable operator lanes.
- `include_full_package=true` delegates to the Full first-install workflow so the
  slower runtime/package assembly runs on GitHub Actions with the runtime layer
  cache.
- `run_vm_smoke=true` is the stable release installation profile. It runs the
  standard DMG clean-VM smoke, Full DMG clean-VM smoke when Full is included,
  the App one-shot installer smoke, and Docker/WebUI HTTP smoke after release
  assets are uploaded. Leave it off only for draft or emergency packaging
  refreshes that are not being treated as stable-complete.
- Scheduled **OPL Nightly Standard Release** builds and publishes standard
  macOS arm64 assets only. It creates a semver prerelease tag such as
  `v26.5.27-nightly.20260527`, marks the Release as prerelease, does not mark it
  as latest, excludes Full first-install assets, and runs remote standard asset
  verification after upload. Users only see this channel after opting into
  prerelease/Nightly updates in the App.
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
  launch gate. This VM workflow is deterministic
  release-blocking evidence for stable release readiness. Codex App and
  Computer Use browser/desktop sessions are allowed only as non-blocking
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
with `--latest=false`, and remote standard asset verification. It does not build
Full assets and does not require clean VM, one-shot installer, Docker/WebUI, or
operator evidence gates.

Stable is the complete user-install proof lane. Before a stable App Release is
treated as smooth, it must cover standard DMG clean-VM installation, Full DMG
clean-VM installation, the public App one-shot installer, Docker/WebUI through
HTTP, remote verification for standard and Full assets, and the operator
evidence bundle. The heavy gates are grouped by installation surface so failures
say which user path is broken instead of producing one vague release failure.
Stable validation covers standard DMG, Full DMG, one-shot installer, and
Docker/WebUI evidence as separate installation surfaces.

The Full first-install payload must include the latest npm-published Codex CLI
and the Temporal-backed family runtime provider. The Full workflow resolves the
current `@openai/codex` version with `npm view @openai/codex version`, installs
that exact version, records `OPL_FULL_CODEX_VERSION`, and verifies `codex
--version`. Temporal runtime packages stay in the Framework production
dependency payload, `@temporalio/testing` is excluded, and the remote verifier
requires the Full manifest to report only the macOS arm64 Temporal core bridge
release.

The Runtime page is the operator evidence acceptance path for App release
evidence. It consumes OPL refs-only JSON from
`opl app state --profile fast --json`, refreshes through
`opl app state --profile full --json`, lazy-loads full detail through
`opl runtime app-operator-drilldown --detail full --json`, and executes selected
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
- `remote-release-verification.json`.

Generate or refresh the manifest after collecting available artifacts:

```bash
node --experimental-strip-types scripts/collect-release-evidence.ts \
  --bundle-dir release-evidence/<version> \
  --action-id <opl-runtime-safe-action-id> \
  --execute-action \
  --overwrite

npm run release:evidence:manifest -- \
  --bundle-dir release-evidence/<version> \
  --overwrite
```

The collector writes only OPL-owned runtime snapshot, summary/full
App/operator drilldown, and selected safe-action dry-run/execute JSON. It does
not create screenshots, VM first-run summaries, guest smoke summaries, remote Release
verification, runtime truth, domain truth, artifact authority, or quality
verdicts; absent App/VM/remote artifacts remain `missing` in the manifest.

Validate a collected bundle with:

```bash
npm run release:evidence:validate -- \
  --bundle-dir release-evidence/<version>
```

Default validation fails closed when required evidence is absent. If a VM smoke
summary, guest smoke summary, screenshot, OPL runtime JSON, or remote Release
artifact could not be produced in the current environment, keep that artifact marked as
`missing` in `evidence-manifest.json` and run:

```bash
npm run release:evidence:validate -- \
  --bundle-dir release-evidence/<version> \
  --allow-missing-evidence
```

That output is a missing-evidence report only. It is not packaged App release
evidence and must not be used to claim that a published App bundle, Full DMG,
clean first-run VM path, packaged Settings navigation, or remote Release has been verified.

Use **OPL Full Runtime Cache Warmup** before release windows or let its scheduled
run keep the content-addressed Full runtime layer cache warm. It builds the
runtime layers on GitHub Actions without publishing a Release, so later Full
packaging spends less time rebuilding shared payloads locally. Warmup runs use a
cancel-in-progress concurrency group because only the latest warm cache matters;
Stable Full packaging keeps `cancel-in-progress=false` and emits both a step
summary and `full-workflow-telemetry.json` JSON artifact for cache
hit/miss and step-duration telemetry.

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
`aggregate_key_input`, then restores and saves each runtime layer independently,
so a changed domain or OPL commit does not force Actions to download or rewrite
unchanged toolchain or skills archives. Release version stamps and runner-local
cache paths do not invalidate otherwise identical layer archives. The MinerU
helper binary uses the MinerU source commit time in its embedded build metadata
so the toolchain layer key is not polluted by the current Actions run time. Full
artifacts include `runtime-cache-events.json` for per-layer hit/miss evidence. Use
`OPL_FULL_RUNTIME_CACHE_MODE=readonly` to consume existing layers without
writing, or `OPL_FULL_RUNTIME_CACHE_MODE=off` for a clean rebuild.

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
`max_full_dmg_bytes=550000000`, and checks
`size_breakdown.total_runtime_uncompressed_bytes` against
`max_runtime_uncompressed_bytes=800000000`. It also compares the GitHub asset
size against the downloaded file size and the recorded `sha256:` digest. Treat
size growth as acceptable only when it is explained by an intentional layer
change, not by duplicated checkouts, stale runtime payloads, or standard-updater
leakage.

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
- Full assets publish only after the standard release exists and the Full build
  artifact is available.
- Full remote verification and Full DMG VM stay on the Full path.
- workflow lint, cache hit/miss, step-duration telemetry, and size summaries are
  audit surfaces only; manifest, SHA256SUMS, remote verification, and size
  budget checks still run every time.
- Full cache/timing telemetry is uploaded as `full-workflow-telemetry.json` so
  release operators can compare cache hits and step durations across runs before
  tuning cache keys or test matrix width.
- Shared active-shell setup/cache blocks use a local composite action when the
  reuse is exact and release semantics stay visible in the workflow jobs.

Publishing to an existing tag is intentional for Full first-install refreshes:
`scripts/publish-release.ts` uses `gh release upload --clobber`, so the same
`v<version>` tag can receive rebuilt Full assets after the standard App release
already exists. Use `--full-package-only --include-full-package` for that lane;
it updates the Full release-note section and overwrites matching Full assets
without rebuilding or replacing standard updater assets.

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

2026-05-17 release policy: the stable App release channel publishes macOS arm64
standard update assets only. Docker/WebUI support is validated separately
against the Framework runtime surfaces; it is not a desktop release asset lane.

The `gaofeng21cn/one-person-lab` and `gaofeng21cn/opl-aion-shell` GitHub
Release lists should stay empty so App release ownership has a single remote
entry point.
