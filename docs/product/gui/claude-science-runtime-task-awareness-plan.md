# Claude Science Runtime Task Awareness Landing Plan

Owner: `one-person-lab-app`
Purpose: `claude_science_runtime_task_awareness_landing_plan`
State: `superseded_as_core_retained_x0_reference`
Currentness boundary: 本文是历史 implementation/design record。正文中的 `100%` 不得作为
当前完成度或关单 authority；当前唯一五轴账本是
[`app-ideal-state-gap-plan.md`](../../active/app-ideal-state-gap-plan.md) 与
[`shell-conformance-matrix.md`](shell-conformance-matrix.md)。Conversation current-task 与
Inspector refs 仍是 core thin consumers；跨项目 Runtime 仅为 X0-01 条件保留 route，Cloud、
Hosted Workspace、Fabric、HPC 与 Console 仅为 X0-03/X0-04 retained references。
Machine boundary: Human-readable external-learning landing plan. Machine-readable truth lives in `contracts/`, `opl app state`, `opl app action`, source, tests, active-shell validation, and OPL Framework/domain read-model output consumed by the App.

## 当前状态

This plan has been landed through the Framework, App contract, and AionUI
thin-renderer mainlines. It is still not an App release-ready or domain-ready
claim.

2026-07-05 之后，Runtime 页的下一步不再是继续堆 task-awareness 字段，而是把这些
字段重新组织成用户可理解的项目运行总览。最新产品设计与一步到位落地顺序见
[`runtime-overview-redesign.md`](runtime-overview-redesign.md)。

2026-07-05 contract alignment narrowed the default Runtime page semantics
further: it is a user task cockpit, not an internal runtime diagnostics page.
The App contract now explicitly requires a four-layer user mental model
(agent/capability, project, task/work item, execution run), stage/run telemetry
fields, typed blocker routing, and a separate agent/module status panel. When
elapsed, heartbeat, or usage telemetry is missing from the projection, the App
must show `telemetry missing` rather than silently omitting the slot or
inferring a healthy run.

- OPL Framework owns the refs-only task awareness producer, Settings /
  Capabilities refs, workflow refs, and dry-run-only export preview action.
  Current proof must be read from `opl app state`, `opl app action`, Framework
  contracts, source, tests, and runtime readback.
- App repo owns `task_awareness_projection`, `current_task_slice_projection`,
  `TaskRunProjection` v2, fixtures, page-state matrix, GUI product contract,
  active-shell validation, and release-boundary assertions for the refs-only
  task model.
- OpenScience accepted items are now explicit App projection contracts:
  structured result panel, artifact/provenance drawer or card, ref-level
  follow-up refs, and workflow/skill candidate refs. OPL App here is the
  shell-wrapped Codex App, and professional agents are Codex plugins or packaged
  Codex skills.
- AionUI renders Runtime task ref summaries, conversation / inspector refs, and
  capability / connector / workflow / export refs as a thin consumer. Temporal,
  provider and `current_control_state` internals remain diagnostics; AionUI does
  not add shell-owned runtime truth, reviewer/domain logic, artifact-body access,
  readiness judgment, or a new dashboard.

## 2026-07-05 Runtime cockpit semantics

The default Runtime page contract now requires these user-facing answers before
diagnostics:

- Which agent/capability owns this work?
- Which project line does it belong to?
- Which task/work item is moving or blocked?
- Which execution run is active, how long has it been in the current stage, is
  it still alive, what usage has accumulated, and what blocker/owner route
  applies?

This also tightens status language:

- `queued`, `pending`, and `waiting` must come from explicit projected status.
- `blocked` stays blocked; it must not be relabeled as queued just because the
  run is not currently advancing.
- `stopped`, `parked`, and `checkpointed` stay inactive summaries.
- `provider`, `projection`, `ref`, `stage attempt`, and
  `current_control_state` remain diagnostic vocabulary, not first-screen user
  wording.

## 目标

Claude Science 对 OPL App 的可学习点不是新增一个科研工作台，也不是复制一个任务 dashboard。目标是把现有 Runtime / 运行状态页升级为全局任务感知主接口，并把同一份 OPL Framework 任务 projection 的当前任务切片投到聊天和右侧 inspector。

最终用户应能回答：

- 现在有哪些任务在运行、活跃、排队或需要注意？
- 当前任务处于哪个 stage，下一步是什么，owner 是谁？
- 产物从哪里来，有哪些 lineage / manifest / receipt refs？
- reviewer 检查到了什么，下一步怎么处理？
- 哪些动作会写文件或触发长任务，执行前计划是什么，执行后 receipt 在哪里？

## 表达方式调整

2026-07-04 复查 Claude Science 官方介绍
(`https://www.anthropic.com/news/claude-science-ai-workbench`、
`https://claude.com/product/claude-science`、`https://claude.com/docs/claude-science/overview`)
后，本计划的产品表达要避免从 Settings、shell、contract、validator 这些内部词起笔。
可借鉴的不是 Claude Science 的品牌或科研限定场景，而是它把复杂系统讲成用户收益的方式：

- 用户不用在 PubMed、Jupyter、R、cluster terminal 和各类工具之间来回切换，而是在一个研究环境里完成多阶段工作。
- 产物不是普通文件输出，而是带生成历史、代码、环境和会话上下文的可复查 artifact。
- 计算资源不是后台架构，而是用户可以在 laptop、Linux box、HPC login node、cloud VM 或按需 GPU 上继续工作的能力。
- 连接器和 skills 不是插件清单，而是让团队已有工具、数据库、ELN、脚本和 pipeline 进入同一个工作会话。
- reviewer 不是“质量模块”，而是在结果出现前检查引用、数字、图表和底层证据是否对得上。

映射到 OPL App，白皮书和公开文档应采用这组用户侧表达：

- **一个工作台，不用跳工具。** 用户从 App 进入科研、基金、演示、书稿和智能体构建，不需要知道底层是哪个 agent、仓库、命令或 shell。
- **结果带来路。** 图、表、稿件、PPT、申请书和运行结果都应能回到材料、任务、产物、审阅、回执和下一步，而不是只给一个最终文件。
- **工作台跟着工作走。** OPL App 是本地优先、云端连续的工作台：macOS 桌面 App、本机/服务器 Docker WebUI、云端 OPL Workspace 使用同一套任务、产物、进度和回执语言。
- **用已有资源，不重建世界。** 本机文件、服务器、SSH/HPC、云主机、OPL Gateway、OPL Fabric、团队工具和未来连接器都应进入同一条 plan/approve/run/collect/receipt 工作线。
- **专业智能体协作，但用户先看到工作目的。** MAS、MAG、RCA、BookForge、OMA 等能力在普通表达里对应研究、基金、演示、书稿、智能体构建，而不是一组技术缩写。

这意味着 App 白皮书若单独创建，主轴应是“可信专业工作台”，不是“Settings
信任机制”“可替换 shell”“contracts 定义产品真相”。这些内部概念仍然保留在
App 架构和验证文档中，但不作为用户-facing 白皮书的主要叙事。

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
| Structured result panel | Conversation current-task slice + right inspector structured result panel | 覆盖；不是新 dashboard |
| Artifact / provenance drawer or card | Artifact provenance bundle projection + inspector Artifacts card/drawer | 覆盖 refs-only；不读 artifact body |
| Ref-level comment / structured follow-up | Review/action ref-level follow-up refs | 覆盖；不创建 App annotation store |
| Workflow / skill candidate | Settings / Capabilities report-first suggestion refs | 覆盖；review / needs changes / continue in conversation，不自动 enable 或写 skill body |

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
| 5 | Artifact provenance card | Framework/domain 产出，App contract 定义 | 通用 artifact/receipt card | 100% | Framework enriched `evidence_cards` include `kind/owner/updated_at/why_it_matters/open_action`; App fixture/validator/test require those fields. App runtime bridge now also declares `artifact_provenance_bundle_projection` for provenance bundle refs, RO-Crate refs, replay status refs, agent trace refs, review refs and typed issues. AionUI Runtime and current-task cards render enriched details without artifact bodies, and the App contract/fixture now read back `aionui_refs_only_drawer_implemented` for the provenance drawer. | 已完成 for refs-only artifact provenance UI/readback; App contract + AionUI refs-only drawer 已落地，real artifact body plus quality/export verdict remain domain authority. |
| 6 | Reviewer receipt card | Domain 产出，Framework projection，App contract 定义 | 通用 receipt summary | 100% | Review receipt stays an evidence card with non-authoritative refs; App contracts forbid quality verdicts; AionUI renders review/action receipt refs and related card details from the same projection. | 已完成 for refs-only reviewer receipt UI; reviewer verdict quality remains domain authority. |
| 7 | Runtime 全局展示增强 | Framework projection + App contract | existing Runtime thin renderer | 100% | In addition to overview counts and grouped detail, the App contract now requires the Runtime default page to answer the four-layer mental model, stage/run telemetry, typed blocker route, and separate agent/module status panel. Missing elapsed/heartbeat/usage must surface as `telemetry missing`, not silence. | Contract/docs/validator landing已完成；live producer coverage for every telemetry slot仍以 fresh `opl app state`/runtime readback 为准。 |
| 8 | 聊天当前任务切片 | Framework projection + App contract | conversation/composer status thin renderer | 100% | App contracts `current_task_slice_projection`; AionUI current-task component consumes enriched `conditions/evidence_cards/action_cards/resource_cards/diagnostics_ref` from the same slice, including open-action/risk/resource refs, without an independent task store. | 已完成 for current conversation inline status. |
| 9 | Inspector 当前任务证据面 | Framework refs + App contract | collapsed tabs/card thin renderer | 100% | App inspector fields use the same TaskRunProjection v2 model; AionUI right-side current-task evidence sections render artifact/review/action/workflow/resource/diagnostics refs from the same current-task slice. | 已完成 for refs-only right-side evidence surface. |
| 10 | Capability health / connector readiness | Framework/App contract | Settings thin renderer | 100% | Framework exposes refs-only capability health and connector readiness; App contract/fixture/tests require the Settings capabilities surface; AionUI renders the refs in Settings / Capabilities. | 已完成 for refs-only capability and connector readiness display; real module/domain readiness remains owner authority. |
| 11 | Reusable workflow refs | Framework/domain | Settings/Capabilities 列 ref | 100% | Framework exposes Settings-level workflow refs with `content_policy=refs_only_no_skill_body_no_workflow_body`; App contracts lock the field; AionUI lists workflow refs without skill bodies. | 已完成 for reusable workflow refs listing; workflow/skill body authoring remains outside App/AionUI. |
| 12 | Reproducibility export bundle action | Framework/domain action | artifact/task action button + receipt summary | 100% | Framework owns the `task_export_bundle_preview` dry-run action and non-dry-run fail-closed boundary; App fixture/test checks the preview route; AionUI renders the export action ref and dry-run/receipt summary. | 已完成 for reproducibility export preview/action-ref UI; real domain bundle generation and export readiness remain domain-owner actions. |
| 13 | Structured result panel | App repo 定义，Framework 产出 refs | conversation / current task / inspector thin renderer | 100% | `structured_result_panel_projection` plus fixture/test coverage require result summary, status, evidence/action refs, artifact provenance ref and follow-up refs. | 已完成 for refs-only structured result panel；不得变成新 dashboard。 |
| 14 | Ref-level follow-up | Framework/domain 产出 refs，App contract 定义 | Review/Actions refs UI | 100% | `ref_level_follow_up_projection` and fixture require review/request-change/follow-up prompt/action refs. | 已完成 for refs-only prompt/action refs；不创建 App annotation store。 |
| 15 | Workflow / skill candidate | Framework/App refs | Settings / Capabilities | 100% | `workflow_skill_candidate_projection` and Settings fixture expose report-first suggestions with review / needs changes / continue in conversation actions. | 已完成 for candidate refs；不自动 enable skill，不写 skill body。 |
| 16 | Fixture 与 focused tests | App repo + shell repo | DOM/i18n focused tests | 100% | App fast fixture carries enriched `TaskRunProjection` v2 evidence/action/resource card examples plus OpenScience structured result, provenance card, ref-level follow-up, and workflow/skill candidate refs; shared validators and release-boundary tests require the fields. | 已完成 for landed App-owned contract slices; shell rendering and domain producer changes remain separate owner surfaces. |
| 17 | 吸收、清理和完成度审计 | Main session | 提供 verified shell commit 后由主会话吸收 | 100% | Current landing is read from Framework producer evidence, App enriched contract/docs lanes, and AionUI Runtime/current-task rendering evidence. This row is a boundary note, not a reusable closeout proof. | 本计划不保存最终吸收审计；future closeout must re-read owner evidence before any completion, release-ready, or domain-ready claim. |

## 证据读取规则

Current proof is not stored in this landed plan. Re-read Framework producer
commands, App release-boundary tests, App active-shell validation, and AionUI
focused rendering evidence from their owner repos before making a current,
release, readiness, absorption, or completion claim. In particular, this plan's
contract-level `telemetry missing` fallback and four-layer Runtime semantics do
not by themselves prove live producer completeness for elapsed/heartbeat/usage
fields. Dated command transcripts, worktree paths, shell refs, test counts, and
pass/fail logs belong in process history, release artifacts, CI logs, or commit
history.

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
