# Claude Science Runtime Task Awareness Landing Plan

Owner: `one-person-lab-app`
Purpose: `claude_science_runtime_task_awareness_landing_plan`
State: `landed_mainline`
Machine boundary: Human-readable external-learning landing plan. Machine-readable truth lives in `contracts/`, `opl app state`, `opl app action`, source, tests, active-shell validation, and OPL Framework/domain read-model output consumed by the App.

## 当前状态

This plan has been landed through the Framework, App contract, and AionUI
thin-renderer mainlines. It is still not an App release-ready or domain-ready
claim.

- OPL Framework main: `dd867215` exposes refs-only task awareness fields in
  `opl app state --profile fast --json` and a dry-run-only
  `task_action_receipt_preview` App action. Fresh readback confirms
  `stage`, `progress`, `next_owner`, `artifact_or_blocker`, `review_receipt`,
  `action_receipt`, and `workflow_refs`, with artifact/review/action/workflow
  bodies excluded.
- App repo main: `014e0f8` contracts `task_awareness_projection` and
  `current_task_slice_projection` in `app-runtime-bridge`, mirrors them into
  the page-state matrix and GUI product contract, updates fixtures, and extends
  active-shell validation plus release-boundary tests.
- AionUI shell main: `6bccbab8f` renders Runtime task ref summaries as a thin
  renderer, and `ffb5701e0` renders the conversation current-task inline status
  plus the right-side workspace/inspector evidence refs from the same runtime
  current-task slice. Temporal/provider/current_control_state remain
  diagnostics. AionUI does not add shell-owned runtime truth, reviewer/domain
  logic, artifact-body access, readiness judgment, or a new dashboard.

## 目标

Claude Science 对 OPL App 的可学习点不是新增一个科研工作台，也不是复制一个任务 dashboard。目标是把现有 Runtime / 运行状态页升级为全局任务感知主接口，并把同一份 OPL Framework 任务 projection 的当前任务切片投到聊天和右侧 inspector。

最终用户应能回答：

- 现在有哪些任务在运行、活跃、排队或需要注意？
- 当前任务处于哪个 stage，下一步是什么，owner 是谁？
- 产物从哪里来，有哪些 lineage / manifest / receipt refs？
- reviewer 检查到了什么，下一步怎么处理？
- 哪些动作会写文件或触发长任务，执行前计划是什么，执行后 receipt 在哪里？

## 核心定义

| 概念 | 定义 | Owner |
| --- | --- | --- |
| 用户任务 | 用户关心的科研、基金、演示、写作或维护任务；不是 Temporal workflow / activity / task queue 本身。 | OPL Framework / domain projections |
| Runtime / 运行状态页 | 全局任务感知中心，显示 running / active / queued / attention 任务、owner、stage、next step、artifact/blocker/review/action refs。 | App contract + active shell thin renderer |
| 聊天当前任务切片 | 同一 task projection 在当前 conversation / turn 的局部状态，例如 running/pending、elapsed、plan、latest receipt、latest artifact ref。 | App contract + active shell thin renderer |
| 右侧 inspector 当前任务证据面 | 当前任务的 artifact provenance、review receipt、lineage、action receipt 和文件 refs。 | App contract + active shell thin renderer |
| Temporal | 执行 substrate 和 diagnostics，提供 worker / queue / attempt / visibility 排障信息。 | OPL Framework diagnostics |
| Artifact provenance | 产物来源、输入、lineage、manifest、hash、receipt refs；不包含 artifact body。 | Framework / domain producers |
| Reviewer receipt | 审查状态、issue refs、next action、receipt ref；不是 quality verdict 或 domain readiness。 | Domain producers + Framework projection |
| Plan-approve-run receipt | `opl app action execute --dry-run` 的计划预览与 `--json` execute receipt。 | OPL Framework action surface |

## 当前规划调整

原 Claude Science 学习计划中的 10 个方向仍保留，但全部收敛到 Runtime projection 架构：

| 原学习项 | 当前归并位置 | 覆盖判断 |
| --- | --- | --- |
| Artifact Provenance Card | Runtime task detail + inspector artifact provenance refs | 等价覆盖 |
| Reviewer Receipt | Runtime task detail + inspector review receipt refs | 等价覆盖 |
| Plan-Approve-Run-Receipt | `opl app action` dry-run / execute / receipt contract | 等价覆盖 |
| Domain Skill Pack Curated UI | Settings / Capabilities capability health | 覆盖，范围更聚焦 |
| Inline Figure / Manuscript Review Loop | Artifact provenance + current task slice action | 覆盖为子能力 |
| Long-running Work Status | Runtime global task projection + chat current task slice | 等价覆盖 |
| Reusable Workflow as Skill | Capability workflow refs，P2；不直接写 skill body | 部分覆盖，显式保留 |
| Specialist Agent Handoff | `next_owner` / owner route / accepted return shape | 覆盖为 Runtime 字段 |
| Scientific Source Connector UX | Capability / connector readiness refs | 等价覆盖 |
| Reproducibility Export Bundle | Artifact task action + dry-run / execute / receipt | 覆盖，显式保留 |

## Owner 分层

| 层 | 责任 | 不做什么 |
| --- | --- | --- |
| OPL Framework / domain agents | 产出 task projection、artifact refs、reviewer receipt refs、action dry-run/execute receipt、connector/capability status。 | 不把 App 或 shell 变成 runtime/domain truth owner。 |
| OPL App repo | 定义 GUI contract、runtime bridge、page-state matrix、fixtures、validation、docs 和 completion audit。 | 不产出 runtime truth，不读 artifact body，不写 owner receipt。 |
| AionUI shell | 读取 App state/profile，渲染通用任务/产物/receipt/health 卡片，调用 App action。 | 不实现 reviewer/domain logic，不解析 Temporal 为用户任务，不判断 readiness，不新增 runtime store。 |

## 详细落地清单

| 顺序 | Item | 主 owner | AionUI 角色 | 当前完成度 | 当前证据 | 彻底落地标准 |
| --- | --- | --- | --- | ---: | --- | --- |
| 1 | 统一任务感知定义 | App repo | 按 contract 消费 | 100% | `docs/architecture.md`、`docs/decisions.md`、active plan、本文和 App contracts 一致定义 Runtime 为全局任务感知，聊天/inspector 为当前任务切片。 | 已完成；后续只需随合同变化维护。 |
| 2 | Runtime projection 字段收敛 | App repo 定义，Framework 产出 | 渲染字段 | 100% | App `014e0f8` 定义 `task_awareness_projection` / `current_task_slice_projection`；Framework `dd867215` mainline readback 输出 stage/progress/next_owner/artifact_or_blocker/review_receipt/action_receipt/workflow refs。 | 已完成；真实 domain artifact/reviewer 内容仍由 domain owner 产出。 |
| 3 | Framework producer refs | OPL Framework / domain | 无 | 100% | Framework `dd867215`; fresh `./bin/opl app state --profile fast --json` readback contains refs-only task awareness fields and excludes artifact/review/action/workflow bodies. | 已完成；domain-specific receipt quality remains domain authority. |
| 4 | Plan-approve-run action | OPL Framework action catalog | 复用 confirmation/action UI | 90% | Framework `dd867215` dry-run readback returns plan/write_targets/risk/expected_output and non-dry-run fails closed; App `014e0f8` contracts the route. | Preview path complete; real domain execute receipts remain domain-owner actions, not this generic preview action. |
| 5 | Artifact provenance card | Framework/domain 产出，App contract 定义 | 通用 artifact/receipt card | 100% | Runtime projection and AionUI Runtime summary render artifact/blocker refs; AionUI `ffb5701e0` renders right-side current-task artifact/blocker evidence refs; App contracts forbid artifact body access. | 已完成 for refs-only artifact provenance UI; real artifact body and quality/export verdict remain domain authority. |
| 6 | Reviewer receipt card | Domain 产出，Framework projection，App contract 定义 | 通用 receipt summary | 100% | Framework readback includes `review_receipt`; App contracts and AionUI Runtime/conversation summaries treat it as non-authoritative refs; AionUI `ffb5701e0` renders right-side review receipt refs. | 已完成 for refs-only reviewer receipt UI; reviewer verdict quality remains domain authority. |
| 7 | Runtime 全局展示增强 | Framework projection + App contract | existing Runtime thin renderer | 100% | AionUI `6bccbab8f` renders task ref summaries; DOM/i18n/format checks pass; Temporal/provider remain diagnostics. | 已完成 for Runtime page global task awareness. |
| 8 | 聊天当前任务切片 | Framework projection + App contract | conversation/composer status thin renderer | 100% | App `014e0f8` contracts `current_task_slice_projection`; AionUI `ffb5701e0` projects `current_task` through the conversation runtime view and renders the inline current-task status without an independent task store. Focused current-task DOM and conversation runtime view tests pass. | 已完成 for current conversation inline status. |
| 9 | Inspector 当前任务证据面 | Framework refs + App contract | collapsed tabs/card thin renderer | 100% | App `014e0f8` adds inspector Artifacts/Review/Actions tabs and current-task evidence contract, with artifact body/domain verdict authority false; AionUI `ffb5701e0` renders artifact/review/action/workflow refs in the right-side workspace/inspector panel from the same current-task slice. | 已完成 for refs-only right-side evidence surface. |
| 10 | Capability health / connector readiness | Framework/App contract | Settings thin renderer | 55% | Existing Settings capability and maintenance boundaries remain unchanged. | Not expanded in this tranche; still a separate Settings capability-health follow-up. |
| 11 | Reusable workflow refs | Framework/domain | Settings/Capabilities 列 ref | 70% | Framework readback includes `workflow_refs`; App contracts list workflow refs and forbid App skill-body writes. | Runtime refs complete; Settings/Capabilities workflow listing remains follow-up. |
| 12 | Reproducibility export bundle action | Framework/domain action | artifact/task action button + receipt summary | 70% | Framework exposes export bundle refs under artifact/task refs; App contracts `export_bundle_action_ref`. | Ref contract complete; real domain bundle generation remains domain action follow-up. |
| 13 | Fixture 与 focused tests | App repo + shell repo | DOM/i18n focused tests | 100% | App release-boundary + active-shell quick pass; Framework app-state/action tests + typecheck pass; AionUI Runtime/current-task DOM tests, conversation runtime view tests, i18n validation, and format checks pass. | 已完成 for landed slices. |
| 14 | 吸收、清理和完成度审计 | Main session | 提供 verified shell commit 后由主会话吸收 | 100% | Framework `dd867215` is absorbed in Framework main; App `014e0f8` and `b7cd8ed` are on App main; AionUI `6bccbab8f` and `ffb5701e0` are on AionUI main/gh-https; Claude Science worktrees were absorption-audited and removed; ops ledgers record closed lanes. | 已完成 for this refs-only Runtime task-awareness landing. |

## 建议落地顺序

1. **Framework first**：先补 `opl app state` / `opl app action` 的最小 refs：artifact summary、reviewer receipt summary、action plan/receipt、workflow refs、export bundle action refs。
2. **App contract second**：再把这些字段写入 `app-runtime-bridge`、`app-page-state-matrix`、fixtures、release-boundary tests 和本文 completion list。
3. **AionUI thin renderer third**：只渲染通用 `TaskStatusRow`、`ArtifactRefCard`、`ReceiptSummary`、`ActionPreviewConfirm`、`CapabilityHealthItem` 或复用现有组件。
4. **Verification and absorption last**：Framework readback、App contract tests、shell DOM/i18n tests 都通过后，由主会话复核 diff、吸收回目标分支并清理 worktree。

## 验收规则

一个 item 只有满足对应 fresh evidence 才能标 `100%`：

- Framework item：需要 `opl app state` / `opl app action` fresh JSON readback 或 focused producer tests。
- App contract item：需要 contract / fixture / release-boundary tests。
- AionUI item：需要 focused DOM / i18n / formatting checks，并确认未新增 shell-owned runtime truth。
- Docs item：需要 docs links / diff check / active plan foldback。

禁止把 docs、contract-only、fixture-only、subagent report、测试绿、commit 或 push 单独包装成 runtime behavior、owner receipt、domain readiness、App release readiness 或 production readiness。

## 非目标

- 不新增 Claude Science dashboard。
- 不新增任务感知系统。
- 不把 Temporal workflow / activity / task queue 直接显示为普通用户任务。
- 不在 AionUI 中实现 reviewer/domain logic。
- 不在 App 或 AionUI 中读取 artifact body、写 owner receipt、判断 quality/export/domain readiness。
- 不为了这项学习扩大 AionUI fork delta 或削弱上游跟随能力。
