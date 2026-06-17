# OPL Hermes GUI 改造方案

Owner: `one-person-lab-app`
Purpose: `opl_hermes_gui_adaptation_plan`
State: `active_plan`
Machine boundary: 本文是人读 GUI 改造方案。机器可读候选状态、adapter contract、
model policy、first-run gate 和 release gate 仍以 `contracts/`、源码、验证脚本、
packaged artifact 和测试输出为准。

本文把 `hermes-codex` 后续 GUI 改造收敛成一个 App-owned 方案。它不替代
[`app-ideal-gui-interaction-spec.md`](app-ideal-gui-interaction-spec.md)、
[`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md) 和
[`app-gui-feature-inventory.md`](app-gui-feature-inventory.md)，而是回答一个更
具体的问题：在 Hermes Desktop 这个成熟 upstream 基线上，哪些界面和功能应该
保留、收窄、隐藏、重命名或延后，才能最快得到一个看起来像 Codex App 换壳、
但由 OPL 控制的候选包。

当前结论：Hermes 路线继续采用 upstream-first OPL customization。先保留官方
Hermes Desktop 的 chat、files、preview、tool output、settings、onboarding、
i18n 和 native packaging；OPL 只在普通路径上收窄 provider/backend/runtime
概念，并补上 Codex CLI、模型访问、first-run、品牌化、简体中文/英文双语和后续 purpose route。
AionUI 仍是 release shell；Hermes 仍是 explicit technical verification candidate。

## App-owned 目标态

Hermes candidate 的 App-owned 目标态已经由本仓固化，而不是由
`/Users/gaofeng/workspace/opl-hermes-shell` 或 upstream Hermes roadmap 定义：

- 默认发布 shell 仍是 AionUI。Hermes 只通过
  `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/hermes-codex.json`
  进入 explicit candidate build；不修改 `contracts/app-shell-adapter.json` 前不能成为
  stable/nightly release shell。
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
- MAS/MAG/RCA 是 App-owned purpose route 声明：`mas -> purpose:research`、
  `mag -> purpose:grant`、`rca -> purpose:ppt`。Hermes 普通界面可以展示 composer
  purpose entries 和 Settings 的“智能体与能力”摘要，但 runtime truth、domain truth、
  artifact authority 和 quality verdict 仍归 OPL Framework 与各 domain repo。
- Settings 必须 OPL 化。普通 tab 收敛为 General、Access、Agents & Capabilities、
  Local Environment、Appearance、Advanced、About & Updates，并对应“模型策略、模型访问、
  智能体与能力、本机环境、外观与语言、高级与诊断、关于与更新”。Hermes backend、
  provider marketplace、OAuth accounts、custom Base URL、remote backend、Hermes memory
  provider 和 raw gateway state 只能进 Advanced/Diagnostics 或隐藏。
- 视觉门槛不低于 AionUI active release shell。Hermes 不能只因为用了 Codex app-server
  或 contract 通过就算 GUI 可用；chat reading lane、composer、Settings、首启和 packaged
  smoke 截图至少要与 AionUI baseline 对比，且不能出现明显更低的可读性、密度、层级或空白页。

## 当前完成度口径

Last checked: `2026-06-17`

本清单只按当前仓库和 linked checkout 的 fresh evidence 计完成度。contract、source
tests、packaged smoke、Settings visual smoke、Tart clean-VM smoke 和本机 live Codex
app-server smoke 可以证明候选边界、adapter shape、packaged app 基础启动、fixture
Codex turn、真实本机 Codex app-server 一轮回合、MAS route receipt、MAG/RCA 显式 route
blocker readback、关键 Settings 页面非空和 clean-VM 候选包行为；不能单独证明视觉不低于
AionUI、release promotion、MAS/MAG/RCA domain ready、artifact ready 或 quality verdict。
完整完成度见本文末尾“完成度清单”。

## 目标体验

Hermes candidate 的目标不是“完整 Hermes 工作台加 OPL 插件”，而是 Codex App-like
OPL thin shell：

- 打开后进入 workspace-aware chat，而不是 dashboard、provider marketplace 或
  Hermes Agent installer。
- 普通 executor 固定为 Codex CLI / Codex app-server；用户不选择 backend。
- 模型选择显示为 App-owned 策略：`Auto` 表示跟随 OPL/Codex 推荐的最新最强模型，
  当前有效模型是 `GPT-5.5` + `xhigh`。`auto` 不是持久模型 id，也不进入 provider
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
[`opl-hermes-first-run-flow.md`](opl-hermes-first-run-flow.md) 拆成四条流程：

- 每次启动轻量检查：每次 launch 只做 marker、核心组件、Codex/OPL CLI、`opl app state
  --profile fast --json` 模型访问探测和 adapter startup 路由检查；热启动不能同步跑
  full `opl system initialize --json` 阻塞主界面。
- 一次性本机初始化：只在 fast app state 不能证明 Codex/模型访问状态、marker 过旧且
  探测失败、或核心组件缺失时显示 Hermes checklist UI，并只等待 Core launch
  readiness。marker 缺失本身不等于要进入初始化页；已安装机器应先轻量探测，成功后
  补写 marker 并进入主界面。
- 模型访问配置：作为单独“模型访问”向导，只处理 gflabtoken API key / 模型访问；
  它不是本机初始化 checklist 的一个安装 stage。
- 后台 OPL 状态刷新：full OPL status/readback 在 Codex adapter ready 和主界面可见
  之后异步运行，结果进入 Runtime/Diagnostics，不阻塞 chat-first 主界面。

## 当前必须落地的普通路径

| Surface | OPL 语义 | 当前目标行为 |
| --- | --- | --- |
| 主模型显示 | 模型策略 | `Auto · GPT-5.5 Max` 这类显示表达“自动策略 + 当前有效模型”。不显示第二个 `Auto` 模型选项。 |
| 模型设置 | 模型策略 | 只展示当前 OPL/Codex 有效模型和推理强度。辅助任务默认跟随主模型，不提供独立 provider 槽位作为普通能力。 |
| Provider 设置 | 模型访问 | 改名为“模型访问”。只显示 gflabtoken API key。 |
| `/api/env` | 模型访问目录 | 普通路径只返回 `OPENAI_API_KEY`。拒绝 `OPENAI_BASE_URL` 和其它 provider key 写入。 |
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
  已经可进入主界面。
- Executor：普通 chat route 接 Codex app-server adapter，而不是 Hermes Agent 默认后端。
- 模型访问：从 provider/OAuth 心智替换为 One Person Lab 模型访问。

**已接入并已有 packaged smoke 证据的能力：**

- MAS/MAG/RCA 的 ordinary route catalog、conversation route receipt/error 事件和
  Settings“智能体与能力”摘要已经进入 App-owned 目标态。Hermes shell 的 source/unit
  evidence 可以证明 route declaration、OPL owner-surface dry-run/readback、Codex prompt
  receipt 注入和 UI tool-event 映射存在。
- 候选包 packaged smoke 已从 App repo 的 `validate:shell-candidates -- --candidate
  hermes-codex --run-candidate-commands` 链路执行：先打包
  `One Person Lab Hermes Candidate.app`，再运行
  `/Users/gaofeng/workspace/opl-hermes-shell/out/smoke-opl-first-run/summary.json`
  所记录的缺 key、缺 key 热启动、已配置、已配置热启动和 fast probe fallback 场景。
  已配置场景会启动真实 packaged `.app`、连接 Codex app-server fixture、创建 session、
  发送 turn、收到 `message.complete` 与 `fixture codex response`，并记录 MAS
  `route_readback_ready` 回执，以及 MAG/RCA 的 `route_readback_with_blockers` 显式 readback。
- 候选包 packaged Settings visual smoke 已进入 App repo 的 candidate command chain：
  `/Users/gaofeng/workspace/opl-hermes-shell/out/smoke-settings-visual/settings-visual-summary.json`
  记录 home、模型访问、智能体与能力、关于页面截图，并断言 gflabtoken-only、禁止
  provider/Base URL/OAuth 普通控件、Agents/Capabilities 可见和品牌文案可见。
- Tart clean-VM smoke 已通过：
  `artifacts/hermes-candidate-tart-20260617T104000Z/summary.json` 记录从
  `opl-first-run-no-clt-clean-base-26-5-18` 克隆出的 guest 内启动 packaged `.app`，
  并跑完同一组 first-run 场景。该证据证明候选包能在 clean VM 中执行 packaged
  fixture smoke；它不是 release shell clean-VM readiness，也不证明真实外部模型服务。
- 本机 live Codex app-server smoke 已通过：主会话直接实例化 Hermes gateway 的
  `CodexAppServerClient`，调用本机 `codex app-server --listen stdio://`，完成
  `thread/start -> turn/start -> item/agentMessage/delta -> turn/completed`，并得到
  `OPL Hermes live Codex smoke ok`。该证据证明 Hermes adapter 采用的 app-server client
  能连通本机真实 Codex CLI；它仍不是 packaged GUI 人工验收、release readiness 或
  MAS/MAG/RCA domain readiness。
- 这些证据仍不能证明 domain runtime ready、artifact ready 或 quality verdict。相关结论
  必须继续来自 OPL Framework、MAS/MAG/RCA domain repo 和它们的 owner receipt/readback。

**仍然延后提升：**

- Runtime refs 的完整展示、OPL App state/action 全量 bridge、WebUI parity、Full packaged
  runtime、stable release gates。
- 这些能力必须有 Hermes 原生功能对比、App-owned contract/gate 和 runtime/packaged evidence，
  不能按旧 AionUI/AGUI 稳定线直接搬进 Hermes。

## 视觉与交互方向

Hermes candidate 后续视觉优化要继续逼近 Codex App，而不是重新做工作台：

- 第一屏保持中心 chat reading lane 和底部多行 composer，默认不打开复杂 inspector。
- Composer 是主视觉锚点：多行、高度充足、轻 outline、统一圆角，不出现圆角输入框
  后面又露出白色矩形底板。
- 控件比例、间距和字体按 macOS / Codex App-like quiet utility 方向收敛：更少方块、
  更柔和层级、更清楚的主次。
- Header、model status、workspace path 和 route tag 作为辅助信息，不抢 conversation。
- Settings 信息密度可以高于首页，但分组必须清晰，空态必须解释“当前无 OPL 可配置项”，
  不能像功能坏了。

## 验收口径

Hermes candidate 只能在以下证据齐备时声称“基本可用”：

- 启动不进入 Hermes Agent installer。
- 热启动不跑 full initialize 作为阻塞 gate；已配置 API key、marker 新鲜且核心存在时
  自动进入主界面。
- 缺 key 时进入 OPL 模型访问 onboarding，不显示本机安装 checklist。
- marker 缺失但 fast app state 已证明 Codex/模型访问可用时，不显示 OPL 本机初始化
  checklist，只补写 marker 并进入主界面。
- marker 过旧且 fast app state 无法证明 readiness，或核心组件缺失时，才显示 OPL
  本机初始化 checklist。
- 全新安装或 VM smoke 记录轻量检查、本机初始化、模型访问、adapter startup 和后台
  OPL status refresh 的阶段耗时。
- 主界面可创建 session、发送 Codex turn，并展示 assistant response。
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

## 完成度清单

本文和 contract 只固化目标态；完成度必须按证据分层计算，不能把 docs-only 或
contract-only 写成 100%。

| 条目 | 当前状态 | 完成度 | 新鲜证据要求 | 缺口/后续动作 |
| --- | --- | --- | --- | --- |
| App-owned Hermes 目标态 | done | 100% | `contracts/app-shell-candidates.json` 与 `contracts/shell-adapters/hermes-codex.json` 通过候选 contract 校验。 | 后续若目标态变化，先改 App-owned contract/docs，再改 shell。 |
| 默认 release shell 仍是 AionUI | done | 100% | `scripts/validate-shell-candidates.ts` 读取 `contracts/app-shell-adapter.json`、runtime bridge 和 GUI contract，确认 active shell 仍为 AionUI。 | 无；Hermes promotion 需单独 adoption decision。 |
| Candidate app bundle identity | done | 100% | `npm run validate:candidate -- --require-app` 与 App-root manifest validator 证明 `CFBundleExecutable` 和 `Contents/MacOS` executable 都是 `One Person Lab Hermes Candidate`，且旧 `Electron` executable 不存在。 | 后续若改回 electron-builder，要保留同等 bundle identity check。 |
| Codex app-server gateway 目标 | done | 98% | Contract 声明 app-server gateway 和事件流；Hermes source/unit tests 证明 `session.create`、`prompt.submit`、delta、complete、tool/approval/error bridge；packaged smoke 证明真实 `.app` 内 session/turn/delta/complete 可用；本机 live smoke 证明 `CodexAppServerClient` 能驱动真实 `codex app-server` 完成一轮回合。 | 仍需 packaged GUI 人工验收和长期稳定性证据；不能从一次 live smoke 推导 release readiness。 |
| gflabtoken-only 模型访问 | partial | 95% | Contract 声明 gflabtoken、`OPENAI_API_KEY`、禁用 Base URL/provider marketplace；Hermes renderer tests 证明 Settings/onboarding 不展示其它 provider 和 legacy Base URL；packaged smoke 覆盖缺 key 与已配置状态分流；Settings visual smoke 证明模型访问页只暴露 gflabtoken/API key 普通入口。 | 仍需真实用户在 packaged GUI 中保存 API key 并完成真实模型访问验证；当前自动 smoke 使用 fixture 配置命令。 |
| MAS/MAG/RCA agent routes | partial | 92% | Contract 声明 purpose routes 和 forbidden claims；Hermes source/unit tests 证明 route catalog、OPL dry-run/readback receipt、conversation route receipt/error tool event 和 Codex prompt receipt 注入；packaged smoke 与 VM smoke 证明 MAS `route_readback_ready` 进入真实 `.app` conversation stream，并证明 MAG/RCA 返回 `route_readback_with_blockers` 而非静默失效。 | 仍需 live OPL/MAS/MAG/RCA domain readback；不能声称 domain ready、artifact ready 或 quality verdict。 |
| Settings OPL 化 | partial | 85% | Contract/docs 已定义 ordinary IA；Hermes renderer tests 证明普通导航隐藏 Gateway/Tools & Keys，显示“智能体与能力”和模型访问；packaged Settings visual smoke 证明 home、模型访问、智能体与能力、关于页面非空，且隐藏 forbidden provider controls。 | 长期还需把 remaining Hermes config sections 进一步 OPL 化，并做 AionUI baseline 视觉比较。 |
| 首启四线模型 | partial | 95% | First-run contract 和矩阵区分轻量检查、一次性初始化、模型访问、后台刷新；Hermes source tests 覆盖 provider catalog、localEndpoint 不回退 Base URL、configured key auto-skip；packaged smoke 与 Tart clean-VM smoke 覆盖缺 key、缺 key hot launch、已配置、已配置 hot launch 与 fast probe fallback。 | 仍需真实模型访问和非 fixture Codex turn；候选 VM smoke 不是 release shell clean-VM readiness。 |
| 视觉不低于 AionUI | partial | 20% | 方向和门槛已写入 contract/docs；Hermes upstream UI 基线和普通导航降噪已保留。 | 需要 AionUI baseline 与 Hermes candidate 的 desktop、Settings、首启 packaged screenshot 对比。 |
| Tart/VM clean smoke | done | 95% | `npm run smoke:hermes-candidate:tart -- --no-graphics --artifacts artifacts/hermes-candidate-tart-20260617T104000Z --timeout-ms 600000` 已通过；summary 记录 guest IP、source VM、packaged `.app` 路径、缺 key/热启动/已配置/fallback 场景、fixture Codex turn、MAS ready 和 MAG/RCA explicit blocker readbacks。 | 该证据证明候选包 clean-VM fixture smoke 通过；仍不等同于 release shell clean-VM readiness、真实模型服务或 AionUI 视觉验收。 |
| Hermes release promotion | not_started | 0% | 需要 active shell contract 切换、page-state、first-run、product profile、runtime bridge、packaged smoke、WebUI 和 release gates 全部通过。 | 本轮明确不 promotion。 |
