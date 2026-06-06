# App broader docs portfolio SSOT closeout

Owner: `one-person-lab-app`
Purpose: `broader_docs_portfolio_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable governance closeout. Machine truth stays in `contracts/`, source, release artifacts, updater metadata, validation scripts, release-boundary tests, active-shell validation, candidate manifests, shell artifacts, CI logs, and OPL Framework CLI/read-model output consumed by the App. This document is not App release-ready, domain-ready, production-ready, candidate adoption, active-shell adoption, Full first-install success, screenshot evidence, VM evidence, or release promotion authority.

This file records the 2026-06-07 broader App docs portfolio SSOT coverage lane. The lane did not rewrite active/current docs because the current portfolio already has a single owner split: lifecycle governance in `docs/docs_portfolio_consolidation.md`, docs navigation in `docs/README.md`, current product/release/runtime/shell truth in the core docs and App contracts, current gaps in `docs/active/app-ideal-state-gap-plan.md`, and dated proof / closeout evidence in `docs/history/process/**`.

## Semantic Theme

The theme was whether any stale App module/interface/test/docs surface still appears as current truth after the recent release, GUI, candidate-shell, Settings, selector, screenshot, testing, docs-index, and status foldback lanes.

Scope covered:

- Root public entries: `README.md`, `README.zh-CN.md`.
- Docs index and lifecycle owner: `docs/README.md`, `docs/docs_portfolio_consolidation.md`.
- Core current docs: `docs/project.md`, `docs/status.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md`.
- Active truth and GUI support docs: `docs/active/**`, GUI definition stack, candidate runbook.
- Release/testing/user docs: `docs/release/**`, `docs/testing/**`, `docs/user-guides/**`, `docs/screenshots/**`.
- Process history index and recent closeouts under `docs/history/process/**`.
- App contracts, scripts and release-boundary tests only as machine-truth cross-checks for stale alias / readiness / adoption terms.

## Portfolio Classification

| Surface | Classification | Governance action |
| --- | --- | --- |
| Root `README*` | `public_entry` | Kept. Public install/product entry remains human-readable and does not own release readiness, domain readiness, runtime truth, or shell adoption truth. |
| `docs/README.md` | `docs_entry_index` | Kept. It routes readers to owner docs and does not carry detailed current product/profile/install/shell/runtime truth. |
| `docs/docs_portfolio_consolidation.md` | `lifecycle_governance_owner` | Kept. It owns directory roles, governance rules and reopening conditions. |
| Core five docs | `current_truth_owner` | Kept. They explain App product, release, shell, runtime bridge, non-ownership and still-active decisions without turning proof artifacts into readiness claims. |
| `docs/active/app-ideal-state-gap-plan.md` | `single_active_truth_owner` | Kept. It owns App current progress, gaps, next-round baton and non-goals. |
| GUI definition stack | `human_product_support` | Kept. Ideal interaction, GUI element audit, Codex-to-OPL delta, feature inventory and candidate verification each keep distinct support roles. |
| `docs/agui-codex-candidate-verification.md` | `candidate_runbook` | Kept. It is command / boundary / acceptance guidance for explicit candidate builds, not active-shell adoption or release-channel truth. |
| `docs/release/` | `release_operator_support` | Kept. Release truth stays with release contracts, workflows, scripts, candidate records, evidence artifacts and validation outputs. |
| `docs/testing/` | `validation_guide` | Kept. Package scripts, workflows, contracts, validators, evidence manifests and tests own executable acceptance. |
| `docs/user-guides/` and `docs/screenshots/` | `derived_user_docs_and_visual_guides` | Kept. Generated guide artifacts and screenshots are user-doc / evidence inputs, not release-ready proof by themselves. |
| `docs/history/process/` | `process_provenance` | Kept. It owns dated release/candidate/GUI/testing/docs closeouts and branch/worktree evidence. |

## Content-Level Consolidation

- Legacy tag-push **Build and Release** remains retired in current docs and guarded by release-boundary validation / tests.
- `Full clean-install` wording remains retired; current docs use Full first-install semantics, while `full_dmg_clean_vm_smoke` remains a machine scenario id rather than user-facing legacy wording.
- Positive `Developer Mode` wording remains retired from current Settings/product docs; Developer Profile capability axes and developer diagnostics are the current owner wording.
- AionUI Team is disabled/hidden/redirected for ordinary paths and remains implementation material, not an App capability.
- Backend/provider/permission selectors stay retired from ordinary Home/conversation; the App-owned Codex model selector/status remains visible and current.
- AG-UI/CopilotKit candidate shell, WebUI transport, PilotDeck/Stitch references and candidate package evidence remain explicit technical verification inputs until App-owned contracts and adapter gates adopt them.
- Release guide, testing guide, screenshots, user-guide artifacts, candidate runbook and status docs do not own App release readiness or family/domain readiness.
- No source, workflow, contract, validator, test, updater metadata, release artifact, shell implementation, candidate adapter, or generated guide artifact changed in this lane.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app/.worktrees/app-broader-docs-portfolio-ssot-20260607` before adding this closeout:

```bash
git status --short --branch
find docs -path 'docs/history' -prune -o -name '*.md' -print | sort | wc -l
find docs/history -name '*.md' -print | sort | wc -l
find docs -name '*.md' -print | sort | wc -l
find . -maxdepth 2 -name 'README*' -print | sort
rg -n "Build and Release|Full clean-install|clean-install|developer mode|Developer Mode|Settings System|Settings Runtime|Settings About|Settings Update|Settings Theme|Team|/team|PPT|ppt|model selector|right context inspector|OPL Agent Codex context|AionUI|PilotDeck|Stitch|AG-UI|CopilotKit|candidate shell|active shell adopted|release ready|App release ready|domain ready|production ready|screenshot.*proof|screenshot.*ready|legacy|compatibility|alias|facade|wrapper|fallback|WebUI|GHCR|Full first-install|first-run scenario" README.md README.zh-CN.md docs/README.md docs/docs_portfolio_consolidation.md docs/project.md docs/status.md docs/architecture.md docs/invariants.md docs/decisions.md docs/active docs/release docs/testing docs/user-guides docs/screenshots docs/app-ideal-gui-interaction-spec.md docs/app-gui-element-audit.md docs/codex-to-opl-app-delta.md docs/app-gui-feature-inventory.md docs/agui-codex-candidate-verification.md scripts/README.md
rg -n "active_shell_adopted|active_shell_unchanged|release_participation|candidate.*adopted|release_ready|app_release_ready|domain_ready|production_ready|full_dmg_clean_vm_smoke|Full clean-install|Build and Release|legacy_developer_mode_alias|legacy.*alias|compatibility.*alias|allow.*legacy|deprecated.*allowed" contracts tests scripts docs/active docs/status.md docs/architecture.md docs/invariants.md docs/decisions.md docs/release docs/testing README.md README.zh-CN.md
```

Result before adding this closeout:

- Worktree started clean on `codex/app-broader-docs-portfolio-ssot`.
- Inventory was `docs/**/*.md=54`, non-history `docs/**/*.md=20`, `docs/history/**/*.md=34`; root / near-root README files were `README.md`, `README.zh-CN.md`, `docs/README.md`, and `scripts/README.md`.
- Targeted scans returned current boundary statements, negative guards, explicit candidate verification boundaries, release/test validation ownership, current Full first-install wording, ordinary selector / Team / Settings / Developer Profile retirement rules, and process-history provenance.
- No active-current docs scan showed App release-ready, domain-ready, production-ready, active-shell-adopted, old public path compatibility, or physical adoption authority from docs prose.
- Machine cross-checks showed candidate adoption and readiness fields guarded by contracts, scripts and release-boundary tests; old `Full clean-install` survives only as no-resurrection test wording.

Result after adding this closeout:

- Inventory is `docs/**/*.md=55`, non-history `docs/**/*.md=20`, `docs/history/**/*.md=35`, confirming this lane added only process history and did not expand current docs.
- `git diff --check` passed for the closeout and process index update.
- Conflict-marker scan passed.
- App OPL Doc doctor reported `finding_count=0`.

## Remaining Scope

This lane closes only broader App docs portfolio SSOT routing for this OPL series tranche. It does not claim App release readiness, domain readiness, family production readiness, active-shell adoption, candidate promotion, future-cohort Full VM evidence, fresh package evidence, screenshot evidence completeness, or release promotion.

Open carry-forward:

- Fresh candidate package/adoption evidence remains separate and must be produced by explicit candidate records, shell artifacts, CI logs, validation outputs and adoption contracts.
- Future cohort Full VM / local authorization evidence remains release-cohort evidence to produce only when a real release cohort is being validated.
- Actual active-shell adoption remains gated by deliberate `contracts/app-shell-adapter.json` change, product profile sync, page-state/first-run matrices, active-shell validation, GUI package compile, release isolation and external checkout history policy.
