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

## 当前完成度清单

Last checked: `2026-06-17`

本清单只按当前仓库和 linked checkout 的 fresh evidence 计完成度。合同和源码检查可以
证明候选边界、adapter shape 和部分实现约束；不能单独证明 packaged `.app` 可用、
真实热启动耗时、VM smoke、视觉状态、用户可发送 Codex turn 或 release promotion。

| 规划项 | 完成度 | 状态 | Fresh evidence | 缺口 / 下一步 |
| --- | ---: | --- | --- | --- |
| 默认 release shell 仍为 AionUI，Hermes 只做 explicit candidate | 100% | `done` | `node --experimental-strip-types scripts/validate-active-shell.ts --quick` 通过；`npm run validate:shell-candidates -- --candidate hermes-codex` 返回 `active_shell_unchanged=aionui`、`release_participation=explicit_candidate_build_only_until_adopted`。 | 无；后续 adoption 必须显式改 `contracts/app-shell-adapter.json`。 |
| Hermes candidate registry / adapter contract | 100% | `done` | `node --experimental-strip-types scripts/validate-hermes-candidate.ts` 返回 `hermes_candidate_contract_valid`、`checkout_path=../opl-hermes-shell`、`blockers=[]`。 | 无；保持 App contract 和 shell checkout 同步。 |
| 相关本地 repo 同步到最新 GitHub main | 100% | `done` | `one-person-lab-app`、`one-person-lab`、`opl-aion-shell`、`opl-hermes-shell` 均为 `main...origin/main` 且 clean；`one-person-lab` 和 `opl-hermes-shell` 已 fast-forward 到最新远端。 | 无；继续避免跨 repo dirty state 被误当成候选状态。 |
| Upstream-first OPL customization 边界 | 90% | `partial` | App contract 声明 `NousResearch/hermes-agent apps/desktop`、MIT、official backend preserved、minimal OPL delta；App validator 通过；shell source 包含 OPL defaults、Codex gateway 和 upstream README receipt。 | 还缺 Hermes-native feature comparison artifact；不能开始搬运 AionUI/AGUI stable surface。 |
| OPL 品牌、图标和 macOS safe margin | 85% | `partial` | App validator 通过；独立 PNG alpha readback 得到 `840x840+92+92`，满足 `max_alpha_bounds_px=900`。 | `opl-hermes-shell` 的 `npm run validate:candidate` 依赖 `magick`，当前本机缺该二进制导致 validator 报 `.stdout.trim()` TypeError；需要安装/声明 ImageMagick 或让 validator fail closed with diagnostic 后重跑。 |
| Chat-first Codex app-server adapter | 75% | `partial` | `node --test electron/opl-bootstrap-runner.test.cjs electron/opl-codex-gateway.test.cjs` 在 `opl-hermes-shell` 通过 26/26；gateway tests 覆盖 `thread/start`、`turn/start`、`item/agentMessage/delta`、renderer-safe config/RPC shapes 和 no `exec --json` shim。 | 还缺 packaged `.app` 启动、创建 session、发送 Codex turn、展示 assistant response 的 smoke evidence。 |
| 首启/启动四流程：轻量检查、本机初始化、模型访问、后台刷新 | 70% | `partial` | shell bootstrap tests 覆盖 marker missing fast probe、one-time fallback、current marker lightweight startup、missing key route、deferred maintenance 和 core missing rerun。 | 还缺 source/packaged/VM smoke 记录各阶段 started/finished/duration，尤其热启动不阻塞 full initialize 的 runtime evidence。 |
| 模型访问：只暴露 gflabtoken API key | 75% | `partial` | gateway tests 覆盖 missing model access、`configure-codex` 保存路径、ordinary catalog 只暴露 gflabtoken API key、拒绝 non-bootstrap official Hermes backend endpoints。 | 还缺 UI 截图或 packaged smoke 证明没有 Base URL、OAuth accounts、provider marketplace 或其它 provider key。 |
| 主模型显示：Auto 策略 + 当前有效模型 | 55% | `partial` | `npm run typecheck` 在 `opl-hermes-shell` 通过；相关 model preset/source 已存在。 | Focused UI test `src/app/settings/model-settings.test.tsx` 当前失败 1 项：期望 `auto · use main model` 的 auxiliary task rows 未出现。需要先判定是实现缺口还是测试口径过期，再补 UI evidence。 |
| Settings 信息架构收窄 | 55% | `partial` | providers/settings 相关 focused suite 中除上面的 model settings 用例外整体可加载；gateway config schema/RPC shape tests 通过，说明关键 Settings 不应因 bootstrap shape 缺失而空白。 | 还缺 Settings 视觉/交互 smoke；model settings failing test 必须解决后才能提高完成度。 |
| 简体中文/英文双语；不维护繁体中文/日文 | 75% | `partial` | `opl-hermes-shell` 最新 main 删除 `src/i18n/ja.ts` 和 `src/i18n/zh-hant.ts`；focused UI suite 中语言/i18n tests 未失败。 | 还缺真实系统 locale 或 renderer screenshot 证明中文系统普通 UI 默认简体中文且新增 copy 全部来自 catalog。 |
| 隐藏 provider/backend/runtime 工作台心智 | 60% | `partial` | contracts 和 source tests 覆盖 gflabtoken-only model access、renderer-safe OAuth providers empty、non-bootstrap Hermes backend endpoints refused。 | 还缺首页/Settings visual smoke 证明 provider marketplace、OAuth provider accounts、自定义 Base URL、backend/runtime selector、remote backend 等未出现在普通路径。 |
| 视觉与交互向 Codex App-like 收敛 | 35% | `partial` | 计划和 source 已有 model pill / composer / settings 调整入口，typecheck 通过。 | 未跑 Playwright/截图/packaged visual QA；不能声明界面已达到目标形态。 |
| App-root explicit candidate wrapper 打包 `.app` | 0% | `not_started` | 本轮未运行 `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/hermes-codex.json npm run package`。 | 需要先让 shell validator 依赖和 focused UI failure 收敛，再跑 App-root package 和 packaged validator。 |
| MAS/MAG/RCA purpose route、OPL App state/action、WebUI parity、Full runtime、stable release gates | 0% | `deferred` | contracts 明确列入 `deferred_until_feature_comparison`。 | 先完成 Hermes-native feature comparison 和 minimal candidate smoke；不能按旧 AionUI/AGUI 稳定线直接搬入。 |

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

**延后提升：**

- MAS/MAG/RCA purpose route、route receipt、runtime refs、OPL App state/action、
  WebUI parity、Full packaged runtime、stable release gates。
- 这些能力必须先有 Hermes 原生功能对比和 App-owned contract/gate，不能按旧
  AionUI/AGUI 稳定线直接搬进 Hermes。

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

这不是 release promotion。Hermes 成为默认 release shell 仍必须更新
`contracts/app-shell-adapter.json`，并通过 page-state、first-run、product profile、
runtime bridge、packaged smoke、WebUI claim 和 release gates。
