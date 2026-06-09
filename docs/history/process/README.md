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
| Install exposure / Codex-visible domain skills | `contracts/app-install-exposure-policy.json`, `docs/status.md`, `docs/decisions.md`, `docs/active/app-ideal-state-gap-plan.md`, `npm run validate:agent-installation` |
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
| Install exposure / Codex-visible domain skills | 当前读法回到 install exposure contract、product profile、status/decisions/active plan 和 `validate:agent-installation`。README 安装段、release guide、user guide 和 testing docs只能指向同一 App-first setup / plugin-packaged skill 语义，不维护第二套 MAS/MAG/RCA skill mirror 或 OMA home-entry 规则。 |

## Coverage Snapshot

2026-06-09 App remaining-theme SSOT tranche:

- Scope reviewed: all tracked App root `README*`, `docs/*.md`, `docs/active/*.md`, `docs/history/*.md`, `docs/history/process/*.md`, `docs/release/*.md`, `docs/testing/*.md`, `docs/user-guides/*.md`, and `docs/screenshots/*.md`, with focused live-owner reads from `contracts/app-install-exposure-policy.json`, `contracts/app-release-channel.json`, `contracts/app-gui-product-contract.json`, package scripts, release workflows and release/agent-installation validators.
- SSOT decision: install exposure stays in `contracts/app-install-exposure-policy.json` plus `docs/status.md` / `docs/decisions.md` / active plan readout; release cohort evidence stays in `docs/release/README.md`, `contracts/app-release-channel.json`, release workflows, validators, artifacts and CI outputs; GUI definition stays in `docs/app-ideal-gui-interaction-spec.md`, `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md`, `docs/app-gui-element-audit.md`, App GUI/page-state/first-run contracts and active-shell validation.
- Content-level consolidation: the three previously named remaining themes now have explicit owner routes and no longer count as App docs-governance unreviewed scope. Candidate adoption and testing release-policy wording remain covered by earlier tranches; install exposure, release cohort evidence and GUI definition stack are covered here as semantic owner routes, not as release-ready or GUI-implementation completion claims.
- Retired / guarded: no source, contract, workflow, package or test changed in this tranche. Do not recreate duplicate bare MAS/MAG/RCA Codex skill mirrors, a second release-cohort policy in testing/user guides/screenshots, screenshot-based release-readiness proof, GUI candidate adoption by prose, or shell-owned GUI product truth.
- Remaining App scope under the parent OPL series goal: no unreviewed App `README*` or `docs/**/*.md` scope remains from the named App docs-governance themes at this snapshot. Open work is implementation/evidence-tail work under existing owners: future release cohorts, Full/VM evidence, candidate shell technical proof, GUI implementation parity, and install exposure live-root validation when package roots change.
- Next write scope: reopen App docs only when contracts, release workflows, release artifacts, candidate manifests, active shell validation, user-guide generation, or install exposure validators change live truth. Otherwise continue the parent OPL series goal in another repo or in a concrete App implementation/evidence lane, not by appending more App process-history coverage logs.

2026-06-09 candidate shell adoption SSOT tranche:

- Scope reviewed: `docs/agui-codex-candidate-verification.md`, `docs/app-gui-feature-inventory.md#AG-UI/CopilotKit Candidate 验证 Owner`, `docs/codex-to-opl-app-delta.md#Shell 采纳规则`, `docs/architecture.md` active-shell / candidate paragraphs, `docs/status.md` candidate status paragraphs, `docs/active/app-ideal-state-gap-plan.md#agui_codex_candidate_gate`, `docs/docs_portfolio_consolidation.md`, `contracts/app-shell-candidates.json`, `contracts/shell-adapters/agui-codex.json`, `contracts/app-shell-adapter.json`, `scripts/validate-shell-candidates.ts`, and `scripts/validate-shell-candidates/*`.
- SSOT decision: candidate registry, adoption gate, forbidden entry routes and design-reference policy stay in `contracts/app-shell-candidates.json`; explicit candidate adapter selection stays in `contracts/shell-adapters/agui-codex.json`; default stable/nightly release shell truth stays in `contracts/app-shell-adapter.json`; human command order and minimum acceptance stay in `docs/agui-codex-candidate-verification.md`.
- Content-level consolidation: candidate adoption wording no longer remains an unresolved docs-governance tail. The runbook now states that source/WebUI/package smoke, candidate manifests, state-model validation and package validation prove only technical verification; default-shell adoption requires a deliberate active adapter contract change plus App-owned product, page-state, first-run, validation, package, release-isolation and external-checkout gates.
- Retired / guarded: do not convert candidate smoke summaries, design references, WebUI parity evidence, package manifest presence, or runbook prose into active-shell adoption, App product authority, release readiness, clean-VM readiness, Full release readiness, domain readiness, or family production readiness. Do not create a second adoption checklist in feature-inventory, status, architecture, active plan, or process history.
- Remaining App scope under the parent OPL series goal: candidate technical evidence and possible future adoption remain implementation/release work, not an unresolved docs-adoption SSOT split. The previously named install exposure, release cohort evidence and GUI definition docs themes are covered by the 2026-06-09 remaining-theme SSOT tranche above.
- Next write scope: only reopen candidate adoption docs if `contracts/app-shell-candidates.json`, `contracts/shell-adapters/agui-codex.json`, `contracts/app-shell-adapter.json`, candidate manifests, or validation scripts change.

2026-06-09 release cohort evidence testing-doc SSOT tranche:

- Scope reviewed: `docs/testing/README.md` release matrix / installed smoke / release CI operations / VM and AI-first testing sections, plus peer owner surfaces `docs/release/README.md`, `docs/status.md`, `docs/decisions.md`, `docs/active/app-ideal-state-gap-plan.md`, `docs/docs_portfolio_consolidation.md`, `contracts/app-release-channel.json`, package scripts, release validators and release-boundary tests.
- SSOT decision: release cohort policy, gate membership, Homebrew sequencing, Full first-install scope, VM profiles, release notes, candidate records and promotion rules stay in `docs/release/README.md`, `contracts/app-release-channel.json`, release workflows, release validators and release-boundary tests. `docs/testing/README.md` owns only testing entry points and evidence classification guidance.
- Content-level consolidation: `docs/testing/README.md` no longer repeats the detailed release workflow, Homebrew, VM, Full cache/size, readiness-summary, actionlint/concurrency and release-note policy. It now keeps a testing-facing release validation matrix and cohort evidence boundary, with pointers back to release owners.
- Retired / guarded: do not regrow testing docs into a second release policy owner or current proof ledger. Same-cohort release artifacts, VM output, Homebrew summaries, release notes evidence and candidate records remain release artifacts / CI outputs, not durable current truth in testing docs.
- Remaining App scope under the parent OPL series goal: release cohort evidence remains live release/evidence work under `docs/release/README.md`, release contracts, workflows, artifacts and validators. It is no longer an App docs-governance unreviewed theme after the 2026-06-09 remaining-theme SSOT tranche above.

2026-06-09 OPL Doc series tranche:

- Scope reviewed: root `README*`, `docs/*.md`, `docs/active/*.md`, `docs/history/*.md`, `docs/history/process/*.md`, `docs/release/*.md`, `docs/testing/*.md`, `docs/user-guides/*.md`, `docs/screenshots/*.md`, App contracts and package-script surfaces that define App docs truth.
- SSOT decision: active progress and next baton stay in `docs/active/app-ideal-state-gap-plan.md`; App current truth stays in the core docs; release/user-path evidence stays in release artifacts, manifests, workflows, validators and CI logs; GUI requirements stay in the GUI definition stack and App contracts; process history stays here only as compressed provenance.
- Content-level consolidation: prior dated release-workflow, release-evidence, AG-UI/CopilotKit, user-guide/screenshot, runtime-page and command-center coverage entries were compressed into the provenance groups above. Durable no-resurrection rules remain in `retired-surface-provenance.md`; current rules remain in owner docs and contracts.
- Retired / guarded: no source, contract, workflow or test changed in this tranche. Do not recreate `docs/active/app-interaction-logic-command-center.md`, the legacy tag-push **Build and Release** workflow, optional `release-evidence-<version>` seed download, duplicate candidate verification checklists, user-guide screenshot release-readiness proof, Team ordinary-user route, single Developer Mode switch, or legacy settings routes as active App truth.
- Remaining unreviewed scope under the parent OPL series goal: none for App `README*` / `docs/**/*.md` at this snapshot. This is a docs-governance coverage statement only; it does not close release readiness, GUI implementation parity, install exposure live-root validation, candidate adoption, Full first-install evidence, or App/family production readiness.
- Next write scope: reopen App docs from fresh live truth only when an App-owned contract, release workflow, release artifact/evidence manifest, active-shell validation output, user-guide generation output, candidate manifest, or install exposure validator changes. Do not use this process-history compression as proof of release readiness or product implementation completion.
