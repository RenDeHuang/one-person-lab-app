# App process history

Owner: `one-person-lab-app`
Purpose: `process_history_index`
State: `historical_archive_index`
Machine boundary: Human-readable process history index. Machine truth stays in `contracts/`, source, release artifacts, updater metadata, test outputs, active shell validation, release artifacts, candidate manifests, CI logs, Homebrew tap output, and OPL Framework CLI/read-model output consumed by the App.

## 读法

本目录只保留 App docs / release / GUI / candidate 治理过程的压缩 provenance。历史过程按主题保留，不再维护逐日 closeout 长清单。若某条历史结论仍有当前规则价值，先折回 `docs/docs_portfolio_consolidation.md`、核心五件套、active gap plan、App contracts、source、tests、release artifacts、candidate manifests 或 validation scripts，再把过程记录压缩在本目录。

## Single Source Of Truth

| Theme | Current owner |
| --- | --- |
| 当前完成口径、功能/结构差距、测试/证据差距、下一轮 prompt | `docs/active/app-ideal-state-gap-plan.md` |
| 文档生命周期、目录职责、unique-role inventory、reopening conditions | `docs/docs_portfolio_consolidation.md` |
| 当前 App repository / shell / release / runtime-page / validation state | `docs/status.md` |
| Product boundary、architecture split、non-ownership rules、still-active decisions | `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md` |
| GUI definition stack | `docs/app-ideal-gui-interaction-spec.md`, `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md`, `docs/app-gui-element-audit.md` |
| Candidate shell verification | `docs/agui-codex-candidate-verification.md`, `contracts/app-shell-candidates.json`, `contracts/shell-adapters/agui-codex.json` |
| Release / updater / Full first-install / evidence operations | `docs/release/README.md`, `docs/release/release-train-optimization-design.md`, `contracts/app-release-channel.json`, release workflows and scripts |
| Validation guidance | `docs/testing/README.md`, package scripts, validators, release-boundary tests, active-shell validation |
| User guide and screenshots | `docs/user-guides/README.md`, guide source JSON, `docs/screenshots/README.md`, generated guide artifacts |
| Retired surface no-resurrection provenance | [`retired-surface-provenance.md`](./retired-surface-provenance.md) |

## Compressed Provenance

| Provenance group | What remains here | What moved out |
| --- | --- | --- |
| Docs lifecycle and coverage | 本索引只记录当前 SSOT owner、coverage snapshot 和 reopen 入口。 | Dated coverage tranche、doctor transcript、branch/worktree closeout、per-file proof log 不再以单独 Markdown 文件维护。 |
| Retired module/interface/test/workflow/entrypoint tails | `retired-surface-provenance.md` 保留 no-resurrection rules 和 current owner refs。 | Homebrew PR mode、legacy Build and Release、duplicate tests、docs-prose oracles、helper exports、legacy routes、ordinary selector、Team、Developer Mode、`ppt` compatibility wording、`morph-ppt` packaging 和 dated evidence closeouts 已压缩。 |
| Candidate / release / screenshot / guide evidence | 当前读法回到 candidate manifests、release artifacts、evidence manifests、generated guide manifests、CI logs、contracts、validators 和 tests。 | Dated local smoke、VM proof、candidate smoke、screenshot proof、WebUI image-size、absolute paths、run ids 和 proof-by-proof logs 不再作为当前 truth 保存。 |
| GUI definition stack and external references | 当前 owner 仍是 GUI definition docs、candidate runbook、contracts、page-state matrices 和 validators。 | PilotDeck / Stitch / AG-UI / CopilotKit 的 dated intake 只保留 reference-only boundary 和 no-authority-transfer 规则。 |

## Coverage Snapshot

2026-06-08 App release-workflow retirement SSOT tranche:

- Theme / SSOT: release workflow lifecycle and the retired tag-push **Build and Release** surface. Machine SSOT is `.github/workflows/`, `contracts/app-release-channel.json#release_acceleration.github_actions`, `scripts/validate-release-boundary.ts`, and `tests/release/app-release-boundary-cases/workflow-release-channels.ts`; docs are human projections only.
- Reviewed: all App `README*.md`, `docs/README.md`, every `docs/*.md`, every `docs/active/*.md`, every `docs/history/*.md`, every `docs/history/process/*.md`, every `docs/release/*.md`, every `docs/testing/*.md`, every `docs/user-guides/*.md`, `scripts/README.md`, `.github/workflows/*.yml`, `contracts/app-release-channel.json`, `package.json`, `scripts/validate-release-boundary.ts`, `scripts/validate-active-shell/release-contract-validator.ts`, and release-boundary tests touching workflow ownership.
- Edited: `tests/release/app-release-boundary-cases/workflow-release-channels.ts`, this file, and `docs/history/process/retired-surface-provenance.md`.
- Retired / guarded: legacy `.github/workflows/build-and-release.yml` remains absent and now has an explicit release-boundary test proving there is no live workflow file, no contract pointer, and no same-name workflow title. The current replacement stays Desktop Release / Desktop Release Promote / Full First-Install / Nightly Standard workflows plus candidate records and release-boundary validation.
- Coverage result: App README/docs are covered for this release-workflow retirement theme. No App doc outside history claims the old workflow as live truth; `docs/release/README.md` keeps the operator explanation, and no-resurrection provenance points back to machine owners.
- Remaining App unreviewed scope under the parent OPL series goal: full line-by-line semantic audit for non-release themes such as GUI definition stack, user guides/screenshots, candidate-shell adoption, runtime-page operator evidence, and install exposure. Remaining functional/evidence gaps stay in `docs/active/app-ideal-state-gap-plan.md`.
- Next write scope: continue with another clean sibling repo or another disjoint App theme only after fresh intake; do not return to `one-person-lab` or `med-autoscience` writes while their concurrent dirty write sets remain active.

2026-06-08 App process-history compression tranche:

- Reviewed: `AGENTS.md`, fallback `~/.codex/TASTE.md`, `README*`, `docs/README.md`, `docs/project.md`, `docs/status.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md`, `docs/docs_portfolio_consolidation.md`, `docs/active/app-ideal-state-gap-plan.md`, `docs/history/README.md`, previous `docs/history/process/*.md`, `docs/agui-codex-candidate-verification.md`, `docs/app-gui-feature-inventory.md`, `docs/testing/README.md`, `package.json`, and exact contract/source/test/workflow references to dated process paths.
- Edited: `docs/history/process/README.md`, `docs/history/process/retired-surface-provenance.md`, `docs/docs_portfolio_consolidation.md`, `docs/agui-codex-candidate-verification.md`, `docs/app-gui-feature-inventory.md`, `docs/status.md`, `docs/testing/README.md`.
- Compressed / deleted: previous dated App process closeout Markdown files under `docs/history/process/`, after their durable conclusions were folded into the SSOT owners above or into `retired-surface-provenance.md`.
- Unreviewed in this tranche: non-process App docs were read for SSOT alignment and stale dated-reference cleanup only. A full line-by-line App non-process docs audit remains open under the parent OPL series goal unless covered by prior accepted tranches.
- Remaining stale / retire candidates in App process history: none identified after compression. Remaining App work stays in `docs/active/app-ideal-state-gap-plan.md`, especially release-cohort evidence, Full first-install VM evidence, runtime-page operator evidence, active shell sync, packaged GUI Codex-path evidence, AG-UI/CopilotKit candidate gate, and PilotDeck reference intake.
- Next write scope: repeat SSOT-first history/process compression on the remaining clean sibling repos, then return to `one-person-lab` and `med-autoscience` only when their dirty concurrent write sets are safe to absorb or disjoint.
