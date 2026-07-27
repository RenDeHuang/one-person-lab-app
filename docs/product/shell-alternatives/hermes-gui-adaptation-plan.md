# OPL Hermes GUI 改造方案

Owner: `one-person-lab-app`
Purpose: `opl_hermes_gui_adaptation_plan`
State: `active_plan`
Machine boundary: 本文是人读 GUI 改造方案。机器可读候选状态、adapter contract、
model policy、first-run gate 和 release gate 仍以 `contracts/`、源码、验证脚本、
packaged artifact 和测试输出为准。

本文把 `hermes-codex` 后续 GUI 改造收敛成一个 App-owned 方案。它不替代
[`ideal-interaction-spec.md`](../gui/ideal-interaction-spec.md)、
[`codex-to-opl-app-delta.md`](../gui/codex-to-opl-app-delta.md) 和
[`feature-inventory.md`](../gui/feature-inventory.md)，而是回答一个更
具体的问题：在 Hermes Desktop 这个成熟 upstream 基线上，哪些界面和功能应该
保留、收窄、隐藏、重命名或延后，才能最快得到一个看起来像 Codex App 换壳、
但由 OPL 控制的候选包。

当前结论：Hermes 路线继续作为 prior foreground alternative reference，采用
upstream-first OPL customization。先保留官方
Hermes Desktop 的 chat、files、preview、tool output、settings、onboarding、
i18n 和 native packaging；OPL 只在普通路径上收窄 provider/backend/runtime
概念，并补上 Codex CLI、模型访问、first-run、品牌化、简体中文/英文双语和 Codex Skill/Plugin 能力入口。
AionUI 仍是当前 release shell；`opl-native-workbench` 是当前 foreground alternative
candidate。Hermes 现阶段证据仍按 technical verification / reference replay 读取；
未切换 active-shell contract 前，它不是默认发布 shell，也不是 release-ready claim。

## 三阶段路线

Hermes prior alternative reference 的推进分三阶段。阶段顺序服务一个更窄的目标：先得到一个
可维护、chat-first、行为接近 Codex App 的 OPL wrapper，再逐步呈现 OPL 品牌能力，
最后才进入完整 OPL App product profile。阶段推进不能反过来要求当前 Hermes lane
一次性背完整 Hermes backend、AionUI release shell 或 Full OPL runtime 的责任。

| 阶段 | 定位 | 主要动作 | 明确不做 | 退出条件 |
| --- | --- | --- | --- | --- |
| Phase 1：Hermes Compatibility Firewall | 兼容性分流与 Codex adapter 补洞 | 盘点 Hermes renderer 依赖的 REST/RPC/desktop bridge/Settings/command palette；能自然映射到 Codex App 行为的实现；不能完整实现但有诊断价值的下沉到 Advanced/Diagnostics；会误导普通用户的隐藏或移除。 | 不补完整 Hermes backend；不做假成功 no-op；不把 MCP、provider、agent、profile 或 cron 管理变成第二套 truth source。 | 普通 chat、session、model access、Settings、slash Skill、附件和基础诊断路径不报错；不支持功能不会出现在普通路径或不会宣称已完整生效；source tests、candidate validation 和 VM smoke 给出 fresh evidence。 |
| Phase 2：OPL Branded Codex Experience | OPL 品牌化 Codex 体验 | 让 MAS/MAG/RCA、模型访问、首启、能力状态、诊断信息以更有品牌感和更自然的方式出现在主路径；把“科研/基金/演示”从说明页提升为清晰可用的产品入口。 | 不急着接完整 App state/action bridge、Full runtime、WebUI parity 或 release shell duties；不把领域 runtime truth 搬进 GUI。 | 用户打开 candidate 就能识别 One Person Lab Codex App；科研、基金、演示入口清楚；Skill 调用链稳定；能力缺失、模型访问缺失和诊断状态讲人话。 |
| Phase 3：Full OPL Product Profile | 完整 OPL App 目标形态 | 接入 App-owned product profile、page-state matrix、first-run matrix、runtime bridge、release gates、packaged/VM/WebUI evidence，并在需要时评估 Hermes 是否替代 AionUI 成为默认 shell。 | 不用 docs-only、focused tests 或 candidate smoke 替代 release promotion；不在未切换 active shell contract 时声称 Hermes 是默认发布 shell。 | Hermes 被正式纳入 active shell adoption 决策；App-owned contracts、page-state、first-run、runtime bridge、packaged smoke、VM evidence、WebUI claim 和 release gates 齐全。 |

Phase 1 的核心不是“尽量实现所有 Hermes Desktop 功能”，而是给 Hermes 前端建立
兼容性防火墙。每个 upstream 功能必须落入以下四类之一：

| 分类 | 处理规则 | 例子 |
| --- | --- | --- |
| `implement` | 与 Codex App-like OPL 普通路径一致，补 adapter 或 UI。 | chat session、`prompt.submit` ack/event stream、gflabtoken 模型访问、`/mas` `/mag` `/rca` slash。 |
| `adapt` | upstream 有入口，但必须改成 Codex/OPL 语义。 | Settings provider 面改成“模型访问”；MCP reload 改成 adapter diagnostics；Agents 管 package lifecycle，Capabilities 管 Skill/Plugin/Flow 状态与调用说明。 |
| `diagnostic_only` | 工程排障有价值，但普通用户不应以为这是主能力。 | raw MCP config、gateway logs、unsupported backend route readback、advanced config JSON。 |
| `hide_or_remove` | 当前无法实现、会误导用户，或会创建第二 truth source。 | provider marketplace、OAuth accounts、自定义 Base URL、完整 Hermes MCP manager、Hermes Agent installer、普通路径 backend selector。 |

Phase 1 的状态只按当前 owner surface 读取。`source tests passed` 能证明对应 source
行为，`candidate validation passed` 能证明候选边界，`packaged smoke passed`
能证明当前包的 fixture 路径，`VM smoke passed` 只能证明该候选包在该 VM cohort
中执行了 smoke；它们都不能单独证明 release-ready、domain-ready、artifact-ready
或 Hermes 已成为默认 shell。具体 run metadata、VM 名称、绝对路径、截图和 dated pass/fail
记录属于 candidate artifacts、shell artifacts、CI logs、release evidence 或
`docs/history/process/` provenance。

## App-owned 目标态

Hermes prior foreground alternative reference 的 App-owned 目标态已经由本仓固化，而不是由
`/Users/gaofeng/workspace/opl-hermes-shell` 或 upstream Hermes roadmap 定义：

- 默认发布 shell 仍是 AionUI。Hermes 只通过
  `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/hermes-codex.json`
  进入 explicit candidate build；不修改 `contracts/app-shell-adapter.json` 前不能成为
  Stable、Dev 或 Nightly release shell。当前 Automated Nightly Preview 仍使用
  AionUI active adapter；移动 Latest pointer 不改变 shell role。
- 普通体验是 chat-first Codex App-like shell。第一屏以 workspace-aware chat、
  conversation timeline 和 composer 为中心；workspace rail、runtime refs、files、
  capabilities、memory、automations 和 diagnostics 都是可收起上下文，不回到 dashboard。
- 普通 executor 只走 Codex app-server gateway。App-owned adapter contract 要能表达
  `codex app-server --listen stdio://`、`thread/start`、`turn/start`、
  `item/agentMessage/delta`、`turn/completed`，并禁止把 Hermes Agent installer、
  provider-selected backend 或 AionUI backend 当成普通 chat executor。
- 模型访问只用 gflabtoken API key。普通 UI 只暴露模型访问状态和 API key；底层可继续
  写 `OPENAI_API_KEY` 兼容 Codex/OpenAI-compatible 配置，但普通 UI 不暴露
  `OPENAI_BASE_URL`、OAuth provider accounts、provider marketplace、自定义 provider key
  或第二个 `auto` 模型 id。
- MAS/MAG/RCA 是 Codex Skill/Plugin 能力入口：`$mas`、`$mag`、`$rca`。Hermes
  普通界面可以展示 composer Skill shortcuts，以及 Settings 中分离的“智能体”和“能力”摘要，但不能
  只藏在 Settings。chat-first home 必须可见 One Person Lab 品牌，并以轻量 chip 露出
  科研/MAS、基金/MAG、演示/RCA 入口；点击入口只把显式 Skill prompt 写入下一条普通
  prompt。是否加载 MAS/MAG/RCA、下层如何调用 CLI/MCP/工具，必须由 Codex runtime
  通过已安装 Skill/Plugin/MCP 机制决定。GUI adapter 不做关键词识别、不直接执行
  `opl start`、不做 `workspace_ensure` dry-run、不注入 route receipt。runtime truth、
  domain truth、artifact authority 和 quality verdict 仍归 OPL Framework 与各 domain repo。
- Settings 必须 OPL 化。普通 tab 收敛为 Overview、Setup & Access、Capabilities、
  Maintenance & Updates、Data & Storage、Preferences、Advanced，并对应“总览、设置与访问、
  能力、维护与更新、数据与存储、偏好、高级”。About、Update、Theme 只作为 secondary
  surfaces。Hermes backend、
  provider marketplace、OAuth accounts、custom Base URL、remote backend、Hermes memory
  provider 和 raw gateway state 只能进 Advanced/Diagnostics 或隐藏。
- 视觉门槛不低于 AionUI active release shell。Hermes 不能只因为用了 Codex app-server
  或 contract 通过就算 GUI 可用；chat reading lane、composer、Settings、首启和 packaged
  smoke 截图至少要与 AionUI baseline 对比，且不能出现明显更低的可读性、密度、层级或空白页。

## 当前缺口口径

本文只保留 Hermes prior foreground alternative reference 的目标态、功能/结构读法和后置证据 owner。
Contract、source tests、packaged smoke、Settings visual smoke、VM smoke 和 live Codex
app-server smoke 可以证明各自覆盖的 candidate 边界；它们不能单独证明视觉不低于 AionUI、
release promotion、MAS/MAG/RCA domain ready、artifact ready 或 quality verdict。

具体 smoke run、绝对路径、VM 元数据、截图和 dated pass/fail 记录属于 candidate
manifests、shell artifacts、CI logs、release evidence 或 `docs/history/process/`；
active plan 不维护第二份 candidate evidence ledger。

## 目标体验

Hermes prior foreground alternative reference 的目标不是“完整 Hermes 工作台加 OPL 插件”，而是 Codex App-like
OPL thin shell：

- 打开后进入 workspace-aware chat，而不是 dashboard、provider marketplace 或
  Hermes Agent installer。
- 普通 executor 固定为 Codex CLI / Codex app-server；用户不选择 backend。
- 模型选择显示为 App-owned 策略：`Auto` 表示跟随 OPL/Codex 推荐的最新最强模型，
  当前有效模型是 `5.6 Sol` + `max`。`auto` 不是持久模型 id，也不进入 provider
  model list。
- 模型访问只配置 gflabtoken API key。底层 env 名可继续是 `OPENAI_API_KEY`，这是
  Codex/OpenAI-compatible 配置兼容名，不代表普通 UI 开放 OpenAI-compatible
  provider、自定义 Base URL、OAuth provider 或其它供应商 key。
- Settings 只把普通用户必须理解的面展示为 OPL 语义；Hermes backend、provider、
  gateway、memory store、remote terminal backend、OAuth marketplace 等概念进入
  Advanced、Diagnostics 或暂不暴露。
- 主界面保持 chat-first。Runtime、Files、Capabilities、Memory、Automations 等
  信息进入可收起 context surface，不回到第一屏工作台。

## 首启与启动边界

Hermes candidate 复用 upstream checklist/onboarding 组件，但不复用 upstream Hermes
Agent installer 语义，也不把所有启动工作合并成一个 first-run gate。当前口径按
[`hermes-first-run-flow.md`](hermes-first-run-flow.md) 拆成四条流程：

- 每次启动轻量检查：每次 launch 只做 marker、核心组件、Codex/OPL CLI、`opl app state
  --profile fast --json` 模型访问探测和 adapter startup 路由检查；热启动不能同步跑
  full `opl system initialize --json` 阻塞主界面。
- 一次性本机初始化：只在 fast app state 不能证明 Codex/模型访问状态、marker 过旧且
  探测失败、或核心组件缺失时显示 Hermes checklist UI，并只等待 Core launch
  readiness。marker 缺失本身不等于要进入初始化页；已安装机器应先轻量探测，成功后
  补写 marker 并进入主界面。
- 可跳过首启准备：Hermes checklist 可以继续承载真实准备任务，但在 Codex CLI /
  Codex adapter 可用时必须允许用户“跳过并进入对话”。跳过只写入 `user_deferred`
  启动 marker，不伪造模型访问、module readiness、MAS/MAG/RCA domain readiness 或
  Full readiness；剩余任务转入 Settings/Diagnostics 与后台维护。
- 模型访问配置：作为单独“模型访问”向导，只处理 gflabtoken API key / 模型访问；
  它不是本机初始化 checklist 的一个安装 stage。
- 后台 OPL 状态刷新：full OPL status/readback 在 Codex adapter ready 和主界面可见
  之后异步运行，结果进入 Runtime/Diagnostics，不阻塞 chat-first 主界面。

## 当前必须落地的普通路径

| Surface | OPL 语义 | 当前目标行为 |
| --- | --- | --- |
| 主模型显示 | 模型策略 | 主按钮显示 `5.6 Sol 极高`；自动状态由菜单中的“自动（推荐）”选中态表达，不显示第二个 `Auto` 模型选项。 |
| 模型设置 | 模型策略 | 只展示当前 OPL/Codex 有效模型和推理强度。辅助任务默认跟随主模型，不提供独立 provider 槽位作为普通能力。 |
| Provider 设置 | 模型访问 | 改名为“模型访问”。只显示 gflabtoken API key。 |
| `/api/env` | 模型访问目录 | 普通路径只返回 `OPENAI_API_KEY`。拒绝 `OPENAI_BASE_URL` 和其它 provider key 写入。 |
| Home wordmark | 品牌化 | 首屏 wordmark 必须是 `One Person Lab`，不能显示 `HERMES AGENT` 或其它 upstream 产品名。 |
| Home Skill chips | 智能体入口 | 第一屏在 intro/composer 附近显示轻量 `科研/MAS`、`基金/MAG`、`演示/RCA` Skill chips。点击 chip 将 `$mas`、`$mag`、`$rca` 显式 Skill prompt 插入 composer，让普通用户能直接提示 Codex 使用内置智能体能力。 |
| Slash Skill shortcuts | Codex Skill 入口 | `/mas 任务`、`/mag 任务`、`/rca 任务` 是 GUI slash shortcut，执行时转换为 `$mas 任务`、`$mag 任务`、`$rca 任务` 普通 prompt，再交给 Codex app-server 的 Skill 机制。GUI 不做关键词 route，不执行 MAS/MAG/RCA CLI。 |
| 启动流程 | OPL 启动分流 | 轻量检查每次运行；marker 缺失/过旧先做 fast app state readiness probe，只有 probe 失败或核心缺失才使用本机初始化 checklist；模型访问配置单独处理 gflabtoken API key；full OPL status refresh 后台异步。 |
| 语言 | 双语 UI | 中文系统默认简体中文；普通 UI 同屏不混用中英文。新增 copy 进入 Hermes i18n catalog；繁体中文和日文不维护。 |

## Settings 信息架构

Hermes 官方 Settings 很完整，但它是通用 Agent Desktop 的设置。OPL 普通路径要按
Codex App-like 心智重命名和收窄：

| Settings 面 | 保留方式 | OPL 调整 |
| --- | --- | --- |
| 模型策略 | 保留并收窄 | 表达 Auto 策略、当前模型和推理强度。当前不开放多 provider 自由切换。 |
| 对话 | 保留 | 只保留与 chat 行为有关的显示、reasoning、image input 等。避免露出 backend 概念。 |
| 外观与语言 | 保留 | 作为简体中文/英文切换、主题和视觉密度入口。 |
| 工作区/终端 | 保留但降噪 | 普通路径只展示 cwd、本机执行和必要 limits；Docker/SSH/Modal/Daytona 等 remote backend 默认隐藏或进 Advanced。 |
| 安全/审批 | 保留但用 OPL 文案 | 解释为本机执行权限、审批提示和安全约束，不作为普通 composer 控件。 |
| 记忆与上下文 | 延后提升 | 只有接入 OPL memory refs 后再作为普通能力；Hermes memory provider 不作为 OPL authority。 |
| 模型访问 | 保留并重写 | 只显示 gflabtoken API key；不显示 OAuth accounts、provider marketplace、OpenAI-compatible Base URL 或其它 provider key。 |
| 工具与密钥 | 保留为空态/诊断 | 只显示真实可配置且有 owner 的工具密钥；不要为了填满页面伪造 keys。 |
| 智能体 | OPL 新增 package 目录摘要 | 消费公共 Agent Package directory，管理 lifecycle、开发来源与 Home visibility；不得从本地 Skill 列表推断 package 状态。 |
| 能力 | OPL 新增能力摘要 | 展示 Codex 当前发现的 Skills/Plugins/Flow/MCP 等能力、调用格式和 authority boundary；不得聚合 Gateway 或 Resources 状态。 |
| MCP / Capabilities | 后续接入 | 接入 App-owned skill/capability whitelist 后再提升；不展示 raw helper skills。 |
| 连接诊断 | 保留为诊断 | Gateway、unsupported backend routes、raw bridge 状态只进 diagnostics。 |
| 关于与更新 | 保留 | 品牌、版本、候选状态、upstream ref 和 release shell 边界清楚显示。 |

## 保留、隐藏、替换

**保留 upstream：**

- Chat-first 主 frame、conversation timeline、composer、files/previews、tool output。
- Settings overlay、onboarding/progress 组件、i18n catalog、Electron packaging。
- 官方 renderer 的基础数据形状，但由 OPL adapter 提供 renderer-safe bootstrap。

**普通路径隐藏或收窄：**

- Provider marketplace、OAuth provider accounts、自定义 Base URL、OpenAI-compatible
  自由 provider 配置。
- Hermes Agent installer、Hermes backend/runtime 选择、remote terminal backend、
  voice/provider store、Hermes memory provider、generic delegation/subagent knobs。
- Raw JSON-RPC、Codex app-server protocol、AG-UI/ACP 等实现名。

**必要替换：**

- 启动行为 owner：从 Hermes Agent installer 替换为 OPL 启动分流；每次启动轻量
  检查、本机初始化 checklist、模型访问向导和后台 OPL 状态刷新分别处理。marker
  缺失或过旧不能单独触发 full initialize；必须先用 fast app state probe 判断是否
  已经可进入主界面。首启准备页必须有可跳过入口：当 Codex 下限可用但 OPL 维护、
  网络或模块同步耗时时，用户可以先进入 chat-first 主界面，剩余准备在后台/诊断页继续。
- Executor：普通 chat 接 Codex app-server adapter，而不是 Hermes Agent 默认后端。
- 模型访问：从 provider/OAuth 心智替换为 One Person Lab 模型访问。

**已接入能力与证据边界：**

- MAS/MAG/RCA 的 Codex Skill catalog、`/mas` `/mag` `/rca` slash shortcuts 和
  Settings 中分离的“智能体”和“能力”摘要已经进入 App-owned 目标态。可接受证据应来自
  Hermes source/unit tests、candidate manifests、packaged smoke 或 live app-server
  readback，并证明 GUI 只把显式 Skill prompt 交给 Codex Skill/Plugin 机制；GUI 不做
  关键词 route，不产生 GUI 侧 route receipt/error，也不直接调用 OPL/MAS CLI。
- Packaged smoke、Settings visual smoke、VM smoke 和 live Codex app-server smoke 都是
  candidate evidence，各自只证明对应 run 覆盖的启动、设置、Skill input、事件流或
  visual surface。具体 run metadata、截图和日志留在 artifact owner 中；本文不维护
  dated smoke ledger。
- 这些证据仍不能证明 release readiness、domain runtime ready、artifact ready 或
  quality verdict。相关结论必须继续来自 App release gates、OPL Framework、
  MAS/MAG/RCA domain repo 和它们的 owner receipt/readback。

**仍然延后提升：**

- Runtime refs 的完整展示、OPL App state/action 全量 bridge、WebUI parity、Full packaged
  runtime、stable release gates。
- 这些能力必须有 Hermes 原生功能对比、App-owned contract/gate 和 runtime/packaged evidence，
  不能把 AionUI 主线能力或 AGUI archived proof 直接搬进 Hermes。

## 视觉与交互方向

Hermes prior alternative reference 后续视觉优化要继续逼近 Codex App，而不是重新做工作台：

- 第一屏保持中心 chat reading lane 和底部多行 composer，默认不打开复杂 inspector。
- 第一屏 intro 只允许轻量品牌和 Skill chips；MAS/MAG/RCA 入口必须靠近 composer，
  但不能扩展成 dashboard、工作台或解释性 landing page。
- Composer 是主视觉锚点：多行、高度充足、轻 outline、统一圆角，不出现圆角输入框
  后面又露出白色矩形底板。
- 控件比例、间距和字体按 macOS / Codex App-like quiet utility 方向收敛：更少方块、
  更柔和层级、更清楚的主次。
- Header、model status、workspace path 和 skill tag 作为辅助信息，不抢 conversation。
- Settings 信息密度可以高于首页，但分组必须清晰，空态必须解释“当前无 OPL 可配置项”，
  不能像功能坏了。

## 验收口径

Hermes prior alternative reference 只能在以下证据齐备时声称“基本可用”：

- 启动不进入 Hermes Agent installer。
- 热启动不跑 full initialize 作为阻塞 gate；已配置 API key、marker 新鲜且核心存在时
  自动进入主界面。
- 缺 key 时进入 OPL 模型访问 onboarding，不显示本机安装 checklist。
- 用户在 checklist 中选择跳过时，首启遮罩关闭并进入 chat-first 主界面；gateway
  报告 `onboarding_deferred`，但 `/api/env` 仍显示 gflabtoken API key 未配置。
- marker 缺失但 fast app state 已证明 Codex/模型访问可用时，不显示 OPL 本机初始化
  checklist，只补写 marker 并进入主界面。
- marker 过旧且 fast app state 无法证明 readiness，或核心组件缺失时，才显示 OPL
  本机初始化 checklist。
- 全新安装或 VM smoke 记录轻量检查、本机初始化、模型访问、adapter startup 和后台
  OPL status refresh 的阶段耗时。
- 主界面可创建 session、发送 Codex turn，并展示 assistant response。
- 长回复不会因为 renderer JSON-RPC 默认 30 秒 timeout 而中途显示“提示词发送失败”；
  `prompt.submit` 必须先 ack，后续 delta/complete 通过事件流进入 UI。
- 旧 session 中遗留的 `Opl route` / `OPL purpose route receipt` 不得继续出现在普通
  对话内容中，也不得再次送入 Codex。
- 主界面首屏 wordmark 是 `One Person Lab`，不得显示 `HERMES AGENT`；科研/MAS、
  基金/MAG、演示/RCA chips 必须可见且点击后能写入 composer Skill prompt。
- `/` 命令面板必须能发现 `/mas`、`/mag`、`/rca`；执行后应转成 `$mas`、`$mag`、
  `$rca` prompt，由 Codex Skill/Plugin 机制接管。
- 主模型列表不包含 `auto` 模型 id；Auto 只作为策略显示。
- Settings 的“模型访问”只显示 gflabtoken API key，且拒绝 Base URL / 其它 provider key。
- Settings 关键页面不因 adapter 缺少 renderer-safe shape 而空白。
- 中文系统普通 UI 使用中文，新增 copy 来自 i18n catalog。
- App-root explicit candidate wrapper 能打包候选 `.app`；默认 AionUI release shell 不变。
- macOS candidate bundle 必须使用 OPL branded executable：
  `Contents/MacOS/One Person Lab Hermes Candidate`，不能继续暴露
  `Contents/MacOS/Electron`。这一点由 Hermes 自身
  `npm run validate:candidate -- --require-app` 和 App root candidate manifest validator
  同时检查。

这不是 release promotion。Hermes 成为默认 release shell 仍必须更新
`contracts/app-shell-adapter.json`，并通过 page-state、first-run、product profile、
runtime bridge、packaged smoke、WebUI claim 和 release gates。

## 功能/结构缺口清单

本文和 contract 只固化目标态。Live / VM / release / owner evidence 是后置证据 owner
的职责，不在本表累积百分比。

| 条目 | 当前功能/结构状态 | 目的 | 剩余功能/结构缺口 | 后置证据 owner |
| --- | --- | --- | --- | --- |
| App-owned Hermes 目标态 | Contract / docs owner 已明确。 | 让 Hermes prior reference 受 App product truth 约束，而不是受 upstream roadmap 或 shell-local state 约束。 | 目标态变化时先改 App-owned contract/docs，再改 shell。 | Candidate validators and shell artifacts. |
| 默认 release shell 仍是 AionUI | Active shell contract 仍指向 AionUI；Hermes 是 prior foreground alternative reference，当前 foreground alternative 是 `opl-native-workbench`。 | 防止 candidate work 被误读成默认发布 shell 切换。 | Hermes promotion 需要单独 adoption decision 和 active-shell contract change。 | Release owner records, release artifacts, release validators. |
| Foreground alternative app bundle identity | OPL branded candidate bundle identity 已纳入 candidate contract/readback 要求。 | 避免候选包仍暴露 generic Electron identity。 | 后续若 packaging 机制变化，保留等价 bundle identity gate。 | Candidate manifests and package validation artifacts. |
| Codex app-server gateway | 目标 gateway 和事件流边界已定义。 | 让普通 chat 走 Codex app-server，而不是 Hermes backend/provider selector。 | 继续补齐 tool / approval / error bridge 和长 turn 稳定性。 | Source tests, packaged smoke, live app-server readback. |
| gflabtoken-only 模型访问 | 普通模型访问目标已收敛到 gflabtoken/API key。 | 避免 provider marketplace、Base URL、OAuth 和多 provider 设置成为普通用户路径。 | Settings 深层仍需持续按普通路径 / Advanced / 隐藏分级处理。 | Renderer tests, Settings visual smoke, real user credential readback. |
| MAS/MAG/RCA Codex Skills | 目标已切到 Skill-first composer / slash / explicit prompt。 | 防止 GUI 重建 purpose-route truth source 或直接执行 domain CLI。 | 继续确保 shell 不恢复关键词路由、GUI route receipt 或 domain CLI direct call。 | Packaged / live Skill readback; domain owner evidence for domain claims. |
| Settings OPL 化 | Ordinary IA 已定义，仍需逐页跟进 upstream 通用 Agent 设置残留。 | 让 Settings 表达 App control center，而不是 Aion/Hermes generic backend manager。 | 深层远程网关、高级能力和通用 Agent 文案继续分流到 Advanced/Diagnostics 或隐藏。 | Active-shell validation and Settings visual QA manifest. |
| 首启四线模型 | 轻量检查、一次性初始化、模型访问、后台刷新已形成目标模型。 | 防止 full initialize 或后台维护挡住 chat-first 入口。 | 持续防回归：marker/fast probe/user-deferred/缺 key/热启动路径不能混淆。 | First-run matrix, packaged/VM smoke artifacts, real model access readback. |
| 视觉不低于 AionUI | 方向和门槛已写入 product/docs。 | 防止只有 protocol 可用但 GUI 体验倒退。 | 仍需 desktop、Settings、首启 packaged screenshot 对比和视觉接受。 | Visual QA screenshots, release/candidate artifacts, owner acceptance. |
| Hermes release promotion | 未进入默认发布 shell。 | 保持 reference candidate 与 release shell 分离。 | 需要 active shell contract 切换、page-state、first-run、product profile、runtime bridge、packaged smoke、WebUI 和 release gates 一起通过。 | Release owner decision, release artifacts, release validators. |
