# OPL App GUI 设计体系

Owner: `one-person-lab-app`
Purpose: `app_gui_human_readable_design_system_index`
State: `active`
Machine boundary: 本目录是人读产品设计与实现指引。GUI machine truth 仍归
`contracts/app-gui-product-contract.json`、
`contracts/app-product-profile.json`、
`contracts/app-page-state-matrix.json`、adapter contracts、validators、shell source/tests
和 release/user-path evidence；本文不创建第二套 authority。

## 结论

OPL App GUI 使用三层设计体系：

1. **功能层**回答“产品必须具备什么能力”。
2. **理想交互与视觉层**回答“用户应怎样完成工作、界面应怎样呈现”。
3. **具体 shell 实现层**回答“AionUI 或候选 shell 当前怎样承接，以及差距在哪里”。

三层必须分开维护。功能或理想目标不能从某个 shell 的现状反推；shell 实现文档也
不能把局部代码、截图或 focused test 提升成 App product truth。

当前 AionUI 主线的执行顺序、非降级边界、current-main disposition 与收口条件由
[`../../active/aionui-mainline-gui-convergence-plan.md`](../../active/aionui-mainline-gui-convergence-plan.md)
维护。该 active plan 只组织实施，不拥有三层产品定义，也不能把计划状态提升为 source、
pixel 或 release 完成。

GUI 运行采用双轴模型：AionUI 继续是 `active release shell`，而本机可以把 AionUI 或
`opl-native-workbench` 作为一次性的 `local GUI launch target`。启动候选不等于 adoption，
也不修改 release/updater authority。共享逻辑基座、独立 GUI 状态、统一 launcher 目标和
当前 Runtime/session 偏差统一见
[`gui-shell-candidates.md`](gui-shell-candidates.md)，不在本入口复制命令或状态矩阵。

产品方向固定为：**先继承 ChatGPT Codex 的主工作流和空间关系，再增加 OPL
专业能力**。Rail、单列 conversation、底部 composer 和按需环境详情构成基础壳；
OPL capabilities、progress、evidence refs、artifacts 与 safe actions 必须
嵌入这些稳定位置，不得把 Home 改造成 dashboard、launcher 或 card wall。

功能来源使用独立的 `B0 / R1 / U1 / X0` 轴：B0 是 Codex 必要 baseline，R1 是等价
替换，U1 是 OPL 定位必须增加，X0 是条件保留/当前非目标；`P0/P1/P2` 继续只表示优先级。
AionUI 与 Native 是同一 `B0 + R1 + U1` 产品定义的两种 carrier。两张必要功能 List 和
“为什么必要”见 [`feature-inventory.md#功能来源分类`](feature-inventory.md#功能来源分类)，
双 carrier 当前实现证据见
[`shell-conformance-matrix.md#r1--u1-必要功能实现矩阵`](shell-conformance-matrix.md#r1--u1-必要功能实现矩阵)。

视觉执行与验收以 [`codex-app-visual-parity.md`](codex-app-visual-parity.md) 为准：除 OPL
品牌与 OPL-owned 产品能力外，字体、颜色、图标、密度、阴影、圆角、布局和交互状态以
当前安装的 Codex App 做 1:1 对齐。既有 `26.707.41301` 仍是 machine contract 中的交互
observation；最新视觉像素 cohort 独立绑定 `26.707.72221` / build `5307`，不得混用。

当前人读交互 observation 基准是本机 ChatGPT macOS `26.707.41301`（观察于 `2026-07-11`）；
它不替代上面的最新视觉像素 cohort。
App machine authority 已升为 baseline schema v2；最低已验证 AionUI GUI conformance ancestor 是
`a0ce713b65801fd9ca7f46ad168c977c75a187de`，当前 Shell HEAD 必须从 active checkout Git
readback 获取，不复制成动态默认值。`0ebc1fdd278e8a79602458e15e28cf814dfd917d`
的完整 source gates 与 packaged 8 场景 visual matrix 继续作为历史 exact-cohort evidence，
不能通过替换 SHA 升级为当前 pixels。当前 parity cohort 另以
[`evidence/aionui-41301-parity-20260714/manifest.json`](evidence/aionui-41301-parity-20260714/manifest.json)
精确绑定 Shell `b2c05a1c8dc4ef81094323b49a67b601e3c425f5`、macOS arm64 package 和 9 个
route/state 场景；它证明当前指定画面非空且布局检查通过，但不证明 1:1 parity、安装或
release-ready。`26.707.31428` 与 `26.707.31123` 只作为 superseded observations 保留。

此前 App machine authority 同步落在
`2dae4961b63089bc1ec6739a4c1ab2fac8b648f3`：capability 只从 Home starter 选择，管理进入
Settings -> Agents 管理 package lifecycle，Settings -> Capabilities 管理 Skills/Plugins/Flow；App updater 与 Framework-owned
managed lifecycle 分离，不再保留 OPL Flow 专用 post-update 分支。本轮 parity exact cohort
`b2c05a1c8dc4ef81094323b49a67b601e3c425f5` 已实现 projectless local input、App Server rail、
absolute-path Preview、用户触发的线程 lifecycle、Review 已采纳子集，以及当时仍启用的
Runtime cockpit；Runtime V2 现仅作为 X0-01 条件保留 route。该 exact cohort 的 full source gates、macOS arm64 directory-only package、
codesign 与 9 场景 packaged E2E 已闭合；package 未安装，main/remote currentness 与 release
promotion仍由操作层 fresh readback决定。当前 Session-first Shell source cohort 不绑定临时
topic SHA；它由 `useConversationListSync.ts`、`GroupedHistory/index.tsx`、`GuidPage.tsx`、只读
`ConversationEnvironmentPopover.tsx` 及对应 DOM/source tests 定义，并要求 `WorkspaceHandoffControl.tsx`、
`ProjectContextSection.tsx` 与 `projectContext.ts` 缺席。Composer 的统一 `+` 菜单承载文件、目录、新 session 初始 cwd、
App allowlist 内的 Skills 与真实可用连接；选中 cwd 后只显示一个可移除的紧凑 chip，未选时不显示“不使用项目”占位行。
Environment 只读显示 recorded workspace 与 live Git context；Shell 不自建 managed Worktree/Handoff，
也不允许已绑定 session 在 Project 之间任意重分组。只有 `custom_workspace=false` 或无 canonical recorded cwd 的
projectless session 可执行一次 Project adoption：用户选择唯一 canonical Project directory 后，Shell 通过既有
`thread/settings/update.cwd` 写入该 thread 的 recorded cwd，再以 `thread/read` exact readback 验证。只有 readback
匹配时才提交本地 `workspace + custom_workspace=true` projection 并移动 rail row；已有 recorded cwd 时禁止改绑。
App Server 继续持有 canonical thread ID、history 和 recorded cwd authority；OPL 不增加私有 adoption RPC 或第二 client。
它不从 turn/command `pwd` 推断绑定、要求 Project 覆盖显式输入、修改 writable roots，或创建 pending/receipt/Handoff 层。
工作目录 picker 缺失或不可用时，projectless new task、输入、显式
send-scoped local inputs 与普通 Codex conversation 仍保持可用；只有 owner-projected action 的
`required_payload_fields` 明确要求 Workspace 或 managed target 时，才对该 Agent launch 做局部校验。
Activation 默认按 `ready / degraded / package_unavailable` 三态自修复、JIT、降级或 fallback；receipt、
binding、closure 不构成普遍硬门槛。Exact commit/currentness 只由 App owner
在 Shell main 吸收后回读。Review 保留 `Last turn`，custom instructions 只经
`review/start.target.custom`；公开协议缺少非 custom Review Focus input 时，正常路径在启动 Review 前
返回 `protocol_unavailable`，不得回退 `turn/steer`、伪造成功或产生副作用。当前仍无匹配
package/pixel/install 证据。

## 三层与文件归属

| 层级 | 核心问题 | 人读文件 | 不应包含 |
| --- | --- | --- | --- |
| 功能层 | OPL App 能做什么，用户可以完成哪些工作？ | [`feature-inventory.md`](feature-inventory.md) | AionUI/Hermes/AGUI 实现历史、视觉 token、完成流水、截图结论。 |
| 理想交互与视觉层 | 功能如何组织成低摩擦工作流，视觉基准和元素位置是什么？ | [`ideal-interaction-spec.md`](ideal-interaction-spec.md)、[`visual-system.md`](visual-system.md)、[`codex-app-visual-parity.md`](codex-app-visual-parity.md)、[`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md)、[`element-audit.md`](element-audit.md) | carrier-specific 组件路径、fork 复制步骤、当前实现已完成声明。 |
| 具体 shell 实现层 | shell 如何消费 App truth，当前对齐、偏差和验证入口是什么？ | [`shell-implementation-guide.md`](shell-implementation-guide.md)、[`shell-conformance-matrix.md`](shell-conformance-matrix.md) | 新的产品规则、模型 allowlist、runtime/domain truth、release-ready 推断。 |

专题设计继续由现有 owner 文档承接：Settings 见
[`settings-control-center.md`](settings-control-center.md)，Runtime 见
[`runtime-overview-redesign.md`](runtime-overview-redesign.md)，GUI client 角色、启动选择与
adoption 边界见 [`gui-shell-candidates.md`](gui-shell-candidates.md)，候选 shell 的 staged
计划见对应 candidate plan；Codex Auto 模型策略见
[`codex-auto-model-policy.md`](codex-auto-model-policy.md)。专题文档不得反向覆盖三层
体系或 machine contracts。

## Authority 与优先级

发生冲突时按以下顺序处理：

1. **Machine truth：** contracts、generated profile、page-state matrix、adapter
   contract、validator 和实际 source/tests 决定机器接受什么。
2. **App-owned 产品目标：** 本目录的功能、理想交互和视觉文档解释产品为什么这样
   设计，并可明确记录尚未进入 machine truth 的目标差距。
3. **Shell read model：** conformance matrix 只汇总当前 carrier 对 machine truth
   与理想目标的承接情况，不拥有任何一方。
4. **外部参考：** ChatGPT Codex、AionUI upstream、K-Dense、Open Science、Stitch
   等只提供交互或实现材料，不能覆盖 OPL App authority。

若 machine contract 与理想目标暂时不同，不把其中一边伪装成已经一致。先在
[`shell-conformance-matrix.md`](shell-conformance-matrix.md) 标成明确偏差，再由拥有
contract 的 lane 决定是否修改 machine truth、实现或目标。

Runtime cockpit 是 X0-01 条件保留的跨项目 owner projection/route，不是 B0/R1/U1、P0、
默认 release gate 或 Native phase-1 parity。现有 source 可以保留，但普通路径只在该 X0 route
显式启用时展示；conversation current-task 与 Inspector refs 不依赖它。当前 machine contracts、
page-state、design-system/release validators 仍把 Runtime 当硬门，这是待单独清理的
`core_gate_pruning_pending`，validator pass 只能证明现有合同与 source 一致。

Conformance 必须按 `contract_status`、`source_status`、`pixel_status`、`install_status`、
`release_status` 独立读取；`pixel_verified` 只证明存在当前像素证据，不等于视觉对齐、
安装验收或 release-ready。

证据分层固定为：`docs` 解释意图，`contract` 决定 machine acceptance，`source/tests`
证明 implementation，`pixel` 证明指定 cohort 的可见结果，`install` 证明最终安装字节与
用户路径回读，`release` 证明 owner promotion。当前 Contract、Source、Pixel、Install、Release
必须逐轴记录；公开发布、远端 currentness 与 owner promotion 仍必须由 release authority 独立证明。

## 治理标记（供 validator 读取）

本段只声明入口、authority 和动态默认状态来源，不复制 machine truth：

- `product_definition=docs/product/gui/README.md,docs/product/gui/feature-inventory.md`
- `visual_system=docs/product/gui/ideal-interaction-spec.md,docs/product/gui/visual-system.md,docs/product/gui/codex-to-opl-app-delta.md,docs/product/gui/element-audit.md`
- `shell_implementation_conformance=docs/product/gui/shell-implementation-guide.md,docs/product/gui/shell-conformance-matrix.md`
- `gui_shell_authority: implementation_only`
- `ideal_target.workspace_session_rail_default_visible=true`
- `ideal_target.ordinary_rail_thread_authority=codex_app_server_thread_list_read_resume`
- `ideal_target.workspace_directory_owner=false`
- `ideal_target.explicit_session_local_inputs=attachments,file_picker,directory_picker,paste,drop,/open`
- `ideal_target.workspace_selection=new_session_initial_cwd_only`
- `ideal_target.review_surface=existing_files_changes_diff_surface`
- `active_aionui.review_last_turn=source_implemented_existing_message_store`
- `active_aionui.review_custom_target_instructions=review_start_target_custom_only`
- `active_aionui.review_focus_context=optional_protocol_limit_non_blocking`
- `active_aionui.review_inline_comments=optional_protocol_limit_non_blocking`
- `ideal_target.inspector_default_visible=false`
- `active_aionui.state_source=contracts/app-product-profile.json#gui.home.home_layout`
- `active_shell_switch_contract=contracts/app-shell-adapter.json`
- `current_interaction_reference=ChatGPT Codex macOS 26.707.41301 (2026-07-11)`
- `superseded_interaction_observations=ChatGPT Codex macOS 26.707.31428 (2026-07-10),ChatGPT Codex macOS 26.707.31123 (2026-07-10)`
- `human_target.owner=one-person-lab-app`
- `active_aionui.role=current_implementation_conformance_only`
- `active_aionui.gui_conformance_ref=a0ce713b65801fd9ca7f46ad168c977c75a187de`
- `active_aionui.current_shell_head_source=active_shell_checkout_git_head`
- `active_aionui.historical_41301_evidence_sha=0ebc1fdd278e8a79602458e15e28cf814dfd917d`
- `active_aionui.current_parity_evidence_ref=docs/product/gui/evidence/aionui-41301-parity-20260714/manifest.json`
- `runtime_cockpit.role=retained_optional_x0_owner_route`
- `runtime_cockpit.upstream_alignment_may_remove_or_weaken=true_when_core_gate_removed_and_owner_route_boundary_preserved`
- `runtime_cockpit.core_requirement=false`
- `runtime_cockpit.machine_gate_pruning_pending=true`
- `runtime_cockpit.acceptance_ref=contracts/app-page-state-matrix.json#pages[id=runtime].runtime_view_model.runtime_cockpit_acceptance`
- `docs_or_contract_imply_source_complete=false`
- `docs_or_contract_imply_pixel_complete=false`
- `runtime_contract_implies_framework_producer_complete=false`
- `runtime_contract_implies_shell_consumer_complete=false`
- `runtime_contract_implies_live_evidence_complete=false`
- `ideal_target.permission_access_mode_visible=true`
- `ideal_target.environment_details_primary=workspace,locality,branch,changes,subtasks,sources`
- `ideal_target.advanced_tools_default_visible=false`
- `ideal_target.default_third_column_visible=false`
- `ideal_target.advanced_workspace_surfaces=files_changes,preview,terminal,browser`
- `entry_docs=docs/product/gui/README.md,docs/product/gui/feature-inventory.md,docs/product/gui/ideal-interaction-spec.md,docs/product/gui/visual-system.md,docs/product/gui/codex-to-opl-app-delta.md,docs/product/gui/element-audit.md,docs/product/gui/shell-implementation-guide.md,docs/product/gui/shell-conformance-matrix.md`
- `codex_auto_model_policy=contracts/app-product-profile.json#codex.auto_model_policy`
- `contract_refs=contracts/app-gui-product-contract.json,contracts/app-product-profile.json,contracts/app-page-state-matrix.json,contracts/app-shell-candidates.json,contracts/app-shell-adapter.json`

### Legacy validator compatibility

下列两行只逐字投影当前尚未清理的 GUI validator hard gate，属于
`current_machine_deviation`，不是 product target、P0 requirement、default release gate 或 Native
phase-1 parity。P1a owns their removal together with the matching product/page-state/design-system/release
rules；在该 machine change 落地前保留它们只为避免 docs-only 变更制造默认门回归：

- `runtime_cockpit.role=user_agent_collaboration_control_console`
- `runtime_cockpit.upstream_alignment_may_remove_or_weaken=false`
- `legacy_validator_compatibility.not_product_target=true`
- `legacy_validator_compatibility.owner=docs/active/app-ideal-state-gap-plan.md#p1a`

## 当前目标与实现边界

当前 Codex-based ideal target 是：

- 宽桌面默认显示目录/对话 rail，保持工作目录分组和 conversation history 可见；
  窄窗口改为 drawer，不能为增加工具而压缩主阅读列。
- Rail 顶部固定 New task、Archived；仅在 X0-01 route 显式启用时显示 Runtime。主体按 canonical thread ID 关联的显式
  Project affinity 分组 App Server threads，底部承载 account/help/Settings；App Server canonical overview 可用时是 Codex
  session directory authority，carrier 只保存 affinity、draft、preference 和可重建 cache。Git origin 与 runtime cwd 不作为
  Project identity。Rename/archive/restore/delete 分别映射 `thread/name/set`、
  `thread/archive`、`thread/unarchive`、`thread/delete`；pin 是 Shell UI metadata，本地 reset 不冒充
  App Server history reset。Canonical overview 未返回的 stale Codex ACP cache row 不进入 ordinary rail；
  只有 overview unavailable 时才 fallback cache，非 Codex local row 继续保留。每个 canonical thread ID
  最多一行，不能按标题或 workspace 去重。
- Session/thread 是主单位，project/workspace/directory 不拥有 session、context 或 artifact。新 session 以所选目录
  初始化 cwd 或以 projectless 状态开始；projectless session 可由用户一次性归入一个 canonical directory group，
  保留 thread identity 与 history。已绑定 session 的 Project affinity 不提供 A→B 任意重分组，命令或 turn 的实际
  `pwd` 不反写 affinity。目录组提供
  “使用此工作目录新建对话”的快捷动作，不提供组级删除，更不能级联删除 session。
- Home/New task 与普通 conversation 共用同一 chat canvas 和 composer，不是
  landing/dashboard；有无 workspace 都使用同一 session 模型。未选 workspace 时仍保留
  attachment、任意本地文件/目录选择、paste/drop 与 `/open`；Project/workspace 只提供初始 cwd、
  projectless 一次性 adoption、分组和展示，真实访问只由 Codex permission/approval/sandbox 决定。Workspace readiness 只约束
  project/OPL workspace controls，不得禁用普通本地对话或这些显式文件输入；
  Codex/model prerequisites 不变。Home root、composer shell 与 footer account/Settings entry 在每个 viewport 各只有一个实例。
- Conversation 顶部只保留当前 task identity 与直接动作。Model/reasoning、
  permission/access、统一 `+` 菜单和 send/stop 均留在 composer；不在 header 重复配置。
- Purpose 从 Home/New task 的 starter 选择；选中后只显示轻量 active capability，
  不用独立 Capabilities 主导航页重复同一组说明。能力安装、首页显示与维护继续归 Settings。
- Package starter 必须投影真实 availability；发送时按 `ready / degraded / package_unavailable`
  处理。Shell 优先消费 owner-projected action 做 JIT prepare、自修复或安全 fallback；只有明确
  身份/版本/入口/安全目标/权限失败才局部阻止所选 package。Workspace、receipt、binding 和 closure
  不得成为普遍启动前提，App/shell 不拥有 package currentness。
- 当前 task progress、tool events、approval 与 receipts 进入 timeline；后台 target 的 interactive
  requests 在 selected thread detail 保留 thread/turn/item context；条件启用的跨项目总览可进入
  X0-01 Runtime route。Current task 只有 timeline 单一实例；普通任务 inline/unpinned，只有用户 pin
  或真实 `long_running` 信号才 sticky，并保留 status/elapsed/progress/next/stop。
- X0-01 Runtime route 启用时消费 `WorkItemProjection v2`，只回答 Agent -> Project 范围、用户主状态、当前/
  下一 stage、下一行动与 owner、运行和 telemetry 可信度。Scope 不包含论文/work item；状态
  saved views 不重复 MAS 或其他智能体。默认列表固定为项目/论文、状态、当前进展/下一步、
  时间/Token 四列，智能体全称作为次级标签；一个 canonical work item 只显示一行。
- Runtime 的领域详情是 item-scoped progressive disclosure，不改变四列表。fast projection 只携带
  declaration-derived `domain_detail_views[]` locator 与 transport 状态，不携带医学摘要；完整内容由
  `opl app view read --item-id ... --view-id ... [--if-revision ...] --json` 按需读取。Shell 按
  `view_kind` 选择 typed renderer，禁止按 MAS id
  分支、提交任意路径、解析 Markdown/Codex session 或把 read model 提升为领域裁决。
- 首个 typed view 是 `scientific_reasoning_map`。Drawer 只显示“当前主要假设、最新研究发现、当前判断、
  下一研究步骤、更新时间”和“查看科研路线”；独立 `/runtime/item/:itemId/insights/:viewId` 全幅画布
  显示科研路线与右侧研究对象详情。来源只在折叠“来源与依据”中出现；generation、digest、ref、
  payload、attempt、provider 等机器字段不得进入用户文案。
- 科研路线是 MAS 在有意义科研变化时一次写入的轻量只读快照，不增加第二套质量门或阶段记录控制层。
  App/Shell 只做 schema/格式、节点边可绘制、机器字段隐藏和多视口排版检查；医学叙述逐值透传，
  禁止生成、翻译、摘要、改写或审核。
  unread、available、missing、stale、invalid、read_error 仅表示 transport 状态，不得转译为科研结论。
- 条件 Runtime route 的 Token 只显示 observed 当前阶段与累计值；missing 必须说明原因，不能渲染成 `0`，
  未配置上限时不得画进度条。Agent availability 使用独立 projection，五个一方智能体使用全称，
  全健康时折叠；任务数和裸 `0/2` 不构成 availability，MAS Scholar Skills 只是 MAS 依赖。
  raw ids、logs、refs、receipts 与 provider 诊断只进入诊断区。
- Environment 使用右上按需浮层，只读渲染真实
  recorded workspace/locality/branch/changes/subtasks/sources；artifact、
  evidence、receipt refs 属于次级信息，不默认形成全高第三列。它不提供已绑定 session cwd
  重绑或 rail 重分组；新任务初始 cwd 只从 composer `+` 菜单选择，projectless adoption 留在 rail。
- Files/Changes 是按需 workspace surface，Preview 独立；Terminal/Browser 只从 Environment
  或任务需要打开。旧八类 inspector taxonomy 与会话级 Runtime duplicate 不再是产品面。
- Transcript export 只导出完整分页后的、脱敏的 user/assistant text；Markdown 默认、
  strict JSON 可选，目录与文件名显式选择，不授权 workspace bundle。
- Thread identity/history 归 Codex Core/App Server。Shell 只保留一个用户触发的 App Server
  adapter，复用现有 directory/actions 执行 `thread/list`、`thread/read`、`thread/start`、
  `thread/resume`、`thread/fork`、archive/restore 和 rename/delete；普通 conversation
  继续走 AionUI 现有 ACP。没有独立“线程协调”页面、模型 dynamic tool、第二 JSON-RPC client、
  audit/idempotency ledger、pending-request 控制面或 cross-host handoff。
- Preview 通过现有 ref-only adapter 打开当前 session 的显式 attachment、可见 conversation result，或用户
  显式选择的合法绝对本地路径；绝对路径不要求属于当前 workspace，也不存在 workspace-scoped project-context ref。
  traversal、非法 scheme、自动静默读取及 unsupported ref 保持可见并 fail closed，App/shell 不复制
  artifact body，也不猜测内容。
- New session 只通过 composer `+` 菜单里的工作目录动作设置初始 cwd；projectless session 可从 rail 通过拖动或
  键盘可达的等价动作一次性归入一个目录组。失败时保持 projectless 和对话可用。Shell 不创建 managed Worktree、
  不保存 `workspace_handoff` metadata，也不提供已绑定 session 的任意目录重绑或 Local↔Worktree handoff。
- Workspace/cwd 缺失按 fail-open 处理：保留 projectless new task、composer、显式本地输入和普通 Codex
  conversation；单个 Agent Package 的 Workspace/managed-target 前提或 readiness 故障不得升级为全局聊天门禁。
- Review 复用现有 Files/Changes diff surface，按需增加 PR context、inline comments、stage、commit、
  push；target 至少包含 uncommitted/base branch/commit/custom，交付支持 inline/detached，默认
  Unstaged 并提供 Staged/Commit/Branch/Last turn。PR context 依赖 `gh`，缺失时明确 unavailable；
  `Last turn` 只读既有 message store 中最近可见用户消息之后已完成的 workspace edit；当前
  App Server `review/start` 没有 file/line comment request，因此 line-level inline comments 保持
  protocol-blocked，不建立本地 annotation store或假成功。不恢复旧 equal-weight Review tab，也不复制 Git store。
- Settings 已进入 maintenance；保持现有 OPL IA/object 和 model policy，不得决定 Home、
  rail、conversation 或 composer 结构，也不拥有 installer/runtime truth。
- 模型策略与当前默认值只读取 `contracts/app-product-profile.json`；本文档族不复制
  当前 model/reasoning 值或具体模型 allowlist。

Active AionUI 通过上面的动态 state-source marker 读取默认状态；
`opl-native-workbench` candidate contract 则把 rail 记为 default visible。当前是否
收敛由 validator readback 动态计算，不在本文复制 profile 值。右上 Environment/details
的理想目标为默认关闭。Product target、active source 和 pixel evidence 必须
分轴记录；条件 Runtime 还必须把 Product contract、Framework producer、Shell consumer、Live evidence
四条完成度独立记账。合同或文档落地不表示 Framework、AionUI source、像素或 live user path
已经完成。具体状态、允许偏差和验证入口只在
[`shell-conformance-matrix.md`](shell-conformance-matrix.md) 维护。

## 变更流程

1. **先判层。** 新能力进入功能层；工作流、位置和视觉规则进入理想层；carrier
   适配与状态进入实现层。
2. **判定是否改变 machine behavior。** 若改变普通用户可见状态、page-state
   acceptance、模型策略、Settings IA、first-run gate 或 release gate，必须由对应
   contract/validator lane 先更新 machine truth，不能只改人读文档。
   Runtime X0-01 route 的启用、入口、字段或状态变化属于 machine behavior 变更；把它从默认
   hard gate 降为条件 route 也必须同步清理 product/page-state/design-system/release validators。
   保留 optional owner route 不等于继续维护核心发布义务。
3. **更新人读目标。** 功能、交互、视觉和元素位置只在各自 owner 文件定义一次，
   其它文件使用链接，不复制长列表。
4. **实现 thin adapter。** Shell 通过 generated profile、state/action bridge、
   Settings Control Plane、single existing App Server thread-directory/user-action adapter、route redirect、局部 renderer composition、i18n/CSS 和
   focused tests 承接，不创建 shell-local 产品规则。
5. **更新 conformance read model。** 记录来源、当前状态、允许偏差、验证入口和
   evidence boundary；不把 docs-only 或 contract-only 状态写成已实现。
6. **按风险验证。** 文档改动做链接、术语、漂移和格式检查；行为改动再运行
   contract、DOM、package、screenshot、VM 或 release gate。

## Evidence 边界

本目录可以证明：

- 产品层次、术语、目标交互和视觉规则已经明确；
- shell 应遵循的适配方法和检查入口已经明确；
- 已知目标/实现差异被显式记录。

本目录不能单独证明：

- active shell 已经实现或通过全部要求；
- candidate 已被采用、可发布或已通过 clean-VM/user-path 验收；
- runtime、domain、artifact、owner receipt 或 release currentness；
- 某次截图、focused test 或 contract validation 代表完整视觉一致性。

这些结论必须由对应 source/tests、runtime readback、candidate evidence、packaged
artifact、owner acceptance 或 release authority 提供 fresh evidence。

当前 9 场景 exact-cohort evidence 见
[`evidence/aionui-41301-parity-20260714/README.md`](evidence/aionui-41301-parity-20260714/README.md)；
历史 8 场景证据继续保留在 [`evidence/aionui-41301/README.md`](evidence/aionui-41301/README.md)。

## 推荐阅读顺序

1. [`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md)
2. [`feature-inventory.md`](feature-inventory.md)
3. [`ideal-interaction-spec.md`](ideal-interaction-spec.md)
4. [`visual-system.md`](visual-system.md)
5. [`element-audit.md`](element-audit.md)
6. [`gui-shell-candidates.md`](gui-shell-candidates.md)
7. [`shell-implementation-guide.md`](shell-implementation-guide.md)
8. [`shell-conformance-matrix.md`](shell-conformance-matrix.md)
9. [`../../active/aionui-mainline-gui-convergence-plan.md`](../../active/aionui-mainline-gui-convergence-plan.md)
10. [`aionui-41301-delta-audit.md`](aionui-41301-delta-audit.md)（历史 `dbff7370f` 审计）
