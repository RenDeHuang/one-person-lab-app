# App AionUI Team surface closeout

Owner: `one-person-lab-app`
Purpose: `app_aionui_team_surface_ssot_closeout`
State: `history_closeout`
Machine boundary: 本文是本轮文档治理证据。当前 AionUI Team ordinary-path 机器真相继续归 `contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy`、`contracts/app-page-state-matrix.json#guid_home.home_view_model.home_layout.must_not_show`、active-shell validation、shell GUI tests 和 release-boundary tests。
Date: `2026-06-07`

## Semantic Theme

`aionui_team_surface_ordinary_path_retirement`: upstream AionUI Team mode is implementation material only. It is not an OPL ordinary-user capability, normal navigation entry, Settings tab, or route target. Ordinary `/team/*` compatibility routes return to App-owned Home while Team mode is disabled.

## Single Source of Truth

- Primary machine SSOT: `contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy`.
- Page-state SSOT: `contracts/app-page-state-matrix.json#guid_home.home_view_model.home_layout.must_not_show`.
- Validator SSOT: `scripts/validate-active-shell/gui-product-contract-validator.ts` and `scripts/validate-active-shell/shell-implementation-validator.ts`.
- Test SSOT: release-boundary cases for GUI contracts and product profile/install exposure.

These owners beat peer prose because they are machine-readable contracts, validators, or tests. Upstream AionUI README and shell-local Team implementation files are external implementation material and do not define App product truth.

## Peer Docs / Evidence

| Surface | Classification | Decision |
| --- | --- | --- |
| `docs/decisions.md` | `covered_by_ssot` | Already records AionUI Team as hidden in ordinary OPL App and points to contracts/validators/shell `TEAM_MODE_ENABLED`. No rewrite. |
| `docs/architecture.md` | `covered_by_ssot` | Already states Team is not an ordinary capability, Team mode is disabled, sidebar is hidden, deep links are rejected, and compatible `/team/*` routes return to Home. No rewrite. |
| `docs/status.md` | `covered_by_ssot` | Already keeps the same current status without turning Team into an active gap or compatibility feature. No rewrite. |
| `docs/app-ideal-gui-interaction-spec.md`, `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md` | `more_specific_detail` | Keep GUI definition/support detail for hidden Team sidebar, disabled auto redirect, disabled deep links, and App-owned redirect. No rewrite. |
| `contracts/app-product-profile.json`, `contracts/app-gui-product-contract.json`, `contracts/app-page-state-matrix.json` | `covered_by_ssot` | Machine surfaces already forbid AionUI Team nav/page in ordinary Home and define Team hidden upstream surfaces / route policy. No rewrite. |
| `scripts/validate-active-shell/*` and release-boundary tests | `more_specific_detail` | Validators/tests already fail closed if Team mode is enabled, Team route is not redirected, Team sider entry is not gated, Team-created redirect does not no-op, or Team deep links are whitelisted. No rewrite. |
| `shells/aionui/**` upstream readmes and Team implementation files | `out_of_scope` / `implementation_material` | These are external shell implementation materials. App repo governance only uses them as evidence that Team exists upstream and remains gated by App-owned contracts. |

## Edits

- Added this history closeout.
- Indexed it in `docs/history/process/README.md`.
- No active docs, contracts, validators, tests, shell implementation, release workflows, or product profile files changed.

## Retired / Guarded Surface

The retired ordinary-path surface is upstream AionUI Team as a normal App capability, ordinary nav entry, Settings tab, auto redirect target, or whitelisted deep link. It may exist in the shell checkout as upstream implementation material, but it does not become App product truth and no compatibility alias, facade, wrapper, or ordinary route was added.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk node --experimental-strip-types scripts/validate-active-shell.ts --quick
rtk rg -n "AionUI Team|Team nav entry|Team sidebar|team deep link|/team|TEAM_MODE_ENABLED|Team mode" docs contracts scripts tests -g '*.md' -g '*.json' -g '*.ts'
rtk git diff --check
rtk sh -lc '! rg -n "^(<<<<<<<|=======|>>>>>>>)" docs contracts scripts tests'
python3 /Users/gaofeng/workspace/opl-doc/scripts/opl_doc_doctor.py doctor /Users/gaofeng/workspace/one-person-lab-app --format json
```

Result:

- `scripts/validate-active-shell.ts --quick` passed.
- Team surface scan found only current hidden/disabled/redirect contract, validator, test, core-doc and history-closeout wording; no current doc presents Team as an ordinary App capability or navigation path.
- `git diff --check` passed.
- Conflict-marker scan found no matches.
- App doctor returned `finding_count=0` and `active_truth_health.status=pass`.

## Remaining Scope

- This lane does not change shell implementation, delete upstream Team source, alter App contracts/tests, adopt collaboration features, or claim App release/domain/runtime readiness.
- Broader App docs portfolio coverage remains open under the global OPL series goal.
