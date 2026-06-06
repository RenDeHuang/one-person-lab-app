# 2026-06-06 App Developer Profile wording retirement closeout

Owner: `one-person-lab-app`
Purpose: `app_developer_profile_wording_retirement_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current App Settings and Developer Profile truth stays in `contracts/app-gui-product-contract.json`, `contracts/app-product-profile.json`, `scripts/app-product-profile.ts`, active-shell validation, release-boundary tests, and shell-consumed generated product profile output.

## Snapshot

- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: `developer mode wording retirement`
- Governance mode: SSOT-first product wording cleanup. Start from App GUI/product-profile contracts and keep negative guards for the retired single-switch surface.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-gui-product-contract.json#developer_profile`
  - owns Developer Profile as explicit capability axes, not a single Developer Mode switch.
  - keeps raw paths, logs, and diagnostics under Advanced as developer diagnostics.
- `contracts/app-product-profile.json#settings.developer_profile` and `#settings.settings_information_architecture.advanced`
  - own shell-consumed Developer Profile capability defaults and the Advanced settings question.
- `scripts/app-product-profile.ts`
  - validates the required capability axes and fails closed if `legacy_developer_mode_alias` is reintroduced.
- `tests/release/app-release-boundary-cases/product-profile-and-install-exposure.ts` and `tests/release/app-release-boundary-cases/shell-adapter-and-gui-contracts.ts`
  - assert Developer Profile capability policy and the absence of legacy aliases.

Human-doc owners:

- `docs/app-ideal-gui-interaction-spec.md`
  - owns ideal GUI interaction wording for Advanced settings.
- `docs/active/app-interaction-logic-command-center.md`
  - owns active shell handoff wording for Settings and Advanced diagnostics.

## Content-Level Consolidation

- Retired active positive references to `developer mode` as a current App capability.
- Replaced those references with `Developer Profile capabilities` and `developer diagnostics`.
- Kept `Developer Mode` only as negative guard language where the App explicitly forbids a single-switch capability expression.
- Kept `legacy_developer_mode_alias` only as a contract/test guard that fails closed if a legacy alias returns.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app/.worktrees/app-developer-profile-wording-retirement-20260606`:

```bash
rtk npm run ensure:shell
rtk npm run validate:active-shell
rtk npm run test:release-boundary -- --runInBand
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" contracts/app-gui-product-contract.json contracts/app-product-profile.json docs/app-ideal-gui-interaction-spec.md docs/active/app-interaction-logic-command-center.md docs/history/process/2026-06-06-app-developer-profile-wording-retirement-closeout.md docs/history/process/README.md
rtk rg -n "developer mode|Developer Mode|legacy_developer_mode_alias|Developer Profile|developer profile" docs/app-ideal-gui-interaction-spec.md docs/active/app-interaction-logic-command-center.md contracts/app-gui-product-contract.json contracts/app-product-profile.json scripts/app-product-profile.ts tests
```

Result:

- `ensure:shell` prepared `shells/aionui` from `gaofeng21cn/opl-aion-shell@4a1154d4c313`.
- `validate:active-shell` passed.
- `test:release-boundary -- --runInBand` passed with `124` tests.
- `git diff --check` passed.
- Conflict-marker scan found no matches.
- Targeted wording scan found no positive lowercase `developer mode` current-surface references in the edited active docs/contracts; remaining `Developer Mode` and `legacy_developer_mode_alias` matches are negative guards.

## Remaining Scope

This lane covers App Settings Developer Profile wording only. It does not change Developer Profile behavior, App release gates, active shell implementation, or broader App settings IA work.
