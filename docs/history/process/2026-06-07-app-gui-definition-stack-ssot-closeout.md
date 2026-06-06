# App GUI definition stack SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_gui_definition_stack_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable OPL Doc closeout. Current App GUI machine truth stays in `contracts/app-gui-product-contract.json`, `contracts/app-page-state-matrix.json`, `contracts/app-product-profile.json`, `contracts/app-shell-adapter.json`, `contracts/app-shell-candidates.json`, validation scripts, release-boundary tests, active-shell output, candidate manifests, release artifacts, updater metadata, and OPL Framework App state/action read-model output consumed by the App.

## Semantic Theme

This lane governed the App root-level GUI definition stack:

- shell-independent ideal interaction model;
- Codex App to OPL App product delta;
- cross-shell GUI capability inventory and external reference mapping;
- element-level ordinary-user GUI audit;
- AG-UI/CopilotKit candidate verification runbook.

The question was whether these documents had become parallel active plans or parallel machine truth for App GUI behavior, active shell adoption, release readiness, runtime truth, domain readiness, or external UI source/runtime authority.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-gui-product-contract.json` owns GUI product requirements: purpose entries, ordinary conversation policy, model selector boundary, Settings IA, right context inspector, route receipt policy, Team-surface retirement, and authority boundaries.
- `contracts/app-page-state-matrix.json` owns page-state expectations for GUI validation.
- `contracts/app-product-profile.json` owns generated product profile data consumed by the active shell.
- `contracts/app-shell-adapter.json` owns the default active release shell, currently `aionui`.
- `contracts/app-shell-candidates.json` and `contracts/shell-adapters/agui-codex.json` own candidate-shell policy, design-reference boundaries, explicit candidate adapter selection, and release isolation.
- `scripts/validate-active-shell.ts`, `scripts/validate-shell-candidates.ts`, release-boundary tests, and focused shell tests own executable validation.

Human SSOT:

- `docs/app-ideal-gui-interaction-spec.md` owns the shell-independent target interaction model.
- `docs/codex-to-opl-app-delta.md` owns the product delta from Codex App to OPL App.
- `docs/app-gui-feature-inventory.md` owns cross-shell GUI capability inventory, PilotDeck / Stitch reference mapping, and feature categories.
- `docs/app-gui-element-audit.md` owns ordinary-user element-level review and placement judgment.
- `docs/agui-codex-candidate-verification.md` owns the human runbook for explicit AG-UI/CopilotKit candidate verification.
- `docs/active/app-ideal-state-gap-plan.md` remains the single active truth owner for progress, gaps, and next-round baton.
- Core docs keep compact durable current truth, and `docs/docs_portfolio_consolidation.md` owns the docs lifecycle role map.

These owners beat peer summaries because they are either machine-readable gates or the narrowest human document for the semantic role. Repeated GUI wording in README, status, architecture, invariants, decisions, active plan, or candidate history does not create another owner.

## Peer-Doc Set

Reviewed current docs and evidence surfaces:

- `README.md`
- `README.zh-CN.md`
- `docs/README.md`
- `docs/project.md`
- `docs/status.md`
- `docs/architecture.md`
- `docs/invariants.md`
- `docs/decisions.md`
- `docs/docs_portfolio_consolidation.md`
- `docs/active/app-ideal-state-gap-plan.md`
- `docs/active/app-interaction-logic-command-center.md`
- `docs/app-ideal-gui-interaction-spec.md`
- `docs/codex-to-opl-app-delta.md`
- `docs/app-gui-feature-inventory.md`
- `docs/app-gui-element-audit.md`
- `docs/agui-codex-candidate-verification.md`
- `docs/history/process/2026-06-06-app-agui-codex-candidate-shell-ssot-closeout.md`
- `docs/history/process/2026-06-06-app-gui-command-center-role-ssot-closeout.md`
- `docs/history/process/2026-06-06-app-ppt-purpose-id-ssot-closeout.md`
- `docs/history/process/2026-06-06-app-ordinary-selector-boundary-ssot-closeout.md`
- `docs/history/process/2026-06-06-app-settings-ia-legacy-route-ssot-closeout.md`
- `contracts/app-gui-product-contract.json`
- `contracts/app-page-state-matrix.json`
- `contracts/app-product-profile.json`
- `contracts/app-shell-adapter.json`
- `contracts/app-shell-candidates.json`
- `contracts/shell-adapters/agui-codex.json`
- active-shell validation, shell-candidate validation, and release-boundary tests

## Classification

| Class | Outcome |
| --- | --- |
| `covered_by_ssot` | GUI behavior and acceptance are already contract/test owned; active progress/gaps remain in `docs/active/app-ideal-state-gap-plan.md`; docs lifecycle role truth remains in `docs/docs_portfolio_consolidation.md`. |
| `more_specific_detail` | The ideal interaction spec, Codex-to-OPL delta, feature inventory, element audit, and candidate runbook each keep a distinct human role: target interaction, product delta, capability/reference inventory, element review, and explicit candidate verification. |
| `conflicts_with_ssot` | No current non-history doc claims the GUI definition stack is a second active plan, makes AionUI / AG-UI / PilotDeck / Stitch product authority, treats candidate evidence as active-shell adoption, or converts UI rendering into App release ready, domain ready, or production ready. |
| `history_or_provenance` | Dated candidate smoke, GUI command-center role correction, Settings IA, purpose-id, selector, Team-surface, Developer Profile, active GUI wording, and docs-index closeouts remain under `docs/history/process/`. |
| `stale_or_superseded` | The already-retired stale surfaces remain retired: command-center as a second active plan, `PPT` as visible compatibility wording, all-model-selector retirement, upstream Settings tabs as ordinary App IA, AionUI Team as ordinary App capability, and candidate-shell evidence as release adoption. |
| `out_of_scope` | This lane did not change GUI contracts, page-state matrices, shell implementation, release workflows, candidate package evidence, active-shell adoption, runtime truth, domain truth, App release readiness, or family production readiness. |

## No-Rewrite Decision

No active/current doc was rewritten in this lane.

The current portfolio already has one role per owner:

- `docs/app-ideal-gui-interaction-spec.md` defines what the App should feel and do independent of shell.
- `docs/codex-to-opl-app-delta.md` explains what turns Codex App into OPL App.
- `docs/app-gui-feature-inventory.md` lists cross-shell target capabilities and external references.
- `docs/app-gui-element-audit.md` reviews visible element placement and remaining design gaps.
- `docs/agui-codex-candidate-verification.md` gives explicit candidate verification steps and stop conditions.
- Contracts, validators, tests, release artifacts, and active-shell output own machine claims.

Merging these files would make the root GUI docs less reviewable; copying their content into `docs/README.md`, status, or the active plan would create a second truth source. The right governance action is to record the no-rewrite SSOT classification here and keep future edits content-level by theme.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app` after this closeout and process index update:

```bash
git diff --check -- docs/history/process/2026-06-07-app-gui-definition-stack-ssot-closeout.md docs/history/process/README.md
rg -n '^(<<<<<<<|=======|>>>>>>>)' docs/history/process/2026-06-07-app-gui-definition-stack-ssot-closeout.md docs/history/process/README.md docs/app-ideal-gui-interaction-spec.md docs/codex-to-opl-app-delta.md docs/app-gui-feature-inventory.md docs/app-gui-element-audit.md docs/agui-codex-candidate-verification.md docs/docs_portfolio_consolidation.md docs/active/app-ideal-state-gap-plan.md
rg -n 'State: `active_plan`|State: `active_definition`|State: `active_design_review`|State: `active_experimental`|State: `active_support`|State: `active`' docs/*.md docs/active/*.md docs/release/*.md docs/testing/*.md docs/user-guides/*.md docs/screenshots/*.md
rg -n 'GUI 定义栈|app-ideal-gui-interaction-spec|codex-to-opl-app-delta|app-gui-feature-inventory|app-gui-element-audit|agui-codex-candidate-verification|PilotDeck|Stitch|candidate shell|active_shell' README.md README.zh-CN.md docs/**/*.md contracts/*.json scripts/*.ts tests/**/*.ts
find docs -name '*.md' -print | sort | wc -l
find docs/history -name '*.md' -print | sort | wc -l
find docs -path 'docs/history' -prune -o -name '*.md' -print | sort | wc -l
/Users/gaofeng/.local/bin/opl-doc-doctor doctor /Users/gaofeng/workspace/one-person-lab-app --format json
```

Result:

- `git diff --check`: passed.
- Conflict-marker scan: passed.
- State-role scan confirmed the only `State: active_plan` in non-history docs is `docs/active/app-ideal-state-gap-plan.md`; GUI definition docs remain `active_definition`, `active_design_review`, `active`, or `active_experimental` according to their support roles.
- Targeted GUI stack scan showed current references route GUI truth to App contracts, page-state matrices, validation scripts, active-shell output, candidate contracts, and specific human owner docs; history closeouts keep dated provenance.
- Inventory after adding this closeout: `docs/**/*.md=52`, `docs/history/**/*.md=32`, non-history `docs/**/*.md=20`.
- App OPL Doc doctor returned `finding_count=0`.

## Remaining Scope

This lane closes only the App GUI definition stack SSOT coverage. It does not close the six-repo OPL series `/goal`.

Open carry-forward:

- App broader docs portfolio remains open at the full-goal level, although the currently reviewed root GUI definition stack, docs index, release, screenshot, candidate, Settings, selector, Team, Developer Profile, and runtime-page themes now have recorded SSOT lanes.
- Fresh candidate package/adoption evidence remains a separate technical verification lane and cannot be inferred from this docs governance closeout.
- Future GUI edits must start from the role split above: product/interaction definitions in the owner docs, executable acceptance in contracts/tests/validation, dated proof in history/process or release/candidate artifacts, and no compatibility aliases or shell-local authority surfaces.
