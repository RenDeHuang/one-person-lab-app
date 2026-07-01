# Claude Science Runtime Task Awareness Landing Plan

Owner: `one-person-lab-app`
Purpose: `claude_science_runtime_task_awareness_landing_plan`
State: `active_plan`
Machine boundary: Human-readable external-learning landing plan. Machine-readable truth lives in `contracts/`, `opl app state`, `opl app action`, source, tests, active-shell validation, and OPL Framework/domain read-model output consumed by the App.

## 当前状态

This plan is updated after the Runtime-task-awareness and AionUI-thin-renderer
research. It is a product and execution plan, not a completion claim.

- App repo: the Runtime-task-awareness direction is recorded in this document,
  `docs/architecture.md`, `docs/decisions.md`, and
  `docs/active/app-ideal-state-gap-plan.md`.
- OPL Framework candidate lane:
  `codex/claude-science-app-refs` at
  `1412b44f9691fd92e4fccc5f45a028c2e01f0ba0` adds refs to the App task
  projection and a dry-run-only action receipt preview. It remains a candidate
  implementation until main-session diff review, absorption, and Framework
  owner readback.
- AionUI candidate lane:
  `codex/claude-science-thin-renderer` at
  `b4296dfb2a90981ba5d60babcd742e8836f878b6` renders task ref summaries in the
  Runtime page. It remains a candidate implementation until main-session diff
  review, absorption into the shell mainline, and active-shell validation from
  the App repo.

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
| 1 | 统一任务感知定义 | App repo | 按 contract 消费 | 70% | `docs/architecture.md` 和 `docs/decisions.md` 已定义 Runtime user-task-status first。 | 本文、architecture、decisions、active plan 一致说明 Runtime 是全局任务感知，聊天/inspector 是当前任务切片，禁止新 dashboard。 |
| 2 | Runtime projection 字段收敛 | App repo 定义，Framework 产出 | 渲染字段 | 65% | `contracts/app-runtime-bridge.json` 已有 user task status、artifact-native、state-index、safe action 边界；Framework candidate `1412b44f...` adds `stage` / `progress` / `next_owner` / artifact-or-blocker / review / action refs to task drilldowns. | Contract 明确 task/stage/progress/next_owner/artifact_or_blocker/reviewer_receipt/action_receipt/workflow/export refs 的 required/optional 字段，并由 Framework mainline readback 证明。 |
| 3 | Framework producer refs | OPL Framework / domain | 无 | 50% | `opl app state` 已是 App 默认状态源；fixture 有 artifact-native refs；Framework candidate `1412b44f...` keeps task refs refs-only and keeps Temporal as diagnostics/provider substrate. | `opl app state --profile fast --json` 输出 refs-only task projection；full/detail 可 drilldown；不包含 artifact body 或 domain verdict。 |
| 4 | Plan-approve-run action | OPL Framework action catalog | 复用 confirmation/action UI | 70% | App contracts 已要求 `opl app action execute --dry-run/execute --json`；Framework candidate `1412b44f...` adds `task_action_receipt_preview` as dry-run-only and fail-closed for non-dry-run. | dry-run 返回 plan、write targets、risk、expected output；execute 返回 receipt；App/shell 不能绕过 action route。 |
| 5 | Artifact provenance card | Framework/domain 产出，App contract 定义 | 通用 artifact/receipt card | 45% | Artifact-native drilldown 已覆盖 current/canonical/export/lineage/retention/conformance refs。 | Runtime task detail 和 inspector 能显示 provenance summary；只展示 refs，不读 artifact body。 |
| 6 | Reviewer receipt card | Domain 产出，Framework projection，App contract 定义 | 通用 receipt summary | 20% | 当前 App contract 未把 reviewer receipt 单列为用户任务字段。 | task projection 有 reviewer status、issue refs、next action、receipt ref；UI 不显示 domain ready/quality passed。 |
| 7 | Runtime 全局展示增强 | Framework projection + App contract | `TaskStatusRow` / existing Runtime thin renderer | 65% | Runtime page 已定义 running/active/queued/attention、owner、stage、next step；AionUI candidate `b4296df...` renders task ref summaries without owning runtime truth. | 全局任务列表展示 task、stage、owner、next step、artifact/blocker/review refs，Temporal/provider 默认不出现。 |
| 8 | 聊天当前任务切片 | Framework projection + App contract | conversation/composer status thin renderer | 25% | Conversation 已有 pending elapsed seconds policy。 | 当前 turn 显示 running/pending、elapsed、plan、latest receipt、latest artifact ref；不维护独立任务 store。 |
| 9 | Inspector 当前任务证据面 | Framework refs + App contract | collapsed tabs/card thin renderer | 30% | `right_context_inspector` 已存在 collapsed tabs contract。 | Files / Artifacts / Review / Runtime tabs 消费当前 task refs；默认收起；不读取 artifact body。 |
| 10 | Capability health / connector readiness | Framework/App contract | `CapabilityHealthItem` / Settings thin renderer | 55% | Settings Capabilities / Local Environment 已有 capability package 和 maintenance status 边界。 | MAS/MAG/RCA/BookForge 显示可用、需配置、可修复；connector 只显示 readiness/action refs。 |
| 11 | Reusable workflow refs | Framework/domain | Settings/Capabilities 列 ref | 15% | 原学习项已确认需要保留为 P2。 | Capability page 能列 workflow refs；创建/更新 workflow 走 domain action；App 不直接写 skill body。 |
| 12 | Reproducibility export bundle action | Framework/domain action | artifact/task action button + receipt summary | 20% | Artifact-native refs 和 action route 已存在，但 export bundle action 未单列。 | Artifact card/task detail 提供 export bundle dry-run/execute；Framework/domain 生成 manifest/receipt；App 只显示 ref。 |
| 13 | Fixture 与 focused tests | App repo + shell repo | DOM/i18n focused tests | 45% | App release-boundary tests 覆盖 runtime evidence boundary；Framework candidate reports focused app-state/action tests and typecheck passing; AionUI candidate reports Runtime DOM/i18n checks passing. These reports still require main-session verification before absorption. | 覆盖 normal、blocked、missing reviewer、dry-run plan、receipt returned、diagnostic-only Temporal 六类状态。 |
| 14 | 吸收、清理和完成度审计 | Main session | 提供 verified shell commit 后由主会话吸收 | 15% | 当前已有 Framework candidate `1412b44f...` 和 AionUI candidate `b4296df...`，但尚未主会话复核/吸收/清理。 | Framework/App/AionUI lanes 都有 commit、验证、diff 复核、吸收回目标分支、worktree 清理和 Plan Completion Audit。 |

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
