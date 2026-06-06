# App `ppt` Purpose Id SSOT Closeout

Owner: `one-person-lab-app`
Purpose: `app_ppt_purpose_id_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable OPL Doc closeout. Current App purpose-entry truth stays in `contracts/app-gui-product-contract.json`, `contracts/app-product-profile.json`, `contracts/app-page-state-matrix.json`, `scripts/app-product-profile.ts`, active-shell validation, release-boundary tests, and shell-consumed profile output.

## Semantic Theme

`presentation_purpose_entry_internal_id`: the ordinary App Home shows a Presentation / `演示` purpose entry that routes to RCA. The internal route/purpose id is `ppt`; the ordinary user-facing label is `演示` in Chinese and Presentation in English.

## SSOT Owner

Machine owners:

- `contracts/app-gui-product-contract.json#home_purpose_entries`
- `contracts/app-product-profile.json#gui.home.home_purpose_entries`
- `contracts/app-page-state-matrix.json#pages[].home_view_model.home_purpose_entries`
- `scripts/app-product-profile.ts`
- `scripts/validate-active-shell/product-profile-validator.ts`
- `scripts/validate-active-shell/gui-product-contract-validator.ts`
- `scripts/validate-active-shell/page-state-matrix-validator.ts`
- release-boundary tests that assert `research/grant/ppt -> mas/mag/rca`

Human support owners:

- `docs/app-ideal-gui-interaction-spec.md`
- `docs/codex-to-opl-app-delta.md`
- `docs/app-gui-feature-inventory.md`
- `docs/architecture.md`
- `docs/decisions.md`

The contracts and validators win over prose because they define and enforce the App-visible home purpose entries. Current machine truth is `research`, `grant`, and `ppt` as stable internal purpose ids, targeting `mas`, `mag`, and `rca`, with `ppt` displaying as `演示` and routing to RCA.

## Peer Docs Classification

| Peer surface | Classification | Outcome |
| --- | --- | --- |
| `docs/codex-to-opl-app-delta.md` | `conflicts_with_ssot` wording residue | Replaced "historical `PPT` compatibility label" wording with stable internal purpose-id wording. |
| `docs/app-ideal-gui-interaction-spec.md` | `conflicts_with_ssot` wording residue | Replaced "keep `ppt` for compatibility" wording with current contract-owned internal id / visible label split. |
| `docs/app-gui-feature-inventory.md` | `conflicts_with_ssot` wording residue | Replaced "compatibility profile" wording with current internal purpose-id wording. |
| `docs/architecture.md` | `covered_by_ssot` | Already says home purpose entries are App-owned click targets and labels, while default assistants are implementation targets. No rewrite. |
| `docs/decisions.md` | `covered_by_ssot` | Already binds ordinary App executor, home assistants, route receipt, and GUI definition stack to contracts and validators. No rewrite. |
| `docs/status.md` | `covered_by_ssot` | Already states purpose entries are `科研` / `基金` / `演示` and route to MAS/MAG/RCA without presenting them as backend choices. No rewrite. |
| `docs/active/app-ideal-state-gap-plan.md` | `covered_by_ssot` active plan | Already says App contracts and shell tests require MAS/MAG/RCA as purpose-first entries and route receipts. No rewrite. |
| `docs/history/process/2026-06-06-app-active-gui-stale-wording-closeout.md` | `history_or_provenance` | Prior stale wording retirement remains history only. |

## Content-Level Change

- Kept the active `ppt` internal id because the App contracts, generated profile, validators, page-state matrix, and tests currently require it.
- Retired prose that explained `ppt` / `PPT` as a historical compatibility label or compatibility profile carry-forward.
- Clarified that user-facing chrome is `演示` / Presentation, while `ppt` is a stable internal purpose id that targets RCA.

## Stale-Surface Retirement

No physical source, contract, route id, or test deletion was authorized by this lane.

Retired surface posture:

- `PPT` must not be described as a current ordinary Chinese chrome label.
- `ppt` must not be described as a compatibility alias, fallback, facade, wrapper, or historical label in active design docs.
- If the App later renames the internal id away from `ppt`, that must be a separate contract/test migration across product profile, GUI contract, page-state matrix, validators, shell profile output, release-boundary tests, and active shell implementation.

## Verification

Evidence read before edit:

- `rtk jq '.gui.home.home_purpose_entries' contracts/app-product-profile.json`
- `rtk jq '(.gui.default_assistants[] | select(.id=="rca")), (.gui.assistant_skill_profiles[] | select(.assistant_id=="rca"))' contracts/app-product-profile.json`
- `rtk jq '.home_purpose_entries' contracts/app-gui-product-contract.json`
- `rtk jq '(.default_assistants[] | select(.id=="rca")), (.assistant_skill_profiles[] | select(.assistant_id=="rca"))' contracts/app-gui-product-contract.json`
- `scripts/validate-active-shell/product-profile-validator.ts`
- `scripts/validate-active-shell/gui-product-contract-validator.ts`
- `scripts/validate-active-shell/page-state-matrix-validator.ts`
- `contracts/app-page-state-matrix.json#guid_home.home_view_model.home_purpose_entries`

Follow-up validation for this docs-only lane should run:

```bash
rtk git diff --check
rtk rg -n 'compatibility label|兼容既有 product profile|以兼容既有 profile|历史 `PPT`|PPT compatibility' docs/codex-to-opl-app-delta.md docs/app-ideal-gui-interaction-spec.md docs/app-gui-feature-inventory.md
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/codex-to-opl-app-delta.md docs/app-ideal-gui-interaction-spec.md docs/app-gui-feature-inventory.md docs/history/process/2026-06-06-app-ppt-purpose-id-ssot-closeout.md
rtk opl-doc-doctor doctor . --format json
```

## Residual Scope

This lane closes only App docs wording around the `ppt` internal purpose id and `演示` / Presentation visible label. It does not close fresh candidate package/adoption evidence, future cohort Full VM artifact production, or the broader App docs portfolio.
