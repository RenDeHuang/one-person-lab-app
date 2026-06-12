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

## Coverage Summary

This section keeps topic-level App OPL Doc coverage only. It is not a dated
closeout ledger, release proof transcript, branch/worktree log, or completion
claim for the parent six-repo goal.

| Coverage theme | Current summary | Current owner |
| --- | --- | --- |
| App docs portfolio scope | Root `README*`, `docs/*.md`, `docs/active/*.md`, `docs/history/*.md`, `docs/history/process/*.md`, `docs/release/*.md`, `docs/testing/*.md`, `docs/user-guides/*.md`, and `docs/screenshots/*.md` have covered owner routes in this App process ledger. | `docs/docs_portfolio_consolidation.md`, core docs, this index |
| Install exposure / Codex-visible domain skills | MAS/MAG/RCA exposure stays plugin-packaged with direct skill compatibility; OMA stays OPL-generated. Duplicate bare skill mirrors and second semantic maps remain retired. | `contracts/app-install-exposure-policy.json`, `docs/status.md`, `docs/decisions.md`, active plan, `npm run validate:agent-installation` |
| Release cohort evidence | Release cohort policy, gates, Homebrew sequencing, Full first-install scope, VM profiles, candidate records, release notes, and promotion rules stay out of testing/user-guide/screenshot docs. Evidence remains cohort-bound and classified as present, missing, typed blocker, or not applicable. | `docs/release/README.md`, `contracts/app-release-channel.json`, workflows, release validators, release artifacts, CI outputs |
| Release guide compression | The release guide is now an operator map and SSOT pointer, not a long proof transcript. Dated GHCR/package-setting diagnostics, VM runner arguments, Full cache telemetry, local authorization debug details, workflow transcripts, and size-regression investigations belong in release artifacts, CI logs, scripts/workflow owners, or history/provenance. | `docs/release/README.md`, `contracts/app-release-channel.json`, release scripts, validators, workflows, release artifacts |
| Testing docs release guidance | Testing docs own command entry points and evidence classification guidance only. They do not duplicate release workflow policy or serve as current proof ledger. | `docs/testing/README.md`, package scripts, validators, release-boundary tests |
| GUI definition stack | GUI target shape, OPL delta, element audit, feature inventory, and shell candidate runbook remain separate owner docs. Shell implementation, active-shell adoption, and product acceptance require contracts, adapter selection, validation, and release gates. | GUI definition docs, App GUI/page-state/first-run contracts, active-shell validation |
| Candidate shell adoption | Candidate registry/adoption policy and design-reference policy are contract-owned; explicit AG-UI adapter selection is separate from default active shell. Candidate smoke, manifests, and runbook prose prove technical verification only. | `contracts/app-shell-candidates.json`, `contracts/shell-adapters/agui-codex.json`, `contracts/app-shell-adapter.json`, candidate manifests, validation scripts |
| User guide and screenshots | Generated guides derive from guide JSON and asset manifests. User-guide screenshots and visual docs are documentation artifacts, not release-ready, runtime-ready, domain-ready, or family-production proof. | `docs/user-guides/README.md`, guide source JSON, screenshot manifests, generated verification records, `docs/screenshots/README.md` |
| Retired App surfaces | No-resurrection rules are compressed in retired-surface provenance. | `retired-surface-provenance.md`, current owner contracts/source/tests/validators |

Current recheck scope: process-history and docs-lifecycle wording was rechecked
against the active plan, docs portfolio governance, status, release/testing/user
guide/screenshot indexes, package scripts, and retired-surface provenance. No
source, contract, workflow, package, shell, or test surface changed in this
docs-only tranche.

Remaining unreviewed docs-governance scope for App: none currently carried in
the App process ledger for tracked `README*` / `docs/**/*.md` owner-route themes.
This is not a release-readiness, GUI implementation parity, install exposure
live-root, candidate adoption, Full first-install, App production, or family
production claim.

Remaining App work under current owners: future release cohorts, Full/VM
evidence, candidate shell technical proof, GUI implementation parity, install
exposure live-root validation when package roots change, and any future
contract/workflow/artifact/validation change that alters App docs truth.

Next write scope: reopen App docs from fresh live truth only when an App-owned
contract, release workflow, release artifact/evidence manifest, active-shell
validation output, user-guide generation output, candidate manifest, install
exposure validator, or package script changes. Otherwise continue the parent OPL
series docs-governance goal in another repo or in a concrete App
implementation/evidence lane, not by appending more App process-history coverage
logs.
