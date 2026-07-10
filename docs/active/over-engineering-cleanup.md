# Over-Engineering Cleanup Boundary

Status: active cleanup boundary
Scope: guide generation, release helper scripts, and active-shell validator cleanup
Last updated: 2026-07-10

## 2026-07-10 One-Step Completion Plan

The approved cleanup is executing in three isolated, parallel lanes and is only complete after each candidate is absorbed to `main`, the combined diff is verified, and the worktrees are removed.

| Slice | Scope | State recorded by this branch | Main closeout evidence |
| --- | --- | --- | --- |
| platform and docs | guide asset/verification deduplication, whitepaper builder inlining, Node `fs.cpSync` / `fs.globSync` replacement | `implemented_in_candidate`; absorption pending | generator readback, behavior probes, combined tests, absorbed commit |
| release-dead | dead release-note setup surface and unused release helpers | `pending_parallel_lane_readback` | parallel-lane commit, diff review, focused release validation, absorbed commit |
| tests-release-dead | orphan release fixtures, dead aliases, and unused test exports | `pending_parallel_lane_readback` | parallel-lane commit, diff review, focused/full release tests, absorbed commit |

The last two rows are deliberate closeout placeholders, not completion claims. The main absorption owner must replace them with the actual commit, verification, and absorption result or record a concrete blocker.

## Landed Safe Slices

### 2026-07-10 guide, whitepaper, and Node platform simplification candidate

- Reused `05-opl-ready-research-entry.png` for both `research_entry` and `first_research_task`; the manifest and generated Quarto/slide verification records retain both semantic roles while the byte-identical `07-first-research-entry.png` is removed.
- Removed the byte-identical `macos-app-install-html-verification.json` and the guide-specific duplicate-write branch. `macos-app-install-verification.json` is the single long-form HTML/PDF verification record; slide verification remains separate because it describes a different renderer and artifact set.
- Replaced the guide's recursive screenshot copier with Node `fs.cpSync` using explicit recursive, dereference, and overwrite behavior, and removed the unused `writeProject` QMD parameter.
- Inlined the sole whitepaper builder consumer into `scripts/build-opl-app-whitepaper.ts` and removed the unused generic configuration layer and `scripts/opl-whitepaper-builder.ts`. Source, output paths, validation messages, command execution, verification schema, and rendered-page hashes remain unchanged.
- Replaced `copyTreeFiltered` with Node `fs.cpSync` and replaced size, quarantine, and external-symlink traversal loops with Node `fs.globSync`. The glob pattern set explicitly includes hidden entries; symlinks are collected through `exclude` so they remain countable/checkable without being traversed.
- Preserved invariants: missing and root-file size behavior, root symlink behavior, regular-file-only analysis totals, hidden descendants, external symlink detection, filtered runtime paths, dereferenced copy output, executable mode bits, and root inclusion for quarantine checks.
- Required verification for this slice: `npm run docs:publishing-templates`, `npm run docs:macos-guide:quarto`, `npm run docs:macos-guide:slides`, `npm run docs:whitepaper`, focused Node probes for copy/glob/root/symlink/mode behavior, relevant Full/guide release tests, `git diff --check`, stale-reference scans, generated verification readback, and final worktree evidence binding before absorption.

### 2026-07-07 guide generation and delivery assets

- Removed the one-hop `scripts/build-docker-webui-guide.ts` wrapper. `npm run docs:docker-webui-guide` now calls `scripts/build-quarto-guide.ts docker-webui-install` directly.
- Removed the equivalent `docs:macos-guide:html` and `docs:macos-guide:pdf` aliases. Use `npm run docs:macos-guide:quarto` for the shared Quarto HTML/PDF build.
- `scripts/build-user-guide-slides.ts` now references canonical screenshots under `docs/guides/macos-app-install/screenshots` from generated Marp markdown, so tracked duplicate delivery PNGs are not needed for slide generation.
- Deleted only delivery PNGs whose SHA256 matched the canonical screenshots manifest source. Kept `docs/delivery/user-guides/macos-app-install/assets/06-research-data-folder.png` because its hash differs from `docs/guides/macos-app-install/screenshots/06-research-data-folder.png`; this cleanup does not decide whether that nonduplicate historical asset still has product value.
- Verification required for this slice: `npm run docs:docker-webui-guide`, `npm run docs:macos-guide:slides`, and `git diff --check`.

### 2026-07-07 release notes sanitization

- `scripts/release-notes-ai-writer.ts` factored repeated developer-term cleanup inside `sanitizePreTechnicalDeveloperTerms` into private string helpers.
- Why safe: the split stays in one file, preserves the existing pre-Technical-details vs Technical-details behavior, and does not change provider selection, command execution, JSON parsing, release-note validation, or publish flow.
- Verification required for this slice: `git diff --check` plus a focused release-notes test or direct `release-notes-ai-writer.ts --input/--evidence` command that exercises the sanitization path.

### 2026-07-07 delivery asset and simple CLI parser cleanup

- Removed `docs/delivery/user-guides/macos-app-install/assets/06-research-data-folder.png`; current guide, generated delivery markdown, slide markdown, and verification refs point at the canonical `docs/guides/macos-app-install/screenshots/06-research-data-folder.png` source instead.
- `scripts/generate-release-notes.ts` was already on `node:util.parseArgs`, so this slice left it unchanged.
- `scripts/publish-release.ts` now uses `node:util.parseArgs` for its simple boolean and string release options instead of a hand-rolled argv loop.
- At this point `scripts/cli-option-args.ts` stayed because release cohort, readiness, operator, evidence, and Docker/WebUI dispatch scripts still imported it; the later stdlib release helper cleanup slice removes it.
- Verification required for this slice: `git diff --check`, focused parser probes for `generate-release-notes.ts` and `publish-release.ts`, and `rg` checks proving the deleted delivery asset path and `cli-option-args.ts` imports are understood.

### 2026-07-07 guide helper and candidate evidence duplicate shrink

- `scripts/guide-script-helpers.ts` now owns the shared guide-script primitives for file hashing, PNG dimension checks, template expansion, generated-text scanning, and generated lifecycle front-matter insertion. `scripts/build-quarto-guide.ts` and `scripts/build-user-guide-slides.ts` keep their guide-specific manifest and rendering logic.
- `scripts/validate-shell-candidates/candidate-evidence.ts` now uses file-local helpers for the common candidate `.app` package manifest base checks and repeated expected-field assertions. Candidate-specific AGUI, native-workbench, and Hermes evidence rules stay in their original validator functions.
- No-safe boundary: do not collapse generated lifecycle text across guide scripts, because the guide Markdown and Marp deck machine-boundary text intentionally names different source/artifact authorities. Do not promote candidate evidence helpers into a new framework until another validator family shares the same package-manifest semantics.
- Verification required for this slice: `git diff --check`, `npm run docs:docker-webui-guide`, `npm run docs:macos-guide:slides`, and `npm run validate:shell-candidates`.

### 2026-07-07 macOS guide Marp theme extraction

- Moved the macOS guide Marp theme CSS out of `scripts/build-user-guide-slides.ts` and into `docs/publishing/templates/opl-guide/marp-theme.css`, the existing guide-owned publishing template location.
- `scripts/build-user-guide-slides.ts` now reads that static theme source and still writes the generated theme to `docs/delivery/user-guides/macos-app-install/generated/macos-app-install-marp-theme.css`.
- Why safe: the generated path and Marp theme name stay unchanged; the generator keeps owning the delivery write, while the CSS source is reviewable as a static template asset.
- Verification required for this slice: `npm run docs:macos-guide:slides` and `git diff --check`.

### 2026-07-07 shell candidate blocker and evidence cleanup

- Removed `scripts/validate-shell-candidates.ts`'s file-list blocker projection. Missing checkout and implementation-file failures now stay with the candidate contract and evidence validators instead of a second hand-maintained Native/Hermes list in the CLI summary.
- `scripts/validate-shell-candidates/candidate-evidence.ts` keeps Native Workbench and Hermes package evidence in their candidate-specific validators, but shares the local `.app` bundle executable/symlink/profile check and uses named expected-field tables for repeated non-adoption assertions.
- Preserved product roles: AionUI remains the active GUI mainline, OPL Native Workbench remains the foreground alternative, Hermes remains the explicit reference candidate, and AGUI remains archived technical proof.
- Verification required for this slice: `npm run validate:shell-candidates` and `git diff --check`.

### 2026-07-07 stdlib release helper cleanup

- `scripts/release-file-helpers.ts` now uses Node `fs.globSync` for file discovery and keeps exact basename matching in the helper instead of maintaining a manual recursive stack.
- Removed the one-hop `scripts/cli-option-args.ts` helper. Release cohort, readiness, operator, candidate-record, gate-reuse, evidence-manifest, and Docker/WebUI dispatch parsers now use `node:util.parseArgs` or file-local pass-through parsing where a subcommand forwards arguments to an existing parser.
- Updated release evidence validation fixture copies so temporary app roots no longer copy the deleted CLI option helper.
- Verification required for this slice: `git diff --check`, focused parser probes for the changed CLI entrypoints, `node --test` release tests that cover cohort/operator/candidate/gate/evidence/dispatch behavior, and `rg` checks proving scripts/tests no longer depend on `cli-option-args.ts`.

### 2026-07-07 local ignored artifacts and WebUI assertion helper reuse

- Local ignored-artifact cleanup is safe only as worktree hygiene: remove ignored generated files from the active lane when they are not tracked product, release, contract, or runtime truth. Do not encode ignored-artifact cleanup as App behavior or release readiness.
- `scripts/validate-webui-runtime-image.ts` and `scripts/validate-webui-runtime-smoke-receipts.ts` now reuse `scripts/value-assertions.ts` for repeated expected-field and string-array inclusion assertions instead of keeping duplicate file-local equality/includes helpers.
- Why safe: the slice keeps each validator's parsing, required-field checks, summary output, and WebUI runtime receipt/image semantics in place. It does not add `validator-utils`, touch contracts, or reshape validator ownership.
- Verification required for this slice: `git diff --check`, the existing WebUI runtime smoke receipt test, and a direct `validate-webui-runtime-image.ts` fixture command for the image validator.

### 2026-07-08 local ignored artifact lifecycle

- `scripts/cleanup-local-artifacts.ts` is the executable lifecycle entrypoint for local ignored generated output. `npm run cleanup:local-artifacts` defaults to dry-run; `--execute` is required before deletion.
- Managed scopes are `tmp/`, `docs/site/latest/`, generated Full runtime payload dirs, and top-level `artifacts/*` run directories. `artifacts/*` uses `--keep-days` retention, defaulting to 7 days, so current release/debug evidence is not removed by an ordinary cleanup run.
- Explicitly excluded: `.claude`, `.codegraph`, `.superpowers`, and ignored external shell checkouts under `shells/`.
- Verification required for this slice: syntax check, dry-run for all scopes, an execute check on a recreateable scratch scope, and `git diff --check`.

### 2026-07-08 generated guide snapshot cleanup

- Removed tracked generated guide snapshots under `docs/delivery/user-guides/*/generated/`. The guide source QMD, source manifests, screenshot manifests, verification JSON, and publishing templates remain the maintained surfaces.
- `.gitignore` now ignores regenerated user-guide snapshots so `npm run docs:*` can recreate them locally without polluting App main.
- `scripts/publish-docs-latest.sh` now accepts only `OPL_DOCS_BUILD_COMMAND` or this repo's `docs:latest` script; the unrelated cloud-whitepaper fallback was removed.
- Verification required for this slice: `bash -n scripts/publish-docs-latest.sh`, `git diff --check`, generated-link grep checks, and a future `npm run docs:guides` when guide publication output must be refreshed.

### 2026-07-08 stdlib parser cleanup

- `scripts/build-full-first-install-package/env.ts` and `scripts/validate-active-shell/validation-config.ts` now use Node `node:util.parseArgs` token parsing instead of hand-rolled argv loops.
- The Full parser keeps the existing `--opl-root` alias, path resolution, boolean flags, runtime cache mode validation, and legacy rejection of `--key=value` inline syntax.
- Focused parser coverage lives in `tests/release/app-release-boundary-cases/full-first-install-args.ts`.
- Verification required for this slice: the focused parser test, an active-shell quick parser command with a real shell root, and `git diff --check`.

### 2026-07-08 release workflow path duplicate cleanup

- The duplicated workflow path list was first replaced with a re-export from `scripts/validate-release-boundary/release-checks.ts`; the remaining test-only re-export is removed in the 2026-07-10 dead-fixture cleanup after its last consumer is deleted.
- Why safe: the release-boundary script remains the App-owned gate source, while tests neither shadow nor expose an unused copy of that surface.
- Verification required for this slice: the release-boundary test entrypoint with an explicit active shell root and `git diff --check`.

### 2026-07-08 release-boundary shadow test cleanup

- Removed release-boundary tests that only duplicated App contract or workflow text already gated by `scripts/validate-release-boundary/*`, `scripts/validate-active-shell.ts`, `scripts/validate-agent-installation-contract.ts`, and focused release readiness tests.
- Deleted `tests/release/release-speed-vm-plan.test.ts` and `tests/release/app-release-boundary-cases/workflow-release-channels/desktop-release-workflow.ts`; the remaining release-channel checks stay in validators and focused release-boundary behavior tests.
- Deleted the large contract snapshot tests `tests/release/app-release-boundary-cases/app-gui-product-contract.ts` and `tests/release/app-release-boundary-cases/product-profile-and-install-exposure.ts`. The App GUI/product profile/install exposure contract checks remain executable through active-shell validation, agent installation validation, release-boundary validation, and narrower behavior tests.
- Kept behavior tests for release planning, preflight, readiness aggregation, release assets, evidence validation, active shell adapter behavior, settings, runtime page evidence, Full package behavior, and installer/runtime boundaries.
- Verification required for this slice: `npm run test:release-boundary`, `npm run validate:release-boundary`, `npm run validate:active-shell -- --quick`, `npm run validate:agent-installation`, and `git diff --check`.

### 2026-07-08 release-boundary workflow shadow cleanup

- Deleted `tests/release/release-readiness/workflow-contract-cases.ts`, `tests/release/app-release-boundary-cases/release-operations-workflows.ts`, and the remaining `tests/release/app-release-boundary-cases/workflow-release-channels/*` aggregator.
- Why safe: these files asserted workflow YAML strings, contract field echoes, package script literals, and validator-case presence already owned by `scripts/validate-release-boundary/*`, `scripts/validate-active-shell.ts`, `scripts/validate-agent-installation-contract.ts`, and behavior-focused release readiness/candidate/evidence tests.
- Kept behavior coverage for release readiness aggregation, candidate records, release assets/remote verification, publishing behavior, release owner nonready records, Full first-install behavior, settings/runtime evidence, and installer/runtime boundaries.
- Verification required for this slice: touched release test entrypoints, `npm run test:release-boundary`, `npm run validate:release-boundary`, `npm run validate:active-shell -- --quick`, `npm run validate:agent-installation`, and `git diff --check`.

### 2026-07-08 focused test shadow cleanup

- Removed the Node 24 workflow policy shadow test from `tests/release/app-release-boundary-cases/ownership-and-installation-contracts.ts`; the executable owner remains `scripts/validate-release-boundary/text-check-runner.ts#validateWorkflowNode24Policy`.
- Removed duplicated Full runtime packaging source-regex assertions from `tests/release/app-release-boundary-cases/full-first-install-cache-and-acceleration.ts`; the cache test keeps cache key, support files, gate reuse, compression, and release-acceleration assertions, while Full runtime packaging assertions stay in `tests/release/app-release-boundary-cases/full-first-install-runtime.ts`.
- Verification required for this slice: focused Node test for the two touched case files, `npm run validate:release-boundary`, and `git diff --check`.

### 2026-07-08 release notes source-regex shadow cleanup

- Removed the release-boundary test that only regex-locked `scripts/publish-release.ts` and `.github/workflows/full-first-install-release.yml` source text for Full release notes.
- Why safe: the same case file keeps behavior coverage for template, AI, prepared-file, same-tag, Full-only, and evidence-output release notes paths; workflow/source text remains owned by the release scripts and release-boundary validator.
- Verification required for this slice: focused Node test for `tests/release/app-release-boundary-cases/release-plan-and-publishing.ts`, `npm run validate:release-boundary`, and `git diff --check`.

## No-Safe-Semantic-Split Boundaries

The following cleanup classes must not be landed as broad mechanical refactors without a focused semantic split and matching verification:

- Command runner unification across `scripts/release-cleanup-helpers.ts`, `scripts/release-notes/command.ts`, `scripts/build-full-first-install-package/process.ts`, and `scripts/guide-script-helpers.ts`.
  These runners intentionally differ in capture behavior, error handling, env propagation, `maxBuffer`, null-vs-throw semantics, and inherited stdio. A shared runner is only safe when one caller group is isolated and its observable stdout/stderr/status behavior is covered.
- JSON helper consolidation across `scripts/release-json-helpers.ts`, release notes, publish, and cleanup scripts.
  Some call sites need strict object/array coercion, others intentionally allow raw `JSON.parse` failures or line-delimited parsing. Consolidation must keep parse-error wording and schema-boundary behavior visible.
- Active-shell validator cleanup under `scripts/validate-active-shell/*`.
  Validator structure encodes App product truth and shell adapter expectations. Do not reshape it for aesthetics; first identify one validator rule, its owning contract/doc, and the command proving that rule still gates the intended behavior.
- Hermes validator consolidation.
  Merging Hermes candidate validator paths is `no-safe-semantic-split`: Hermes is a reference candidate with different adoption status, evidence shape, and shell boundary from the active AionUI path and the OPL Native Workbench foreground alternative. Any consolidation needs an owner-approved semantic split that names the preserved candidate role and focused validator evidence.
- Contract shrink.
  Shrinking App product, release, install exposure, shell adapter, or page-state contracts is `no-safe-semantic-split`: contracts are the App-owned truth surface, not just duplicate prose. A shrink must first prove which owner surface now holds each removed requirement and which validator/readback still gates it.
- First-run matrix schema redesign.
  Reshaping first-run matrix schema is `no-safe-semantic-split`: the schema controls packaged first-run expectations and cannot be mechanically compacted without preserving migration semantics, page-state acceptance, and active-shell validation coverage. Open a separate owner-approved semantic split before changing it.
- Release cleanup helper expansion.
  `release-cleanup-helpers.ts` is currently scoped to destructive-release cleanup scripts. Do not promote it into a general release runner unless the new caller shares dry-run/execute semantics and has a destructive-action safety check.
- Release closeout / GitHub Actions timing helper consolidation across `scripts/closeout-release-run.ts` and `scripts/summarize-github-actions-timing.ts`.
  This remains a no-safe-semantic-split boundary. The apparent duplicate timing helpers are tied to different CLI contracts: release closeout is a single-run release decision/readback path with local artifact inputs, optional artifact downloads, `runStartedAt` handling, and agent start/finish fallback; the Actions timing summarizer is a multi-run timing report that accepts arrays/nested `runs`, treats GitHub zero-date timestamps as missing, falls back to `completedAt` for run end, and emits Markdown top jobs/steps. A shared helper would need behavior switches to preserve those differences, which would add a new abstraction without removing release risk.

## Future Slice Requirements

Each future cleanup slice must include:

- one owner surface or script family;
- explicit preserved behavior, including stdout/stderr/status and file-write side effects when relevant;
- one focused verification command that fails on the preserved behavior if the cleanup is wrong;
- no edits to contracts, release workflow package metadata, CLI parseArgs worker files, or broad validator structure unless the user explicitly opens that write set.
