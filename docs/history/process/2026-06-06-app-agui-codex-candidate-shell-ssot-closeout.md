# App AG-UI/Codex candidate shell SSOT closeout

Owner: `one-person-lab-app`
Purpose: `agui_codex_candidate_shell_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable OPL Doc closeout. Current candidate-shell, design-reference, active-shell, WebUI transport, package, and release-isolation truth stays in `contracts/app-shell-candidates.json`, `contracts/app-shell-adapter.json`, `contracts/shell-adapters/agui-codex.json`, validation scripts, release-boundary tests, candidate shell artifacts, manifests, CI logs, and App-owned GUI contracts.

## Semantic Theme

This lane governed the App docs theme `experimental AG-UI/Codex candidate shell and external UI design references`.

The question was whether active docs still had competing current truth for:

- the default release shell versus the `agui-codex` candidate;
- explicit candidate adapter selection and package validation;
- AG-UI, CopilotKit, WebUI, PilotDeck, and Stitch roles;
- candidate smoke evidence and dated proof lifecycle;
- whether candidate evidence can imply active-shell adoption, release readiness, Full VM readiness, domain readiness, or family production readiness.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-shell-candidates.json` owns the candidate registry, candidate policy, design-reference policy, `agui-codex` technical-verification state, WebUI transport, PilotDeck/Stitch reference boundaries, minimum acceptance, and explicit-build-only release participation.
- `contracts/app-shell-adapter.json` owns the default release shell, which remains `aionui`.
- `contracts/shell-adapters/agui-codex.json` owns the explicit selectable candidate adapter used only through `OPL_APP_SHELL_ADAPTER_CONTRACT`.
- `scripts/validate-shell-candidates.ts` and `scripts/validate-shell-candidates/**` enforce registry shape, active-shell separation, candidate adapter package contract, WebUI transport, PilotDeck no-authority transfer, state-model proof requirements, and candidate evidence checks.
- `tests/release/app-release-boundary-cases/shell-adapter-and-gui-contracts.ts` guards the release-boundary behavior.

Human owners:

- `docs/agui-codex-candidate-verification.md` owns the candidate verification runbook.
- `docs/app-gui-feature-inventory.md` owns the product-level GUI feature inventory and reference mapping.
- `docs/app-ideal-gui-interaction-spec.md` owns the shell-agnostic ideal interaction model.
- `docs/codex-to-opl-app-delta.md` owns the Codex App to OPL App product delta.
- `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, and `docs/decisions.md` own compact durable current truth and non-ownership rules.
- `docs/history/process/2026-06-02-agui-codex-candidate-smoke-evidence.md` owns dated smoke evidence provenance.

These owners beat peer docs because they are either machine-readable gates or the narrowest current human document for the semantic role. Recency, repeated wording, candidate package evidence, or implementation roadmap prose does not create product truth.

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
- `docs/active/app-ideal-state-gap-plan.md`
- `docs/active/app-interaction-logic-command-center.md`
- `docs/app-ideal-gui-interaction-spec.md`
- `docs/codex-to-opl-app-delta.md`
- `docs/app-gui-feature-inventory.md`
- `docs/app-gui-element-audit.md`
- `docs/agui-codex-candidate-verification.md`
- `docs/docs_portfolio_consolidation.md`
- `scripts/README.md`
- `docs/history/process/2026-06-02-agui-codex-candidate-smoke-evidence.md`
- `docs/history/process/2026-06-03-app-docs-lifecycle-cleanup-archive.md`
- `contracts/app-shell-candidates.json`
- `contracts/app-shell-adapter.json`
- `contracts/shell-adapters/agui-codex.json`
- `scripts/validate-shell-candidates.ts`
- `scripts/validate-shell-candidates/**`
- `tests/release/app-release-boundary-cases/shell-adapter-and-gui-contracts.ts`

## Classification

| Class | Outcome |
| --- | --- |
| `covered_by_ssot` | Candidate registry, candidate adapter, default active shell, WebUI transport, PilotDeck/Stitch design-reference policy, candidate package validation, and release isolation already have machine SSOT in contracts, validators, and release-boundary tests. |
| `more_specific_detail` | Candidate runbook keeps commands and minimum acceptance; GUI inventory keeps product capability and reference mapping; ideal interaction spec and Codex-to-OPL delta keep shell-agnostic product requirements; core docs keep compact current truth. |
| `conflicts_with_ssot` | No current non-history doc claims `agui-codex` is the default release shell, treats PilotDeck or Stitch as source/runtime authority, exposes AG-UI as an ordinary product concept, or turns candidate evidence into active-shell adoption or release readiness. |
| `history_or_provenance` | Dated 2026-06-02 candidate smoke evidence and 2026-06-03 lifecycle cleanup remain under `docs/history/process/`; future dated proof belongs in candidate manifests, shell artifacts, CI logs, release evidence, history, or commit history. |
| `stale_or_superseded` | No text needed retirement in this lane. The existing negative guards already keep candidate evidence technical-only and prevent default release-shell adoption without `contracts/app-shell-adapter.json` changing deliberately. |
| `out_of_scope` | Producing fresh source/WebUI/package smoke artifacts, packaging the candidate `.app`, changing default release shell, adopting `agui-codex`, and broad App docs portfolio coverage. |

## No-Rewrite Decision

No active/current doc was rewritten in this lane.

The current portfolio already keeps one role per owner:

- `contracts/app-shell-candidates.json` and `scripts/validate-shell-candidates.ts` own machine candidate policy.
- `contracts/app-shell-adapter.json` owns default release-shell truth.
- `contracts/shell-adapters/agui-codex.json` owns explicit candidate selection.
- `docs/agui-codex-candidate-verification.md` owns human verification steps.
- `docs/app-gui-feature-inventory.md` owns product capability inventory and reference mapping.
- `docs/status.md`, `docs/project.md`, and `docs/architecture.md` keep only compact current summaries and pointers.
- history docs retain dated proof and cleanup provenance.

Adding another active summary would create a parallel truth source. This closeout therefore records the audit result under history only.

## Verification

Fresh verification on `2026-06-06`:

- `npm run validate:shell-candidates` passed and returned `active_shell_unchanged=aionui`, `candidate_count=1`, candidate `agui-codex`, and `release_participation=explicit_candidate_build_only_until_adopted`.
- `node --experimental-strip-types scripts/validate-active-shell.ts --quick` passed with `Active shell contract is structurally valid.`
- `npm run test:release-boundary -- --runInBand` passed with `124` tests and `0` failures.

This evidence proves registry shape, candidate isolation, active-shell separation, and release-boundary guards. It does not prove candidate package readiness, active-shell adoption, release readiness, Full first-install readiness, domain readiness, or family production readiness.
