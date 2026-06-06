# App status candidate runbook foldback closeout

Owner: `one-person-lab-app`
Purpose: `app_status_candidate_runbook_foldback_closeout`
State: `history_provenance`
Machine boundary: Human-readable OPL Doc closeout. Current App status truth stays in `docs/status.md`; candidate-shell machine truth stays in App contracts, validators, release-boundary tests, candidate manifests, shell artifacts, CI logs, and active-shell validation output.

## Semantic Theme

This lane governed the App docs theme `status currentness versus AG-UI/Codex candidate runbook detail`.

The question was whether `docs/status.md` should retain candidate-shell command sequences, shell-local smoke commands, and minimum acceptance longlists after the candidate runbook and candidate registry already own that content.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-shell-candidates.json` owns the candidate registry, candidate policy, design-reference policy, minimum acceptance policy, `agui-codex` technical-verification state, WebUI transport, PilotDeck/Stitch reference boundaries, and explicit-build-only release participation.
- `contracts/app-shell-adapter.json` owns the current default release shell, which remains `aionui`.
- `contracts/shell-adapters/agui-codex.json` owns the explicit selectable candidate adapter used only when `OPL_APP_SHELL_ADAPTER_CONTRACT` is set.
- `scripts/validate-shell-candidates.ts`, active-shell validation, release-boundary tests, candidate manifests, shell artifacts, and CI logs own executable candidate validation and proof.

Human SSOT:

- `docs/status.md` owns compact current App repository status.
- `docs/agui-codex-candidate-verification.md` owns candidate shell verification commands, shell-local smoke steps, minimum acceptance, and package-validation order.
- `docs/active/app-ideal-state-gap-plan.md` owns active candidate gap and next-round baton.
- `docs/docs_portfolio_consolidation.md` owns docs lifecycle routing.
- `docs/history/process/2026-06-06-app-agui-codex-candidate-shell-ssot-closeout.md` owns the prior candidate-shell SSOT audit provenance.

These owners beat `docs/status.md` for runbook detail because status should remain a compact current readout, while candidate commands and acceptance checklists are narrow operational support material.

## Peer-Doc Set

Reviewed current docs and evidence surfaces:

- `docs/status.md`
- `docs/agui-codex-candidate-verification.md`
- `docs/active/app-ideal-state-gap-plan.md`
- `docs/docs_portfolio_consolidation.md`
- `docs/project.md`
- `docs/architecture.md`
- `docs/invariants.md`
- `docs/decisions.md`
- `docs/history/process/2026-06-06-app-agui-codex-candidate-shell-ssot-closeout.md`
- `contracts/app-shell-candidates.json`
- `contracts/app-shell-adapter.json`
- `contracts/shell-adapters/agui-codex.json`
- `scripts/validate-shell-candidates.ts`

## Classification

| Class | Outcome |
| --- | --- |
| `covered_by_ssot` | Candidate registry, explicit adapter selection, active-shell separation, candidate release isolation, design-reference policy, and executable validation remain covered by contracts, validators, release-boundary tests, artifacts, manifests, CI logs, and the candidate runbook. |
| `more_specific_detail` | Candidate App-root commands, shell-local commands, UI smoke order, packaged `.app` checks, WebUI/source/package smoke requirements, and minimum acceptance belong in `docs/agui-codex-candidate-verification.md`, not in `docs/status.md`. |
| `conflicts_with_ssot` | `docs/status.md` carried a runbook-grade command and acceptance longlist even though it also stated that candidate evidence currentness stays outside the status file. |
| `history_or_provenance` | Prior candidate SSOT audit remains in `docs/history/process/2026-06-06-app-agui-codex-candidate-shell-ssot-closeout.md`; this closeout records only the status-foldback cleanup. |
| `stale_or_superseded` | The duplicated candidate command surface and minimum acceptance longlist were removed from `docs/status.md` and replaced by owner pointers. No compatibility or legacy command surface was kept there. |
| `out_of_scope` | This lane did not change candidate contracts, active-shell adapter choice, default release packaging, candidate package evidence, candidate adoption, release readiness, domain readiness, App release readiness, or family production readiness. |

## Rewrite Decision

`docs/status.md` was thinned at the content level.

The status file now keeps the current candidate fact: `agui-codex` is an explicit technical-verification candidate, AionUI remains the default stable/nightly shell, and candidate claims must be proved by candidate registry, explicit adapter validation, state-model validation, smoke/package artifacts, manifests, and release-isolation checks.

The detailed App-root command sequence, shell-local command sequence, and minimum acceptance longlist now remain only in `docs/agui-codex-candidate-verification.md` and machine validation surfaces.

## Verification

Fresh verification for this docs-only lane:

- `git diff --check` passed.
- Conflict-marker scan over `README*`, `docs`, and `scripts/README.md` found no matches.
- Targeted status scan confirmed `docs/status.md` now points candidate commands and minimum acceptance to `docs/agui-codex-candidate-verification.md` instead of carrying the duplicated longlist.
- App OPL Doc doctor returned `finding_count=0` and `active_truth_health.status=pass`.

This evidence proves docs hygiene for this lane only. It does not prove candidate package readiness, active-shell adoption, App release readiness, domain readiness, or OPL family production readiness.
