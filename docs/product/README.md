# Product Docs

Owner: `one-person-lab-app`
Purpose: `app_product_docs_entry`
State: `active_support`
Machine boundary: Human-readable product, GUI, and shell-alternative design
support. Product acceptance stays in App contracts, page-state matrices,
active-shell validation, source, tests, release artifacts, workflows, and CI
logs.

This directory holds App-owned product design material. It is for maintainers
and implementers, not for end-user onboarding.

The cross-repository Persona/Relay/App design authority is
`opl-persona/docs/architecture-guidance.md` in the sibling `opl-persona`
repository. App documents should describe the App consumer contract and visual
behavior; they should not redefine domain ownership or create a second domain
engine.

## Entries

| Path | Role |
| --- | --- |
| [`opl-persona-integration.md`](opl-persona-integration.md) | OPL Persona Package contribution, App consumer boundary, and production mount gates. |
| [`gui/ideal-interaction-spec.md`](gui/ideal-interaction-spec.md) | Shell-independent target interaction model for the OPL App. |
| [`gui/element-audit.md`](gui/element-audit.md) | Human review of ordinary user GUI elements, placement, gaps, and interaction logic. |
| [`gui/codex-to-opl-app-delta.md`](gui/codex-to-opl-app-delta.md) | Product delta from Codex App baseline to OPL App. |
| [`gui/feature-inventory.md`](gui/feature-inventory.md) | Cross-shell GUI capability inventory, reference mapping, and validation classes. |
| [`gui/opl-studio-plan.md`](gui/opl-studio-plan.md) | `opl-studio` Native successor development, current pre-adoption boundary, minimum-complete product, and staged cutover evidence plan. |
| [`gui/deepseek-harness-composition-plan.md`](gui/deepseek-harness-composition-plan.md) | DeepSeek Harness GUI reuse boundary and OPL spatial/temporal composition migration plan. |
| [`gui/claude-science-runtime-task-awareness-plan.md`](gui/claude-science-runtime-task-awareness-plan.md) | Claude Science external-learning landing plan, mapped onto Runtime global task awareness and current-task slices. |
| [`gui/settings-control-center.md`](gui/settings-control-center.md) | App-owned Settings Control Center product system and validation boundary. |
| [`gui/settings-control-center-completion-audit.md`](gui/settings-control-center-completion-audit.md) | Current completion audit for the Settings Control Center product-system checklist. |
| [`shell-alternatives/hermes-gui-adaptation-plan.md`](shell-alternatives/hermes-gui-adaptation-plan.md) | Archived Hermes GUI proof and historical adaptation context; explicit replay only. |
| [`shell-alternatives/hermes-first-run-flow.md`](shell-alternatives/hermes-first-run-flow.md) | Archived Hermes first-run replay context. |

Archived shell-candidate proof lives under `docs/history/shell-candidates/`.
