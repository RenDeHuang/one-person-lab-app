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
- `current_interaction_reference=ChatGPT Codex macOS 26.707.31428 (2026-07-10)`
- `superseded_interaction_observation=ChatGPT Codex macOS 26.707.31123 (2026-07-10)`
- `human_target.owner=one-person-lab-app`
- `active_aionui.role=current_implementation_conformance_only`
- `docs_or_contract_imply_source_complete=false`
- `docs_or_contract_imply_pixel_complete=false`
- `ideal_target.permission_access_mode_visible=true`
- `ideal_target.side_panel_primary_tools=review,terminal,browser,files`
- `entry_docs=docs/product/gui/README.md,docs/product/gui/feature-inventory.md,docs/product/gui/ideal-interaction-spec.md,docs/product/gui/visual-system.md,docs/product/gui/codex-to-opl-app-delta.md,docs/product/gui/element-audit.md,docs/product/gui/shell-implementation-guide.md,docs/product/gui/shell-conformance-matrix.md`
- `codex_auto_model_policy=contracts/app-product-profile.json#codex.auto_model_policy`
- `contract_refs=contracts/app-gui-product-contract.json,contracts/app-product-profile.json,contracts/app-page-state-matrix.json,contracts/app-shell-candidates.json,contracts/app-shell-adapter.json`

## 当前目标与实现边界

当前 Codex-based ideal target 是：

- 宽桌面默认显示项目/对话 rail，保持 workspace 和 conversation history 可见；
  rail 在 `280-340px` 内可调，窄窗口改为 drawer。
- Rail 顶部固定 New task、Archived、Capabilities，底部固定 account/help/Settings；
  Sites/Chat 没有 OPL 对应能力时不成为普通入口。
- Home 是动态问题标题、最多四个轻量 OPL starter 和 composer，不是 landing/dashboard；
  project task 与 projectless conversation 都可用，无 workspace 时普通文字聊天仍可发送。
- Purpose 由 Home starter 或 Capabilities 选择；composer 只显示 active capability chip，
  以及 project/local/branch context strip、textarea、bottom action row。
- Model/reasoning 使用单一紧凑 menu；permission/access mode 使用自动化和文件权限的
  用户语言并保持可见，不暴露 provider/backend。
- 当前任务使用可 pin summary bar，统一显示 status、elapsed、progress、next action、stop。
- Environment 是 anchored popover；wide side panel 是默认关闭的可调 split，主工具只有
  Review、Terminal、Browser、Files，Artifacts/Runtime/Actions/Memory 进入次级 section。
- Bottom panel、file tree、Terminal、Browser 等 advanced work surfaces 保留但默认关闭。
- Settings 采用 Codex full-window return/search/grouped-row shell，同时保持现有 OPL IA。
- 模型策略与当前默认值只读取 `contracts/app-product-profile.json`；本文档族不复制
  当前 model/reasoning 值或具体模型 allowlist。

Active AionUI 通过上面的动态 state-source marker 读取默认状态；
`opl-native-workbench` candidate contract 则把 rail 记为 default visible。当前是否
收敛由 validator readback 动态计算，不在本文复制 profile 值。右侧 side panel 的理想
目标与 candidate 均为默认关闭。Product target、active source 和 pixel evidence 必须
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

1. [`feature-inventory.md`](feature-inventory.md)
2. [`ideal-interaction-spec.md`](ideal-interaction-spec.md)
3. [`visual-system.md`](visual-system.md)
4. [`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md)
5. [`element-audit.md`](element-audit.md)
6. [`shell-implementation-guide.md`](shell-implementation-guide.md)
7. [`shell-conformance-matrix.md`](shell-conformance-matrix.md)
