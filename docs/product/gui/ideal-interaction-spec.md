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
2. **Workspace visible。** 当前 workspace/project 与 conversation context 始终可理解。
3. **One primary timeline。** 当前任务、assistant output 和 turn-local events 在同一
   conversation flow 中发生。
4. **Secondary context on demand。** Runtime、Files、Artifacts、Memory、Automations
   和 diagnostics 只在用户需要时打开。
5. **Purpose, not backend。** 用户选择科研、基金、演示、写书等工作目的，不管理
   executor/provider/backend orchestration。
6. **Summary first, evidence available。** 首先显示结论、下一步和影响；refs、receipts
   与 raw detail 可按需展开。
7. **Authority aware。** UI 展示 state/action/domain/release refs，但不推断或接管
   owner truth。

## 默认桌面状态

宽桌面首次进入 ordinary Home 或 conversation 时：

- 左侧项目/对话 rail 默认可见，展示 selected workspace/project 和 recent
  conversations。
- 主区域是一条 conversation timeline；空 conversation 仍使用同一工作画布。
- Composer 固定在主区底部，可直接输入多行任务。
- 当前 workspace、purpose 和模型状态可见但保持辅助权重。
- 右侧 inspector 默认关闭。
- 不显示解释性 landing、marketing hero、activity grid、continue-work dashboard、
  backend/provider/permission selector 或 raw protocol monitor。

当窗口不足以同时保留 rail 和可读 main canvas 时，rail 转为用户可开关的 drawer；
这属于响应式变化，不改变宽桌面的 persistent target。Right inspector 在所有 viewport
均由用户主动打开。

## 核心用户流程

1. **进入工作上下文。** App 恢复最近 workspace/conversation，或让用户选择 workspace。
2. **开始或继续对话。** 用户从 rail 新建、恢复或切换 conversation。
3. **选择工作目的。** 用户选择科研、基金、演示、写书或其它已暴露 package shortcut。
4. **提交任务。** 用户输入说明、附加材料、确认模型/推理状态并发送。
5. **观察执行。** Timeline 显示 pending、elapsed time、assistant output、tool/process
   summary、permission/input prompt 和当前 turn result。
6. **查看上下文。** 需要时打开 Files、Runtime、Artifacts、Capabilities、Memory 或
   Settings，不离开当前 conversation。
7. **继续或恢复。** Turn 完成后保留 compact receipt/next action；用户可继续提问、
   切换 conversation 或回到 Runtime 处理跨项目工作。

## Project / Conversation Rail

Rail 负责 navigation，不承担 dashboard：

- 先显示 selected workspace/project，再显示 conversation history。
- 支持 new、resume、rename、archive/reset 等 contract 允许的操作。
- Active conversation、running/blocked/completed 等状态只用轻量标记，不改变 row 布局。
- 切换 conversation 保留各自 scroll、draft 和 refs context。
- Workspace switch 明确说明新 turn 会在哪个目录执行。
- Backend、provider、permission、router 和 raw runtime state 不作为 rail 层级。

宽桌面 rail persistent；窄窗口 drawer 化。关闭 drawer 不清除 selection 或当前草稿。

## Home / New Conversation

空 Home 不是 landing page，而是未开始的 conversation：

- 保留 rail、workspace context、purpose choices 和 composer。
- 可以展示少量 assistant-scoped prompt starters，但不解释产品功能或堆叠大卡片。
- Purpose click-to-start 只准备 route context，不自动执行隐藏 workflow。
- Home 不查询或渲染跨项目 activity、needs-attention、recent refs 或 per-assistant
  running badges。
- 当前 turn 尚未开始时，不伪造 runtime status、progress 或 receipt。

## Conversation Timeline

Timeline 按时间顺序组织用户可理解的工作事实：

- User instruction 与 assistant response 是主内容。
- Thinking/tool/process/file/diff/receipt 作为 compact event 或 disclosure 出现。
- 当前 turn 运行时显示 elapsed time、最近事件、stop 和必要 recovery action。
- Permission request 与 user-input request 留在相应 turn 中，不跳到独立 control panel。
- Error 显示 direct reason、影响范围和 App-owned next action；raw stack/protocol 在 details。
- Turn 完成后保留 result summary、artifact/receipt refs 和继续工作入口。
- 跨项目 status、长 evidence list 和 full ledger 进入 Runtime/inspector，不挤占 timeline。

Streaming 期间用户始终知道 App 仍在工作。即使已有 tool event，也不能移除 pending
反馈或让 timeline 看起来停止响应。

## Composer

Composer 是普通路径唯一主 command surface：

- 文本输入默认可用，支持多行、paste、keyboard shortcuts 和 IME。
- Purpose、attachments、workspace/context、model/reasoning、send/stop 是直接控件。
- Home 与 ordinary conversation 使用同一 App-owned model control。
- 模型策略只读取 `contracts/app-product-profile.json`；当前默认为
  `5.6 Sol / ultra`，本文不复制 allowlist、顺序或退休列表。
- Executor 固定为 Codex CLI；backend、provider 和 permission mode 不作为普通控件。
- Attachments 在发送前可预览、移除并显示访问失败。
- Running 时 send 转为 stop 或明确 queue 行为；stopping、blocked、failed 有可理解状态。
- Composer draft 不因打开 inspector、切换 details、window resize 或临时 error 丢失。

视觉尺寸、radius、control placement 与状态样式见
[`visual-system.md`](visual-system.md)。

## Purpose 与 Capability 交互

- 普通标签描述用户工作：科研、基金、演示、写书等。
- Purpose 改变 route context 和 assistant-scoped capability profile，不改变 executor。
- Required skills 可见且 locked；optional skills 由 App packaged profile 控制。
- Package id、MAS/MAG/RCA 等 short name、route id 和 schema refs 进入 receipt/details。
- OMA 或其它 package 是否显示由 product profile/package exposure 决定，不由 shell
  discovery 自动加入。
- Ordinary capability selector 不展示未被 App allowlist 接受的 helper skill 或 MCP。

## Right Inspector

Right inspector 是 selected conversation 的辅助上下文，默认关闭。可包含：

- Files 与 workspace refs；
- Artifacts、deliverables、review 和 provenance refs；
- Runtime、routing、conditions、blockers 和 App actions；
- Active capability profile；
- Memory 与 automation refs；
- Contextual Settings shortcut。

打开 inspector 时：

- 保留 conversation、scroll、selection 和 composer draft；
- 默认展示 summary，不自动展开 raw refs；
- 只消费当前 workspace/conversation 的 refs；
- 不拥有 artifact body、memory body、runtime/domain truth 或 owner receipt；
- 空间不足时变为 overlay/drawer，并提供明确 close 和 keyboard focus boundary。

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
- Failure 保留 typed reason、receipt/ref 和可恢复入口；不能把所有错误压成“重试”。

## 响应式与 WebUI

- Desktop 与 WebUI 保持同一产品语义；transport 和 native affordance 可以不同。
- 宽桌面保留 persistent rail；窄窗口把 rail 与 inspector 变为 drawer/overlay。
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
- Right inspector 默认关闭，打开后不破坏 conversation/draft。
- Home/chat-first 且没有 dashboard、backend/provider/permission controls。
- Model/reasoning 来自 App product profile，当前默认 `5.6 Sol / ultra`。
- Pending、elapsed、tool/process、permission、failure 和 receipt 在 turn 中可理解。
- Runtime/Settings 使用 App state/action/Control Plane，不拥有 owner truth。
- 中英文、keyboard、focus、contrast、responsive panel 均可用。
- Contract/DOM/source screenshot/package/VM/release evidence 没有跨层过度声明。
