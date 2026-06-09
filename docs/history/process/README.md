# App process history

Owner: `one-person-lab-app`
Purpose: `process_history_index`
State: `historical_archive_index`
Machine boundary: Human-readable process history index. Machine truth stays in `contracts/`, source, release artifacts, updater metadata, test outputs, active shell validation, release artifacts, candidate manifests, CI logs, Homebrew tap output, and OPL Framework CLI/read-model output consumed by the App.

## 读法

本目录只保留 App docs / release / GUI / candidate 治理过程的压缩 provenance。历史过程按主题保留，不维护逐日 closeout 长清单。若某条历史结论仍有当前规则价值，先折回 `docs/docs_portfolio_consolidation.md`、核心五件套、active gap plan、App contracts、source、tests、release artifacts、candidate manifests 或 validation scripts，再把过程记录压缩在本目录。

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

| Provenance group | Current read |
| --- | --- |
| Docs lifecycle and coverage | Dated coverage tranche、doctor transcript、branch/worktree closeout、per-file proof log 不在本目录逐条维护；本索引只保留主题级 coverage 与 remaining scope。 |
| Retired module/interface/test/workflow/entrypoint tails | `retired-surface-provenance.md` 保留 no-resurrection rules 和 current owner refs。Homebrew PR mode、legacy Build and Release、duplicate tests、docs-prose oracles、helper exports、legacy routes、ordinary selector、Team、Developer Mode、`ppt` compatibility wording、`morph-ppt` packaging 和 dated evidence closeouts 已压缩。 |
| Candidate / release / screenshot / guide evidence | 当前读法回到 candidate manifests、release artifacts、evidence manifests、generated guide manifests、CI logs、contracts、validators 和 tests。Local smoke、VM proof、candidate smoke、screenshot proof、WebUI image-size、absolute paths、run ids 和 proof-by-proof logs 不作为当前 truth 保存。 |
| GUI definition stack and external references | 当前 owner 仍是 GUI definition docs、candidate runbook、contracts、page-state matrices 和 validators。PilotDeck / Stitch / AG-UI / CopilotKit 的 intake 只保留 reference-only boundary 和 no-authority-transfer 规则。 |

## Coverage Snapshot

2026-06-09 OPL Doc series tranche:

- Scope reviewed: root `README*`, `docs/*.md`, `docs/active/*.md`, `docs/history/*.md`, `docs/history/process/*.md`, `docs/release/*.md`, `docs/testing/*.md`, `docs/user-guides/*.md`, `docs/screenshots/*.md`, App contracts and package-script surfaces that define App docs truth.
- SSOT decision: active progress and next baton stay in `docs/active/app-ideal-state-gap-plan.md`; App current truth stays in the core docs; release/user-path evidence stays in release artifacts, manifests, workflows, validators and CI logs; GUI requirements stay in the GUI definition stack and App contracts; process history stays here only as compressed provenance.
- Content-level consolidation: prior dated release-workflow, release-evidence, AG-UI/CopilotKit, user-guide/screenshot, runtime-page and command-center coverage entries were compressed into the provenance groups above. Durable no-resurrection rules remain in `retired-surface-provenance.md`; current rules remain in owner docs and contracts.
- Retired / guarded: no source, contract, workflow or test changed in this tranche. Do not recreate `docs/active/app-interaction-logic-command-center.md`, the legacy tag-push **Build and Release** workflow, optional `release-evidence-<version>` seed download, duplicate candidate verification checklists, user-guide screenshot release-readiness proof, Team ordinary-user route, single Developer Mode switch, or legacy settings routes as active App truth.
- Remaining unreviewed scope under the parent OPL series goal: full paragraph-by-paragraph audit remains open for App non-process docs not semantically covered by prior accepted tranches, especially install exposure, release cohort evidence, future shell adoption, GUI definition paragraphs, and candidate promotion/adoption wording.
- Next write scope: after fresh intake, choose one concrete App-owned theme and edit only its SSOT owner plus directly affected peer docs; likely `install_exposure`, `release_cohort_evidence`, `GUI_definition_stack`, or `candidate_shell_adoption`. Do not use this process-history compression as proof that the whole App docs portfolio is globally complete.
