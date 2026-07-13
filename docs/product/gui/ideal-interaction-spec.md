# OPL App 理想 GUI 交互细则

Owner: `one-person-lab-app`
Purpose: `app_ideal_gui_interaction_spec`
State: `active_design_target`
Machine boundary: 本文是 shell-neutral 的人读交互目标。机器可读产品要求和状态仍归
现有 GUI/profile/page-state/Settings/adapter/release contracts、source、tests 与 evidence。

设计体系入口见 [`README.md`](README.md)。

## 文档职责

本文回答“用户怎样在 OPL App 中完成工作”。功能目录见
[`feature-inventory.md`](feature-inventory.md)，视觉 token 与组件规则见
[`visual-system.md`](visual-system.md)，carrier 当前差距见
[`shell-conformance-matrix.md`](shell-conformance-matrix.md)。

本文不描述 AionUI、native workbench、Hermes 或 AGUI 的组件实现。任何 shell 都应
通过 App-owned profile、page-state、state/action bridge 和 Settings Control Plane
表达同一交互；实现现状不能反向定义理想目标。

## 产品原则

1. **Chat first。** 用户打开 App 后直接开始或继续 conversation，不先阅读 dashboard。
2. **Context visible。** 当前 project/local/branch 与 conversation context 始终可理解；
   没有 workspace 时仍允许普通文字聊天，并明确文件与项目能力受限。
3. **One primary timeline。** 当前任务、assistant output 和 turn-local events 在同一
   conversation flow 中发生。
4. **Secondary context on demand。** Environment floating details、preview 和 advanced
   work surfaces 分层按需打开，不默认形成第三列，也不把九个工具做成同权 tabs。
5. **Purpose, not backend。** 用户选择科研、基金、演示、写书等工作目的，不管理
   executor/provider/backend orchestration。
6. **Summary first, evidence available。** 首先显示结论、下一步和影响；refs、receipts
   与 raw detail 可按需展开。
7. **Authority aware。** UI 展示 state/action/domain/release refs，但不推断或接管
   owner truth。

没有明确 OPL delta 的主流程默认采用 OPL contracts 对
[`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md) 记录的
ChatGPT `26.707.41301` reference 所做的 composition 翻译。Shell 不能因为已有组件更方便，就把模型移到
header、隐藏 project rail、默认打开 inspector，或用 Settings/card layout 重新定义 Home。

## 默认桌面状态

宽桌面首次进入 ordinary Home 或 conversation 时：

- 左侧项目/对话 rail 默认可见，展示 selected workspace/project 和 recent
  conversations。
- 主区域是一条 conversation timeline；空 conversation 仍使用同一工作画布。
- Composer 浮于主区底部并保留安全距，可直接输入多行任务。
- Project identity 与 project context management 位于 rail；locality/branch 位于 Environment。
  Composer 只保留 active capability、send-scoped attachments/project refs、模型/推理和
  permission/access mode；access mode 使用自动化与文件权限的用户语言。
- 右上 Environment details 默认关闭；bottom panel、file tree、Terminal、Browser 和
  独立 artifact preview 也默认关闭。
- 不显示解释性 landing、marketing hero、activity grid、continue-work dashboard、
  backend/provider selector 或 raw protocol monitor。

当窗口不足以同时保留 rail 和可读 main canvas 时，rail 转为用户可开关的 drawer；
这属于响应式变化，不改变宽桌面的 persistent target。Environment/details surfaces 在
所有 viewport 均由用户主动打开。

## 核心用户流程

1. **进入工作上下文。** App 恢复最近 project/conversation；用户也可不选 workspace，
   直接开始 projectless conversation。
2. **开始或继续对话。** 用户从 rail 新建、搜索、pin、rename、archive、reset 或切换
   conversation，并从独立 Archived surface 管理归档。
3. **选择工作目的。** 用户从 Home starter 选择科研、基金、演示、写书等能力；
   composer 只保留 active capability chip。Package 安装、Home 显示与 lifecycle 管理在
   Settings → Agents & Capabilities 完成。
4. **提交任务。** 用户输入说明、附加材料、确认模型/推理状态并发送。
5. **观察执行。** Timeline 显示 pending、elapsed time、assistant output、tool/process
   summary、permission/input prompt 和当前 turn result。
6. **查看上下文与结果。** 需要时打开 Environment floating details 查看 workspace、
   locality、branch、changes、subtasks 和 sources；artifact/evidence 使用次级 section、
   preview 或 conversation disclosure，Terminal/Browser/Files 从 Environment 或任务需要打开。
7. **继续或恢复。** Turn 完成后保留 compact receipt/next action；用户可继续提问、
   切换 conversation 或回到 Runtime 处理跨项目工作。

## Project / Conversation Rail

Rail 负责 navigation，不承担 dashboard：

- 顶部只保留 New task、Runtime 和 Archived；Runtime 是跨项目工作状态 cockpit。
  会话级 Runtime details 只能补充当前任务，不能替代全局 Runtime 入口。Package/capability
  选择由 Home starter 承接，管理由 Settings → Agents & Capabilities 承接，不在 rail 重复。
  其它全局入口仅在 OPL 有真实对应能力时保留。
- 中段按 project 分组 conversation。Selected project 下依次组织可选 context refs、
  attachments 入口和最近 conversations；context 与 attachments 都不是建项前置条件。
- Projectless conversation 继续可用，但不伪造 project/context 层级。
- Context refs 是该 workspace 内的文件或目录引用，支持添加和移除，不生成示例项，也不复制
  artifact body；按 canonical workspace path 持久化，并在该 project 新建 conversation 时
  作为可见、可移除的 context 预载。Attachments 仍属于当前 conversation draft，不自动继承为
  project defaults。
- 支持 search、pin、rename、archive、reset；Archived 是独立 surface。
- 底部固定 account、help、Settings。
- Active conversation、running/blocked/completed 等状态只用轻量标记，不改变 row 布局。
- 切换 conversation 保留各自 scroll、draft 和 refs context。
- Workspace switch 明确说明新 turn 会在哪个目录执行。
- Backend、provider、permission、router 和 raw runtime state 不作为 rail 层级。
- 外部交互参考可以改变入口位置，但不得删除 OPL-owned capability；任何迁移必须在同一
  变更提供可见、键盘可达的替代入口，并同步更新 contract、source 和 navigation tests。

宽桌面 rail persistent 且在 `280-340px` 内可调；窄窗口 drawer 化。关闭 drawer 不清除
selection 或当前草稿。Back/Forward、Previous/Next Task、New Window 是 desktop
affordance，通过 application menu 与现有 conversation header 提供，并保持键盘可达；
Previous/Next 只在当前可见 ordinary conversations 中移动，不扩张 WebUI 产品 IA。

## Home / New Conversation

空 Home 不是 landing page，而是未开始的 conversation：

- 使用动态问题标题，保留 rail、context 和 composer。
- 展示所有由安装状态与用户偏好标记为可见的轻量 OPL starter，按稳定配置顺序响应式换行，
  不静默截断，也不解释产品功能或堆叠大卡片。
- Starter click-to-start 只准备 route context 与 active capability，不自动执行隐藏 workflow。
- Package 不可用时 starter 保持可识别但 disabled，邻近显示用户可理解的原因和允许动作；
  不用 spinner、空白或静默隐藏掩盖 readiness 问题。
- 点击可用 package starter 只进入 prepare 状态；真正 launch 前调用 Framework-owned
  use-boundary activation。只有 `launch_allowed`、`use_receipt_ref` 和 `use_binding` 完整时
  才创建/发送 conversation，失败时 fail closed 并保留修复入口。
- 无 workspace 时普通文字聊天可发送；附件、文件、Git 与 project actions 显示受限原因。
- Home 不查询或渲染跨项目 activity、needs-attention、recent refs 或 per-assistant
  running badges。
- 当前 turn 尚未开始时，不伪造 runtime status、progress 或 receipt。

## Conversation Timeline

Timeline 按时间顺序组织用户可理解的工作事实：

- User instruction 与 assistant response 是主内容。
- Thinking/tool/process/file/diff/receipt 作为 compact event 或 disclosure 出现。
- 当前 turn 运行时显示 elapsed time、最近事件、stop 和必要 recovery action。
- 长任务和 OPL current-task projection 共用可 pin summary bar，固定包含 status、elapsed、
  progress、next action、stop。
- Permission request 与 user-input request 留在相应 turn 中，不跳到独立 control panel。
- Error 显示 direct reason、影响范围和 App-owned next action；raw stack/protocol 在 details。
- Turn 完成后保留 result summary、artifact/receipt refs 和继续工作入口。
- 跨项目 status、长 evidence list 和 full ledger 进入 Runtime/details，不挤占 timeline。

Streaming 期间用户始终知道 App 仍在工作。即使已有 tool event，也不能移除 pending
反馈或让 timeline 看起来停止响应。

## Composer

Composer 是普通路径唯一主 command surface：

- 文本输入默认可用，支持多行、paste、keyboard shortcuts 和 IME。
- 由 41301 reference 翻译出的 OPL-owned target 不在 composer 常驻重复 project/local/branch：project 由 rail 表达，
  branch/locality 由 Environment 表达；composer 只保留与下一次发送直接相关的 attachment、
  project context refs 和 active capability。
- Project Context inputs 以可见 refs 预载，发送前可逐项移除；不允许 hidden prompt injection，
  也不把项目默认 context 与当前 conversation attachments 混为一类。
- 中层是 textarea；底层 action row 放 attachments/project refs、permission/access mode、
  单一紧凑 model/reasoning menu、可选 voice 和 send/stop。
- Home 与 ordinary conversation 使用同一 App-owned model control。
- 模型策略与当前默认值只读取 `contracts/app-product-profile.json`；本文不复制
  model/reasoning 值、allowlist、顺序或退休列表。
- Executor 固定为 Codex CLI；backend/provider 不作为普通控件。Permission/access mode
  在 Home 与 conversation 可见，以自动化和文件权限表达并保留安全透明度。
- Attachments 在发送前可预览、移除并显示访问失败。
- Running 时 send 转为 stop 或明确 queue 行为；stopping、blocked、failed 有可理解状态。
- Model/reasoning 与 permission/access 不在 conversation header 或 Settings 快捷条中重复。
- Composer draft 不因打开 Environment/preview、切换 details、window resize 或临时 error
  丢失。

视觉尺寸、radius、control placement 与状态样式见
[`visual-system.md`](visual-system.md)。

## Purpose 与 Capability 交互

- 普通标签描述用户工作：科研、基金、演示、写书等。
- Purpose 只从 Home starter 选择；不再是 composer 的常驻可变 selector，也不在 rail
  建立 Capabilities 主导航。
- Composer 只以低权重显示 active capability；更换 capability 改变 route context
  与 assistant-scoped profile，不改变 executor。
- Required skills 可见且 locked；optional skills 由 App packaged profile 控制。
- Package id、MAS/MAG/RCA 等 short name、route id 和 schema refs 进入 receipt/details。
- OMA 或其它 package 是否显示由 product profile/package exposure 决定，不由 shell
  discovery 自动加入。
- Ordinary capability selector 不展示未被 App allowlist 接受的 helper skill 或 MCP。
- Settings → Agents & Capabilities 负责 package 安装、Home visibility 和 lifecycle；历史
  `/capabilities` 只能作为 compatibility redirect，不能重新挂载第二套 capability directory。

## Environment Floating Details 与 Advanced Surfaces

Environment details 采用 Codex reference 的右上 anchored floating surface，默认关闭。首层只显示
当前 conversation 直接相关的 workspace、locality、branch、changes、subtasks 和 sources；
它不是常驻 inspector，也不承载完整 Runtime dashboard。

OPL 增量按以下顺序进入：

1. 与当前 task 直接相关的 artifact/evidence refs 进入 Environment 次级 section；
2. 需要阅读的 Markdown/PDF/code/result 在独立 preview 或 conversation disclosure 打开；
3. Terminal、Browser、Files 等 advanced surfaces 只从 Environment 或任务需要打开；
4. 跨项目 Runtime、Actions、Memory 管理保持独立 route，不并列成九个 tabs。

打开任何 details/preview surface 时：

- 保留 conversation、scroll、selection 和 composer draft；
- 默认展示 summary，不自动展开 raw refs；
- 只消费当前 workspace/conversation 的 refs；
- 不拥有 artifact body、memory body、runtime/domain truth 或 owner receipt；
- 空间不足时变为 overlay/drawer，并提供明确 close 和 keyboard focus boundary。

Bottom panel、file tree、Terminal、Browser 等 advanced work surfaces 保留，但默认关闭；
用户显式打开后必须真实可见、可调、可关闭，不以 hidden DOM 冒充功能。

## Runtime 交互

Runtime 是跨 conversation/project 的工作状态页：

- 普通读取和 refresh 使用 `opl app state --profile fast --json`。
- Full state/operator drilldown 只在 explicit detail/diagnostic path 使用。
- 首屏先回答：哪些任务真实在跑、哪些项目仍在推进、哪些排队、哪些需要关注。
- User-facing primary state 与 automation/provider secondary state 分开展示。
- Running 只来自权威 projection 的显式运行状态；active id、module dirt 或 DOM 不构成
  liveness proof。
- 每个 item 显示 title、status、stage、progress、next step、owner 和 last update；
  evidence、resource 与 raw diagnostic refs 按需展开。
- Safe mutation 通过 App action route，先 preview/confirmation，再 execute/receipt。
- UI 不从 progress/readback 推断 domain-ready、artifact quality、production-ready 或
  release-ready。

Runtime 专题设计见
[`runtime-overview-redesign.md`](runtime-overview-redesign.md)。

## Settings 交互

Settings 是 OPL Control Center，不是 upstream 配置列表：

- 使用独立 Settings route：明确 return、search 和 grouped rows；不把 Settings 塞进
  Environment/details。
- Ordinary navigation 按 App-owned Settings IA 组织 Overview、Access、Workspace、
  Capabilities、Resources & Connections、Maintenance & Updates、Data & Storage 和
  Preferences；Advanced/About/Update 等保持 secondary。
- 每页先回答用户问题，再给 recommended action；raw ids、paths、receipts 和 JSON
  默认折叠。
- Search 只帮助导航，不创建第二 status source。
- 二元值用 toggle/checkbox，模式用 segmented control，选项用 menu，数值用合适的
  input/stepper/slider。
- 状态改变或 destructive action 进入 confirmation surface，明确 will change、
  will not change、recovery/receipt 和 preview/proof。
- Legacy/upstream route 只 redirect 到最近 App-owned page。

详细信息架构见
[`settings-control-center.md`](settings-control-center.md)。

## First-run

First-run 的目标是让用户尽快进入可工作的 App：

- Core readiness 只回答 workspace、Codex CLI 和可用模型访问是否满足普通 launch。
- 当前 blocker 用用户语言解释，并只突出一个最重要 next action。
- Initialization 显示真实 phase、elapsed time、完成/失败和恢复路径。
- Full readiness、package reconcile、runtime provider 和 background maintenance 在进入
 主界面后继续，除非 App contract 明确为 blocker。
- 已有可用 access 时不重复要求配置推荐 provider；技术命令只在 details 中显示。

## Empty、Loading 与 Failure

- Empty state 说明为什么为空、用户可以做什么；不使用功能说明广告文案。
- Loading 优先显示已知 phase、elapsed time 或正在读取的对象，避免无限 spinner。
- Stale state 标明 last checked 和 refresh action，不伪装成 fresh。
- Disabled action 显示 disabled reason。
- Partial/unavailable state 保留可用功能，并说明缺失边界；不使用 silent fallback 假装
  完整。
- Package starter 的 unavailable/activating/blocked 状态必须来自 App/Framework readback；
  blocked 时只保留 status、doctor、repair 等 contract 允许动作，不允许绕过 activation 发送。
- Failure 保留 typed reason、receipt/ref 和可恢复入口；不能把所有错误压成“重试”。

## 响应式与 WebUI

- Desktop 与 WebUI 保持同一产品语义；transport 和 native affordance 可以不同。
- 宽桌面保留 persistent rail；窄窗口把 rail 与 Environment/details 变为 drawer/overlay。
- Main timeline 与 composer 始终优先获得可读宽度。
- Native file picker 在 WebUI 可映射为受控 path/volume action，但不得扩大文件权限。
- 用户打开 secondary context 后，panel 必须真实可见、可滚动、可关闭和 keyboard 可达。
- WebUI 不创建第二 product profile、runtime truth、provider policy 或 release channel。

## 双语与可访问性

- 普通 UI 支持简体中文和英文，同屏不随机混用语言。
- 中文 labels 描述工作目的；technical name、命令和用户原文在 details 保留原样。
- Language switch 只改变 copy/formatting，不改变 workspace、thread、route 或 runtime state。
- 所有主流程可 keyboard-only 完成；focus order 与视觉顺序一致。
- 状态不只靠颜色；icon button 有 accessible name；dialog/drawer 管理焦点和 Escape。
- Streaming 与 live status 使用适当 announcement，避免逐 token 重复朗读。

## 验收清单

一个 shell 匹配理想交互，需要有匹配层级的 fresh evidence 证明：

- 宽桌面打开即显示 project/conversation rail、single timeline 和 composer。
- 窄窗口 rail 可收起并能以 drawer 重新打开。
- Environment details 默认关闭且 anchored，打开后不破坏 conversation/draft。
- Home 使用动态问题标题与全部用户可见 configured starters，不静默截断，也不是
  dashboard/landing。
- Package starter unavailable 时有原因和允许动作；launch 前 activation fail closed，成功时
  绑定 use receipt/binding。
- Project task 与 projectless conversation 均可用；无 workspace 时文字聊天可用且文件能力受限。
- Composer 只有 textarea、send-local controls 和 bottom action row；purpose 不再常驻可变
  selector，project/local/branch 不与 rail/Environment 重复。
- Permission/access mode 可见并用用户语言表达，不暴露 backend/provider。
- Model/reasoning 及当前默认值来自 App product profile。
- Current-task summary bar 可 pin，并包含 status/elapsed/progress/next action/stop。
- Rail/Archived/conversation management 与 desktop affordances 完整可达。
- Rail 顶部只有 New task、Runtime、Archived；capability 选择在 Home，管理在 Settings。
- Environment 首层保持 workspace/locality/branch/changes/subtasks/sources；OPL artifact/evidence 为
  次级 section/preview，advanced tools 默认关闭。
- Settings 使用 full-window shell，OPL IA、first-run、品牌和双语边界保持不变。
- Pending、elapsed、tool/process、permission、failure 和 receipt 在 turn 中可理解。
- Runtime/Settings 使用 App state/action/Control Plane，不拥有 owner truth。
- 中英文、keyboard、focus、contrast、responsive panel 均可用。
- Contract/DOM/source screenshot/package/VM/release evidence 没有跨层过度声明。
