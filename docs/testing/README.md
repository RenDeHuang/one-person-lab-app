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
selectors with App-owned Codex model selector/status, home prompt, Settings System/Runtime/About/Update/Theme coverage,
module path source explanation, stable/nightly release gating, MDS non-default
display, and OPL Flow context before shell validation runs.
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
after execute, and explicit non-authority boundary fields.

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

## Installed App Smoke

After a standard macOS build, replace the installed app and run the packaged GUI
smoke against the real `/Applications` bundle:

```bash
node shells/aionui/scripts/opl-first-run-vm-smoke.mjs \
  --dmg shells/aionui/out/One-Person-Lab-<version>-mac-arm64.dmg \
  --artifacts artifacts/opl-installed-smoke-<stamp> \
  --timeout-ms 180000 \
  --settings-smoke \
  --assistant-route-smoke
```

2026-05-15 evidence: the standard 26.5.15 arm64 DMG replaced
`/Applications/One Person Lab.app`; the previously installed 1.5G app bundle
contained `Contents/Resources/opl-full-runtime`, and the replacement bundle was
354M with no `opl-full-runtime`. The smoke passed with `status=passed` and
label `opl-guid-entry`. Final evidence directory:
`artifacts/opl-installed-smoke-20260515-204923`.

Tart clean-VM smoke reached `wait_for_ssh` against
`opl-first-run-tahoe-base`, received guest IP `192.168.64.87`, timed out before
guest execution, and cleaned up the temporary VM. Evidence directory:
`artifacts/opl-first-run-tart-20260515-205500`.

## Release Matrix

- Contracts/unit: `npm run test:release-boundary`.
- Standard release metadata: `node --experimental-strip-types scripts/validate-release.ts release-assets`.
- App-owned release boundary: `npm run validate:release-boundary`.
- Nightly standard release: `.github/workflows/nightly-standard-release.yml`
  is the lightweight profile. It publishes standard macOS arm64 prerelease
  assets only; `npm run test:release-boundary` locks the semver prerelease tag,
  `--latest=false`, remote standard verification, and no-Full boundary. It does
  not run Full packaging, VM install gates, one-shot installer, Docker/WebUI, or
  operator evidence gates.
- Stable release: `.github/workflows/desktop-release.yml` is the full user-path
  profile when `run_vm_smoke=true`. It must cover standard DMG clean-VM install,
  Full DMG clean-VM install when Full is included, the App one-shot installer,
  Docker/WebUI over HTTP, remote standard/Full verification, and the release
  evidence bundle.
- Fallow production hygiene: `npm run hygiene:fallow -- --format json --summary`.
- Active GUI shell validation: `npm run validate:gui-shell`.
- App product profile sync: standard and Full release preparation must generate
  the active shell `shell_contract.paths.product_profile_target` declared in
  `contracts/app-shell-adapter.json`.
- Full first-install package: `npm run release:full -- --version <version>`.
- GUI smoke: installed `/Applications/One Person Lab.app` smoke or the App repo
  VM workflow. The standard DMG gate uses `--runtime-profile standard` to prove
  launch, App-managed bootstrap/readiness, and Settings navigation. The Full DMG
  gate uses `--runtime-profile full` to add bundled runtime materialization and
  Full readiness checks after `ready_to_launch`. The Full gate proves the
  pre-`/guid` Core launch gate through `opl system initialize --json`; the gate
  requires only workspace root, Codex CLI, and Codex config. If the Codex/OpenAI
  API key wizard appears during first launch, the smoke submits it and records
  that path, but Full release readiness is based on Codex config readiness rather
  than requiring the wizard UI to be shown. Domain modules, the family runtime
  provider, recommended skills, native helpers, CLT, git, managed repo sync, and
  ecosystem updates are Full readiness or deferred maintenance and must not
  block `ready_to_launch`. First-run progress evidence must map visible phase,
  Core progress, Full readiness progress, background maintenance counts,
  blockers, and next step back to `opl system initialize --json` /
  `system_initialize.setup_flow`; release tests must not accept a separate
  installer-local progress authority. VM smoke evidence must also include a
  first-run screenshot/layout gate proving the beginner-first default: the
  visible first screen is limited to the simplified readiness summary, three
  setup steps, Core progress, the primary entry action, and the next visible
  user step, while technical phase labels, refresh, runtime settings, raw
  errors, and maintenance actions are folded under technical details by
  default. When `--codex-functional-check` is enabled, the same VM smoke writes
  `codex-functional-check-summary.json` as a post-install functional receipt for
  Codex behavior: UI language, App-managed `opl-flow` context expectation,
  user `AGENTS.md` policy, Codex CLI detection, MAS/MAG/RCA route receipts, and
  skill/plugin visibility. The App-managed context is session-scoped preset
  context, localized from the current UI language, and must not write or
  overwrite a user's workspace `AGENTS.md`. The receipt is deterministic and
  does not call an external LLM; missing credentials are recorded as diagnostic
  skipped rather than a network gate. When `--codex-ai-self-check` is enabled,
  the VM smoke runs a second, non-blocking AI-first stage after the deterministic
  receipt: Codex CLI receives the target installed OPL working mode and the
  collected evidence, then writes `codex-ai-self-check-summary.json` with a
  structured judgment and recommended actions. The default `diagnose` mode is
  read-only and must not overwrite user `AGENTS.md`; any future fix mode remains
  explicit. Product UI exposes the same principle after setup: real first-run
  completion or the ready entry opens `/guid` with a localized Codex CLI task
  that asks the user-facing Codex session to verify the installed working mode
  against the target state. That App entry remains diagnosis-first; repair
  commands or file mutations require explicit user confirmation. The App repo
  VM workflow is the deterministic release-blocking gate
  for first-run GUI evidence; Codex App or Computer Use sessions may explore UI
  behavior during triage, but those exploratory checks are non-blocking and
  cannot replace the Tart VM gate. Any exploratory finding that should affect
  release readiness must be converted into a deterministic contract, workflow,
  or script gate before it can block or clear a release.
- Release tuning evidence: Full workflow cache hits and step timings are stored
  in `full-workflow-telemetry.json` artifacts, including
  `duration_seconds.full_package_build` and
  `duration_seconds.full_package_build_breakdown`. These artifacts help compare
  build speed across runs; they do not replace release manifests, checksums,
  remote verification, VM smoke artifacts, or evidence bundle validation.
  `cache.shell_vite_output` records whether the Full workflow reused the
  active-shell Vite output. When it is `true`, the Full shell build skips Vite
  bundling and still repackages/signs/verifies the Full DMG after runtime
  payload sync; when it is `false`, the workflow runs the normal full shell
  build and saves Vite output for later runs. The Vite cache key is scoped to
  the release version and renderer/main/preload inputs because the shell build
  injects the release version into the bundled output. Packager-only script or
  Electron Builder config changes should not invalidate the Vite cache. The same
  telemetry includes `cache.electron_artifacts` for Electron/Electron Builder
  download cache hits.
  Full workflows also upload `opl-full-diagnostics-<version>`, a small
  diagnostics artifact with telemetry, `full-package-build-timing.json`,
  `full-package-manifest.json`, `runtime-cache-events.json`, `SHA256SUMS.txt`,
  and the Full README so cache and hash checks do not require downloading the
  large Full DMG. `runtime-cache-events.json` includes per-layer cache keys and
  key inputs so operators can see whether a miss came from payload refs,
  toolchain versions, skill source fingerprints, packager inputs, or the runtime
  exclusion policy. Warmup runs do not upload the large Full package artifact;
  release-called Full builds still do because publish and VM gates consume the
  DMG.
- Full size/cache summary checks: `release-readiness-summary.json` stays
  `passed` when the Full DMG is above `warning_full_dmg_bytes=600000000` and at
  or below `max_full_dmg_bytes=650000000`, but it must include a warning in JSON
  and markdown. The same summary must expose runtime cache `miss_written` layer
  names and counts from `runtime-cache-events.json` for the next cache-key
  optimization pass.
- Final readiness diagnostics: the `release-readiness-summary` job is the final
  stable pass/fail entry. It reads dependency results plus only small artifacts:
  remote verification JSON, VM smoke summaries, one-shot installer output,
  Docker/WebUI smoke output, Full diagnostics, and telemetry. It fails closed
  when a required remote, VM, one-shot, Docker/WebUI, or Full timing gate is
  failed, cancelled, missing, or unexpectedly skipped. It must not download the
  standard DMG, the large Full DMG workflow artifact, or published DMG assets
  for diagnosis. The one-shot fields are diagnostic machine fields derived from
  the public installer entry, the job result, and
  `opl-one-shot-system-initialize.json`; they expose setup-flow status/source,
  progress, blockers, next step, retry, and skip-module state without creating a
  separate installer-local readiness authority.
- Standard DMG clean VM smoke: the packaged App must run its bundled
  `opl-install.sh` bootstrap carrier if `opl` is missing, reach
  `ready_to_launch` through `opl system initialize --json`, and only then enter
  `/guid`. The smoke keeps Full-only runtime equivalence out of the standard
  profile but still uploads `system-initialize.json` as the core readiness
  proof.
- One-shot installer: the App root `install.sh` remains the public entrypoint.
  Stable verification runs it against a checked-out Framework installer with
  `OPL_INSTALL_SCRIPT_URL=file://.../one-person-lab/install.sh ./install.sh
  --complete --skip-modules`, then runs `opl system initialize`.
- Scheduled VM smoke backlog: the App repo VM workflow must cancel stale
  scheduled runs through GitHub Actions concurrency while keeping manual and
  release-called validation runs serialized in a separate non-cancelling group.
  Repository variable `OPL_FIRST_RUN_TART_SOURCE` must point to a local Tart
  base VM on the self-hosted runner; the current source VM is
  `opl-first-run-no-clt-clean-base-26-5-18`. Missing source-VM configuration is
  a failed gate because no clean first-run evidence can be produced.
  The workflow copies the GitHub runner's Node.js runtime into the guest for
  the smoke harness, so the clean VM does not need preinstalled Node.js, CLT, or
  other developer tooling.
  `npm run test:release-boundary` locks this workflow policy.
- Docker/WebUI: build from `shells/aionui/Dockerfile`, run the container, and
  verify HTTP 200 for `/` and `/manifest.webmanifest`.
- Release-called VM smokes consume the same-run standard or Full DMG workflow
  artifact for draft candidates, while keeping the release tag as provenance.
  Remote verification remains responsible for proving that the published
  GitHub Release assets match the release manifest and checksums.

## Release CI Operations Boundaries

The release-speed work keeps packaging and installation proof separate from
workflow-operations hygiene:

- `actionlint` is the workflow semantic gate in the reusable build quality
  jobs. YAML parsing only proves syntax; `actionlint` is the check that should
  fail semantic GitHub Actions mistakes.
- Release workflows must set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` in
  top-level `env` so checked-in JavaScript actions run on GitHub's Node 24
  action runtime. `npm run test:release-boundary` and
  `npm run validate:release-boundary` lock this policy.
- GitHub Actions `concurrency` is duplicate-run governance. It collapses stale
  scheduled queues or serializes operator runs; it is not release evidence and
  does not replace remote verification, installer smoke, or VM gates.
- Machine-readable telemetry artifacts are post-release tuning inputs. Step
  summaries and ad hoc text artifacts are useful for operators, but a JSON
  telemetry artifact should be treated as the basis for later cache/matrix
  tuning, not as the source of release truth.
- Full package tuning reads both `full-workflow-telemetry.json` and
  `runtime-cache-events.json`; the first captures workflow-level cache and
  timing surfaces, and the second records per-layer Full runtime cache status.
  Prefer `opl-full-diagnostics-<version>` for remote tuning because it contains
  those files plus manifest and checksum evidence without the large DMG.
- Composite/setup reuse is allowed only when the shared action is checked in
  and release-boundary tests lock its behavior. The current active-shell
  checkout/setup/cache reuse lives in `.github/actions/setup-active-shell-deps`.

## VM and AI-first testing boundary

Stable release installation proof uses deterministic automation as the blocking
gate. The VM lane downloads the published DMG, clones the configured clean
no-CLT Tart base VM, fixes the display size, installs the App, launches it, and
collects first-run/settings artifacts and assistant route smoke evidence,
including screenshots, layout checks for the first-run view, MAS/MAG/RCA Codex
route receipts, and the Codex functional check receipt when
`--codex-functional-check` is present. That receipt freezes installed-App Codex
behavior in machine-readable form while keeping actual AI/LLM exploration
non-blocking until it is converted into deterministic evidence. When
`--codex-ai-self-check` is present, the same VM lane also writes a structured
Codex CLI AI self-check receipt. This is the intended AI-first layer: after
normal initialization succeeds, Codex reads the target state and evidence and
decides whether the App-owned working mode really matches expectation. It is a
diagnostic receipt, separate from Computer Use, and does not clear or block a
stable release by itself. That lane is the source of release
readiness for standard DMG and Full DMG installation because it is repeatable,
time-bounded, and produces comparable logs.

Codex App or Computer Use based UI exploration is useful, but it is not the
blocking release gate by itself. Use AI-first exploration for pre-release user
journeys that are hard to script yet: visual regressions, unclear first-run
copy, unexpected modal ordering, long waits, or accessibility of Settings
paths. The output of that lane should be screenshots, operation notes, and
candidate regressions. Once a finding is stable, convert it into the VM smoke,
Playwright, contract, or shell test surface before it becomes release-blocking.

This keeps the full validation plan fast and usable:

- PR/local: contract and release-boundary checks.
- Nightly: standard package build and remote standard asset verification.
- Stable: standard DMG VM, Full DMG VM, one-shot installer, Docker/WebUI,
  remote standard/Full verification, and evidence bundle validation.
- Codex CLI AI self-check: non-blocking post-install diagnostic receipt.
- Exploratory Computer Use: non-blocking unless its findings are converted into a
  deterministic gate.

Release-note validation is part of the same boundary. Public GitHub Release
notes are AI-first English prose generated from deterministic evidence JSON:
Stable compares with the previous Stable, Nightly compares with the previous
Nightly, and the primary story is the OPL App package carrying or exposing OPL
agents and runtime payloads. Stable/Full notes must include exact payload refs
and payload deltas from `full-package-manifest.json`; Nightly notes must
describe the standard App-managed MAS/MAG/RCA/OPL Meta Agent entry surface and
Codex plugin/skill sync policy while stating that Full runtime payloads are not
in Nightly. When Full manifests expose local component `source_path` repos, the
evidence must include concrete `agent_runtime_changes` commit summaries so the
note can explain agent/runtime improvements before audit refs. The quality gate
rejects vague boilerplate, Chinese text, self-referential release-note copy,
process-first openings, missing agent names, and missing user impact before
release publication. It also requires the opening user-benefit paragraph before
any section heading, keeps payload evidence as normal bullets, and rejects
role-only payload copy when concrete runtime change hints are available. Tests should use `OPL_RELEASE_NOTES_AI_COMMAND` to inject a fake provider; only dry-run
diagnostics may set `OPL_RELEASE_NOTES_MODE=template`. GitHub release jobs pass
`OPL_RELEASE_NOTES_PROVIDER=auto`, request `models: read`, use GitHub Models
with `GITHUB_TOKEN` first, and fall back to explicit Codex provider
configuration through `OPL_RELEASE_NOTES_CODEX_*` vars and the
`OPL_RELEASE_NOTES_CODEX_API_KEY` secret. They generate a temporary
`CODEX_HOME/config.toml` for that fallback and upload the small
`release-notes-evidence-<version>` JSON artifact instead of downloading large
DMG/ZIP assets for note diagnosis.

2026-05-15 Docker/WebUI evidence: `docker build -t
one-person-lab-webui:26.5.15-smoke .` completed from `shells/aionui`, the image
size was `1132840811` bytes, and a container on `127.0.0.1:33015` returned HTTP
200 for `/` and `manifest.webmanifest`.
