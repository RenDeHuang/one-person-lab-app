# App Root Scripts

The root `scripts/` directory exposes App-level wrappers. The active Electron
shell implementation is checked out from `gaofeng21cn/opl-aion-shell` and
exposes its shell-specific helpers under `shells/aionui/scripts/`.
By default wrappers read `contracts/app-shell-adapter.json`. AionUI is the
mainline GUI carrier, Hermes Desktop / `hermes-codex` is the only foreground
alternative, and AGUI / `agui-codex` is archived technical proof rather than a
routine implementation, validation, or polish lane. Technical
verification can select a different linked shell repo with
`OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/<candidate>.json`;
AGUI selection should happen only when AGUI replay is explicitly requested.

| Script | Purpose |
| --- | --- |
| `ensure-active-shell.ts` | Clones or validates the selected external shell checkout, defaulting to `shells/aionui`. |
| `verify.sh` | App-root verification wrapper for smoke, active-shell, release-boundary, candidate-shell, structure, and full lanes without running release packaging by default. |
| `validate-active-shell.ts` | Validates the selected shell adapter contract and runs selected validation commands. |
| `validate-shell-candidates.ts` | Validates the foreground GUI alternative from `contracts/app-shell-candidates.json` by default. Hermes Desktop is the only foreground alternative; archived AGUI proof is checked only with `--candidate agui-codex`. Selectable candidates are packageable only through an explicit adapter contract env override and must emit a real `.app` bundle manifest. |
| `prepare-release-assets.ts` | Calls the active shell release asset normalizer from the App root. |
| `validate-release.ts` | Verifies release assets and enforces that standard updater metadata excludes Full first-install assets. |
| `verify-remote-release-assets.ts` | Downloads GitHub Release assets and verifies remote size, sha256 digest, updater metadata, Full manifest, Full README language, Full checksums, and Full size budgets. |
| `generate-release-notes.ts` | Generates English, channel-aware release notes: Stable compares with the previous Stable release, Nightly compares with the previous Nightly prerelease, release names use `One Person Lab v<version>`, both group changes by user purpose, and notes include OPL-family repo changes plus Full payload versions when available. |
| `cleanup-draft-release-candidates.ts` | Dry-runs or deletes stale `v<version>-draft.*` and `v<version>-readiness.*` draft Releases after the stable release exists. |
| `cleanup-webui-ghcr-versions.ts` | Dry-runs or deletes stale `one-person-lab-webui` GHCR package versions according to the App release-channel retention policy. |
| `install-docker-webui.sh` | Linux/macOS Bash entrypoint for starting the Docker/WebUI image with host `/data` and `/projects` mounts through `docker compose`; Ubuntu may install Docker Engine, while macOS only checks for an existing Docker runtime. After compose startup it waits for the local HTTP endpoint and can write a diagnostic directory or `.tar.gz` package without accepting API keys. |
| `install-docker-webui.ps1` | Windows PowerShell one-click Docker/WebUI installer that writes `compose.yaml`, creates persistent `OnePersonLab` data/projects directories, runs `docker compose up`, waits for the local HTTP endpoint, and can write a diagnostic directory or archive without accepting API keys. |
| `docker-webui-smoke-gate.ts` | Repo-native Docker/WebUI smoke gate runner for clean Linux VM, clean Windows VM, existing Docker, and old data-dir gates. It writes a typed blocker when the current host cannot prove the requested gate instead of returning a false pass. |
| `validate-docker-webui-diagnostics.ts` | Validates installer diagnostic directories for required files, data preservation evidence, and secret-like markers. |
| `publish-release.ts` | Creates or refreshes App GitHub Release assets from local shell output, prebuilt standard assets, and optional Full first-install assets. |
| `plan-release-candidate.ts` | Prints the Nightly or Stable release lane plan, including purpose-based installation gates, Stable candidate-record promotion, and post-release guide refresh with `npm run docs:macos-guide` from `docs/delivery/user-guides/macos-app-install` sources into `docs/public`. |
| `closeout-release-run.ts` | Powers the default desktop release `release-closeout-<version>` artifact and local reruns; reads only final small release summaries, writes `release-closeout.json/md`, separates GitHub Actions workflow wall time from Agent orchestration wall time, and points the operator at candidate blockers, failed gates, promotion, or log inspection. |
| `summarize-github-actions-timing.ts` | Profiles one or more `gh run view --json ...jobs` payloads, including multi-run span, failed/canceled run tax, slow jobs, slow steps, and the operator-loop gap when an Agent wall-time clock is supplied. |
| `plan-release-gate-reuse.ts` | Compares the current release cohort with a previous promote-ready candidate record, readiness summary, and remote verification artifact, then writes `opl_release_gate_reuse_plan.v1` with per-gate `reuse_allowed` / `must_run` decisions and a stable reuse digest. The plan is a decision artifact only; workflow gates still run unless a workflow explicitly consumes it. |
| `release-cohort-lock.ts` | Resolves App, shell, and Framework refs into `opl_app_release_cohort_lock.v1` with immutable SHAs. It is a preparation record only and cannot dispatch, publish, promote, claim readiness, or write runtime truth. |
| `plan-release-cohort.ts` | Writes `opl_app_release_cohort_plan.v1` for a Stable train: version, release mode, embedded cohort lock, Full/VM intent, cheap source gates, and the typed next action that consumes fixed App/Shell/Framework SHAs. |
| `release-operator.ts` | Thin no-watch controller over existing release scripts, workflows, and artifacts. It can write `release-operator-state.json/md`, report structured status from GitHub run JSON, classify stale, draining, cancelled, or superseded runs, and emit typed next actions such as `repair_source_gate`, `dispatch_new_cohort`, `rerun_diagnostic_same_artifact`, `provide_owner_receipt`, or `promote_candidate`; it is the only no-watch status entrypoint and is not release truth. |
| `summarize-release-readiness.ts` | Aggregates small Stable gate artifacts and job results into `release-readiness-summary.json` and Markdown without downloading large DMG artifacts. |
| `validate-release-candidate-record.ts` | Validates or summarizes `release-candidate-record.json`; promotion requires schema `opl_release_candidate_record.v1`, matching version, `status=ready_to_promote`, and `decision.can_promote=true`. |
| `analyze-full-package-size.ts` | Reads `full-package-manifest.json` and reports Full runtime component/layer size, budget use, and optional runtime-root top entries. |
| `collect-release-evidence.ts` | Collects live OPL runtime snapshot, App/operator drilldown, selected safe-action dry-run/execute JSON, and standard smoke source-dir artifacts into a release evidence bundle, writes the manifest, and validates the bundle in missing-evidence mode without claiming absent screenshot, VM, settings, or remote evidence. |
| `write-release-evidence-manifest.ts` | Writes `evidence-manifest.json` for a release evidence bundle and marks absent VM/remote artifacts as missing evidence. |
| `validate-release-evidence-bundle.ts` | Validates a release evidence bundle manifest and artifact files, including real screenshot dimensions; default validation fails closed when required evidence is missing. |
| `smoke-hermes-candidate-tart.ts` | Runs the packaged `One Person Lab Hermes Candidate.app` first-run fixture smoke inside a Tart clean VM, copying guest artifacts back to the App repo. This is candidate technical verification only and does not promote Hermes to the release shell. |

Stable App-root npm entries are `verify`, `validate:release-boundary`,
`validate:gui-shell`, `test:smoke`, `test:full`, `release:evidence:manifest`,
`release:evidence:validate`, and `hygiene:fallow`. `npm test` aliases the smoke
entry so ordinary development does not run the full active-shell DOM portfolio;
full shell Vitest evidence remains explicit through `npm run test:full`,
`scripts/verify.sh full`, and the active-shell validation contract. These keep
release boundary/evidence scripts visible as production entrypoints while the
files remain thin App-owned wrappers around contracts and release artifacts.
App-root fallow config excludes
`shells/aionui/**` and `shells/agui-codex/**` because those paths are ignored
external shell checkouts.
`hygiene:fallow` is not GUI shell build or runtime evidence; `validate:gui-shell`
runs the full active shell validation list and the shell GUI compile path
through App wrappers. Run shell hygiene in `gaofeng21cn/opl-aion-shell`.

Docs generation commands read `docs/delivery/user-guides/macos-app-install`
guide sources and write the public bundle under
`docs/public/macos-app-install/`.

Examples:

```bash
node --experimental-strip-types scripts/ensure-active-shell.ts
scripts/verify.sh
scripts/verify.sh structure
scripts/verify.sh release-boundary
npm run test:smoke
npm run test:full
node --experimental-strip-types scripts/validate-active-shell.ts --quick
node --experimental-strip-types scripts/validate-active-shell.ts --only i18n_types,i18n_check,typecheck
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
npm run release:publish -- --no-build --version <version> --standard-artifacts-dir release-assets
npm run release:notes -- --version <version> --channel stable --include-full-package
npm run release:notes -- --version <YY.M.D-nightly> --channel nightly
npm run verify-remote-release -- --version <version> --include-full-package
npm run verify-remote-release -- --version <YY.M.D-nightly>
npm run release:cleanup-drafts -- --version <version>
npm run release:cleanup-drafts -- --version <version> --execute
npm run release:cleanup-webui-ghcr -- --summary-path webui-ghcr-cleanup.json
npm run release:cleanup-webui-ghcr -- --rollback-tag <version> --execute
npm run validate:release-boundary
npm run release:evidence:manifest -- --bundle-dir release-evidence/<version>
node --experimental-strip-types scripts/collect-release-evidence.ts --bundle-dir release-evidence/<version> --action-id <opl-runtime-safe-action-id> --execute-action --overwrite --evidence-source-dir artifacts/opl-first-run-vm --artifact runtime_screenshot=/path/to/runtime.png
npm run release:evidence:validate -- --bundle-dir release-evidence/<version>
npm run hygiene:fallow -- --format json --summary
npm run validate:gui-shell
npm run validate:shell-candidates -- --candidate hermes-codex --run-candidate-commands
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/hermes-codex.json npm run package
# Explicit AGUI replay only:
npm run validate:shell-candidates -- --candidate agui-codex
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
npm run smoke:hermes-candidate:tart -- --no-graphics --artifacts artifacts/hermes-candidate-tart-<timestamp> --timeout-ms 600000
npm --prefix shells/hermes run smoke:settings-visual -- --allow-foreground --out out/smoke-settings-visual
npm run release:plan -- --version <version> --profile nightly
npm run release:plan -- --version <version> --include-full-package
npm run release:closeout -- --version <version> --run-id <github-actions-run-id> --artifact-profile diagnostics --agent-wall-time <duration>
npm run release:actions-timing -- --run-id <github-actions-run-id> --run-id <promote-run-id> --agent-wall-time <duration> --output actions-timing.json --markdown actions-timing.md
npm run release:gate-reuse-plan -- --version <version> --release-mode refresh_existing --include-full-package true --run-vm-smoke true --app-commit <sha> --shell-ref <ref> --framework-ref <ref> --current-preflight release-preflight-summary.json --current-remote-verification remote-release-verification.json --previous-candidate-record previous-release-candidate-record.json --previous-readiness previous-release-readiness-summary.json --previous-remote-verification previous-remote-release-verification.json --output release-gate-reuse-plan.json --markdown release-gate-reuse-plan.md
npm run release:cohort-lock -- --app-ref <app-sha> --shell-ref <shell-ref> --framework-ref <framework-ref> --output release-cohort-lock.json --markdown release-cohort-lock.md
npm run release:cohort-plan -- --version <version> --release-mode new_release --include-full-package true --run-vm-smoke true --app-commit <app-sha> --shell-ref <shell-ref> --framework-ref <framework-ref> --output release-cohort-plan.json --markdown release-cohort-plan.md
npm run release:operator -- plan --version <version> --release-mode new_release --include-full-package true --run-vm-smoke true --app-commit <app-sha> --shell-ref <shell-ref> --framework-ref <framework-ref> --output release-operator-state.json --markdown release-operator-state.md
npm run release:operator -- status --run-id <github-actions-run-id> --expected-head <app-sha> --output release-operator-state.json --markdown release-operator-state.md
npm run release:operator -- diagnose-vm --version <version> --release-artifact-name <artifact> --release-artifact-run-id <run-id> --package-profile full --diagnostic-scope bootstrap_only --output release-operator-state.json --markdown release-operator-state.md
npm run release:readiness-summary -- --version <version> --release-mode new_release --include-full-package true --run-vm-smoke true --artifacts-dir <downloaded-small-artifacts-dir> --job-results release-readiness-job-results.json --output release-readiness-summary.json --markdown release-readiness-summary.md
npm run release:candidate-record -- --version <version> --release-mode new_release --preflight release-preflight-summary.json --readiness release-readiness-summary.json --remote-verification remote-release-verification.json --release-owner-receipt-ref <release_owner_receipt_ref>
npm run release:candidate-record:validate -- --version <version> --record release-candidate-record.json
npm run release:candidate-record:status -- --record release-candidate-record.json --format json
npm run release:owner-candidate-record:verify -- --version <version> --owner-record docs/delivery/release/records/v<version>-release-owner-receipt.json --artifacts-dir artifacts/release-closeout/v<version>-<run-id>/artifacts
npm run release:full:size -- --markdown
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-no-clt-clean-base --dmg dist/standard-release/One-Person-Lab-<version>-mac-arm64.dmg --smoke-profile no-clt-clean-vm --display 1920x1080px --settings-smoke --assistant-route-smoke --runtime-profile standard --codex-package-tarball artifacts/opl-first-run-vm/codex-package-tarballs/openai-codex.tgz --codex-platform-package-tarball artifacts/opl-first-run-vm/codex-package-tarballs/openai-codex-darwin-arm64.tgz --codex-npm-cache-dir artifacts/opl-first-run-vm/codex-npm-cache
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-no-clt-clean-base --dmg dist/opl-full-release/One-Person-Lab-Full-<version>-mac-arm64.dmg --smoke-profile no-clt-clean-vm --display 1920x1080px --settings-smoke --assistant-route-smoke --runtime-profile full --codex-package-tarball artifacts/opl-first-run-vm/codex-package-tarballs/openai-codex.tgz --codex-platform-package-tarball artifacts/opl-first-run-vm/codex-package-tarballs/openai-codex-darwin-arm64.tgz --codex-npm-cache-dir artifacts/opl-first-run-vm/codex-npm-cache
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-homebrew-ready-base --install-mode homebrew-cask --homebrew-cask gaofeng21cn/one-person-lab/one-person-lab --smoke-profile homebrew-standard-cask --display 1920x1080px --settings-smoke --assistant-route-smoke --runtime-profile standard --codex-package-tarball artifacts/opl-first-run-vm/codex-package-tarballs/openai-codex.tgz --codex-platform-package-tarball artifacts/opl-first-run-vm/codex-package-tarballs/openai-codex-darwin-arm64.tgz --codex-npm-cache-dir artifacts/opl-first-run-vm/codex-npm-cache
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-no-clt-clean-base --dmg dist/standard-release/One-Person-Lab-<version>-mac-arm64.dmg --smoke-profile no-clt-clean-vm --display 1920x1080px --runtime-profile standard
OPL_INSTALL_SCRIPT_URL=file:///path/to/one-person-lab/install.sh ./install.sh --complete --skip-modules
docker build -t one-person-lab-webui:<version> shells/aionui
```

For shell alternatives, `npm run validate:shell-candidates` covers the foreground
Hermes Desktop alternative by default. `agui-codex` is archived technical proof
and is validated only with `--candidate agui-codex`. When AGUI replay is
explicitly requested, `npm run validate:shell-candidates -- --candidate agui-codex --run-candidate-commands`
expects the selected package command to produce
`out/agui-codex-candidate-manifest.json` with `candidate_app_bundle_ready`,
`explicit_candidate_app_bundle`, and a relative `.app` bundle path whose bundle
contains `Contents/Info.plist` and a `Contents/MacOS` executable. A `.txt` smoke
output is intentionally rejected.
Hermes candidate validation is non-foreground by default: the App-root
candidate command chain may build the `.app` and run packaged first-run smoke,
but it must not run screenshot capture or focus the user's active desktop.
Packaged Settings visual smoke is manual/VM evidence only and requires
`--allow-foreground`; prefer Tart/VM for that command when the maintainer is
using the Mac.

`release:prepare-standard` also copies the App root installer into the active
shell resources as `opl-install.sh`, which is the packaged standard DMG
bootstrap carrier used when clean first launch cannot find `opl`.

Full size policy lives in
`contracts/app-release-channel.json#full_first_install.size_budget` and the Full
manifest `size_budget`; size semantics, measured records, profile boundaries,
runtime boundaries, and optimization priority live in
`contracts/app-release-channel.json#full_first_install.size_policy`;
`docs/delivery/release/README.md` is the operator map. Release review records the
compressed DMG size, uncompressed runtime size, and layer breakdown, then uses
`verify-remote-release-assets.ts` as the remote verifier size budget check for
published GitHub Release assets. The remote verifier measures compressed Full
DMG bytes from the GitHub asset size and uncompressed runtime bytes from
`full-package-manifest.json`
`size_breakdown.total_runtime_uncompressed_bytes`. The Full size analyzer keeps
compressed DMG warning, review threshold, and optional hard limit status
separate: crossing the review threshold records `requires_review`; only an
explicit hard limit records a release-blocking compressed-DMG failure.
`npm run release:full:size -- --markdown` prints the same component and layer
breakdown plus manifest size hotspots for local review and is appended to the
Full GitHub Actions summary. Stable Full release builds use UDZO with zlib level
9 by default for the App-owned DMG path; set
`OPL_FULL_DMG_COMPRESSION_LEVEL=<1-9>` only for an explicit diagnostic override.
The `750000000`-byte Full DMG threshold is a review trigger, not permission to
remove required offline first-install payloads. The v26.6.21 measured contract
record shows a `1121919153`-byte Full DMG, a `440471386`-byte standard DMG, and
a zlib level 9 estimate of `844079932` bytes, so compression tuning alone is not
enough to return under the review threshold.
The Full workflow also uploads `full-workflow-telemetry.json`, a machine-readable
cache/timing artifact for post-release bottleneck review; use it as tuning input,
not as release truth.
For remote diagnosis, prefer the small `opl-full-diagnostics-<version>` artifact.
It contains `full-workflow-telemetry.json`, `full-package-manifest.json`,
`runtime-cache-events.json`, `SHA256SUMS.txt`, and the Full README, so operators
can compare recorded hashes, manifest commits, and runtime layer cache status
without downloading the large Full DMG. Warmup runs disable the large Full
package artifact; release-called Full builds keep it enabled for publish and VM
consumers.
`scripts/summarize-release-readiness.ts` also flattens
`runtime-cache-events.json` into readable cache counts and `miss_written` layer
names in `release-readiness-summary.json`, making fresh cache writes visible in
the final release summary.
Full packaging pruning is governed by
`contracts/full-runtime-prune-policy.json`. That contract is the single
machine-readable source for runtime tree filters, production dependency package
filters, Node toolchain package filters, expected pruned-path assertions,
validation examples, and the external practice refs behind the policy. The
builder, cache key, manifest `runtime_prune_policy`, runtime assertions, and
policy audit command all derive from this contract.

The policy excludes local development indexes, dependency caches, tests, and
runtime/user state such as `.codegraph`, `.git`, `.worktrees`, `.venv`,
`node_modules`, `runtime`, `runtime-state`, `runs`, `sessions`, and `tests`.
It also prunes non-runtime build and report output such as `.github`, `.next`,
`.turbo`, `storybook-static`, `playwright-report`, `test-results`, coverage
directories, and source maps. Production `opl/node_modules` packages are copied
through a narrower filter that removes package tests/docs/fixtures/examples,
snapshots, reports, caches, and `*.map` files while keeping runtime JS, schemas,
assets, and native binaries. Domain-specific allowlists must come from the
owning domain repositories.
The explicit prune policy is recorded in
`full-package-manifest.json` as `runtime_prune_policy`, and
`runtime_assertions.prune_policy_hash` is part of the Full runtime cache key.
Node's global npm/corepack payload is copied through the same non-runtime
policy for package docs/man pages/tests/fixtures/examples, while `node`,
`npm`, and `npx` remain offline executables. Python keeps headers and
`ensurepip` for offline native-extension build/debug support, but stdlib test
suites and bytecode caches are excluded. The manifest also records
`runtime_assertions.offline_required_payloads` and
`runtime_assertions.declared_pruned_paths`; use those fields to audit that
Codex and Temporal archives, Node/Python/uv, officecli, mineru, domain modules,
and packaged skills stayed local instead of becoming lazy downloads.
Run `npm run release:full:prune-audit -- --markdown` before changing prune
rules. With `--runtime-root <path>`, it also reports currently excluded paths,
largest excluded entries, runtime assertions, and optional baseline diff.

The clean first-install gates are wired through
`.github/workflows/opl-first-run-vm.yml` and the active shell Tart smoke helper.
It supports `package_profile=standard`, `package_profile=full`, and
`package_profile=homebrew-standard`. The standard profile resolves
`One-Person-Lab-*-mac-arm64.dmg` excluding Full assets and runs
`--runtime-profile standard`; the Full profile resolves
`One-Person-Lab-Full-*-mac-arm64.dmg` and runs `--runtime-profile full`. The
Homebrew profile starts from a clean Homebrew-ready Tart base, runs
`brew install --cask gaofeng21cn/one-person-lab/one-person-lab`, then opens
`/Applications/One Person Lab.app` through the same packaged-app smoke. The
fully qualified cask ref is the trust-scoped CI/user install path; do not
replace it with broad tap trust or a bare cask token in release gates.
Release workflows pass a same-run workflow artifact for the DMG so draft
candidates do not depend on GitHub Release draft visibility. The release tag
stays in the preflight summary as provenance and remote release verification
remains the published-asset gate. Stable release workflows pass DMG-only
same-run artifacts (`macos-build-arm64-dmg` and
`opl-full-first-install-dmg-<version>-mac-arm64`) into VM gates while retaining
the complete standard and Full artifacts for publish jobs.
Branch-lane evidence runs that should not publish release assets may pass the
same DMG-only artifact name plus `release_artifact_run_id` to download the
artifact from the source Actions run through `actions/download-artifact@v8`
with `run-id`; that handoff is
for VM evidence only and does not replace same-run stable release gates or
remote release verification. These profiles fix
the logical display at
`1920x1080px`, sweep packaged Settings pages, and write profile-scoped artifacts
named `opl-first-run-vm-<profile>-<run_id>`. The Full
profile must prove activation from the clean guest's installed
`/Applications/One Person Lab.app`: installed bundle resources, guest runtime
pointer/wrapper readback, and live `opl system initialize --json` output are the
pre-`/guid` `ready_to_launch` proof source. Host `/Applications`, developer
checkout state, prebaked runtime pointers, cache hits, manifest refs, and remote
asset presence are diagnostics or provenance only. The Full profile keeps Full
runtime readiness on the release-blocking path, and submits the Codex/OpenAI API
key configuration wizard when the wizard is visible. It does not require the
wizard UI when Codex config is already ready. Command Line Tools, git
availability, and managed repo sync are deferred maintenance. The pre-`/guid`
gate requires only workspace root, Codex CLI, and Codex config; Domain modules,
the family runtime provider, recommended skills, native helpers, CLT, repo sync,
and ecosystem updates are Full readiness or background maintenance and must not
block launch. With
`--codex-functional-check`, the guest smoke writes
`codex-functional-check-summary.json` as a deterministic post-install receipt
for Codex CLI detection, App-managed `opl-flow` context expectation, user
`AGENTS.md` policy, built-in route receipts, and skill/plugin visibility without
calling an external LLM. App-managed `opl-flow` is injected as localized,
session-scoped preset context; it must not write or overwrite workspace
`AGENTS.md`. With `--codex-ai-self-check`, the guest smoke then asks Codex CLI
to read the target installed OPL working mode and deterministic evidence, and
writes `codex-ai-self-check-summary.json` as non-blocking AI-first diagnostic
evidence. Default mode is read-only `diagnose`; it verifies intended behavior
and recommends next actions without replacing deterministic initialization or
the VM gate. The workflow writes a preflight summary
with runner labels, source VM, guest user, package/runtime profile, DMG path,
display, Codex package preflight path, Codex tarball path, Codex npm cache dir,
and artifact output before executing the smoke. The VM artifact includes
`codex-package-preflight.json`, `codex-package-registry-response.json`,
`codex-package-tarballs/openai-codex.tgz`,
`codex-package-tarballs/openai-codex-darwin-arm64.tgz`, and `codex-npm-cache`;
the active shell helper receives those install assets through
`--codex-package-tarball`, `--codex-platform-package-tarball`, and
`--codex-npm-cache-dir`. The root package tarball and the macOS platform binary
package tarball are both install assets; the platform tarball is explicitly
passed so the Framework runtime installer can materialize the native Codex
binary without relying on npm optional dependency resolution in offline guest
state. This preseed/cache surface reduces live registry dependency during Codex
install. The preflight artifact separates blocking
failures from diagnostic warnings: npm metadata, tarball download, and npm cache
add failures block the gate, while a registry metadata mirror download timeout
is recorded as a warning when the exact tarball and npm cache preseed are still
valid. This surface is not readiness truth, runtime truth, or release-owner
receipt, and it never replaces the clean VM install smoke.
Codex App and Computer Use checks are non-blocking exploratory tools;
release-blocking App readiness must live in deterministic scripts, contracts,
or GitHub Actions gates.
The App VM wrapper exposes `diagnostic_scope=release_gate|bootstrap_only`.
Release workflows use `release_gate`; `desktop-release-diagnostics.yml`
defaults to `bootstrap_only` to skip Codex asset cache restore/prefetch/save,
Settings sweep, assistant route smoke, and Codex functional/AI checks while
still installing and launching the App and collecting bootstrap fatal/native
modal diagnostics. Bootstrap-only artifacts are diagnostic-only and cannot
stand in for stable release evidence.
Scheduled GitHub Actions runs must have repository variable
`OPL_FIRST_RUN_TART_SOURCE` set to a local Tart source VM on the self-hosted
runner; this runner uses `opl-first-run-no-clt-clean-base-26-5-18` for DMG
profiles. The Homebrew profile must use `OPL_FIRST_RUN_HOMEBREW_TART_SOURCE`
or an explicit `tart_source_vm` pointing at a clean VM that already has
Homebrew installed; otherwise the gate fails before App installation.
The VM workflow keeps scheduled runs in a shared cancel-in-progress group, while
release-called and manual runs include the caller run id and package profile in
their concurrency key. Do not collapse standard, Homebrew, and Full VM gates
into one manual group; GitHub keeps only one pending job per concurrency group,
which would cancel one Stable install lane before it can produce readiness
evidence.
The VM workflow checks out only the active shell `scripts/` directory with a
shallow checkout, because the App wrapper calls only
`scripts/opl-first-run-tart-smoke.mjs` and its same-directory guest smoke
helper. If that smoke helper starts depending on other shell paths, update the
workflow checkout and the release-boundary check in the same change.

`.github/workflows/nightly-standard-release.yml` is the standard-only Nightly
publisher. It reuses the standard build workflow, prepares and validates
standard updater assets, publishes or refreshes the daily prerelease semver tag,
updates that tag to the current workflow commit on same-day reruns, keeps
`latest` unchanged, writes release notes that compare against the previous
Nightly, and runs the remote standard asset verifier without Full assets.

Stable release verification keeps the heavy installation checks in separate
lanes for speed and debuggability: standard DMG clean VM, Full DMG clean VM,
one-shot App installer, Docker/WebUI, remote verification, and release evidence
bundle validation can identify the exact user installation path that failed.
For normal Stable trains, use `npm run release:plan -- --version <version>
--include-full-package` as the operator plan: it models
`new_release -> draft candidate -> gates -> candidate record -> promote` and keeps the
`docs/delivery/user-guides/macos-app-install` sources, screenshots, and generated public artifacts refresh in a
post-release lane. Run `npm run docs:macos-guide` for that docs refresh; it
updates the public HTML guide plus the shareable PDF/PPTX and detailed PDF
artifacts under `docs/public/macos-app-install/`.
`refresh_existing` is the
emergency repair/replace lane for an already published release, not the default
new Stable path. Once a candidate record, readiness summary, remote verification
JSON, or named gate result establishes a blocked stop condition, do not continue
polling scattered logs from long-running release runs.

Stable cohort preparation is separate from Stable dispatch. Use moving App,
shell, or framework `main` only to resolve immutable SHAs during sync
preparation. `release:cohort-lock` records the immutable App/Shell/Framework
SHA tuple, and `release:cohort-plan` embeds that lock with the release intent
and next action. The release train consumes those fixed SHAs, not moving refs.
If source preparation exposes a stale App head, unresolved shell/framework ref,
wrong shell type/format, dirty source checkout, or release-boundary/source-gate
failure, repair that root cause before dispatching the workflow. During a run,
use `release:operator status` or the closeout `release-monitor.json` instead of
broad `gh run watch`; after a primary gate fails, `failed_gate_draining` means
queued jobs are settling, and `stale_candidate` means the old run is diagnostic
evidence only. Neither state can be promoted or reinterpreted as release-ready
for a newer cohort. If the release process must be repaired while a run is in
flight, stop the old run and dispatch a new pinned cohort; record the stopped
run as `cancelled` or `superseded`, not as a source-gate failure.

## Release CI operations notes

Release automation has two distinct improvement tracks:

- Release gates prove user installation paths: standard DMG, Full DMG, one-shot
  installer, Docker/WebUI, remote verification, and evidence bundles.
- CI operations reduce wasted runner time and improve diagnostics without
  changing release truth.

`actionlint` belongs to the second track as the workflow semantic gate in the
reusable build quality jobs; Ruby/YAML parsing remains only a syntax check. The
CI gate disables opportunistic external `shellcheck`/`pyflakes` integrations so
host image drift cannot turn historical script-style findings into a release
blocker for packaging or VM telemetry runs.

GitHub Actions `concurrency` belongs to duplicate-run governance. Use it to
cancel stale scheduled runs or serialize operator-triggered runs, not as proof
that any package installed correctly.

Machine-readable release telemetry should be a JSON artifact that records
cache hit/miss, lane timing, package sizes, and image sizes. That artifact is
the evidence base for after-release tuning of cache keys and matrix size; it
does not replace manifests, SHA256SUMS, remote verification, or VM smoke
artifacts. Full remote tuning should read the small
`opl-full-diagnostics-<version>` artifact before downloading any large package
artifact.

`release:closeout` is wired into the desktop release workflow by default. The
final `release-readiness-summary` job builds `release-closeout-<version>` after
the candidate record, using the already downloaded small artifacts and
`--no-download`; it does not fetch standard build or Full package workflow
artifacts. The artifact includes `release-closeout.json`,
`release-closeout.md`, `release-monitor.json`, and `release-notification.json`.
Read `release-monitor.json#state` plus `recommended_next_action` to replace long
`gh run watch` loops; states include `running`, `failed_gate_draining`,
`failed`, `stale_candidate`, `cancelled`, `superseded`, `ready_to_promote`,
`published`, and `published_with_post_publish_followup`. The notification JSON is a small
repo-native payload for automation consumers, not an external push channel. The
same npm script is the local rerun/debug entry for completed or in-progress
GitHub Actions release runs.
Local reruns write ignored output under
`artifacts/release-closeout/v<version>-<run_id>/`, download only primary small
artifacts (`release-candidate-record`, `release-readiness-summary`,
`release-preflight-summary`, and `remote-release-verification`) unless
`--no-download` is passed, and refuse the standard build and Full package
workflow artifacts. Use `--artifact-profile diagnostics` to also fetch Full
workflow telemetry and diagnostics, or `--artifact-profile readiness-inputs`
when rebuilding the full readiness diagnosis locally. Pass
`--agent-wall-time <duration>` only for the operator loop clock; GitHub Actions
workflow wall time is always computed from run timestamps.

Use `release:actions-timing` when the question is release efficiency across
multiple failed, canceled, and successful GitHub Actions runs. It reads
`gh run view --json ...jobs` output, reports total multi-run span,
failed/canceled run tax, top jobs, top steps, and the operator-loop gap outside
the Actions span when `--agent-wall-time` is supplied. It is a profiling tool;
it does not replace release readiness, candidate records, owner receipts, or
published asset verification.

No-watch readback:

```bash
gh run view <run-id> --repo gaofeng21cn/one-person-lab-app --json status,conclusion,url,updatedAt
gh run download <run-id> --repo gaofeng21cn/one-person-lab-app --name release-closeout-<version> --dir artifacts/release-closeout/v<version>-<run-id>
jq '.state,.recommended_next_action' artifacts/release-closeout/v<version>-<run-id>/release-monitor.json
```

The final stable release decision is `release-readiness-summary.json`, produced
by `.github/workflows/desktop-release.yml` through
`scripts/summarize-release-readiness.ts`. The summary script consumes dependency
results and small artifacts only: remote verification JSON, VM summaries,
one-shot installer output, Docker/WebUI smoke output, Full diagnostics, and
`full-workflow-telemetry.json`. Do not download standard or Full DMG artifacts
for readiness diagnosis; missing small evidence is a fail-closed release
readiness failure. For new stable releases, Homebrew tap updates and the
Homebrew VM smoke run from the promote workflow after the draft release has
been published. For existing published release refreshes with
`run_vm_smoke=true`, the desktop release workflow may update the stable
Homebrew tap by direct commit and then run the cask VM smoke. A tap update
failure, cask lane cancellation, or missing artifact fails the matching stable
closure gate with a named cause.

`release:owner-candidate-record:verify` command is the post-owner receipt
readback path: it takes the App release-owner receipt record and the ignored
small release artifacts, rebuilds `release-candidate-record.json`, and runs the
same promote-ready validator. Its output is a verification artifact only; it
does not publish a release, mutate updater metadata, claim App release ready, or
claim OPL family production ready.

The one-shot installer section records the fixed public entry command, the
workflow job result as bootstrap status source, the
`opl system initialize --json` setup-flow source, artifact file names, progress
fields, blockers, next step, retry state, and `--skip-modules` state in JSON and
the Markdown summary.

Draft candidate cleanup is an explicit metadata-only operator step. Use
**OPL Desktop Release Cleanup Drafts** or `release:cleanup-drafts` after the
stable `v<version>` Release is published to remove stale
`v<version>-draft.*` and `v<version>-readiness.*` draft Releases and their tags.
The default is dry-run; pass `--execute` only after reviewing the generated
summary. This path does not download standard or Full DMG assets.

WebUI GHCR cleanup is a separate dry-run-first package admin step. Use
`release:cleanup-webui-ghcr` to read
`contracts/app-release-channel.json#webui_ghcr_image.retention_policy`, keep
protected moving tags (`latest`, `stable`, `nightly`), keep the declared recent
stable/nightly windows and rollback tags, then list stale package versions. Pass
`--execute` only after reviewing the summary and only from a token with package
admin / `delete:packages`; ordinary release publishing never deletes GHCR
versions.

Full build speed tuning should start with `full-workflow-telemetry.json`.
`cache.shell_vite_output=true` means the Full workflow restored active-shell
Vite output and invoked the shell build with `--skip-vite`; `false` means it ran
the normal shell build and saved the output for the next run. The cache is
version-scoped because the bundled shell output embeds `OPL_RELEASE_VERSION`.
`cache.electron_artifacts` records whether Electron/Electron Builder downloads
were restored. `runtime-cache-events.json` carries per-layer keys plus
`key_inputs`, which should be used to explain Full runtime cache misses before
changing cache policy. Treat these as cache acceleration signals only, not as
release truth.

Composite/setup action reuse is used only where a checked-in composite action is
tested and the job still keeps release semantics visible. Active-shell
checkout/setup/cache reuse lives in `.github/actions/setup-active-shell-deps`.
