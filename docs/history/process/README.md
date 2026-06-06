# App process history

Owner: `one-person-lab-app`
Purpose: `process_history_index`
State: `history_index`
Machine boundary: Human-readable process history index. Machine truth stays in `contracts/`, source, release artifacts, updater metadata, test outputs, active shell validation, and OPL Framework CLI/read-model output consumed by the App.

This directory stores dated docs-governance coverage, release/candidate foldback context, branch/worktree closeout notes, and other process provenance that should not live in active App governance, status, or gap-plan documents.

Current App docs lifecycle truth returns to:

- [App docs portfolio governance](../../docs_portfolio_consolidation.md)
- [App status](../../status.md)
- [App ideal-state gap plan](../../active/app-ideal-state-gap-plan.md)
- App contracts, source, tests, release evidence artifacts, and validation scripts

## Ledger

| File | Content | Current read |
| --- | --- | --- |
| [2026-06-06-app-release-evidence-ssot-closeout.md](./2026-06-06-app-release-evidence-ssot-closeout.md) | release cohort evidence versus release-ready claims 的 SSOT-first 文档治理 closeout。 | Historical provenance only; current release evidence truth stays in `contracts/app-release-channel.json`, release evidence manifests, validation scripts, release artifacts, updater metadata, and release owner promotion records. |
| [2026-06-06-app-user-guide-ssot-closeout.md](./2026-06-06-app-user-guide-ssot-closeout.md) | macOS install user-guide source versus generated artifacts 的 SSOT-first 文档治理 closeout。 | Historical provenance only; current guide content truth stays in `docs/user-guides/macos-app-install.guide.json`, screenshot truth stays in `macos-app-install-assets.json` and generated verification records. |
| [2026-06-03-app-docs-lifecycle-cleanup-archive.md](./2026-06-03-app-docs-lifecycle-cleanup-archive.md) | Dated release/candidate/local-smoke evidence classes moved out of active status, active plan, testing, candidate runbook, and GUI inventory docs. | Historical provenance only; current rules live in active governance, core docs, active gap plan, contracts, source, tests, release evidence artifacts, and validation scripts. |
| [2026-06-02-app-docs-portfolio-coverage-ledger-archive.md](./2026-06-02-app-docs-portfolio-coverage-ledger-archive.md) | Dated coverage tranches moved out of `docs/docs_portfolio_consolidation.md`. | Historical provenance only; durable rules must be folded back into active governance, core docs, active gap plan, contracts, source, tests, or release validation docs. |
| [2026-06-02-aionui-builtin-skill-intake.md](./2026-06-02-aionui-builtin-skill-intake.md) | Dated AionUI builtin skill candidate intake and App whitelist rationale. | Historical provenance only; current skill packaging policy is in App contracts, decisions, release scripts, and validation tests. |
| [2026-06-02-agui-codex-candidate-smoke-evidence.md](./2026-06-02-agui-codex-candidate-smoke-evidence.md) | Dated AG-UI/CopilotKit candidate smoke evidence moved out of the active candidate runbook. | Historical provenance only; current candidate boundary and commands stay in `docs/agui-codex-candidate-verification.md`, and default release shell authority stays in App contracts. |
