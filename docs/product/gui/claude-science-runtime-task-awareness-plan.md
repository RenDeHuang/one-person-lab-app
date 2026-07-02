# Claude Science Runtime Task Awareness Landing Plan

Owner: `one-person-lab-app`
Purpose: `claude_science_runtime_task_awareness_landing_plan`
State: `landed_mainline`
Machine boundary: Human-readable external-learning landing plan. Machine-readable truth lives in `contracts/`, `opl app state`, `opl app action`, source, tests, active-shell validation, and OPL Framework/domain read-model output consumed by the App.

## 当前状态

This plan has been landed through the Framework, App contract, and AionUI
thin-renderer mainlines. It is still not an App release-ready or domain-ready
claim.

- OPL Framework owns the refs-only task awareness producer, Settings /
  Capabilities refs, workflow refs, and dry-run-only export preview action.
  Current proof must be read from `opl app state`, `opl app action`, Framework
  contracts, source, tests, and runtime readback.
- App repo owns `task_awareness_projection`, `current_task_slice_projection`,
  `TaskRunProjection` v2, fixtures, page-state matrix, GUI product contract,
  active-shell validation, and release-boundary assertions for the refs-only
  task model.
- AionUI renders Runtime task ref summaries, conversation / inspector refs, and
  capability / connector / workflow / export refs as a thin consumer. Temporal,
  provider and `current_control_state` internals remain diagnostics; AionUI does
  not add shell-owned runtime truth, reviewer/domain logic, artifact-body access,
  readiness judgment, or a new dashboard.

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
| Resource context refs | OPL Gateway、OPL Fabric、环境、存储、资源 receipt 和成本估算 refs；用于说明任务会使用哪些 AI、连接器、计算、环境和存储资源。 | OPL Framework / Fabric projections |

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
| Reusable Workflow as Skill | Capability workflow refs；不直接写 skill body | 等价覆盖 |
| Specialist Agent Handoff | `next_owner` / owner route / accepted return shape | 覆盖为 Runtime 字段 |
| Scientific Source Connector UX | Capability / connector readiness refs | 等价覆盖 |
| Reproducibility Export Bundle | Export-bundle preview refs + dry-run receipt boundary；真实生成仍归 domain owner | 等价覆盖 refs-only GUI 目标 |
| Cloud / HPC / managed compute flow | Resource context refs + plan/approve/execute/monitor/collect/receipt | 覆盖为资源上下文，不新增 Cloud dashboard |

## Owner 分层

| 层 | 责任 | 不做什么 |
| --- | --- | --- |
| OPL Framework / domain agents | 产出 task projection、artifact refs、reviewer receipt refs、action dry-run/execute receipt、connector/capability status。 | 不把 App 或 shell 变成 runtime/domain truth owner。 |
| OPL App repo | 定义 GUI contract、runtime bridge、page-state matrix、fixtures、validation、docs 和 completion audit；显示 OPL Gateway/Fabric/Workspace/Console refs 的用户边界。 | 不产出 runtime truth，不读 artifact body，不写 owner receipt，不调度计算，不管理计费。 |
| AionUI shell | 读取 App state/profile，渲染通用任务/产物/receipt/health/资源上下文卡片，调用 App action。 | 不实现 reviewer/domain logic，不解析 Temporal 为用户任务，不判断 readiness，不新增 runtime store，不实现 Cloud service client。 |
| OPL Console | 管理组织、权限、账单、Workspace 生命周期、连接器审批、环境策略和托管资源包。 | 不管理用户自带本机、SSH 或 HPC 资源，除非 Framework projection 标记为 Console-managed。 |

## 详细落地清单

| 顺序 | Item | 主 owner | AionUI 角色 | 当前完成度 | 当前证据 | 彻底落地标准 |
| --- | --- | --- | --- | ---: | --- | --- |
| 1 | 统一任务感知定义 | App repo | 按 contract 消费 | 100% | `docs/architecture.md`、`docs/decisions.md`、active plan、本文和 App contracts 一致定义 Runtime 为全局任务感知，聊天/inspector 为当前任务切片。 | 已完成；后续只需随合同变化维护。 |
| 2 | Runtime projection 字段收敛 | App repo 定义，Framework 产出 | 渲染字段 | 100% | App contracts require `TaskRunProjection` v2 identity/status/progress/conditions plus enriched `evidence_cards` / `action_cards` / `resource_cards`; Framework producer and App fixture/validators fail closed when these fields drift. | 已完成；真实 domain artifact/reviewer 内容仍由 domain owner 产出。 |
| 3 | Framework producer refs | OPL Framework / domain | 无 | 100% | Fresh Framework `opl app state --profile fast --json` readback is the current proof for refs-only task awareness fields and body exclusion. | 已完成；domain-specific receipt quality remains domain authority. |
| 4 | Plan-approve-run action | OPL Framework action catalog | 复用 confirmation/action UI | 100% | Framework dry-run readback owns plan/write_targets/risk/expected_output; non-dry-run export preview must fail closed unless a real domain owner action authorizes it. App contracts the dry-run/receipt route. | 已完成 for App action dry-run/receipt preview; real domain execute receipts remain domain-owner actions, not this generic preview action. |
| 5 | Artifact provenance card | Framework/domain 产出，App contract 定义 | 通用 artifact/receipt card | 100% | Framework enriched `evidence_cards` include `kind/owner/updated_at/why_it_matters/open_action`; App fixture/validator/test require those fields; AionUI Runtime and current-task cards render the enriched details without artifact bodies. | 已完成 for refs-only artifact provenance UI; real artifact body and quality/export verdict remain domain authority. |
| 6 | Reviewer receipt card | Domain 产出，Framework projection，App contract 定义 | 通用 receipt summary | 100% | Review receipt stays an evidence card with non-authoritative refs; App contracts forbid quality verdicts; AionUI renders review/action receipt refs and related card details from the same projection. | 已完成 for refs-only reviewer receipt UI; reviewer verdict quality remains domain authority. |
| 7 | Runtime 全局展示增强 | Framework projection + App contract | existing Runtime thin renderer | 100% | AionUI Runtime task section now shows overview counts, task list, and selected task detail grouped into Evidence / Actions / Resources / Diagnostics while keeping provider internals in Diagnostics. | 已完成 for Runtime page global task awareness. |
| 8 | 聊天当前任务切片 | Framework projection + App contract | conversation/composer status thin renderer | 100% | App contracts `current_task_slice_projection`; AionUI current-task component consumes enriched `conditions/evidence_cards/action_cards/resource_cards/diagnostics_ref` from the same slice, including open-action/risk/resource refs, without an independent task store. | 已完成 for current conversation inline status. |
| 9 | Inspector 当前任务证据面 | Framework refs + App contract | collapsed tabs/card thin renderer | 100% | App inspector fields use the same TaskRunProjection v2 model; AionUI right-side current-task evidence sections render artifact/review/action/workflow/resource/diagnostics refs from the same current-task slice. | 已完成 for refs-only right-side evidence surface. |
| 10 | Capability health / connector readiness | Framework/App contract | Settings thin renderer | 100% | Framework exposes refs-only capability health and connector readiness; App contract/fixture/tests require the Settings capabilities surface; AionUI renders the refs in Settings / Capabilities. | 已完成 for refs-only capability and connector readiness display; real module/domain readiness remains owner authority. |
| 11 | Reusable workflow refs | Framework/domain | Settings/Capabilities 列 ref | 100% | Framework exposes Settings-level workflow refs with `content_policy=refs_only_no_skill_body_no_workflow_body`; App contracts lock the field; AionUI lists workflow refs without skill bodies. | 已完成 for reusable workflow refs listing; workflow/skill body authoring remains outside App/AionUI. |
| 12 | Reproducibility export bundle action | Framework/domain action | artifact/task action button + receipt summary | 100% | Framework owns the `task_export_bundle_preview` dry-run action and non-dry-run fail-closed boundary; App fixture/test checks the preview route; AionUI renders the export action ref and dry-run/receipt summary. | 已完成 for reproducibility export preview/action-ref UI; real domain bundle generation and export readiness remain domain-owner actions. |
| 13 | Fixture 与 focused tests | App repo + shell repo | DOM/i18n focused tests | 100% | App fast fixture carries enriched `TaskRunProjection` v2 evidence/action/resource card examples; shared validators and release-boundary tests require enriched card fields; AionUI focused DOM tests cover overview/detail and current-task enriched card rendering. | 已完成 for landed App-owned contract slices; shell rendering and domain producer changes remain separate owner surfaces. |
| 14 | 吸收、清理和完成度审计 | Main session | 提供 verified shell commit 后由主会话吸收 | 100% | Current landing is read from Framework producer evidence, App enriched contract/docs lanes, and AionUI Runtime/current-task rendering evidence. This row is a boundary note, not a reusable closeout proof. | 本计划不保存最终吸收审计；future closeout must re-read owner evidence before any completion, release-ready, or domain-ready claim. |

## 证据读取规则

Current proof is not stored in this landed plan. Re-read Framework producer
commands, App release-boundary tests, App active-shell validation, and AionUI
focused rendering evidence from their owner repos before making a current,
release, readiness, absorption, or completion claim. Dated command transcripts,
worktree paths, shell refs, test counts, and pass/fail logs belong in process
history, release artifacts, CI logs, or commit history.

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
