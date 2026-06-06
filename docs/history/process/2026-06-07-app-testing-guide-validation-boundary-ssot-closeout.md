# App testing guide validation boundary SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_testing_guide_validation_boundary_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable OPL Doc closeout. Current App validation truth stays in `package.json` scripts, `.github/workflows/**`, `.github/actions/**`, App contracts, validation scripts, release-boundary tests, active-shell validation, release artifacts, evidence manifests, updater metadata, and OPL Framework CLI/read-model output consumed by the App.

## Semantic Theme

This lane governed the App testing guide and adjacent validation runbook surfaces:

- active shell checks and App-root validation commands;
- release matrix / VM smoke / release evidence bundle guidance;
- release CI operations boundaries;
- deterministic VM gate versus AI-first / Computer Use exploration;
- fallow hygiene, line-budget, Sentrux, telemetry, and workflow-concurrency boundaries.

The question was whether `docs/testing/README.md` had become a second source of truth for release gates, workflow shape, VM evidence, active shell behavior, release readiness, or App/domain/production readiness.

## Single Source Of Truth

Machine SSOT:

- `package.json` owns App-root script names and command wiring.
- `contracts/app-release-channel.json` owns release-channel, Homebrew, WebUI GHCR, Full first-install, release-evidence, release-acceleration, and validation-profile policy.
- `contracts/app-first-run-test-matrix.json` owns first-run / release VM gate scenario ids and required expectations.
- `contracts/app-gui-product-contract.json`, `contracts/app-page-state-matrix.json`, `contracts/app-product-profile.json`, and `contracts/app-runtime-bridge.json` own GUI, page-state, product-profile, and Runtime page acceptance boundaries.
- `.github/workflows/**` and `.github/actions/**` own actual CI workflow shape, concurrency, permissions, checked-in composite setup, VM gate wiring, release candidate promotion, remote verification, Full warmup, and artifact upload behavior.
- `scripts/validate-active-shell.ts`, `scripts/validate-release-boundary.ts`, `scripts/validate-release-evidence-bundle.ts`, `scripts/write-release-evidence-manifest.ts`, `scripts/collect-release-evidence.ts`, `scripts/summarize-release-readiness.ts`, and related release scripts own executable validation.
- `tests/release/**` owns regression coverage for release profiles, workflow boundaries, evidence classification, active-shell validation, GUI contracts, and no-resurrection guards.

Human SSOT:

- `docs/testing/README.md` owns the human validation guide and testing boundary explanations.
- `docs/release/README.md` owns operator release workflow guidance.
- `scripts/README.md` owns App wrapper / release script usage guidance.
- `docs/active/app-ideal-state-gap-plan.md` owns current App progress, gaps, and next-round baton.
- `docs/docs_portfolio_consolidation.md` owns docs lifecycle roles and the rule that machine truth stays in contracts, source, scripts, tests, artifacts, and read-models.

These owners beat peer docs because they are either executable surfaces or the narrowest human guide for the role. Repeated command lists or release-gate wording in testing, release, scripts, status, active plan, and history docs does not create another release truth owner.

## Peer-Doc Set

Reviewed current docs and evidence surfaces:

- `docs/testing/README.md`
- `docs/release/README.md`
- `scripts/README.md`
- `docs/status.md`
- `docs/project.md`
- `docs/architecture.md`
- `docs/invariants.md`
- `docs/decisions.md`
- `docs/docs_portfolio_consolidation.md`
- `docs/active/app-ideal-state-gap-plan.md`
- `docs/history/process/2026-06-03-app-docs-lifecycle-cleanup-archive.md`
- `docs/history/process/2026-06-06-app-release-evidence-ssot-closeout.md`
- `docs/history/process/2026-06-06-app-full-first-install-vm-evidence-ssot-closeout.md`
- `docs/history/process/2026-06-06-app-future-full-vm-evidence-boundary-closeout.md`
- `docs/history/process/2026-06-06-app-settings-ia-legacy-route-ssot-closeout.md`
- `docs/history/process/2026-06-06-app-release-speed-doc-assertion-retirement-closeout.md`
- `package.json`
- `contracts/app-release-channel.json`
- `contracts/app-first-run-test-matrix.json`
- App GUI/runtime contracts
- `.github/workflows/**`
- `.github/actions/setup-active-shell-deps/action.yml`
- release/evidence validation scripts
- release-boundary tests that read package scripts, workflows, contracts, and selected human-doc boundary text

## Classification

| Class | Outcome |
| --- | --- |
| `covered_by_ssot` | Script names, workflow shape, release profiles, VM gate scenarios, evidence classification, active-shell validation, release notes, release readiness summaries, and no-resurrection guards are already package/workflow/contract/script/test owned. |
| `more_specific_detail` | `docs/testing/README.md` keeps human validation guidance: commands to run, what each gate proves, what each gate does not prove, and how deterministic VM gates differ from AI-first exploratory checks. |
| `conflicts_with_ssot` | No current testing-guide section claims release readiness, domain readiness, production readiness, workflow truth, runtime truth, artifact authority, or release evidence authority from prose alone. The prior exact release-guide prose assertion was already retired in the release-speed lane. |
| `history_or_provenance` | 2026-05-15 local smoke examples, older Docker/WebUI checks, release/candidate evidence classes, and previous testing-doc cleanup decisions remain in `docs/history/process/**`. |
| `stale_or_superseded` | No new testing-guide stale surface was found in this lane. Already retired surfaces remain retired: legacy tag-push Build and Release, `Full clean-install` wording, first-run scenario aliases, stale Settings IA summaries, and dated local smoke as current proof. |
| `out_of_scope` | This lane did not change package scripts, workflows, contracts, validators, release-boundary tests, active-shell implementation, VM smoke behavior, candidate package evidence, App release readiness, domain readiness, runtime truth, or production readiness. |

## No-Rewrite Decision

No active/current doc was rewritten in this lane.

The current portfolio already has one role per owner:

- `docs/testing/README.md` is the validation guide.
- `docs/release/README.md` is the operator release guide.
- `scripts/README.md` is the script usage guide.
- App contracts, workflows, scripts, and tests own machine behavior.
- History docs own dated smoke/proof/provenance.

Merging testing guidance into release docs would make release operation harder to scan. Moving release contract detail into `docs/testing/README.md` would create a second truth source. The right governance action is to record this no-rewrite SSOT classification and keep future edits content-level by validation theme.

Existing release-boundary tests still read selected human-doc boundary wording to keep release and validation guidance visible to operators. This lane treats those assertions as human-doc guard coverage, not as workflow or release truth. If future governance wants to remove those tests entirely, the replacement should be a machine-readable policy surface plus narrow docs-presence checks by semantic id rather than prose wording.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app` after this closeout and process index update:

```bash
git diff --check -- docs/history/process/2026-06-07-app-testing-guide-validation-boundary-ssot-closeout.md docs/history/process/README.md
rg -n '^(<<<<<<<|=======|>>>>>>>)' docs/history/process/2026-06-07-app-testing-guide-validation-boundary-ssot-closeout.md docs/history/process/README.md docs/testing/README.md docs/release/README.md scripts/README.md docs/docs_portfolio_consolidation.md docs/active/app-ideal-state-gap-plan.md
rg -n 'Release Matrix|Release CI Operations Boundaries|VM and AI-first testing boundary|Active Shell Checks|App-Level Checks|hygiene:fallow|validate:gui-shell|not release evidence|not as proof' docs/testing/README.md docs/release/README.md scripts/README.md tests/release/*.test.ts tests/release/app-release-boundary-cases/*.ts contracts/*.json
rg -n '2026-05-15|Build and Release|Full clean-install|full_dmg_clean_vm_smoke.aliases|Settings System/Runtime/About/Update/Theme|signed standard App DMG' docs/testing/README.md docs/release/README.md docs/status.md docs/active/app-ideal-state-gap-plan.md docs/history/process/*.md contracts/*.json tests/**/*.ts scripts/*.ts
find docs -name '*.md' -print | sort | wc -l
find docs/history -name '*.md' -print | sort | wc -l
find docs -path 'docs/history' -prune -o -name '*.md' -print | sort | wc -l
/Users/gaofeng/.local/bin/opl-doc-doctor doctor /Users/gaofeng/workspace/one-person-lab-app --format json
```

Result:

- `git diff --check`: pass.
- Conflict-marker scan: pass.
- Targeted validation-boundary scan showed testing/release/scripts docs, tests, and contracts routing claims to package scripts, workflows, contracts, validators, evidence manifests, release-boundary tests, and history.
- Retired-surface scan left stale phrases only in history/provenance, negative guards, or active no-resurrection test contexts.
- Inventory after adding this closeout: `docs/**/*.md=53`, `docs/history/**/*.md=33`, non-history `docs/**/*.md=20`.
- App OPL Doc doctor returned `finding_count=0`.

## Remaining Scope

This lane closes only the App testing guide validation-boundary SSOT coverage. It does not close the six-repo OPL series `/goal`.

Open carry-forward:

- Broader App docs portfolio remains open at the full-goal level.
- Future governance may replace broad human-doc wording assertions in release-boundary tests with machine-readable policy surfaces and semantic-id docs-presence guards, but that is a separate test-architecture lane.
- Future release or validation edits should keep this split: executable acceptance in package scripts / workflows / contracts / validators / tests, operator guidance in release/testing/scripts docs, and dated proof in history/process or release artifacts.
