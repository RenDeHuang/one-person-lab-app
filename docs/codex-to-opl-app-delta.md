# Codex App 到 OPL App 的产品增量

Owner: `one-person-lab-app`
Purpose: `codex_to_opl_app_delta`
State: `active_definition`
机器边界：本文是人读产品增量定义。机器可读真相在 `contracts/`、源码、
发布产物、updater metadata 和测试输出中。

本文定义 One Person Lab App 在 Codex App 用户交互模型之上追加的内容。它
回答一个产品问题：一个 Codex App 形态的 shell，需要新增、隐藏、改名和治理
哪些内容，才会成为 OPL App。

## 基础 App 假设

基础交互是 Codex App：

- 选择 workspace。
- 开始或继续 chat。
- 向 Codex 发送指令。
- 流式展示 assistant output 和 tool/process progress。
- 查看 refs、diffs、command output、files 和 user-input prompts。
- 主 surface 保持 chat-first。

OPL App 应保留这些预期。下面的增量把 Codex App 专门化为 OPL family 产品，
同时不把它变成通用 dashboard。

这些增量属于 App 产品层，不属于 AionUI fork 的永久产品分叉。落地顺序是：
先在 App contract/profile/matrix 中定义增量，再让 active shell 做薄适配。
如果以后改用 `agui-codex` 或其他 carrier，同一增量应通过 adapter/profile 迁移，
而不是搬运 AionUI-specific product code。

## 增量摘要

OPL App 增加五层产品能力：

- OPL purpose routing：把 MAS、MAG、RCA 作为内置 purpose entries。
- OPL domain skill profiles：每个 purpose 带一个 required domain skill 和
  相关 companion skills。
- OPL runtime bridge：把 Framework-owned state/action/read-model surfaces
  展示为 refs、progress、receipts、blockers 和 safe actions。
- OPL installation 与 release policy：App-owned packaging、first-run、
  updater/Full first-install 分离，以及 agent exposure contracts。
- OPL evidence 与 authority boundaries：route receipts、release evidence、
  screenshot evidence，以及严格不拥有 runtime/domain truth。

## 继承 Codex App 的行为

这些基础行为仍是产品要求：

- Workspace-first conversations。
- Chat-first ordinary home。
- Composer 固定在 work surface 底部。
- 运行状态和 stop affordance 可见。
- Conversation-local refs 展示 files、diffs、tools、process output 和 prompts。
- 右侧或弹出 context surfaces 作为次级上下文。
- New conversation 和 recent conversation 工作流。
- Keyboard-centric operation。
- 技术细节按需可见，而不是提前暴露。

如果 shell implementation 在增加 OPL 功能时削弱了这些 Codex-like 行为，它就
偏离了目标。

## 从通用 Agent UI 中隐藏或重构

OPL App 隐藏或重构通用 agent app 控件：

- 普通路径隐藏 executor selection；Codex CLI 是固定 executor。
- 普通路径隐藏 backend 和 provider selection。
- Model override list 不是普通控件；model status 自动展示。
- Permission-mode selection 不是普通 composer UI。
- AG-UI、ACP、app-server events、adapter frames 等 raw protocol names 只在
  diagnostics 中出现。
- Generic agent marketplace 概念翻译成 App-owned Capabilities 和 packaged
  skill profiles。

这样用户看到的是 research、grant、presentation 工作，而不是 backend
orchestration。

## OPL Purpose Entries

普通 App home 上的 OPL purpose entries 是 Codex 之上的入口：

| Purpose | 用户标签 | Domain | 默认 route |
| --- | --- | --- | --- |
| Research | `科研` | Med Auto Science | MAS |
| Grant | `基金` | Med Auto Grant | MAG |
| Presentation | `PPT` | RedCube AI | RCA |

每个 purpose 改变 assistant context、prompt rules、skill profile、route
receipt 和 domain-specific contextual surfaces。它不改变 executor 或 backend。

OMA 保持 explicit 或 Settings-only，直到单独 App 产品决策让它进入普通 home。

## Skill 与 Capability 增量

Codex App 有 skills 和 tools。OPL App 增加 App-owned skill exposure policy：

- MAS/MAG/RCA 是 family domain plugin surfaces。
- 每个 purpose 有一个 required domain skill：`mas`、`mag` 或 `rca`。
- Companion skills 通过一份 App whitelist 打包，不区分来源是 AionUI、
  Skills Manager、本地 Codex skills 还是 plugin payloads。
- Plugin packaging 是 distribution shell；`skill` 仍是 public semantic ABI。
- MAS/MAG/RCA 作为 plugins 打包时，不能再镜像成裸
  `~/.codex/skills/{mas,mag,rca}`。
- OMA 是 OPL-generated skill surface，在提升前保持 explicit。

GUI 应把这些呈现为 Capabilities 和 purpose profiles，而不是 raw filesystem 或
plugin registry。

## Runtime 与进度增量

Codex App 展示 process 和 tool state。OPL App 增加 Framework-backed project
state：

- 来自 `opl app state` 的 current project title、domain、owner/state/stage、
  next visible step 和 blockers。
- 基于 OPL shared progress projection classifications 展示 progress：
  deliverable progress、platform repair 和 progress delta classification。
- 通过 dry-run-first App actions 触发 safe action routes。
- 按需 full Operator drilldown，用于 diagnostics。
- 在 conversation 或 runtime panel 上附加 evidence refs 和 receipt refs。
- Home input 附近的轻量 continue-work activity center，来自 refs-only OPL
  operator projections，展示 needs-attention、active、recent projects。

GUI 应让当前工作可理解，但不能声称 domain truth。例如 platform repair 显示为
infrastructure repair，而不是 manuscript 或 deliverable progress。

## Evidence 增量

OPL App 增加普通 Codex App 不需要的证据要求：

- Built-in assistant selection 创建 route receipts。
- Packaged GUI route smoke 必须证明 MAS/MAG/RCA entries 和 receipts。
- Release evidence 必须保持 cohort-bound。
- First-run evidence 必须区分 Core launch readiness 与 Full maintenance。
- Screenshot evidence 只证明产品 evidence，不证明 domain readiness。
- App/operator read-model refs 是 display refs，不代表 ownership transfer。

GUI 应用用户能理解的语言展示 receipts 和 refs；raw release 与 validation
artifacts 留在 release/evidence surfaces。

## First-Run 与安装增量

Codex App 假设本机已有可用 Codex 环境。OPL App 增加产品化安装与维护：

- Core launch gate：workspace root、Codex CLI 和 Codex config。
- Full readiness：domain modules、family runtime provider、recommended skills、
  native helpers、repo sync、CLT、companion skills 和 ecosystem updates。
- Standard updater assets 与 Full first-install assets 分离。
- Full first-install 可为干净机器携带 bundled runtime payloads。
- Settings 在 launch 后继续 background maintenance。
- Agent installation/exposure policy 通过 App-owned contracts 验证。

用户应该能先打开 App，并理解还剩什么维护事项，而不是被迫先走 terminal-first
setup narrative。

## Context Surface 增量

OPL App 增加 domain-aware context panels：

- Files：workspace refs、artifacts、deliverable refs 和 generated outputs。
- Runtime：current stage、blocker、next action、run state 和 receipts。
- Capabilities：active purpose skill、required skill status、companion skills。
- Memory：memory refs 和 summaries，永不展示 raw memory body authority。
- Automations：Always-On work、scheduled checks 和 long-running owner refs。
- Settings：App-owned release、runtime、access、capabilities 和 appearance state。

所有这些都是次级 surfaces。Chat canvas 仍是主面。

## 命名与语言增量

用户可见名称应该描述工作，而不是基础设施：

- 普通 purpose entries 使用 `科研`、`基金`、`PPT`。
- MAS/MAG/RCA 可作为紧凑 route tags 和 technical refs。
- 用 "Codex CLI / Auto" 作为紧凑状态，而不是配置表单。
- Settings 使用 "General"、"Access"、"Agents & Capabilities"、
  "Local Environment"、"Appearance"、"Advanced"、"About & Updates"。
- 普通 UI 文案避免 AG-UI、ACP、provider、backend、app-server、route id 或
  raw schema names。

技术标签可以出现在 diagnostics、logs、validation evidence 或 developer docs。

## 模块映射

OPL-specific GUI modules：

| Module | App 角色 | Authority owner |
| --- | --- | --- |
| Purpose router | MAS/MAG/RCA purpose selection 和 route receipts | App contract 消费 Framework/domain ids |
| Chat bridge | Codex turns、streaming、prompts 和 refs | App contract 下的 Codex/App shell implementation |
| Runtime panel | Summary、progress、blockers、safe actions | OPL Framework read models/actions |
| Capability panel | Purpose skill profiles 和 packaged companion skills | App install/exposure contract 加 domain skills |
| Files/artifacts panel | Workspace refs 和 artifact refs | Domain/runtime artifact owners |
| Memory panel | Memory refs 和 summaries | Domain/runtime memory owners |
| Automations panel | Always-On 和 scheduled work refs | Framework/domain automation owners |
| First-run | Core readiness 和 Full maintenance state | App first-run contract 加 Framework installer surfaces |
| Release/update | Stable/nightly/Full assets 和 evidence | App release contracts 和 artifacts |
| Settings | App-owned product configuration surfaces | App contract，消费 runtime refs |

## Shell 采纳规则

一个 shell 成为 OPL App candidate，需要满足：

- 保留 Codex App-like chat-first 行为。
- 增加 OPL purpose routing，且不暴露 backend selection。
- 消费 App product profile 和 runtime bridge contracts。
- 把 OPL context panels 实现为默认收起的 secondary surfaces。
- 证明 page-state 和 first-run matrices。
- 证明 source 和 packaged UI smoke。
- 声称 WebUI 时证明 WebUI parity。
- 在 adoption 前保持 App release shell selection explicit。
- 通过薄适配实现产品增量：profile consumer、route redirect、state/action
  bridge、局部 renderer 组合和 shell-local tests；不要把 Settings IA、
  runtime truth、model/provider policy 或 first-run gate 变成 shell-owned
  product code。

一个 shell 只有在 `contracts/app-shell-adapter.json` 被明确提升，且所有
App-owned gates 通过后，才能成为默认 release shell。

## Non-Goals

- 重建 Codex App 本身。
- 替换 Codex CLI 作为普通 executor。
- 让 MAS/MAG/RCA 成为独立 backend choices。
- 把 OPL runtime/domain truth 移入 App repo。
- 把 WebUI 提升成第二个产品。
- 把外部 GUI demo 当成 source/runtime authority。
- 要求第一屏展示所有 OPL module。

## Checklist

当用户可以做到以下事项时，Codex App 形态才算变成 OPL App：

- 打开 workspace 并开始 Codex conversation。
- 选择 `科研`、`基金` 或 `PPT` 作为 purpose，而不是 backend。
- 用与 Codex App 一样低摩擦的 chat flow 发送任务。
- 不离开 chat 就能看到 OPL progress、blockers、refs 和 receipts。
- 只在需要时打开 files、capabilities、memory、runtime 或 automations。
- 理解 first-run readiness 和 background maintenance。
- 获得由 App contracts 治理的 packaged release/update 行为。
- 相信 UI 声明背后有 route receipts、page-state tests、smoke evidence 或
  release artifacts 支撑。
