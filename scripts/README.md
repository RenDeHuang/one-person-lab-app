# App Root Scripts

The root `scripts/` directory exposes App-level wrappers. The active Electron
shell implementation is checked out from `gaofeng21cn/opl-aion-shell` and
exposes its shell-specific helpers under `shells/aionui/scripts/`.
By default wrappers read `contracts/app-shell-adapter.json`. Technical
verification can select a different linked shell repo with
`OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/<candidate>.json`.

| Script | Purpose |
| --- | --- |
| `ensure-active-shell.ts` | Clones or validates the selected external shell checkout, defaulting to `shells/aionui`. |
| `verify.sh` | App-root verification wrapper for smoke, active-shell, release-boundary, candidate-shell, structure, and full lanes without running release packaging by default. |
| `validate-active-shell.ts` | Validates the selected shell adapter contract and runs selected validation commands. |
| `validate-shell-candidates.ts` | Validates GUI shell candidates from `contracts/app-shell-candidates.json`; selectable candidates are packageable only through an explicit adapter contract env override and must emit a real `.app` bundle manifest. |
| `prepare-release-assets.ts` | Calls the active shell release asset normalizer from the App root. |
| `validate-release.ts` | Verifies release assets and enforces that standard updater metadata excludes Full first-install assets. |
| `verify-remote-release-assets.ts` | Downloads GitHub Release assets and verifies remote size, sha256 digest, updater metadata, Full manifest, Full README language, Full checksums, and Full size budgets. |
| `generate-release-notes.ts` | Generates English, channel-aware release notes: Stable compares with the previous Stable release, Nightly compares with the previous Nightly prerelease, release names use `One Person Lab v<version>`, both group changes by user purpose, and notes include OPL-family repo changes plus Full payload versions when available. |
| `cleanup-draft-release-candidates.ts` | Dry-runs or deletes stale `v<version>-draft.*` and `v<version>-readiness.*` draft Releases after the stable release exists. |
| `cleanup-webui-ghcr-versions.ts` | Dry-runs or deletes stale `one-person-lab-webui` GHCR package versions according to the App release-channel retention policy. |
| `publish-release.ts` | Creates or refreshes App GitHub Release assets from local shell output, prebuilt standard assets, and optional Full first-install assets. |
| `plan-release-candidate.ts` | Prints the Nightly or Stable release lane plan, including purpose-based installation gates, Stable candidate-record promotion, and post-release `docs/user-guides` screenshot/source/artifact refresh with `npm run docs:macos-guide`. |
| `summarize-release-readiness.ts` | Aggregates small Stable gate artifacts and job results into `release-readiness-summary.json` and Markdown without downloading large DMG artifacts. |
| `validate-release-candidate-record.ts` | Validates or summarizes `release-candidate-record.json`; promotion requires schema `opl_release_candidate_record.v1`, matching version, `status=ready_to_promote`, and `decision.can_promote=true`. |
| `analyze-full-package-size.ts` | Reads `full-package-manifest.json` and reports Full runtime component/layer size, budget use, and optional runtime-root top entries. |
| `collect-release-evidence.ts` | Collects live OPL runtime snapshot, App/operator drilldown, selected safe-action dry-run/execute JSON, and standard smoke source-dir artifacts into a release evidence bundle, writes the manifest, and validates the bundle in missing-evidence mode without claiming absent screenshot, VM, settings, or remote evidence. |
| `write-release-evidence-manifest.ts` | Writes `evidence-manifest.json` for a release evidence bundle and marks absent VM/remote artifacts as missing evidence. |
| `validate-release-evidence-bundle.ts` | Validates a release evidence bundle manifest and artifact files, including real screenshot dimensions; default validation fails closed when required evidence is missing. |

Stable App-root npm entries are `verify`, `validate:release-boundary`,
`validate:gui-shell`, `release:evidence:manifest`, `release:evidence:validate`, and
`hygiene:fallow`. These keep release boundary/evidence scripts visible as
production entrypoints while the files remain thin App-owned wrappers around
contracts and release artifacts. App-root fallow config excludes
`shells/aionui/**` and `shells/agui-codex/**` because those paths are ignored
external shell checkouts.
`hygiene:fallow` is not GUI shell build or runtime evidence; `validate:gui-shell`
runs the full active shell validation list and the shell GUI compile path
through App wrappers. Run shell hygiene in `gaofeng21cn/opl-aion-shell`.

Examples:

```bash
node --experimental-strip-types scripts/ensure-active-shell.ts
scripts/verify.sh
scripts/verify.sh structure
scripts/verify.sh release-boundary
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
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
npm run release:plan -- --version <version> --profile nightly
npm run release:plan -- --version <version> --include-full-package
npm run release:readiness-summary -- --version <version> --release-mode new_release --include-full-package true --run-vm-smoke true --artifacts-dir <downloaded-small-artifacts-dir> --job-results release-readiness-job-results.json --output release-readiness-summary.json --markdown release-readiness-summary.md
npm run release:candidate-record:validate -- --version <version> --record release-candidate-record.json
npm run release:candidate-record:status -- --record release-candidate-record.json --format json
npm run release:full:size -- --markdown
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-no-clt-clean-base --dmg dist/standard-release/One-Person-Lab-<version>-mac-arm64.dmg --smoke-profile no-clt-clean-vm --display 1920x1080px --settings-smoke --assistant-route-smoke --runtime-profile standard
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-no-clt-clean-base --dmg dist/opl-full-release/One-Person-Lab-Full-<version>-mac-arm64.dmg --smoke-profile no-clt-clean-vm --display 1920x1080px --settings-smoke --assistant-route-smoke --runtime-profile full
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-homebrew-ready-base --install-mode homebrew-cask --homebrew-cask one-person-lab --smoke-profile homebrew-standard-cask --display 1920x1080px --settings-smoke --assistant-route-smoke --runtime-profile standard
OPL_INSTALL_SCRIPT_URL=file:///path/to/one-person-lab/install.sh ./install.sh --complete --skip-modules
docker build -t one-person-lab-webui:<version> shells/aionui
```

For candidate shells, `npm run validate:shell-candidates -- --run-candidate-commands`
expects the selected package command to produce `out/agui-codex-candidate-manifest.json`
with `candidate_app_bundle_ready`, `explicit_candidate_app_bundle`, and a
relative `.app` bundle path whose bundle contains `Contents/Info.plist` and a
`Contents/MacOS` executable. A `.txt` smoke output is intentionally rejected.

`release:prepare-standard` also copies the App root installer into the active
shell resources as `opl-install.sh`, which is the packaged standard DMG
bootstrap carrier used when clean first launch cannot find `opl`.

Full size policy lives in `docs/release/README.md`: release review records the
compressed DMG size, uncompressed runtime size, and layer breakdown, then uses
`verify-remote-release-assets.ts` as the remote verifier size budget check for
published GitHub Release assets. The remote verifier enforces the compressed
Full DMG budget from the GitHub asset size and the uncompressed runtime budget
from `full-package-manifest.json` `size_breakdown.total_runtime_uncompressed_bytes`.
`warning_full_dmg_bytes=700000000` is a release-readiness warning threshold for
the post-Temporal Full baseline; `max_full_dmg_bytes=750000000` is a review
threshold that records a warning without blocking Stable publication. The
uncompressed Full runtime budget is `max_runtime_uncompressed_bytes=1500000000`,
matching the 26.6.5 Stable toolchain-heavy baseline while still failing closed
on duplicated checkouts, stale payloads, or standard-updater leakage.
`npm run release:full:size -- --markdown` prints the same component and layer
breakdown for local review and is appended to the Full GitHub Actions summary.
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
Full packaging excludes local development indexes, dependency caches, tests, and
runtime/user state such as `.codegraph`, `.git`, `.worktrees`, `.venv`,
`node_modules`, `runtime`, `runtime-state`, `runs`, `sessions`, and `tests`;
domain-specific allowlists must come from the owning domain repositories.

The clean first-install gates are wired through
`.github/workflows/opl-first-run-vm.yml` and the active shell Tart smoke helper.
It supports `package_profile=standard`, `package_profile=full`, and
`package_profile=homebrew-standard`. The standard profile resolves
`One-Person-Lab-*-mac-arm64.dmg` excluding Full assets and runs
`--runtime-profile standard`; the Full profile resolves
`One-Person-Lab-Full-*-mac-arm64.dmg` and runs `--runtime-profile full`. The
Homebrew profile starts from a clean Homebrew-ready Tart base, runs
`brew tap gaofeng21cn/one-person-lab && brew install --cask one-person-lab`, then
opens `/Applications/One Person Lab.app` through the same packaged-app smoke.
Release workflows pass a same-run workflow artifact for the DMG so draft
candidates do not depend on GitHub Release draft visibility. The release tag
stays in the preflight summary as provenance and remote release verification
remains the published-asset gate. These profiles fix the logical display at
`1920x1080px`, sweep packaged Settings pages, and write profile-scoped artifacts
named `opl-first-run-vm-<profile>-<run_id>`. The Full
profile uses live `opl system initialize --json` output as the pre-`/guid`
`ready_to_launch` proof source, keeps Full runtime readiness on the
release-blocking path, and submits the Codex/OpenAI API key configuration wizard
when the wizard is visible. It does not require the wizard UI when Codex config
is already ready. Command Line Tools, git availability, and managed repo sync
are deferred maintenance. The pre-`/guid` gate requires only workspace root,
Codex CLI, and Codex config; Domain modules, the family runtime provider,
recommended skills, native helpers, CLT, repo sync, and ecosystem updates are
Full readiness or background maintenance and must not block launch. With
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
display, and artifact output before executing the smoke. Codex App and Computer
Use checks are non-blocking exploratory tools; release-blocking App readiness
must live in deterministic scripts, contracts, or GitHub Actions gates.
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
`docs/user-guides` entry, screenshots, guide source, and generated artifacts refresh in a
post-release lane. Run `npm run docs:macos-guide` for that docs refresh; it
updates the HTML guide plus the shareable PDF/PPTX and detailed PDF artifacts.
`refresh_existing` is the
emergency repair/replace lane for an already published release, not the default
new Stable path. Once a candidate record, readiness summary, remote verification
JSON, or named gate result establishes a blocked stop condition, do not continue
polling scattered logs from long-running runs such as `019e9556`.

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

The final stable release decision is `release-readiness-summary.json`, produced
by `.github/workflows/desktop-release.yml` through
`scripts/summarize-release-readiness.ts`. The summary script consumes dependency
results and small artifacts only: remote verification JSON, VM summaries,
one-shot installer output, Docker/WebUI smoke output, Full diagnostics, and
`full-workflow-telemetry.json`. Do not download standard or Full DMG artifacts
for readiness diagnosis; missing small evidence is a fail-closed release
readiness failure. Homebrew VM smoke is a separate required gate when
`run_vm_smoke=true`; Stable releases first update the stable Homebrew tap by
direct commit and then run the cask VM smoke. A tap update failure, cask lane
cancellation, or missing artifact fails the Stable readiness summary with a
named cause. The one-shot installer section
records the fixed public entry command, the workflow job result as bootstrap status source, the
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
