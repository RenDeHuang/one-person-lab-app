# App GUI command-center role SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_gui_command_center_role_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable OPL Doc closeout. Current App GUI machine truth stays in `contracts/app-gui-product-contract.json`, `contracts/app-page-state-matrix.json`, `contracts/app-product-profile.json`, active-shell validation, release-boundary tests, active shell implementation output, and OPL Framework App state/action JSON consumed by the App.

## Semantic Theme

This lane governed the App GUI definition stack and the role of `docs/active/app-interaction-logic-command-center.md`.

The question was whether the command-center note should be another active plan, or a support handoff under the single active truth owner.

## Single Source Of Truth

- Single active truth owner: `docs/active/app-ideal-state-gap-plan.md`.
- GUI product machine owners: `contracts/app-gui-product-contract.json`, `contracts/app-page-state-matrix.json`, `contracts/app-product-profile.json`, active-shell validation, release-boundary tests, and shell implementation output.
- GUI human definition owners: `docs/app-ideal-gui-interaction-spec.md` for shell-independent interaction, `docs/codex-to-opl-app-delta.md` for Codex-to-OPL product delta, `docs/app-gui-feature-inventory.md` for cross-shell feature inventory, and `docs/app-gui-element-audit.md` for element-level review.
- Docs role owner: `docs/docs_portfolio_consolidation.md`.

These owners beat the command-center metadata because they are narrower for the semantic role: the active gap plan owns progress/gaps/next prompt, contracts/tests own acceptance, and the command-center doc only coordinates App-owned GUI requirements with active shell implementation.

## Peer-Doc Set

- `docs/active/app-interaction-logic-command-center.md`
- `docs/active/app-ideal-state-gap-plan.md`
- `docs/docs_portfolio_consolidation.md`
- `docs/README.md`
- `docs/project.md`
- `docs/status.md`
- `docs/architecture.md`
- `docs/invariants.md`
- `docs/decisions.md`
- `docs/app-ideal-gui-interaction-spec.md`
- `docs/codex-to-opl-app-delta.md`
- `docs/app-gui-feature-inventory.md`
- `docs/app-gui-element-audit.md`
- `contracts/opl-native-profile.json`
- App GUI contracts, active-shell validation, and release-boundary tests

## Classification

| Class | Outcome |
| --- | --- |
| `covered_by_ssot` | The active plan role is already owned by `docs/active/app-ideal-state-gap-plan.md` and declared by `contracts/opl-native-profile.json`. |
| `more_specific_detail` | `docs/active/app-interaction-logic-command-center.md` keeps App GUI handoff details: Home, Runtime, Settings, shell collaboration, fork delta budget, and verification commands. |
| `conflicts_with_ssot` | The command-center front matter said `State: active_plan`, creating a second active-plan signal next to the single active truth owner. |
| `history_or_provenance` | This closeout records the role correction under `docs/history/process/`. |
| `stale_or_superseded` | The `active_plan` metadata on the command-center support note is retired; the document now uses `State: active_support`. |
| `out_of_scope` | This lane did not change GUI contracts, page-state matrices, product profile, active-shell code, release workflow, release evidence, candidate shell adoption, runtime truth, domain truth, App release readiness, or family production readiness. |

## Change

- Changed `docs/active/app-interaction-logic-command-center.md` front matter from `State: active_plan` to `State: active_support`.
- Left command-center body content in place because it remains useful handoff/support detail and does not own current progress, gaps, or next-round prompt.

## Verification

Run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/active/app-interaction-logic-command-center.md docs/history/process/2026-06-06-app-gui-command-center-role-ssot-closeout.md docs/history/process/README.md
rtk rg -n 'app_interaction_logic_command_center|State: `active_plan`|State: `active_support`' docs/active/app-interaction-logic-command-center.md docs/docs_portfolio_consolidation.md docs/README.md docs/history/process/2026-06-06-app-gui-command-center-role-ssot-closeout.md
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
```

Result:

- The command-center support note has `State: active_support`.
- The targeted state scan shows `State: active_support` on the command-center support note; remaining `State: active_plan` matches are only this history closeout's quoted retired wording.
- `git diff --check` passed.
- Conflict-marker scan found no matches.
- `opl-doc-doctor` returned `finding_count=0`, with the only active truth owner still `docs/active/app-ideal-state-gap-plan.md`.
