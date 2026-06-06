# 2026-06-07 App decisions superseded readings SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_decisions_superseded_readings_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable OPL Doc closeout. Current App decisions truth stays in `docs/decisions.md#Current-Decisions`, App contracts, validation scripts, release-boundary tests, active-shell validation, source, release artifacts, updater metadata, and OPL Framework CLI/read-model output consumed by the App.

## Semantic Theme

Theme: `docs/decisions.md` current decisions versus compact superseded-reading provenance.

The concern is content-level, not file-level. `docs/decisions.md` legitimately owns current App decision readout, while its `Superseded Readings` table keeps a compact list of retired interpretations that prevent resurrection. Those retired readings must not look like active App behavior, App defaults, release readiness, runtime truth, shell authority, skill packaging policy, or Settings navigation truth.

## Single Source Of Truth

| Scope | SSOT owner |
| --- | --- |
| Current decision readout | `docs/decisions.md#Current-Decisions`, backed by App contracts/source/tests. |
| GUI product and Settings navigation truth | `contracts/app-gui-product-contract.json#settings_navigation`, `contracts/app-page-state-matrix.json`, `contracts/app-product-profile.json#settings`, active-shell validation, shell Settings/Guid tests, and release-boundary GUI tests. |
| Skill/plugin/package exposure truth | `contracts/app-install-exposure-policy.json`, `contracts/app-product-profile.json#companion_payloads`, `contracts/app-gui-product-contract.json#ordinary_capability_selector_policy`, `scripts/validate-active-shell/*`, `npm run validate:agent-installation`, and release-boundary tests. |
| Superseded-reading provenance | `docs/decisions.md#Superseded-Readings` plus this history closeout. |

This lane treats `docs/decisions.md` as one current decision owner with a bounded provenance subsection. Machine truth wins over both current and superseded prose.

## Peer Docs And Evidence

| Surface | Classification | Readout |
| --- | --- | --- |
| `docs/decisions.md#Current-Decisions` | `covered_by_ssot` | Current decisions already point to contracts, validators, tests, release artifacts and OPL consumed read-models. |
| `docs/decisions.md#Superseded-Readings` | `history_or_provenance` plus `stale_or_superseded` | Retired interpretations are valid only as compact decision provenance; they are not active truth. |
| `docs/architecture.md` | `more_specific_detail` | Keeps App/Shell/Framework/domain split, Settings boundary and skill ownership detail while machine truth stays contract/test-owned. |
| `docs/invariants.md` | `more_specific_detail` | Keeps non-ownership and no-duplication constraints without owning package or Settings machine truth. |
| `docs/docs_portfolio_consolidation.md` | `more_specific_detail` | Already classifies decisions as durable current truth with machine boundary in contracts/source/tests. |
| `docs/history/process/2026-06-02-aionui-builtin-skill-intake.md` | `history_or_provenance` | Dated AionUI builtin-skill intake remains history only. |
| `docs/history/process/2026-06-06-app-settings-ia-legacy-route-ssot-closeout.md` | `history_or_provenance` | Prior Settings IA closeout remains history; current Settings truth stays contract/test-owned. |
| `contracts/app-gui-product-contract.json`, `contracts/app-product-profile.json`, `contracts/app-install-exposure-policy.json` | `covered_by_ssot` | Machine-readable owners for Settings navigation, packaged skill whitelist, domain plugin skill exposure and companion skill filtering. |
| `scripts/validate-active-shell/*`, `tests/release/app-release-boundary-cases/*` | `covered_by_ssot` | Validators/tests guard legacy route redirects, Settings capability filtering, packaged skill whitelist, no duplicate domain-skill mirrors and no retired skill wiring. |

## Edit

- Added a short role guard above `docs/decisions.md#Superseded-Readings` so readers see those rows as retired interpretations and compact decision provenance.
- Did not move or delete the table because it is already concise, content-level provenance rather than a dated execution ledger.
- Did not change App contracts, source, tests, release workflow, shell implementation, packaged skill policy, Settings navigation, release readiness or active App status.

## Coverage Classification

| Classification | Readout |
| --- | --- |
| `covered_by_ssot` | Current decisions, Settings navigation, skill/plugin exposure, App packaged skill whitelist and ordinary capability filtering have contract/source/test owners. |
| `more_specific_detail` | `docs/architecture.md`, `docs/invariants.md` and `docs/docs_portfolio_consolidation.md` keep support explanations and lifecycle role inventory. |
| `conflicts_with_ssot` | No current contract/test conflict was found. The only edit was to prevent retired readings from being interpreted as active truth. |
| `history_or_provenance` | Superseded readings remain compact provenance in `docs/decisions.md`; dated supporting closeouts stay in `docs/history/process/`. |
| `stale_or_superseded` | Retired interpretations such as AionUI implementation defaults, upstream Settings tabs, AionUI builtin skills as App defaults, Homebrew readiness proof, Full assets in standard updater and WebUI as a separate truth source remain non-current. |
| `out_of_scope` | No App release, workflow, shell implementation, contract, package manifest, updater metadata, runtime truth, domain readiness or production readiness changed. |

## Verification

Commands:

```bash
rtk rg -n "Superseded Readings|Rows in this table|AionUI builtin skills|legacy upstream" docs/decisions.md
rtk rg -n "default_packaged_codex_skill_ids|packaged_not_default_visible_codex_skill_ids|domain_plugin_skills_must_not_be_companion_mirrors|settings_navigation" contracts/app-product-profile.json contracts/app-gui-product-contract.json scripts/validate-active-shell tests/release/app-release-boundary-cases -g '*.json' -g '*.ts'
rtk git diff --check -- docs/decisions.md docs/history/process/README.md docs/history/process/2026-06-07-app-decisions-superseded-readings-ssot-closeout.md
rtk sh -lc '! rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/decisions.md docs/history/process/README.md docs/history/process/2026-06-07-app-decisions-superseded-readings-ssot-closeout.md'
rtk opl-doc-doctor doctor /Users/gaofeng/workspace/one-person-lab-app --format json
```

Expected result:

- Superseded readings are explicitly marked retired/provenance.
- Machine owner scans show current Settings and skill/package truth in contracts, validators and tests.
- Diff check, conflict-marker scan and OPL Doc doctor pass.
