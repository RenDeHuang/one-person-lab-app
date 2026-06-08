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

2026-06-08 App GUI command-center support doc retirement tranche:

- Theme / SSOT: App GUI interaction requirements, Home/Runtime/Settings
  placement, shell coordination, and thin-shell implementation boundary.
  Current human SSOT is the GUI definition stack:
  `docs/app-ideal-gui-interaction-spec.md`,
  `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md`, and
  `docs/app-gui-element-audit.md`. Machine SSOT is
  `contracts/app-gui-product-contract.json`,
  `contracts/app-runtime-bridge.json`, `contracts/app-page-state-matrix.json`,
  `contracts/app-product-profile.json`, `scripts/validate-active-shell.ts`, and
  focused release-boundary / shell tests.
- Reviewed: `AGENTS.md`, `TASTE.md`, `README.md`, `README.zh-CN.md`,
  `docs/README.md`, `docs/docs_portfolio_consolidation.md`,
  `docs/active/app-ideal-state-gap-plan.md`,
  `docs/active/app-interaction-logic-command-center.md`,
  `docs/app-ideal-gui-interaction-spec.md`,
  `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md`,
  `docs/app-gui-element-audit.md`, `docs/agui-codex-candidate-verification.md`,
  `docs/status.md`, `docs/project.md`, `docs/architecture.md`,
  `docs/invariants.md`, `docs/decisions.md`, `docs/user-guides/README.md`,
  `docs/screenshots/README.md`, `docs/testing/README.md`, this process index,
  `docs/history/process/retired-surface-provenance.md`, App GUI/runtime
  contracts, package scripts, and references to the retired handoff doc.
- Edited: `docs/README.md`, `docs/docs_portfolio_consolidation.md`, this
  process index, and `docs/history/process/retired-surface-provenance.md`.
  Deleted: `docs/active/app-interaction-logic-command-center.md`.
- Coverage result: the retired command-center support doc contained a parallel
  summary of Home, Runtime, Settings, Source of Truth, shell coordination, and
  validation guidance already owned by the GUI definition stack and App
  contracts. No machine caller or source/test reference depended on the Markdown
  path; only docs navigation and portfolio inventory linked it.
- Retired / guarded: do not recreate `docs/active/app-interaction-logic-command-center.md`
  or another active support doc that summarizes the same GUI requirements.
  Future GUI requirement changes must update the specific definition owner,
  App contract, page-state matrix, validator, release-boundary test, or shell
  test directly.
- Remaining App unreviewed scope under the parent OPL series goal: full
  line-by-line App non-process docs audit remains open for install exposure,
  release cohort evidence, future candidate adoption, and any GUI definition
  paragraph not covered by this retirement tranche.
- Next write scope: continue after fresh intake with install exposure or
  release cohort evidence, or move to a clean sibling repo lane.

2026-06-08 App runtime-page operator evidence lifecycle tranche:

- Theme / SSOT: Runtime page user-task status, operator evidence acceptance,
  provider readiness repair and artifact/native drilldown. Machine SSOT is
  `contracts/app-runtime-bridge.json`, `contracts/app-page-state-matrix.json`,
  `contracts/app-gui-product-contract.json`,
  `contracts/app-release-channel.json#operator_evidence_bundle`,
  `scripts/validate-active-shell/**`, release evidence validators, and
  `tests/release/app-release-boundary-cases/runtime-page-evidence-boundary.ts`.
  Human current readout stays in `docs/status.md`, `docs/architecture.md`,
  `docs/decisions.md`, `docs/testing/README.md`, `docs/release/README.md`, and
  `docs/active/app-ideal-state-gap-plan.md`.
- Reviewed: `AGENTS.md`, `TASTE.md`, `docs/docs_portfolio_consolidation.md`,
  `docs/status.md`, `docs/architecture.md`, `docs/decisions.md`,
  `docs/testing/README.md`, `docs/release/README.md`,
  `docs/screenshots/README.md`, `docs/user-guides/README.md`,
  `docs/active/app-ideal-state-gap-plan.md`, this process index,
  `contracts/app-runtime-bridge.json`, `contracts/app-page-state-matrix.json`,
  `contracts/app-gui-product-contract.json`,
  `tests/release/app-release-boundary-cases/runtime-page-evidence-boundary.ts`,
  and runtime-page/operator-evidence scans across docs, contracts, scripts and
  tests.
- Edited: this file only.
- Coverage result: Runtime page docs already point to the App-owned contract
  and validation owners. The default page remains user-task-status first:
  running, active, queued, attention, next visible step, owner, safe action and
  compact evidence refs before full diagnostic detail. Provider readiness repair
  stays secondary and actionable without overriding `current_owner_delta`.
  State Index and Stage Artifact Kernel data are refs-only drilldowns, not
  SQLite access, artifact-body access, artifact authority, domain readiness,
  quality/export verdict, App release readiness or family production readiness.
- Retired / guarded: no contract, source module, test, workflow, screenshot, or
  runtime-page doc was retired in this tranche. The guarded stale surfaces are
  raw provider/current-control telemetry as default page language, full
  drilldown JSON as normal App state, direct SQLite sidecar reads, artifact body
  reads, release evidence screenshots as product readiness proof, and any
  App-owned runtime/domain/owner-receipt authority wording.
- Remaining App unreviewed scope under the parent OPL series goal: install
  exposure, release cohort evidence, GUI definition stack paragraphs not covered
  by accepted candidate/runtime/user-guide tranches, and any future shell
  adoption or release-evidence body changes remain open unless covered by
  another accepted tranche.
- Next write scope: continue with a concrete SSOT theme after fresh intake,
  likely install exposure, release cohort evidence, GUI definition stack
  paragraph governance, or a clean sibling repo lane. Do not use this
  runtime-page review as proof that every App non-process docs paragraph has
  been line-reviewed.

2026-06-08 App user-guide/screenshot evidence lifecycle tranche:

- Theme / SSOT: macOS user-guide screenshots versus release evidence
  screenshots. User-guide content and screenshot provenance are owned by
  `docs/user-guides/macos-app-install.guide.json`,
  `docs/user-guides/macos-app-install-assets.json`, generated verification JSON,
  and guide build scripts. Release evidence screenshot truth is owned by
  `contracts/app-release-channel.json#operator_evidence_bundle`, release
  evidence collectors/validators, release workflows, and same-cohort release
  evidence artifacts.
- Reviewed: `AGENTS.md`, `TASTE.md`, `docs/active/app-ideal-state-gap-plan.md`,
  `docs/docs_portfolio_consolidation.md`, `docs/release/README.md`,
  `docs/user-guides/README.md`, `docs/screenshots/README.md`, this process
  index, `docs/history/process/retired-surface-provenance.md`,
  `scripts/user-guide-data.ts`, release evidence validators, release workflows,
  guide source/asset manifests, and generated guide verification JSON.
- Edited: `docs/user-guides/README.md`, `docs/screenshots/README.md`, and this
  file.
- Coverage result: user-guide generated artifacts now point back to the guide
  JSON and screenshot manifest as their edit source; `docs/screenshots/README.md`
  is an index, not a release evidence or runtime truth owner. Release evidence
  screenshots remain same-cohort bundle artifacts under release contracts and
  validators.
- Retired / guarded: no contract, workflow, script, generated guide artifact,
  or screenshot file was retired. The guarded stale surface is only the implied
  ability to use generated guide screenshots or `docs/screenshots` as release
  readiness proof; do not recreate that as a compatibility proof path.
- Remaining App unreviewed scope under the parent OPL series goal: full
  line-by-line App non-process docs audit remains open for non-guide themes such
  as runtime-page operator evidence, install exposure, release cohort evidence,
  and candidate adoption.
- Next write scope: continue after fresh intake with another disjoint App theme
  or a clean sibling repo lane. Avoid `one-person-lab` and `med-autoscience`
  writes while their concurrent dirty write sets remain active.

2026-06-08 App AG-UI/CopilotKit candidate docs owner split tranche:

- Theme / SSOT: AG-UI/CopilotKit candidate capability inventory versus candidate verification runbook. Current SSOT for verification commands and minimum acceptance is `docs/agui-codex-candidate-verification.md`, `contracts/app-shell-candidates.json`, `contracts/shell-adapters/agui-codex.json`, `scripts/validate-shell-candidates.ts`, and `scripts/validate-active-shell.ts`; `docs/app-gui-feature-inventory.md` remains a GUI capability/reference mapping owner.
- Reviewed: `AGENTS.md`, `TASTE.md`, `docs/README.md`, `docs/project.md`, `docs/status.md`, `docs/docs_portfolio_consolidation.md`, `docs/active/app-ideal-state-gap-plan.md`, `docs/agui-codex-candidate-verification.md`, `docs/app-gui-feature-inventory.md`, this process index, `contracts/app-shell-candidates.json`, and `scripts/validate-shell-candidates.ts`.
- Edited: `docs/app-gui-feature-inventory.md` and this file.
- Coverage result: duplicated candidate verification commands and detailed acceptance bullets were removed from the GUI feature inventory and replaced with an explicit owner map. The candidate runbook remains the human command/acceptance owner; candidate contracts and validation scripts remain machine owners. `agui-codex` stays a technical verification candidate and is not promoted to the default release shell.
- Retired / guarded: no candidate contract, shell adapter, workflow, or source file was retired. The retired surface is only the duplicate verification checklist inside the feature inventory; do not recreate it as a parallel current checklist or use the inventory as release/adoption proof.
- Remaining App unreviewed scope under the parent OPL series goal: full line-by-line App non-process docs audit remains open for non-candidate themes such as user guides/screenshots, runtime-page operator evidence, install exposure, and release cohort evidence.
- Next write scope: continue with a concrete SSOT theme after fresh intake; likely candidates are user-guide/screenshot evidence lifecycle or runtime-page operator evidence docs. Avoid `one-person-lab` and `med-autoscience` writes while their concurrent dirty write sets remain active.

2026-06-08 App release-evidence seed artifact retirement tranche:

- Theme / SSOT: same-cohort release evidence bundle generation and the retired optional `release-evidence-<version>` seed artifact download. Machine SSOT is `.github/workflows/desktop-release.yml`, `scripts/validate-release-boundary.ts`, `docs/release/README.md`, release evidence validators, release artifacts, and CI logs; docs are human projections only.
- Reviewed: `AGENTS.md`, `TASTE.md`, `docs/active/app-ideal-state-gap-plan.md`, this process index, `docs/history/process/retired-surface-provenance.md`, `.github/workflows/desktop-release.yml`, `docs/release/README.md`, `scripts/validate-release-boundary.ts`, release-boundary tests and package scripts touching release evidence ownership.
- Edited: this file and `docs/history/process/retired-surface-provenance.md`.
- Retired / guarded: the desktop release workflow no longer downloads optional `release-evidence-<version>` before validation. The workflow regenerates the evidence bundle in `operator-evidence-bundle-validation` from current clean VM smoke summaries, remote verification summary, and live OPL operator drilldown, uploads `release-evidence-bundle-<version>`, and the release-boundary validator forbids `name: release-evidence-${{ inputs.opl_version }}` from returning.
- Coverage result: App release docs now explain regenerated in-place evidence and the missing-seed annotation hazard; active workflow/validator truth matches that explanation. A missing old seed is not a release evidence condition, not an App release-ready blocker, and not a reason to add a compatibility download step.
- Remaining App unreviewed scope under the parent OPL series goal: non-release App docs and unrelated App evidence gates remain open in `docs/active/app-ideal-state-gap-plan.md`.
- Next write scope: another disjoint clean App release/evidence theme or a clean sibling repo semantic lane after fresh intake; do not return to `one-person-lab` or `med-autoscience` writes while their concurrent dirty write sets remain active.

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
