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

产品方向固定为：**先继承 ChatGPT Codex 的主工作流和空间关系，再增加 OPL
专业能力**。Rail、单列 conversation、底部 composer 和按需环境详情构成基础壳；
OPL project context、capabilities、progress、evidence、artifacts 与 safe actions 必须
嵌入这些稳定位置，不得把 Home 改造成 dashboard、launcher 或 card wall。

当前人读观察基准是本机 ChatGPT macOS `26.707.41301`（观察于 `2026-07-11`）。
App machine authority 已升为 baseline schema v2；AionUI implementation、generated profile、
完整 Node/DOM/TypeScript/format/i18n、App active-shell/release-boundary 与 packaged 8 场景
visual matrix 已绑定当前 Shell local/remote main `0ebc1fdd278e8a79602458e15e28cf814dfd917d`。
这些证据证明当前 source cohort 与指定 route/layout 状态，不证明 1:1 pixel parity、公开
release-ready 或远端 currentness。`26.707.31428` 与 `26.707.31123` 只作为 superseded
observations 保留。

## 三层与文件归属

| 层级 | 核心问题 | 人读文件 | 不应包含 |
| --- | --- | --- | --- |
| 功能层 | OPL App 能做什么，用户可以完成哪些工作？ | [`feature-inventory.md`](feature-inventory.md) | AionUI/Hermes/AGUI 实现历史、视觉 token、完成流水、截图结论。 |
| 理想交互与视觉层 | 功能如何组织成低摩擦工作流，视觉基准和元素位置是什么？ | [`ideal-interaction-spec.md`](ideal-interaction-spec.md)、[`visual-system.md`](visual-system.md)、[`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md)、[`element-audit.md`](element-audit.md) | carrier-specific 组件路径、fork 复制步骤、当前实现已完成声明。 |
| 具体 shell 实现层 | shell 如何消费 App truth，当前对齐、偏差和验证入口是什么？ | [`shell-implementation-guide.md`](shell-implementation-guide.md)、[`shell-conformance-matrix.md`](shell-conformance-matrix.md) | 新的产品规则、模型 allowlist、runtime/domain truth、release-ready 推断。 |

专题设计继续由现有 owner 文档承接：Settings 见
[`settings-control-center.md`](settings-control-center.md)，Runtime 见
[`runtime-overview-redesign.md`](runtime-overview-redesign.md)，候选 shell 的 staged
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
- `ideal_target.inspector_default_visible=false`
- `active_aionui.state_source=contracts/app-product-profile.json#gui.home.home_layout`
- `active_shell_switch_contract=contracts/app-shell-adapter.json`
- `current_interaction_reference=ChatGPT Codex macOS 26.707.41301 (2026-07-11)`
- `superseded_interaction_observations=ChatGPT Codex macOS 26.707.31428 (2026-07-10),ChatGPT Codex macOS 26.707.31123 (2026-07-10)`
- `human_target.owner=one-person-lab-app`
- `active_aionui.role=current_implementation_conformance_only`
- `active_aionui.final_shell_sha=0ebc1fdd278e8a79602458e15e28cf814dfd917d`
- `docs_or_contract_imply_source_complete=false`
- `docs_or_contract_imply_pixel_complete=false`
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
- Rail 顶部保持少量全局入口，主体按 project 分组 conversation，底部承载 account/help；
  OPL 在 project 下增加可选 context refs，不创建第二套导航体系。
- Home/New task 与普通 conversation 共用同一 chat canvas 和 composer，不是
  landing/dashboard；project task 与 projectless text conversation 都可用。
- Conversation 顶部只保留当前 task identity 与直接动作。Model/reasoning、
  permission/access、attach 和 send/stop 均留在 composer；不在 header 重复配置。
- Purpose 从 Home starter 或 Capabilities 选择；选中后只显示轻量 active capability，
  不用大型入口卡片长期占据主画布。
- 当前 task progress、tool events、approval 与 receipts 进入 timeline；跨项目总览才进入
  Runtime。Current task 只有 timeline 单一实例；普通任务 inline/unpinned，只有用户 pin
  或真实 `long_running` 信号才 sticky，并保留 status/elapsed/progress/next/stop。
- Environment 使用右上按需浮层，只渲染真实
  workspace/locality/branch/changes/subtasks/sources；artifact、
  evidence、receipt refs 属于次级信息，不默认形成全高第三列。
- Files/Changes 是按需 workspace surface，Preview 独立；Terminal/Browser 只从 Environment
  或任务需要打开。旧八类 inspector taxonomy 与会话级 Runtime duplicate 不再是产品面。
- Transcript export 只导出完整分页后的、脱敏的 user/assistant text；Markdown 默认、
  strict JSON 可选，目录与文件名显式选择，不授权 workspace bundle。
- Settings 已进入 maintenance；保持现有 OPL IA/object 和 model policy，不得决定 Home、
  rail、conversation 或 composer 结构，也不拥有 installer/runtime truth。
- 模型策略与当前默认值只读取 `contracts/app-product-profile.json`；本文档族不复制
  当前 model/reasoning 值或具体模型 allowlist。

Active AionUI 通过上面的动态 state-source marker 读取默认状态；
`opl-native-workbench` candidate contract 则把 rail 记为 default visible。当前是否
收敛由 validator readback 动态计算，不在本文复制 profile 值。右上 Environment/details
的理想目标为默认关闭。Product target、active source 和 pixel evidence 必须
分轴记录；合同或文档落地不表示 AionUI source 或像素已经完成。具体状态、允许偏差和验证入口只在
[`shell-conformance-matrix.md`](shell-conformance-matrix.md) 维护。

## 变更流程

1. **先判层。** 新能力进入功能层；工作流、位置和视觉规则进入理想层；carrier
   适配与状态进入实现层。
2. **判定是否改变 machine behavior。** 若改变普通用户可见状态、page-state
   acceptance、模型策略、Settings IA、first-run gate 或 release gate，必须由对应
   contract/validator lane 先更新 machine truth，不能只改人读文档。
3. **更新人读目标。** 功能、交互、视觉和元素位置只在各自 owner 文件定义一次，
   其它文件使用链接，不复制长列表。
4. **实现 thin adapter。** Shell 通过 generated profile、state/action bridge、
   Settings Control Plane、route redirect、局部 renderer composition、i18n/CSS 和
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

## 推荐阅读顺序

1. [`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md)
2. [`feature-inventory.md`](feature-inventory.md)
3. [`ideal-interaction-spec.md`](ideal-interaction-spec.md)
4. [`visual-system.md`](visual-system.md)
5. [`element-audit.md`](element-audit.md)
6. [`shell-implementation-guide.md`](shell-implementation-guide.md)
7. [`shell-conformance-matrix.md`](shell-conformance-matrix.md)
8. [`../../active/aionui-mainline-gui-convergence-plan.md`](../../active/aionui-mainline-gui-convergence-plan.md)
9. [`aionui-41301-delta-audit.md`](aionui-41301-delta-audit.md)（历史 `dbff7370f` 审计）
