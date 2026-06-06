# 2026-06-06 App Settings IA legacy route SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_settings_ia_legacy_route_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current Settings navigation, legacy route redirect, App/Shell authority, page-state, validation, and release-boundary truth stays in `contracts/app-gui-product-contract.json`, `contracts/app-page-state-matrix.json`, `contracts/app-product-profile.json`, `scripts/app-product-profile.ts`, `scripts/validate-active-shell.ts`, release-boundary tests, and active shell validation outputs.

## Snapshot

- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: `App-owned Settings information architecture versus upstream AionUI legacy Settings routes`
- Governance mode: SSOT-first content-level audit. Start from machine contracts and validators, then align active/support docs by semantic section.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-gui-product-contract.json#settings_navigation`
  - owns ordinary Settings visible tabs, legacy upstream route redirects, hidden upstream surfaces, team-surface policy, source commands, and required section contracts.
- `contracts/app-product-profile.json#settings`
  - owns shell-consumed visible tabs, legacy route redirect mapping, developer profile presentation, and generated product profile data.
- `contracts/app-page-state-matrix.json`
  - owns page-state expectations for Settings pages and forbids project progress or provider internals from becoming ordinary Settings pages.
- `scripts/app-product-profile.ts`, `scripts/validate-active-shell.ts`, and release-boundary tests
  - enforce generated profile parity, route redirects, hidden legacy tabs, Settings page sections, and no-resurrection behavior.

Human current owner:

- `docs/architecture.md` keeps the architecture-level App/Shell authority split.
- `docs/active/app-interaction-logic-command-center.md` keeps the active handoff rule for Home, Runtime, Settings, and shell coordination.
- `docs/app-ideal-gui-interaction-spec.md` keeps the target interaction model.
- `docs/testing/README.md` keeps validation command/readout guidance.

## Peer Surface Classification

| Surface | Classification | Action |
| --- | --- | --- |
| `docs/architecture.md` GUI product contract paragraph | `conflicts_with_ssot` wording residue | Replaced the stale `Settings System/Runtime/About/Update/Theme` summary with App-owned ordinary Settings tabs plus legacy upstream redirect wording. |
| `docs/testing/README.md` App GUI product contract validator summary | `conflicts_with_ssot` wording residue | Replaced the stale validator summary with the seven ordinary Settings tabs and legacy upstream redirects. |
| `docs/status.md`, `docs/decisions.md`, `docs/invariants.md` | `covered_by_ssot` current docs | Already state General, Access, Agents & Capabilities, Local Environment, Appearance, Advanced, About & Updates, and legacy route redirects. No edit. |
| `docs/active/app-interaction-logic-command-center.md` | `more_specific_detail` active handoff | Already lists ordinary Settings tabs and exact legacy redirect mapping. No edit. |
| `docs/app-ideal-gui-interaction-spec.md`, `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md`, `docs/app-gui-element-audit.md` | `more_specific_detail` GUI definition/support | Already keep Settings as App-owned IA and prevent upstream categories from becoming ordinary tabs. No edit. |
| `contracts/`, validators, tests | `machine_ssot` | Read as current truth; not edited in this docs-only lane. |

## Content-Level Consolidation

- Active docs no longer summarize ordinary Settings as System/Runtime/About/Update/Theme.
- Current docs point to the durable App-owned Settings IA:
  - General
  - Access
  - Agents & Capabilities
  - Local Environment
  - Appearance
  - Advanced
  - About & Updates
- Upstream AionUI routes such as overview, runtime, system, model, agent, assistants, skills-hub, tools, display, webui, and pet remain redirect or diagnostic implementation material only. They are not ordinary App navigation and must not reappear as compatibility tabs.
- Useful implementation components may stay in the active shell only as redirected or diagnostic sub-content after contract validation; they do not define App product authority.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs
rtk rg -n "Settings System/Runtime/About/Update/Theme|ordinary Settings tab.*System|ordinary Settings tab.*Runtime" docs/architecture.md docs/testing/README.md docs/status.md docs/active docs/app-*.md docs/codex-to-opl-app-delta.md
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
```

Result:

- `git diff --check` passed.
- Conflict-marker scan found no matches.
- Targeted stale Settings IA scan found no matches in the current App docs target set.
- OPL Doc doctor reported `finding_count=0`.

## Remaining Scope

This lane does not change contracts, shell implementation, active-shell validation, page-state tests, or release workflows. Broader App docs portfolio coverage and future-cohort Full VM artifacts remain separate lanes.
