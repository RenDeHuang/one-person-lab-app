# App Root Scripts

The root `scripts/` directory exposes App-level wrappers. The active Electron
shell implementation is checked out from `gaofeng21cn/opl-aion-shell` and
exposes its shell-specific helpers under `shells/aionui/scripts/`.

| Script | Purpose |
| --- | --- |
| `ensure-active-shell.ts` | Clones or validates the external active shell checkout at `shells/aionui`. |
| `validate-active-shell.ts` | Validates `contracts/app-shell-adapter.json` and runs selected active shell validation commands. |
| `prepare-release-assets.ts` | Calls the active shell release asset normalizer from the App root. |
| `validate-release.ts` | Verifies release assets and enforces that standard updater metadata excludes Full first-install assets. |
| `verify-remote-release-assets.ts` | Downloads GitHub Release assets and verifies remote size, sha256 digest, updater metadata, Full manifest, Full README language, Full checksums, and Full size budgets. |
| `publish-release.ts` | Creates or refreshes App GitHub Release assets from local shell output, prebuilt standard assets, and optional Full first-install assets. |
| `plan-release-candidate.ts` | Prints the Nightly or Stable release lane plan, including purpose-based installation gates. |
| `analyze-full-package-size.ts` | Reads `full-package-manifest.json` and reports Full runtime component/layer size, budget use, and optional runtime-root top entries. |
| `collect-release-evidence.ts` | Collects live OPL runtime snapshot, App/operator drilldown, and selected safe-action dry-run/execute JSON into a release evidence bundle, then writes the manifest without claiming missing screenshot, VM, settings, or remote evidence. |
| `write-release-evidence-manifest.ts` | Writes `evidence-manifest.json` for a release evidence bundle and marks absent VM/remote artifacts as missing evidence. |
| `validate-release-evidence-bundle.ts` | Validates a release evidence bundle manifest and artifact files; default validation fails closed when required evidence is missing. |

Stable App-root npm entries are `validate:release-boundary`,
`validate:gui-shell`, `release:evidence:manifest`, `release:evidence:validate`, and
`hygiene:fallow`. These keep release boundary/evidence scripts visible as
production entrypoints while the files remain thin App-owned wrappers around
contracts and release artifacts. App-root fallow config excludes
`shells/aionui/**` because that path is an ignored external shell checkout.
`hygiene:fallow` is not GUI shell build or runtime evidence; `validate:gui-shell`
runs the full active shell validation list and the shell GUI compile path
through App wrappers. Run shell hygiene in `gaofeng21cn/opl-aion-shell`.

Examples:

```bash
node --experimental-strip-types scripts/ensure-active-shell.ts
node --experimental-strip-types scripts/validate-active-shell.ts --quick
node --experimental-strip-types scripts/validate-active-shell.ts --only i18n_types,i18n_check,typecheck
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
npm run release:publish -- --no-build --version <version> --standard-artifacts-dir release-assets
npm run verify-remote-release -- --version <version> --include-full-package
npm run verify-remote-release -- --version <YY.M.D-nightly>
npm run validate:release-boundary
npm run release:evidence:manifest -- --bundle-dir release-evidence/<version>
node --experimental-strip-types scripts/collect-release-evidence.ts --bundle-dir release-evidence/<version> --action-id <opl-runtime-safe-action-id> --execute-action --overwrite
npm run release:evidence:validate -- --bundle-dir release-evidence/<version>
npm run hygiene:fallow -- --format json --summary
npm run validate:gui-shell
npm run release:plan -- --version <version> --profile nightly
npm run release:plan -- --version <version> --include-full-package
npm run release:full:size -- --markdown
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-no-clt-clean-base --dmg dist/standard-release/One-Person-Lab-<version>-mac-arm64.dmg --smoke-profile no-clt-clean-vm --display 1920x1080px --settings-smoke --runtime-profile standard
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-no-clt-clean-base --dmg dist/opl-full-release/One-Person-Lab-Full-<version>-mac-arm64.dmg --smoke-profile no-clt-clean-vm --display 1920x1080px --settings-smoke --runtime-profile full
OPL_INSTALL_SCRIPT_URL=file:///path/to/one-person-lab/install.sh ./install.sh --complete --skip-modules
docker build -t one-person-lab-webui:<version> shells/aionui
```

`release:prepare-standard` also copies the App root installer into the active
shell resources as `opl-install.sh`, which is the packaged standard DMG
bootstrap carrier used when clean first launch cannot find `opl`.

Full size policy lives in `docs/release/README.md`: release review records the
compressed DMG size, uncompressed runtime size, and layer breakdown, then uses
`verify-remote-release-assets.ts` as the remote verifier size budget check for
published GitHub Release assets. The remote verifier enforces the compressed
Full DMG budget from the GitHub asset size and the uncompressed runtime budget
from `full-package-manifest.json` `size_breakdown.total_runtime_uncompressed_bytes`.
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
Full packaging excludes local development indexes, dependency caches, tests, and
runtime/user state such as `.codegraph`, `.git`, `.worktrees`, `.venv`,
`node_modules`, `runtime`, `runtime-state`, `runs`, `sessions`, and `tests`;
domain-specific allowlists must come from the owning domain repositories.

The clean no-CLT first-install gate is wired through
`.github/workflows/opl-first-run-vm.yml` and the active shell Tart smoke helper.
It supports `package_profile=standard` and `package_profile=full`. The standard
profile resolves `One-Person-Lab-*-mac-arm64.dmg` excluding Full assets and runs
`--runtime-profile standard`; the Full profile resolves
`One-Person-Lab-Full-*-mac-arm64.dmg` and runs `--runtime-profile full`. Release
workflows pass a same-run workflow artifact for the DMG so draft candidates do
not depend on GitHub Release draft visibility. The release tag stays in the
preflight summary as provenance and remote release verification remains the
published-asset gate. Both profiles clone a clean no-CLT Tart base VM, fix the
logical display at `1920x1080px`, sweep packaged Settings pages, and write
profile-scoped artifacts named `opl-first-run-vm-<profile>-<run_id>`. The Full
profile uses live `opl system initialize --json` output as the pre-`/guid`
`ready_to_launch` proof source, keeps Full runtime readiness on the
release-blocking path, and submits the Codex/OpenAI API key configuration wizard
when the wizard is visible. It does not require the wizard UI when Codex config
is already ready. Command Line Tools, git availability, and managed repo sync
are deferred maintenance. The pre-`/guid` gate requires only workspace root,
Codex CLI, and Codex config; Domain modules, the family runtime provider,
recommended skills, native helpers, CLT, repo sync, and ecosystem updates are
Full readiness or background maintenance and must not block launch. The workflow writes a preflight summary
with runner labels, source VM, guest user, package/runtime profile, DMG path,
display, and artifact output before executing the smoke. Codex App and Computer
Use checks are non-blocking exploratory tools; release-blocking App readiness
must live in deterministic scripts, contracts, or GitHub Actions gates.
Scheduled GitHub Actions runs must have repository variable
`OPL_FIRST_RUN_TART_SOURCE` set to a local Tart source VM on the self-hosted
runner; this runner uses `opl-first-run-no-clt-clean-base-26-5-18`.

`.github/workflows/nightly-standard-release.yml` is the standard-only Nightly
publisher. It reuses the standard build workflow, prepares and validates
standard updater assets, publishes a prerelease semver tag, keeps `latest`
unchanged, and runs the remote standard asset verifier without Full assets.

Stable release verification keeps the heavy installation checks in separate
lanes for speed and debuggability: standard DMG clean VM, Full DMG clean VM,
one-shot App installer, Docker/WebUI, remote verification, and release evidence
bundle validation can identify the exact user installation path that failed.

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
readiness failure.

Full build speed tuning should start with `full-workflow-telemetry.json`.
`cache.shell_vite_output=true` means the Full workflow restored active-shell
Vite output and invoked the shell build with `--skip-vite`; `false` means it ran
the normal shell build and saved the output for the next run. Treat this as a
cache acceleration signal only, not as release truth.

Composite/setup action reuse is used only where a checked-in composite action is
tested and the job still keeps release semantics visible. Active-shell
checkout/setup/cache reuse lives in `.github/actions/setup-active-shell-deps`.
