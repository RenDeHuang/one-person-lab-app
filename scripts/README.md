# App Root Scripts

The root `scripts/` directory exposes App-level wrappers. The active Electron
shell implementation is checked out from `gaofeng21cn/opl-aion-shell` and
exposes its shell-specific helpers under `shells/aionui/scripts/`.
By default wrappers read `contracts/app-shell-adapter.json`. AionUI is the
active GUI carrier, `opl-native-workbench` is the foreground alternative,
Hermes Desktop / `hermes-codex` is a retained reference candidate, and
AGUI / `agui-codex` is archived technical proof rather than a routine
implementation, validation, or polish lane. Source-only technical validation
can select a different linked shell repo with
`OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/<candidate>.json`;
Hermes full candidate command execution additionally requires
`--manual-reference-replay` and an actual development need. AGUI selection
should happen only when AGUI replay is explicitly requested.

| Script | Purpose |
| --- | --- |
| `ensure-active-shell.ts` | Clones or validates the selected external shell checkout, defaulting to `shells/aionui`. |
| `gui-launcher.ts` | Opens the installed AionUI mainline by default or the isolated Native Candidate for one local run. Candidate launches receive exact OPL/Codex Runtime identity and default to dry-run-only actions; the launcher never changes release adoption or updater state. |
| `verify.sh` | App-root verification wrapper for smoke, active-shell, release-boundary, candidate-shell, structure, and full lanes without running release packaging by default. |
| `validate-active-shell.ts` | Validates the selected shell adapter contract and runs selected validation commands. |
| `validate-runtime-route.ts` | Explicitly validates the retained optional X0-01 Runtime route, including its product contract, page-state matrix, display policy, and required Framework producer. Default active-shell/release gates do not require the route. |
| `validate-shell-candidates.ts` | Validates only the fixed active/foreground/retained/archived role registry by default. `--candidate opl-native-workbench` enables Native detail validation; Hermes and AGUI remain role tombstones whose explicit validation/replay detail is owned by their adapters and runbooks. Hermes command execution requires `--manual-reference-replay` for an actual technical-verification need. |
| `validate-gui-design-system.ts` | Validates the three-layer GUI definition stack, foundation-doc refs, shell roles, ideal/native versus active AionUI state markers, profile-owned model defaults, and the non-release evidence boundary. It fails closed when foundation docs are absent and never promotes docs or visual QA into release readiness. |
| `prepare-release-assets.ts` | Calls the active shell release asset normalizer from the App root. |
| `validate-release.ts` | Verifies release assets and enforces that standard updater metadata excludes Full first-install assets. |
| `write-opl-app-component-manifest.ts` | Writes the App-owned immutable standard artifact lock consumed by `opl_release_set.v2`; the App keeps CalVer while the Release Set records its exact source commit and asset digests. |
| `verify-remote-release-assets.ts` | Downloads GitHub Release assets and verifies remote size, sha256 digest, updater metadata, Full manifest, Full README language, Full checksums, and Full size budgets. |
| `generate-release-notes.ts` | Builds release-note evidence and deterministic template notes for the LLM writer. Stable compares with the previous Stable release, Nightly compares with the previous Nightly prerelease, release names use `One Person Lab v<version>`, and the public body leads with user scenarios, upgrade value, and action items. Commit logs, refs, workflow facts, changelog details, OPL-family changes, and Full payload versions stay in Technical details or evidence artifacts unless they are directly user-visible. Release publish/promote consumes prepared AI-written notes and must not call AI on the critical path; template output is dry-run/diagnostic only. |
| `cleanup-draft-release-candidates.ts` | Discovers stale `v<version>-draft.*` and `v<version>-readiness.*` draft Releases after the stable release exists. Deletion is unavailable until a separate signed broker cleanup mutation is provisioned; neither this CLI nor an ordinary release workflow directly deletes a Release or tag. |
| `cleanup-webui-ghcr-versions.ts` | Dry-runs or deletes stale `one-person-lab-webui` GHCR package versions according to the App release-channel retention policy. |
| `cleanup-local-artifacts.ts` | Dry-runs or deletes local ignored generated output: `tmp/`, `docs/site/latest/`, generated Full runtime payload dirs, and stale top-level `artifacts/*` run directories. It never manages tool state or external shell checkouts. |
| `install-docker-webui.sh` | Linux/macOS Bash entrypoint for starting the Docker/WebUI image with host `/data` and `/projects` mounts through `docker compose`; Ubuntu may install Docker Engine, while macOS only checks for an existing Docker runtime. After compose startup it waits for the local HTTP endpoint and can write a diagnostic directory or `.tar.gz` package without accepting API keys. |
| `install-docker-webui.ps1` | Windows PowerShell one-click Docker/WebUI installer that writes `compose.yaml`, creates persistent `OnePersonLab` data/projects directories, runs `docker compose up`, waits for the local HTTP endpoint, and can write a diagnostic directory or archive without accepting API keys. |
| `docker-webui-smoke-gate.ts` | Repo-native Docker/WebUI smoke gate runner for clean Linux VM, clean Windows VM, existing Docker, and old data-dir gates. It writes a typed blocker when the current host cannot prove the requested gate instead of returning a false pass. |
| `validate-docker-webui-diagnostics.ts` | Validates installer diagnostic directories for required files, data preservation evidence, and secret-like markers. |
| `publish-release.ts` | Creates or refreshes App GitHub Release assets from local shell output, prebuilt standard assets, optional Full first-install assets, and the prepared evidence-backed release-note body. It keeps release-note evidence and technical audit material in Technical details, Actions artifacts, candidate records, or closeout artifacts, and must not generate AI public copy during publish/promote. |
| `plan-release-candidate.ts` | Prints the Nightly or Stable release lane plan, including purpose-based installation gates, Stable candidate-record promotion, and post-release guide refresh with `npm run docs:macos-guide` from `docs/delivery/user-guides/macos-app-install` sources into `docs/site/latest`. |
| `closeout-release-run.ts` | Powers the default desktop release `release-closeout-<version>` artifact and local reruns; reads only final small release summaries, writes `release-closeout.json/md`, separates GitHub Actions workflow wall time from Agent orchestration wall time, and points the operator at candidate blockers, failed gates, promotion, or log inspection. |
| `verify-release-attestations.ts` | Runs `gh attestation verify` for downloaded release assets or OCI refs and writes `opl_release_attestation_verification.v1` for closeout ingestion. It records build-integrity evidence only and does not replace checksum, remote-readback, VM, or owner evidence. |
| `summarize-github-actions-timing.ts` | Profiles one or more `gh run view --json ...jobs` payloads, including multi-run span, failed/canceled run tax, slow jobs, slow steps, and the operator-loop gap when an Agent wall-time clock is supplied. |
| `plan-release-gate-reuse.ts` | Compares the current release cohort with a previous promote-ready candidate record, readiness summary, and remote verification artifact, then writes `opl_release_gate_reuse_plan.v1` with per-gate `reuse_allowed` / `must_run` decisions and a stable reuse digest. The plan is a decision artifact only; workflow gates still run unless a workflow explicitly consumes it. |
| `release-cohort-lock.ts` | Resolves App, shell, and Framework refs into `opl_app_release_cohort_lock.v1` with immutable SHAs. It is a preparation record only and cannot dispatch, publish, promote, claim readiness, or write runtime truth. |
| `plan-release-cohort.ts` | Writes `opl_app_release_cohort_plan.v1` for a Stable train: version, release mode, embedded cohort lock, Full add-on/VM intent, cheap source gates, and one dry-run `release:stable start` next action over fixed App/Shell/Framework SHAs. It never emits a direct workflow dispatch. The plan/manifest is the same-cohort input for controller-led recovery or promotion without hand-filling refs. |
| `release-operator.ts` | Thin no-watch controller over existing release scripts, workflows, and artifacts. It can write `release-operator-state.json/md`, report structured status from GitHub run JSON, classify stale, draining, cancelled, or superseded runs, and emit typed next actions such as `repair_source_gate`, `dispatch_new_cohort`, `rerun_diagnostic_same_artifact`, `provide_owner_receipt`, or `promote_candidate`; it is the only no-watch status entrypoint and is not release truth. |
| `summarize-release-readiness.ts` | Aggregates small Stable gate artifacts and job results into `release-readiness-summary.json` and Markdown without downloading large DMG artifacts. |
| `validate-release-candidate-record.ts` | Validates or summarizes `release-candidate-record.json`; promotion requires schema `opl_release_candidate_record.v1`, matching version, `status=ready_to_promote`, and `decision.can_promote=true`. |
| `analyze-full-package-size.ts` | Reads `full-package-manifest.json` and reports Full runtime component/layer size, budget use, and optional runtime-root top entries. |
| `collect-release-evidence.ts` | Collects live OPL runtime snapshot, App/operator drilldown, selected safe-action dry-run/execute JSON, and standard smoke source-dir artifacts into a release evidence bundle, writes the manifest, and validates the bundle in missing-evidence mode without claiming absent screenshot, VM, settings, or remote evidence. |
| `write-release-evidence-manifest.ts` | Writes `evidence-manifest.json` for a release evidence bundle and marks absent VM/remote artifacts as missing evidence. |
| `validate-release-evidence-bundle.ts` | Validates a release evidence bundle manifest and artifact files, including real screenshot dimensions; default validation fails closed when required evidence is missing. `runtime_screenshot` is conditional and is enforced only with `--require-conditional runtime_screenshot` or the equivalent environment setting. |
| `smoke-hermes-candidate-tart.ts` | Runs the packaged `One Person Lab Hermes Candidate.app` first-run fixture smoke inside a Tart clean VM, copying guest artifacts back to the App repo. This is candidate technical verification only and does not promote Hermes to the release shell. |

Stable App-root npm entries are `verify`, `typecheck`, `validate:release-boundary`,
`validate:gui-design-system`, `validate:gui-shell`, `validate:shell-candidates`,
`test:smoke`, `test:full`, `release:evidence:manifest`,
`release:evidence:validate`, and `hygiene:fallow`. `npm test` aliases the smoke
entry so ordinary development does not run the full active-shell DOM portfolio;
full shell Vitest evidence remains explicit through `npm run test:full`,
`scripts/verify.sh full`, and the active-shell validation contract. These keep
release boundary/evidence scripts visible as production entrypoints while the
files remain thin App-owned wrappers around contracts and release artifacts.
The retained X0-01 route uses the explicit `validate:runtime-route` and
`test:runtime-route` entries and is intentionally absent from default release gates.
App-root fallow config excludes
`shells/aionui/**` and `shells/agui-codex/**` because those paths are ignored
external shell checkouts.
`hygiene:fallow` is not GUI shell build or runtime evidence; `validate:gui-shell`
runs the full active shell validation list and the shell GUI compile path
through App wrappers. Run shell hygiene in `gaofeng21cn/opl-aion-shell`.

Release efficiency policy is `build-once/promote-many`: build and qualify one
frozen cohort once, then route recovery through the cohort plan/manifest,
candidate record, readiness summary, and targeted gate reruns. VM smoke
qualifies the exact artifact under review. Full runtime bundle preparation is
OPL Framework-owned and App-consumed through manifest/lock/readback refs. The
target critical path is standard 10-20 minutes, Full 35-50 minutes, retry 3-15
minutes, and promote under 5 minutes.

Docs generation commands read `docs/delivery/user-guides/macos-app-install`
guide sources and write the public bundle under
`docs/site/latest/macos-app-install/`.

Examples:

```bash
npm run gui
npm run gui -- --shell opl-native-workbench
npm run gui -- --shell opl-native-workbench --plan
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
npm run release:version:validate -- --channel stable --version <YY.M.D>
npm run release:version:validate -- --channel nightly --version <YY.M.D-nightly-or-YY.M.D-nightly.r1>
npm run release:nightly-version:resolve -- --base-version <YY.M.D-nightly> --existing-ref-file <path>
npm run release:notes -- --version <version> --channel stable --include-full-package
npm run release:notes -- --version <YY.M.D-nightly-or-rebuild> --channel nightly
npm run verify-remote-release -- --version <version> --include-full-package
npm run verify-remote-release -- --version <YY.M.D-nightly-or-rebuild>
npm run release:cleanup-drafts -- --version <version>
npm run release:cleanup-drafts -- --version <version> --request-brokered-execute # typed-blocked until the cleanup mutation is provisioned
npm run release:cleanup-webui-ghcr -- --summary-path webui-ghcr-cleanup.json
npm run release:cleanup-webui-ghcr -- --rollback-tag <version> --execute
npm run cleanup:local-artifacts
npm run cleanup:local-artifacts -- --execute
npm run cleanup:local-artifacts -- --scope artifacts --keep-days 0 --execute
npm run validate:release-boundary
npm run validate:gui-design-system
npm run release:evidence:manifest -- --bundle-dir release-evidence/<version>
node --experimental-strip-types scripts/collect-release-evidence.ts --bundle-dir release-evidence/<version> --action-id <framework-action-id> --execute-action --overwrite --evidence-source-dir artifacts/opl-first-run-vm
npm run release:evidence:validate -- --bundle-dir release-evidence/<version>
npm run test:runtime-route
node --experimental-strip-types scripts/collect-release-evidence.ts --bundle-dir release-evidence/<version> --overwrite --artifact runtime_screenshot=/path/to/runtime.png --require-conditional runtime_screenshot
npm run hygiene:fallow -- --format json --summary
npm run validate:gui-shell
npm run validate:shell-candidates
npm run test:candidate:native
npm run validate:shell-candidates -- --candidate opl-native-workbench --run-candidate-commands
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/opl-native-workbench.json npm run package
# Prior Hermes reference only:
npm run validate:candidate:hermes
# Manual packaged replay only when an actual Hermes development task requires it:
npm run validate:shell-candidates -- --candidate hermes-codex --run-candidate-commands --manual-reference-replay
# Explicit AGUI replay only:
npm run validate:candidate:agui
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
npm run smoke:hermes-candidate:tart -- --no-graphics --artifacts artifacts/hermes-candidate-tart-<timestamp> --timeout-ms 600000
npm --prefix shells/hermes run smoke:settings-visual -- --allow-foreground --out out/smoke-settings-visual
npm run release:plan -- --version <version> --profile nightly # returns typed retired_pending_brokered_replacement until the brokered Nightly replacement exists
npm run release:plan -- --version <version> --include-full-package
npm run release:closeout -- --version <version> --run-id <github-actions-run-id> --artifact-profile diagnostics --agent-wall-time <duration>
npm run release:actions-timing -- --run-id <github-actions-run-id> --run-id <promote-run-id> --agent-wall-time <duration> --output actions-timing.json --markdown actions-timing.md
npm run release:gate-reuse-plan -- --version <version> --release-mode refresh_existing --include-full-package true --run-vm-smoke true --app-commit <sha> --shell-ref <ref> --framework-ref <ref> --current-preflight release-preflight-summary.json --current-remote-verification remote-release-verification.json --previous-candidate-record previous-release-candidate-record.json --previous-readiness previous-release-readiness-summary.json --previous-remote-verification previous-remote-release-verification.json --output release-gate-reuse-plan.json --markdown release-gate-reuse-plan.md
npm run release:cohort-lock -- --app-ref <app-sha> --shell-ref <shell-ref> --framework-ref <framework-ref> --output release-cohort-lock.json --markdown release-cohort-lock.md
npm run release:cohort-plan -- --version <version> --release-mode new_release --release-intent stable_complete --include-full-package true --run-vm-smoke true --app-ref <app-sha> --shell-ref <shell-sha> --framework-ref <framework-sha> --output release-cohort-plan.json --markdown release-cohort-plan.md
npm run release:stable -- start --version <version> --release-mode new_release --release-intent stable_complete --include-full-package true --run-vm-smoke true --app-ref <app-sha> --shell-ref <shell-sha> --framework-ref <framework-sha> --state release-session.json
npm run release:stable -- start --version <version> --release-mode new_release --release-intent stable_complete --include-full-package true --run-vm-smoke true --app-ref <app-sha> --shell-ref <shell-sha> --framework-ref <framework-sha> --state release-session.json --execute
npm run release:stable -- resume --state release-session.json
npm run release:stable -- promote --state release-session.json --release-owner-receipt-ref <same-cohort-owner-receipt-ref> --execute
npm run release:operator -- plan --version <version> --release-mode new_release --release-intent stable_complete --include-full-package true --run-vm-smoke true --app-ref <app-sha> --shell-ref <shell-sha> --framework-ref <framework-sha> --output release-operator-state.json --markdown release-operator-state.md
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
OPL_INSTALL_SCRIPT_URL=file:///path/to/one-person-lab/install.sh ./install.sh --with-app --skip-packages
docker build -t one-person-lab-webui:<version> shells/aionui
```

## App root TypeScript gate

`npm run typecheck` is the App-owned root TypeScript gate. It uses pinned
TypeScript and Node type packages through `npx` so the App remains a thin
product wrapper without a second runtime dependency tree. The root
`tsconfig.json` deliberately lists the maintained App boundary and model-policy
entrypoints; the active shell's full renderer typecheck remains owned by the
shell repository and its own `tsconfig.json`.

For shell alternatives, `npm run validate:shell-candidates` covers only the
minimal fixed-role registry by default. The current foreground candidate is
`opl-native-workbench`; its full contract/evidence path is explicit through
`validate:candidate:native`, `test:candidate:native`, or
`--candidate opl-native-workbench --run-candidate-commands`. Hermes and AGUI are
active-registry tombstones: `validate:candidate:hermes` and
`validate:candidate:agui` validate their explicit routes, while command replay
reads the detailed commands from the selected adapter. Generic App validation
does not duplicate or reinterpret their package manifests.

Candidate validation remains non-release: an explicit command chain may build
the selected `.app` and run its adapter-owned smoke, but it must not switch the
active release shell, claim release readiness, or focus the user's desktop
unless a visual smoke lane explicitly requests it. Packaged Settings visual
smoke is manual/VM evidence only and requires `--allow-foreground`; prefer
Tart/VM when the maintainer is using the Mac.

For `opl-native-workbench`, the current non-live product-surface target includes
basic UI modules, artifact preview tabs, provenance drawer, starter forms,
confirmation/interview cards, desktop/WebUI same-renderer parity, and source
visual smoke. These are candidate technical evidence targets only. Live
Evidence, clean VM, same-cohort user path, owner acceptance, active-shell
adoption, and release-ready proof remain outside candidate validation.

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
`opl-release-manifest.json#manifest`
`size_breakdown.total_runtime_uncompressed_bytes`. The Full size analyzer keeps
compressed DMG warning, review threshold, and optional hard limit status
separate: crossing the review threshold records `requires_review`; only an
explicit hard limit records a release-blocking compressed-DMG failure.
`npm run release:full:size -- --markdown` prints the same component and layer
breakdown plus manifest size hotspots for local review and is appended to the
Full GitHub Actions summary. Stable Full release builds use ULMO by default for
the App-owned DMG path; set `OPL_FULL_DMG_FORMAT=UDZO` and
`OPL_FULL_DMG_COMPRESSION_LEVEL=<1-9>` only for an explicit legacy diagnostic
override.
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
Published Full release verification prefers the consolidated
`opl-release-manifest.json` plus the Full DMG. During migration it still accepts
the legacy separate `full-package-manifest.json`, `runtime-cache-events.json`,
`full-runtime-currentness-probe.json`, `full-runtime-native-trust.json`,
`full-app-bundle-trim-report.json`, `full-package-boundary-audit.json`,
`README-Full-First-Install.txt`, `SHA256SUMS.txt`, and
`full-local-authorization-policy.json` assets when the consolidated manifest is
not present.
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
the complete standard and Full artifacts for publish jobs. Each macOS DMG
artifact has a sibling `-cohort` artifact containing the exact App SHA, Shell
SHA, and version. The VM workflow validates that manifest before allocating the
self-hosted VM and rejects an older DMG paired with newer App or Shell smoke
contracts.
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
runtime readiness on the release-blocking path, and submits the OPL Gateway
configuration wizard only when no usable Codex model access exists. It does not
require the wizard UI when existing Codex login or another provider is already
ready. Command Line Tools, git
availability, and managed repo sync are deferred maintenance. The pre-`/guid`
gate requires only workspace root, Codex CLI, and usable Codex model access; Domain modules,
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
The reusable Actions cache for this preseed is keyed by runner OS/architecture,
the frozen Codex version, and both complete tarball SHA-256 values. It never
uses a workflow run, attempt, timestamp, or random value. The restore prefix
keeps one-time compatibility with legacy entries; an exact matched key skips
the save, and only `refs/heads/main` may write a new preseed cache. Per-run
tarballs, diagnostics, and receipts remain Actions artifacts. Run
`npm run validate:release-boundary` after any cache-step change; the validator
parses every workflow and rejects volatile cache identity or an explicit save
without a miss/forced-rebuild guard.
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

The former direct Nightly writer is retired. `release:plan -- --profile nightly`
returns the typed blocker `retired_pending_brokered_replacement` and no publish
command. Nightly publication can resume only through a separately provisioned
brokered workflow whose controller and payload inputs are immutable, whose
write credential is isolated from ordinary Codex tasks, and whose recovery uses
a new authorized attempt or read-only reconcile. Stable preflight is not a
substitute for that missing Nightly mutation authority.

AI release-note drafting is a pre-release preparation path, not publish/promote
critical-path work. Stable desktop release jobs prepare release-blocking notes
from the deterministic same-cohort template with `OPL_RELEASE_NOTES_MODE=template`;
the prepared notes are still validated before publish. Nightly release jobs may
prepare LLM-written notes with `OPL_RELEASE_NOTES_MODE=ai`, run the online
provider probe first, and fail closed when no usable provider is configured.
Online release drafting uses
`OPL_RELEASE_NOTES_PROVIDER=openai_compatible` with the existing
`OPL_RELEASE_NOTES_CODEX_BASE_URL=https://gflabtoken.cn/v1`,
`OPL_RELEASE_NOTES_CODEX_API_KEY`, and
`OPL_RELEASE_NOTES_MODEL=gpt-5.6-luna` route. The writer also accepts
`OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_BASE_URL` and
`OPL_RELEASE_NOTES_OPENAI_COMPATIBLE_API_KEY` for non-release probes or local
operator drafting. GitHub Models is not in the release path. Online pre-release
drafting runs
`scripts/release-notes-ai-writer.ts --probe-openai-compatible` before accepting
AI-assisted copy and fails closed when the online route is not usable.
Use
`npm run release:notes:probe-ai` to run the same secret-safe probe locally, and
`OPL_RELEASE_NOTES_AI_TIMEOUT_SECONDS` to override the default 75-second
per-model online request timeout.

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
artifacts under `docs/site/latest/macos-app-install/`.
`refresh_existing` is the repair lane for an unpublished draft, not the default
new Stable path and never a way to replace a published release. Once a candidate record, readiness summary, remote verification
JSON, or named gate result establishes a blocked stop condition, do not continue
polling scattered logs from long-running release runs.

Stable cohort preparation is separate from Stable dispatch. Use moving App,
shell, or framework `main` only to resolve immutable SHAs during sync
preparation. `release:cohort-lock` records the immutable App/Shell/Framework
SHA tuple, and `release:cohort-plan` embeds that lock with the release intent
and one dry-run canonical-controller next action. `stable_complete` qualifies an
independent Standard Stable terminal and requires its Standard VM proof.
`include_full_package=true` only requests a non-blocking same-cohort Full add-on
after Standard reaches terminal; it never makes Full completion part of the
Standard terminal chain. `standard_hotfix` remains an explicitly documented
expedited Standard-only intent. The plan emits the `release_operator_plan_ref`
but never emits `gh workflow run`; only `release:stable start` may submit the
planned request to the isolated broker when separately invoked with `--execute`.
The release controller consumes the fixed SHAs, not moving refs.
`release:operator plan` repeats this boundary as machine-readable
`operator_guidance`: dispatch inputs come from the cohort plan/lock, manual
long-SHA entry is a diagnostic fallback, and a frozen cohort should run desktop
release once. Remote movement after the freeze is post-freeze drift; either
promote the frozen cohort after owner receipt, or freeze a new cohort and
dispatch a new desktop release.

`release:stable` is the canonical controller entry for Standard Stable and its
independently terminal same-cohort add-on intents.
It is dry-run by default and requires `--execute` before it can submit a planned
request to the isolated mutation broker. `start` resolves the App, Shell, and Framework refs once, deduplicates
and runs the cheap source gates, verifies that the remote App branch still
points to the frozen SHA, durably records dispatching, submits exactly one
request for that cohort, and discovers its run id from broker/GitHub readback.
Every watch has one absolute wall-clock deadline; timeout returns to read-only
reconcile without repeating the mutation. The persisted `opl_app_stable_release_session.v3` uses
revision-CAS atomic writes and append-only qualification/mutation attempts. It
carries the run id into `promote`; promotion cannot be dispatched without
a same-cohort release-owner receipt. A validator-only or smoke-only change must
reuse the existing artifact for diagnosis and does not justify rebuilding it.
The qualification receipt records artifact and verification identities; the
verification harness never replaces the product cohort or DMG SHA-256. Before a
broker request and again before VM allocation, the runner compares artifact and
verification commits and durably records base, head, changed paths, digests and
classification. Any App or Shell verification SHA change is
`new_cohort_required`; changed-path allowlists cannot authorize exact-artifact
reuse. Targeted retry is limited to the exact artifact and exact harness cohort.
`release:cohort-plan` and `release:operator` remain inspection and
diagnostic components behind this entry, not competing manual release paths.
If source preparation exposes a stale App head, unresolved shell/framework ref,
wrong shell type/format, dirty source checkout, or release-boundary/source-gate
failure, repair that root cause before submitting a broker request. Monitoring
is controller-owned, read-only and bounded by one absolute deadline. At 60
minutes it warns; at 90:00 the circuit breaker rejects every new release train.
Only an exact-artifact targeted recovery request or typed-blocked terminal may
continue, and neither path repeats an unknown mutation.
After a primary gate fails, `failed_gate_draining` means
queued jobs are settling, and `stale_candidate` means the old run is diagnostic
evidence only. Neither state can be promoted or reinterpreted as release-ready
for a newer cohort. If the release process must be repaired while a run is in
flight, reconcile it read-only. An emergency cancel is a separate
broker-authorized mutation with its own durable attempt; ordinary controllers
must not stop or supersede runs.

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
readiness failure. Homebrew tap updates and the Homebrew VM smoke run only from
the promote workflow after the draft release has been published and read back.
Published releases cannot be refreshed. A tap update failure, cask lane
cancellation, or missing artifact fails the matching stable closure gate with a
named cause.

`release:owner-candidate-record:verify` command is the post-owner receipt
readback path: it takes the App release-owner receipt record and the ignored
small release artifacts, rebuilds `release-candidate-record.json`, and runs the
same promote-ready validator. Its output is a verification artifact only; it
does not publish a release, mutate updater metadata, claim App release ready, or
claim OPL family production ready.
When this is the only missing same-cohort input, the controller verifies the
post-owner candidate record, durably records the planned promotion attempt, and
submits it to the isolated broker. The operator does not dispatch either
workflow and must not rerun `desktop-release.yml` to carry owner metadata.

The one-shot installer section records the fixed public entry command, the
workflow job result as bootstrap status source, the
`opl system initialize --json` setup-flow source, artifact file names, progress
fields, blockers, next step, retry state, and `--skip-packages` state in JSON and
the Markdown summary.

Draft candidate discovery is an explicit read-only metadata operator step. Use
**OPL Desktop Release Cleanup Drafts** or `release:cleanup-drafts` after the
stable `v<version>` Release is published to list stale
`v<version>-draft.*` and `v<version>-readiness.*` drafts. A deletion request is
typed-blocked while the release broker has no dedicated cleanup mutation. Only
a separately signed broker attempt may eventually delete a Release and tag;
ordinary release workflows and this CLI never do so directly. Upload or publish
failure retains the incomplete draft and writes
`opl_app_release_publish_recovery_receipt.v1` for same-cohort resume. This path
does not download standard or Full DMG assets.

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
