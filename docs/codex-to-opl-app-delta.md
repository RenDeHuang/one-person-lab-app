# Codex App 到 OPL App 的产品增量

Owner: `one-person-lab-app`
Purpose: `codex_to_opl_app_delta`
State: `active_definition`
Machine boundary: 本文是人读产品增量定义。机器可读真相在 `contracts/`、源码、
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
如果以后改用 `hermes-codex`、`agui-codex` 或其他 carrier，同一增量应通过 adapter/profile 迁移，
而不是搬运 AionUI-specific product code。

当 carrier 是 Hermes Desktop 这类成熟通用桌面 Agent GUI 时，迁移策略要更保守：
先保留 upstream 的成熟功能基线，再把 OPL 增量压成清晰的定制层。OPL 不应一开始
把 Hermes 改造成一套从零设计的 App，也不应把旧 AionUI/AGUI 稳定线能力直接套上。
每个新增、隐藏或替换都要先做 Hermes 原生功能对比，并说明这个增量是 branding、
backend bridge、ordinary UI hiding、App-owned contract adoption，还是 release/runtime
gate 提升。

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
- Model selector 是普通控件，但必须由 App product profile 控制：默认选择最新、
  最强模型并显示为 `GPT-5.5（超高）`，Home 与 Codex conversation composer
  保持一致；退休模型不进入普通列表。
- Permission-mode selection 不是普通 composer UI。
- AG-UI、ACP、app-server events、adapter frames 等 raw protocol names 只在
  diagnostics 中出现。
- Generic agent marketplace 概念翻译成 App-owned Capabilities 和 packaged
  skill profiles。

这样用户看到的是 research、grant、presentation 工作，而不是 backend
orchestration。

对 Hermes Desktop 这类 upstream shell，优先级是“隐藏或收窄普通路径”，不是删除
全部上游能力。Provider、模型、Hermes Agent runtime、voice、file preview、settings、
updater 等功能如果对 OPL 普通路径不合适，先判断它们应被保留在 diagnostics /
Advanced / explicit mode、被重命名为 OPL 语义，还是暂时隐藏。只有当功能与 Codex
CLI 固定执行器、App-owned runtime truth 或 release gate 冲突时，才替换实现。

## OPL Purpose Entries

普通 App home 上的 OPL purpose entries 是 Codex 之上的入口：

| Purpose | 用户标签 | Domain | 默认 route |
| --- | --- | --- | --- |
| Research | `科研` | Med Auto Science | MAS |
| Grant | `基金` | Med Auto Grant | MAG |
| Presentation | `演示` | RedCube AI | RCA |

每个 purpose 改变 assistant context、prompt rules、skill profile、route
receipt 和 domain-specific contextual surfaces。它不改变 executor 或 backend。
`ppt` 是 App contracts、product profile 和 page-state matrix 当前稳定的内部
purpose id，路由到 RCA；普通中文界面显示 `演示`，避免把 `PPT` 放进普通用户界面。

OMA 保持 explicit 或 Settings-only，直到单独 App 产品决策让它进入普通 home。

## Skill 与 Capability 增量

Codex App 有 skills 和 tools。OPL App 增加 App-owned skill exposure policy：

- MAS/MAG/RCA 是 family domain plugin surfaces。
- 每个 purpose 有一个 required domain skill：`mas`、`mag` 或 `rca`。
- Companion skills 通过一份 App whitelist 打包，不区分来源是 AionUI、
  Skills Manager、本地 Codex skills 还是 plugin payloads。
- Settings 里的自动注入技能也必须按同一 App whitelist 过滤；AionUI
  implementation helper 如 `aionui-skills`、`aionui-webui-setup` 和
  `skill-creator` 不应作为 OPL App 普通能力显示。
- Home/new conversation 和普通会话 loaded-capability surface 使用更窄的
  `gui.ordinary_capability_selector_policy`：技能只来自 MAS/MAG/RCA assistant
  profiles，MCP 默认空白名单。未被 App profile 明确列入的 AionUI helper skill、
  auto-inject skill 或 MCP server 不进入选择器、展示或 create payload。
- Plugin packaging 是 distribution shell；`skill` 仍是 public semantic ABI。
- MAS/MAG/RCA 作为 plugins 打包时，不能再镜像成裸
  `~/.codex/skills/{mas,mag,rca}`。
- OMA 是 OPL-generated local Codex plugin surface，在提升前保持 explicit。
- Fresh install 后由 App/CLI 管理 `opl connect reconcile-modules`、`opl connect sync-skills`、
  OMA local plugin generation 和 Codex plugin registry 写入；用户不需要在
  Codex App 里重复手工安装 OPL 全部插件。
- 本地 Temporal provider 的默认地址、namespace 和 task queue 由 packaged
  runtime wrapper 配置；Temporal readiness 是 background maintenance，不阻塞
  首次进入 `/guid`。

GUI 应把这些呈现为 Capabilities 和 purpose profiles，而不是 raw filesystem 或
plugin registry。

## Runtime 与进度增量

Codex App 展示 process 和 tool state。OPL App 增加 Framework-backed runtime
和 project refs：

- Runtime 页默认从 `opl app state --profile fast --json` 读取用户任务和项目线：
  `summary_cards`、`activity_center.active_projects`、`task_drilldowns` 和
  `visual_ref_groups.active_project_refs`。
- `opl runtime app-operator-drilldown --json`、`current_control_state` 和
  `running_provider_attempt_count` 只作为高级诊断。它们可以解释底层 provider
  activity，但不能直接当成用户可见的正在运行任务数。
- Running task 只来自显式 `running`、`in_progress` 或 `advancing` status/state；
  `active_run_id` 是上下文，不是 liveness proof。
- 非运行项目线默认折叠。Queued、waiting、stopped、parked、checkpointed、
  blocked 或 attention-needed 项只在折叠区显示 count/status/next-step 摘要，
  展开后再看具体 refs。
- 来自 `opl app state` 的 current project title、domain、owner/state/stage、
  next visible step 和 blockers 作为 project progress refs 展示。
- 基于 OPL shared progress projection classifications 展示 progress：
  deliverable progress、platform repair 和 progress delta classification。
- 通过 dry-run-first App actions 触发 safe action routes。
- 按需 full Operator drilldown，用于 diagnostics。
- 在 conversation 或 runtime panel 上附加 evidence refs 和 receipt refs。
- Home 不展示运行摘要、continue-work、needs-attention/active/recent refs、
  per-assistant running badges 或底部 feedback/favorite/web 图标；这些信息进入
  Runtime 页、右侧 inspector、drawer 或其他 secondary context surface。
- `domain_lane_map.active_task_count`、`module_runtime dirty`、module readiness 和
  assistant purpose cards 不能作为 running task truth。
- AionUI upstream Team 入口不是 OPL 普通功能；普通 GUI 隐藏 Team 侧栏入口、
  禁用 Team 自动跳转和 Team deep link，兼容 `/team/*` 路由只回到 App-owned home。

Conversation 自身的工作反馈继承 Codex App 的 expectation：用户发送消息后，
pending/running 状态必须有可见等待反馈和秒数，而不是只依赖后台处理、console
trace 或 raw event stream。

OPL 的 runtime/project refs 不应把首页改造成工作台。跨项目、跨会话的
needs-attention、active、recent、queued 和 Always-On 信息进入 Runtime 页、
右侧 inspector、drawer 或其他 secondary context；只有当前 conversation turn 的
执行证据进入 chat timeline。推荐形态是 live run artifact：最近事件、tool/process
refs、permission/action receipt 和失败恢复动作随 turn 展开，完成后折叠为摘要。
这样既保留 Codex App 的即时反馈，又避免把 OPL 专用运行信息堆满普通 home。

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

Continue-work 详细列表也属于次级 surface。OPL App 可以让用户从 composer
旁边一键打开这些 refs，但不能把 needs-attention、active、recent refs 默认铺
在 ordinary home 第一屏。

在窄桌面或 WebUI 宽度下，次级 surfaces 的产品语义不变：默认仍收起，打开后
以 overlay sheet、drawer 或等价右侧浮层呈现。用户点击 context toggle 后必须
能看到 context tabs、Routing summary 和相关 refs；不能把 inspector 直接
`display:none`，也不能只改变按钮状态而不显示内容。

## 命名与语言增量

用户可见名称应该描述工作，而不是基础设施：

- 普通中文 purpose entries 使用 `科研`、`基金`、`演示`。
- 英文 UI 中对应显示 `Research`、`Grant`、`Presentation`。
- MAS/MAG/RCA 是 route receipt 和 technical refs；普通 chrome 使用
  `科研`、`基金`、`演示` 或 `Research`、`Grant`、`Presentation`。
- 中文普通首页用 `本机助手 / 自动` 作为紧凑状态，英文界面用
  `Local assistant / Auto`；`Codex CLI` 可进入二级技术详情或 diagnostics，
  不作为中文 first-screen 的主要状态文案。
- Settings 使用 "General"、"Access"、"Agents & Capabilities"、
  "Local Environment"、"Appearance"、"Advanced"、"About & Updates"。
- 普通 UI 文案避免 AG-UI、ACP、provider、backend、app-server、route id 或
  raw schema names。
- 普通 UI 支持中文/英文两套界面 copy。同一屏用户层 chrome 必须使用同一语言。
  `OPL` 和 `Codex` 可作为产品/执行器品牌保留；`Codex CLI`、`MAS`、`MAG`、
  `RCA`、命令、receipt id、路径和用户原文进入二级详情、diagnostics 或原文输出，
  不应让中文普通首页、composer、workspace rail、context inspector 或 routing
  summary 看起来像随机中英混排。
- Workspace/session rail、context inspector、context tabs 和 routing summary
  同样属于普通用户层 chrome；中文模式不能出现 `New Codex turn`、
  `Local assistant` 这类英文普通标签，英文模式也不能残留 `科研`、`基金`、
  `本机助手`、`自动` 这类中文普通标签。
- 中文普通 first screen 优先使用短标签和中文工作意图，不把 Med Auto Science、
  Med Auto Grant、RedCube AI 或 `PPT` 这类英文缩写/长名作为主要视觉文本；
  这些长名可在英文界面、details、Settings 或 diagnostics 中出现。

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
- 声称 Docker/WebUI 时，复用 desktop 同一套 renderer 和 App product profile；
  只允许 transport adapter 不同，不允许另做第二套 Web UI。
- 声称 WebUI 或窄桌面可用时，证明 context inspector 打开后不是隐藏 DOM：
  context tabs 与 Routing summary 必须实际可见。
- 在 adoption 前保持 App release shell selection explicit。
- 通过薄适配实现产品增量：profile consumer、route redirect、state/action
  bridge、局部 renderer 组合和 shell-local tests；不要把 Settings IA、
  runtime truth、model/provider policy 或 first-run gate 变成 shell-owned
  product code。

一个 shell 只有在 `contracts/app-shell-adapter.json` 被明确提升，且所有
App-owned gates 通过后，才能成为默认 release shell。

## Hermes Candidate 增量入口

`hermes-codex` 是当前最高优先级 Codex-like GUI candidate。它参考
`NousResearch/hermes-agent` 的 `apps/desktop`，许可证记录为 MIT；App repo 只把
它作为 technical verification candidate 登记在
`contracts/app-shell-candidates.json` 和
`contracts/shell-adapters/hermes-codex.json`。当前 active shell 仍是 AionUI，
Hermes 不进入默认 stable/nightly release path。

Hermes 的长期方向是 upstream-first OPL customization：先回官方 Hermes Desktop
功能基线，以 `apps/desktop` 为明确参考系，跟随其成熟 GUI、Electron packaging、
files/previews/tool output/settings、i18n 等能力，再把 OPL 的品牌、中文/英文
copy、图标、OPL App-managed first-run、模型访问 API key 配置、Codex executor
route、MAS/MAG/RCA purpose routing、runtime refs 和 release 边界作为薄 delta 接入。
Hermes 第一版只做 minimal adapter：

- Branding：用 One Person Lab App candidate 产品名、bundle id 和图标替换上游
  Hermes branding。
- Bilingual copy：跟随 Hermes i18n catalog 管理中文/英文普通 UI，不在 wrapper
  层硬编码混合语言标签。
- First-run：复用 Hermes onboarding/progress UI module，但把行为 owner 改成
  OPL App/OPL CLI。首次启动运行 `opl system initialize --json`，必要时运行
  `opl install --skip-gui-open --skip-modules --skip-native-helper-repair --json`；
  模型访问 API key 通过 `opl system configure-codex --api-key-stdin --json`
  写入，具体 key 可来自 gflabtoken，但 UI 主标题使用通用“模型访问”；
  API key 已存在时直接进入 OPL Codex adapter，startup maintenance 和 module
  reconcile 在 adapter ready 后后台执行。这里明确禁止默认下载或执行 Hermes
  Agent installer，也禁止用维护命令阻塞首次主界面。系统语言为中文时，首启
  初始化和访问配置默认显示中文。
- Icon：使用 OPL/AionUI 官方图标族，并生成带 macOS Dock safe margin 的资源；
  当前 contract 要求 1024px 图标 alpha bounds 不超过 900px，目标为
  `840x840+92+92`。
- Renderer bootstrap：fallback Codex adapter 要提供官方 Hermes renderer 启动需要的
  profile/config/session-list/cron-list 基础 JSON 形状，避免首页、侧栏和 settings
  空白；这只是默认 profile/config/empty automation 投影，不代表替换完整 Hermes
  backend。
- Executor/route adapter：新增 Codex CLI executor route，并把 MAS/MAG/RCA 作为
  Codex conversation 上的 purpose/agent route 扩展点；不全量替换 Hermes backend，
  也不接管 Hermes runtime 或 OPL runtime/domain truth。
- Build wrapper：通过
  `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/hermes-codex.json npm run package`
  走 App-root explicit candidate packaging，不进入默认 stable/nightly release
  path。

普通用户目标不是暴露一个完整 Hermes 多后端工作台，而是得到一个套壳 Codex App：
打开 workspace、开始或继续 Codex conversation、按 `科研`/`基金`/`演示` route 工作。
Hermes 的通用 agent/backend/provider 能力可以保留为 upstream 基线、Advanced 或
diagnostics，但不能抢占普通 home/chat。

App product profile generated config、`opl app state/action` bridge、
page-state/first-run matrix mapping、Full packaged runtime、stable release asset
normalization/verification、WebUI parity 都是 deferred surfaces；必须先完成 Hermes
原生功能对比，明确保留、替换或隐藏的理由，再进入 App-owned adoption gate。
但 first-run 的 owner 修正不是 deferred surface：候选包能启动进入 OPL 主界面前，
必须已经阻断 upstream Hermes Agent installer 路径，并能把缺失 API key 导向
模型访问 onboarding。

Hermes 的 WebUI parity 目标不是复制一份新前端，而是把 upstream Hermes Desktop 的
同一套 React/Vite renderer 提供给浏览器访问。Electron desktop 继续通过 preload/IPC
提供 native bridge；Docker/WebUI 需要新增 browser shim 和 Web server，把同等 bridge
映射到 HTTP/WebSocket/SSE、Codex CLI、OPL CLI 和 workspace volume。renderer、
i18n、普通信息架构和 App product profile 必须同源；差异只允许存在于 transport 和
native-only affordance 映射。功能一致指的是 OPL 产品工作流一致：chat、workspace、
files/previews、tool output、settings、route refs 和 runtime refs 语义一致；native
file picker、OS notification、window control、desktop self-update 等 OS affordance
可以映射为 Web 等价或明确不可用状态。

Hermes WebUI TODO：

- 记录 Hermes renderer 对 `window.hermesDesktop` 的依赖清单，并定义 App-owned
  browser bridge 兼容层。
- 实现容器内 Web server：静态托管 renderer，代理 Codex/Hermes gateway 请求，
  提供 Codex events stream，并连接 OPL state/action。
- 用 Docker volume/path allowlist 表达 workspace access；WebUI 不直接假设宿主机
  任意路径可访问。
- 建立 WebUI smoke：浏览器打开同一 renderer、bridge 初始化、Codex turn、workspace
  file list/preview、tool output 和核心 settings 均通过。
- 通过 App release Docker/WebUI gates 后，才能把 Hermes WebUI parity 从 deferred
  提升为候选能力。

后续任何 Hermes 能力提升都按以下顺序判断：

- **保留 upstream：** Hermes 已有且不冲突的 chat、files、preview、tool output、
  settings、onboarding、i18n、packaging 能力优先保留。
- **品牌化/命名收敛：** 产品名、图标、bundle id、普通文案和 OPL purpose labels
  由 App repo 定义。
- **首启初始化：** 使用 Hermes onboarding UI 作为承载，但动作序列来自 OPL CLI；
  不安装 Hermes Agent，不把 API key 存到 shell 私有 provider truth，不把
  startup maintenance/reconcile 放在进入主界面前同步等待。
- **隐藏普通路径不需要的概念：** provider/backend/permission/Hermes runtime 细节
  可进入 diagnostics 或 explicit mode，但不抢占 OPL 普通 home/chat。
- **必要桥接：** Codex CLI、route receipt、App state/action、runtime refs 等只有
  在对应 App contract/gate 明确后接入。
- **路由扩展而非 backend 替换：** Codex 是普通 executor route；MAS/MAG/RCA 是
  Codex 之上的 purpose/agent route，不是独立 backend choices，也不是重写 Hermes
  runtime 的理由。
- **同源 WebUI：** 复用 Hermes React/Vite renderer，通过 browser transport adapter
  提供 Docker/WebUI，而不是新建第二套 Web 前端。
- **替换实现：** 仅当 upstream 功能与 App-owned truth 冲突，或不能满足 Codex/OPL
  必需语义时才替换。

如果 `shells/hermes` 或 `../opl-hermes-shell` 不存在，Hermes candidate validation
应报告 `blocked_missing_checkout`，而不是把 contract-only evidence 说成
release-ready。

## Non-Goals

- 重建 Codex App 本身。
- 替换 Codex CLI 作为普通 executor。
- 让 MAS/MAG/RCA 成为独立 backend choices。
- 全量替换 Hermes backend 来承载 Codex/MAS。
- 把 OPL runtime/domain truth 移入 App repo。
- 把 WebUI 提升成第二个产品。
- 把外部 GUI demo 当成 source/runtime authority。
- 要求第一屏展示所有 OPL module。

## Checklist

当用户可以做到以下事项时，Codex App 形态才算变成 OPL App：

- 打开 workspace 并开始 Codex conversation。
- 选择 `科研`、`基金` 或 `演示` 作为 purpose，而不是 backend。
- 用与 Codex App 一样低摩擦的 chat flow 发送任务。
- 不离开 chat 就能看到 OPL progress、blockers、refs 和 receipts。
- 只在需要时打开 files、capabilities、memory、runtime 或 automations。
- 理解 first-run readiness 和 background maintenance。
- 获得由 App contracts 治理的 packaged release/update 行为。
- 相信 UI 声明背后有 route receipts、page-state tests、smoke evidence 或
  release artifacts 支撑。
