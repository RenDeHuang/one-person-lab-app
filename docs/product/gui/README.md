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
OPL project context、capabilities、跨顶层线程协调、progress、evidence、artifacts 与 safe actions 必须
嵌入这些稳定位置，不得把 Home 改造成 dashboard、launcher 或 card wall。

当前人读观察基准是本机 ChatGPT macOS `26.707.41301`（观察于 `2026-07-11`）。
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
absolute-path Preview、首结果 idempotency replay、user coordination/unarchive、
Local/Worktree/handoff、Review 已采纳子集、Runtime cockpit、typed interactive requests，并完整保留
Runtime V2 与 Gateway account/UI。该 exact cohort 的 full source gates、macOS arm64 directory-only package、
codesign 与 9 场景 packaged E2E 已闭合；package 未安装，main/remote currentness 与 release
promotion仍由操作层 fresh readback决定。模型可调用 host tool仍是必需产品目标，当前 AionUI
user coordination surface 不能作为其实现证据。当前 Shell source cohort
`e218d79b7a5727b72ddce66bcaabd9410a38076b` 在该 package cohort 之后补入 profile-driven
feedback、Review `Last turn`/same-turn focus steer、窄窗 Access 单列断点、profile-driven
avatar/help，以及managed Worktree
durable snapshot-before-remove/cleanup rollback/receipt restore、Runtime generic fallback 本地化、
disabled workspace selector 合同 marker，以及 canonical project/locale Runtime evidence 与 DOM fixture
对齐；普通 navigation 不再挂载独立协调页。
其 Node/DOM、TypeScript、format、i18n与lint 0 errors已通过，但尚无匹配 package/pixel 证据。

## 三层与文件归属

| 层级 | 核心问题 | 人读文件 | 不应包含 |
| --- | --- | --- | --- |
| 功能层 | OPL App 能做什么，用户可以完成哪些工作？ | [`feature-inventory.md`](feature-inventory.md) | AionUI/Hermes/AGUI 实现历史、视觉 token、完成流水、截图结论。 |
| 理想交互与视觉层 | 功能如何组织成低摩擦工作流，视觉基准和元素位置是什么？ | [`ideal-interaction-spec.md`](ideal-interaction-spec.md)、[`visual-system.md`](visual-system.md)、[`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md)、[`element-audit.md`](element-audit.md) | carrier-specific 组件路径、fork 复制步骤、当前实现已完成声明。 |
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

Runtime 是 OPL 自有的跨项目“用户与智能体协作控制台”，不是 observability dashboard。
外部产品或 AionUI upstream 只能影响布局与交互材料，不能删除、降级或用会话详情替代该能力。
任何 Runtime 入口迁移或实现重写，都必须在同一变更中保持产品合同的默认问题、page-state
acceptance、validator 与 tests；无法保持时记录 shell deviation，不修改 App 产品真相迁就上游。

Conformance 必须按 `contract_status`、`source_status`、`pixel_status` 三条独立轴读取；
`pixel_verified` 只证明存在当前像素证据，不等于视觉对齐或 release-ready。

证据分层固定为：`docs` 解释意图，`contract` 决定 machine acceptance，`source/tests`
证明 implementation，`pixel` 证明指定 cohort 的可见结果，`release` 证明最终
package/user path。当前 contract/source 与 packaged route visual evidence 已绑定；公开发布、
远端 currentness 与 owner promotion 仍必须由 release authority 独立证明。

## 治理标记（供 validator 读取）

本段只声明入口、authority 和动态默认状态来源，不复制 machine truth：

- `product_definition=docs/product/gui/README.md,docs/product/gui/feature-inventory.md`
- `visual_system=docs/product/gui/ideal-interaction-spec.md,docs/product/gui/visual-system.md,docs/product/gui/codex-to-opl-app-delta.md,docs/product/gui/element-audit.md`
- `shell_implementation_conformance=docs/product/gui/shell-implementation-guide.md,docs/product/gui/shell-conformance-matrix.md`
- `gui_shell_authority: implementation_only`
- `ideal_target.workspace_session_rail_default_visible=true`
- `ideal_target.ordinary_rail_thread_authority=codex_app_server_thread_list_read_resume`
- `ideal_target.project_workspace_authorization_domain=false`
- `ideal_target.projectless_local_inputs=attachments,file_picker,directory_picker,paste,drop,/open`
- `ideal_target.local_worktree_lifecycle=local,worktree,starting_branch,handoff,snapshot,restore`
- `ideal_target.review_surface=existing_files_changes_diff_surface`
- `ideal_target.model_host_tool_access=true`
- `active_aionui.model_host_tool_access=source_missing`
- `model_host_tool.evidence=dynamic_tool_registration_and_item_tool_call_round_trip`
- `model_host_tool.blocker=acp_session_new_or_load_has_no_dynamic_tools_input_or_item_tool_call_callback`
- `model_host_tool.owner_route=aioncore_same_app_server_client_adapter_or_codex_acp_dynamic_tool_callback`
- `ideal_target.cross_host_handoff=true`
- `active_aionui.cross_host_handoff=required_target_protocol_owner_blocked_unavailable`
- `cross_host_handoff.blocker=remote_host_handoff_owner_surface_unavailable`
- `cross_host_handoff.owner_route=codex_app_remote_connections_host_handoff_owner`
- `active_aionui.review_last_turn=source_implemented_existing_message_store`
- `active_aionui.review_inline_comments=source_blocked_missing_typed_codex_protocol`
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
- `runtime_cockpit.role=user_agent_collaboration_control_console`
- `runtime_cockpit.upstream_alignment_may_remove_or_weaken=false`
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

## 当前目标与实现边界

当前 Codex-based ideal target 是：

- 宽桌面默认显示项目/对话 rail，保持 project hierarchy 和 conversation history 可见；
  窄窗口改为 drawer，不能为增加工具而压缩主阅读列。
- Rail 顶部只保留 New task、Runtime、Archived，主体按 project 分组 App Server threads，底部承载
  account/help/Settings；canonical history 来自 `thread/list/read/resume`，Shell DB 只保存 draft、
  preference 和可重建 cache。Rename/archive/restore/delete 分别映射 `thread/name/set`、
  `thread/archive`、`thread/unarchive`、`thread/delete`；pin 是 Shell UI metadata，本地 reset 不冒充
  App Server history reset。OPL 在 project 下增加可选 context refs，不创建第二套导航体系。
- Home/New task 与普通 conversation 共用同一 chat canvas 和 composer，不是
  landing/dashboard；project task 与 projectless conversation 都可用。未选 workspace 时仍保留
  attachment、任意本地文件/目录选择、paste/drop 与 `/open`；Project/workspace 只提供默认 cwd、
  分组和上下文提示，真实访问只由 Codex permission/approval/sandbox 决定。
- Conversation 顶部只保留当前 task identity 与直接动作。Model/reasoning、
  permission/access、attach 和 send/stop 均留在 composer；不在 header 重复配置。
- Purpose 从 Home/New task 的 starter 选择；选中后只显示轻量 active capability，
  不用独立 Capabilities 主导航页重复同一组说明。能力安装、首页显示与维护继续归 Settings。
- Package starter 必须投影真实 availability；不可用时说明原因和允许动作，launch 前由
  Framework-owned use-boundary activation fail closed，App/shell 不拥有 package currentness。
- 当前 task progress、tool events、approval 与 receipts 进入 timeline；后台 target 的 interactive
  requests 在 selected thread detail 保留 thread/turn/item context；跨项目总览才进入
  Runtime。Current task 只有 timeline 单一实例；普通任务 inline/unpinned，只有用户 pin
  或真实 `long_running` 信号才 sticky，并保留 status/elapsed/progress/next/stop。
- Runtime 默认层消费 `WorkItemProjection v2`，只回答 Agent -> Project 范围、用户主状态、当前/
  下一 stage、下一行动与 owner、运行和 telemetry 可信度。Scope 不包含论文/work item；状态
  saved views 不重复 MAS 或其他智能体。默认列表固定为项目/论文、状态、当前进展/下一步、
  时间/Token 四列，智能体全称作为次级标签；一个 canonical work item 只显示一行。
- Runtime Token 只显示 observed 当前阶段与累计值；missing 必须说明原因，不能渲染成 `0`，
  未配置上限时不得画进度条。Agent availability 使用独立 projection，五个一方智能体使用全称，
  全健康时折叠；任务数和裸 `0/2` 不构成 availability，MAS Scholar Skills 只是 MAS 依赖。
  raw ids、logs、refs、receipts 与 provider 诊断只进入诊断区。
- Environment 使用右上按需浮层，只渲染真实
  workspace/locality/branch/changes/subtasks/sources；artifact、
  evidence、receipt refs 属于次级信息，不默认形成全高第三列。
- Files/Changes 是按需 workspace surface，Preview 独立；Terminal/Browser 只从 Environment
  或任务需要打开。旧八类 inspector taxonomy 与会话级 Runtime duplicate 不再是产品面。
- Transcript export 只导出完整分页后的、脱敏的 user/assistant text；Markdown 默认、
  strict JSON 可选，目录与文件名显式选择，不授权 workspace bundle。
- 跨顶层线程协调复用 project/conversation directory、按需 thread detail、target ordinary turn、source
  delivery audit 和 mobile sheet；独立双边 timeline event 属于后续增强，不能从单份 audit 推导。
  普通 navigation 不展示独立“线程协调”页面或 rail 区块；keyboard-reachable thread-detail context
  action 与 model host tool 复用同一 adapter。
  Thread identity/history 归 Codex Core/App Server；OPL host 通过 `thread/list`、`thread/read`、
  `thread/resume`、`thread/fork`、`thread/archive`、`turn/start`、`turn/steer` 完成受控路由，
  并负责 opaque-key 幂等、project/workspace/write-set/route advisory 和可见 delivery audit。Project/
  workspace 只定义新任务默认 cwd、rail 分组和可见元数据；任务启动后仅服从 Codex 自身
  permission/approval/sandbox，不增加 OPL 目录边界。跨 project/workspace、workspace-write、overlap、
  running steer 或 loop advisory 不得被拒绝或额外确认；archive 直接且可通过 `thread/unarchive`
  恢复。同一 idempotency key 重试返回第一次 receipt/result、`ok=true` 且不再次 dispatch；同内容
  不同 key 仍可合法重复。Codex approval、permission、user-input 和 MCP elicitation 是 selected
  target thread 中的 pending state；只有拒绝/取消、请求失效或 handler/protocol 错误才失败。
  Delivery audit 只记录 Codex policy inheritance，不冒充独立 approval receipt。跨 host 当前
  unavailable，不把直接消息或本机 handoff 伪装成已支持。
  `spawn_agent`、`send_input`、`wait_agent` 只用于同一 agent tree，不能成为跨根线程消息总线。
- Artifact/evidence ref 通过现有 Preview surface 的 ref-only adapter 打开。用户显式选择时可打开
  合法任意绝对本地路径，不要求属于当前 workspace；project-context refs 仍保持 workspace-scoped。
  traversal、非法 scheme、自动静默读取及 unsupported ref 保持可见并 fail closed，App/shell 不复制
  artifact body，也不猜测内容。
- New task 支持 Local/Worktree、starting branch 与同主机 idle task 的 Local↔Worktree handoff；
  Worktree 位于 `$CODEX_HOME/worktrees`，selected branch HEAD detached，可应用所选 Local 未提交
  变更并读取 `.worktreeinclude`，同一 task 复用同一 worktree。Snapshot/restore 与 cleanup UI
  当前 deferred，cross-host unsupported；状态归 Codex Core/App Server 与既有 Git 集成，Shell
  只做薄 adapter。
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
分轴记录；Runtime 还必须把 Product contract、Framework producer、Shell consumer、Live evidence
四条完成度独立记账。合同或文档落地不表示 Framework、AionUI source、像素或 live user path
已经完成。具体状态、允许偏差和验证入口只在
[`shell-conformance-matrix.md`](shell-conformance-matrix.md) 维护。

## 变更流程

1. **先判层。** 新能力进入功能层；工作流、位置和视觉规则进入理想层；carrier
   适配与状态进入实现层。
2. **判定是否改变 machine behavior。** 若改变普通用户可见状态、page-state
   acceptance、模型策略、Settings IA、first-run gate 或 release gate，必须由对应
   contract/validator lane 先更新 machine truth，不能只改人读文档。
   Runtime 的删除、入口替代、字段降级或状态合并都属于 machine behavior 变更；“对齐上游”
   不能豁免产品合同、page-state、validator 与 test 的同变更审查。
3. **更新人读目标。** 功能、交互、视觉和元素位置只在各自 owner 文件定义一次，
   其它文件使用链接，不复制长列表。
4. **实现 thin adapter。** Shell 通过 generated profile、state/action bridge、
   Settings Control Plane、App Server coordination host adapter、route redirect、局部 renderer composition、i18n/CSS 和
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
