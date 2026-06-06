# App ordinary selector boundary closeout

Owner: `one-person-lab-app`
Purpose: `app_ordinary_selector_boundary_ssot_closeout`
State: `history_closeout`
Machine boundary: 本文是本轮文档治理证据。当前 ordinary Home / conversation selector 机器真相继续归 `contracts/app-gui-product-contract.json#executor_policy`、`contracts/app-page-state-matrix.json#guid_home`、`contracts/app-page-state-matrix.json#ordinary_conversation`、active-shell validation、shell GUI tests 和 release-boundary tests。
Date: `2026-06-06`

## Semantic Theme

`ordinary_home_and_conversation_selector_boundary`: App ordinary path is Codex CLI fixed-executor with MAS/MAG/RCA purpose entries. Backend/provider/permission selectors are retired from the ordinary Home and ordinary Codex conversation paths; the App-owned Codex model selector/status remains visible and bounded by the App product profile.

## Single Source of Truth

- Primary machine SSOT: `contracts/app-gui-product-contract.json#executor_policy`, `#pages.guid_home`, `#ordinary_conversation`, and `#builtin_assistant_route_receipt_policy`.
- Page-state SSOT: `contracts/app-page-state-matrix.json#guid_home` and `#ordinary_conversation`.
- Validator SSOT: `scripts/validate-active-shell/page-state-matrix-validator.ts`, which fails closed when Home or ordinary conversation loses Codex fixed-executor semantics, hides the App-owned model selector/status, or reintroduces backend/provider/permission selectors.
- Candidate registry SSOT for non-default shells: `contracts/app-shell-candidates.json` plus `scripts/validate-shell-candidates/candidate-contract.ts`.

These owners beat peer prose because they are machine-readable contracts or validators consumed by release/active-shell checks.

## Peer Docs / Evidence

| Surface | Classification | Decision |
| --- | --- | --- |
| `docs/decisions.md` | `conflicts_with_ssot` wording residue | Replaced `model override lists` as a retired ordinary-path control with the current split: backend/provider/permission selectors are retired, while model control stays in the App-owned Codex model selector/status. |
| `docs/invariants.md` | `conflicts_with_ssot` wording residue | Same correction as decisions so the invariant no longer conflicts with the visible model selector/status contract. |
| `contracts/app-shell-candidates.json` design-reference / candidate acceptance wording | `conflicts_with_ssot` wording residue | Replaced hidden `backend/model/provider` and hidden `backend, model, and permission` language with backend/provider/permission retirement plus App-owned model selector/status preservation. |
| `scripts/validate-shell-candidates/candidate-contract.ts` | `more_specific_detail` validator alignment | Updated candidate forbidden-control guard to reject only a non-App-owned model override selector. |
| `docs/active/app-ideal-state-gap-plan.md` | `covered_by_ssot` | Already states Home and conversation hide executor/backend/provider/permission selectors while preserving App-owned model selector/status. No rewrite. |
| `docs/architecture.md`, `docs/status.md`, `docs/app-gui-element-audit.md`, `docs/app-ideal-gui-interaction-spec.md`, `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md`, `docs/agui-codex-candidate-verification.md` | `covered_by_ssot` / `more_specific_detail` | Already align to the same split or keep candidate/support detail without claiming the App-owned model selector is retired. No rewrite. |
| `docs/history/process/2026-06-06-app-active-gui-stale-wording-closeout.md` and older process records | `history_or_provenance` | Historical wording remains provenance and is not rewritten except for this new closeout/index entry. |

## Edits

- `docs/decisions.md`: current decision now separates backend/provider/permission retirement from App-owned model control.
- `docs/invariants.md`: invariant now matches the visible App-owned model selector/status contract.
- `contracts/app-shell-candidates.json`: design-reference and candidate acceptance language now preserves App-owned model control while retiring backend/provider/permission selectors.
- `scripts/validate-shell-candidates/candidate-contract.ts`: candidate validator now guards `non-App-owned model override selector` instead of all model control.
- `docs/history/process/README.md`: indexed this closeout.

## Retired / Guarded Surface

The retired surface is the stale semantic claim that ordinary App UI must hide every model selector. That claim is now history-only. Current retired controls are backend/provider/permission selectors and non-App-owned model override surfaces; no compatibility selector, alias, facade, wrapper, or second model-policy owner was added.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk npm run validate:shell-candidates
rtk node --experimental-strip-types scripts/validate-active-shell.ts --quick
rtk rg -n "backend, model, and permission selectors hidden|without backend/model/provider selectors|model override lists|home or conversation model override lists|Codex model override selector" docs contracts scripts -g '*.md' -g '*.json' -g '*.ts'
rtk git diff --check
rtk sh -lc '! rg -n "^(<<<<<<<|=======|>>>>>>>)" docs contracts scripts'
python3 /Users/gaofeng/workspace/opl-doc/scripts/opl_doc_doctor.py doctor /Users/gaofeng/workspace/one-person-lab-app --format json
```

Result:

- `npm run validate:shell-candidates` passed with `active_shell_unchanged=aionui`, candidate `agui-codex`, and `release_participation=explicit_candidate_build_only_until_adopted`.
- `scripts/validate-active-shell.ts --quick` passed.
- Targeted stale wording scan found only this closeout's history/provenance explanation.
- `git diff --check` passed.
- Conflict-marker scan found no matches.
- App doctor returned `finding_count=0` and `active_truth_health.status=pass`.

## Remaining Scope

- This lane does not change shell implementation, model defaults, release gates, App release readiness, candidate adoption, or domain/runtime authority.
- Broader App docs portfolio coverage remains open under the global OPL series goal.
