# OPL Hermes 首启与启动流程

Owner: `one-person-lab-app`
Purpose: `opl_hermes_first_run_flow`
State: `active_target_spec`
Machine boundary: 本文是人读流程草案和验收清单。机器可读 first-run gate、
adapter contract、packaged smoke、timing artifact 和 release gate 仍以
`contracts/`、源码、验证脚本、候选包和测试输出为准。

本文把 Hermes Desktop candidate 的启动路径拆成四条独立流程：每次启动轻量检查、
一次性本机初始化、模型访问配置、后台 OPL 状态刷新。它补充
[`opl-hermes-gui-adaptation-plan.md`](opl-hermes-gui-adaptation-plan.md)，并按用户
最新要求修正过宽的 first-run 说法：Hermes checklist UI 只承载真正需要等待的本机
准备，不承载每次启动的 full `opl system initialize --json`。

## App-owned 启动合同

Hermes candidate 的首启与启动目标态由 App repo 持有，并映射到
`contracts/app-shell-candidates.json` 和
`contracts/shell-adapters/hermes-codex.json`：

- 每次启动轻量检查是独立路径，必须能被日志或 smoke artifact 单独计时。它可以读取
  marker、CLI、fast app state、gflabtoken 模型访问和 Codex adapter startup，但不能默认
  运行 full initialize 作为进入 chat 的阻塞 gate。
- 一次性本机初始化只在轻量 readiness 不能证明可进入 App、marker 缺失/过旧后 fast probe
  失败，或核心组件缺失时出现。Hermes checklist UI 只复用 progress 组件，不复用 Hermes
  Agent installer 语义。
- 模型访问是单独配置路径，只配置 gflabtoken API key。它可以写入 `OPENAI_API_KEY`
  兼容 Codex，但普通 UI 不暴露 `OPENAI_BASE_URL`、provider marketplace、OAuth accounts
  或其它 provider key。
- 后台 OPL 状态刷新只能在 Codex adapter ready 和主 chat 可见后异步运行。失败时进入
  Runtime/Diagnostics，不回退成首启安装失败。
- App-owned validation 必须能发现默认 active shell 仍是 AionUI、Hermes candidate 有
  app-server adapter contract、模型访问是单一路径、首启四线语义齐全、MAS/MAG/RCA
  route declaration 已声明。

## 术语边界

**首启初始化** 指一次性本机准备。它回答“这台机器是否具备启动 OPL App 的核心条件”。
触发条件是初始化 marker 缺失或过旧后 fast app state 仍无法证明 readiness、核心组件
缺失或核心启动依赖不可用。marker 只是本机准备缓存/路由证据，不能单独把用户带进
阻塞初始化页。
它可以复用 Hermes checklist/progress UI，因为用户确实需要等待本机准备完成。

**首次启动配置向导** 指模型访问配置。它回答“Codex/OPL 是否有可用的模型访问凭据”。
它只处理 gflabtoken API key / 模型访问，不安装本机核心组件，不承载 Hermes Agent
installer，也不作为 provider marketplace。保存时通过
`opl system configure-codex --api-key-stdin --json` 写入 App/OPL 认可的访问配置。

两者不是一回事：一台机器可以本机初始化完成但缺 API key；也可以 API key 已存在但
marker 缺失、marker 过旧或核心组件损坏。UI 必须按真实 blocker 分流，不能把所有
首次启动问题都塞进一个 checklist。尤其是 marker 缺失但 `opl app state --profile
fast --json` 已经证明 Codex CLI 与模型访问可用时，应补写 marker 并进入主界面。

## 四条流程

| 流程 | 触发条件 | UI 承载 | 阻塞关系 | 预期耗时 |
| --- | --- | --- | --- | --- |
| 每次启动轻量检查 | 每次 App launch 或恢复主窗口时运行。只做廉价检查：初始化 marker 是否存在且新鲜、核心组件是否可发现、Codex/OPL CLI 是否可用、`opl app state --profile fast --json` 是否能证明 Codex 与模型访问状态足以路由。 | 普通 splash、header 状态或短暂 inline status；正常情况下不显示 Hermes checklist。 | 只阻塞进入错误的下一步，不阻塞在 full initialize。检查通过且 key 可用时直接进入 chat-first 主界面；缺 key 时进入模型访问配置；marker 缺失/过旧但 fast probe 通过时补写 marker；fast probe 失败或核心缺失时才进入本机初始化 checklist。 | 目标为亚秒到数秒。超过短等待阈值时显示简短状态，但仍不升级为 full initialize。 |
| 一次性本机初始化 | fast app state 不能证明 Codex/模型访问 readiness、核心组件缺失、核心启动依赖不可用，或显式 fresh install / VM smoke。 | 复用 Hermes checklist/progress UI，但文案是 OPL 本机准备，不是 Hermes Agent 安装。 | 可以阻塞进入主 chat，直到 Core launch readiness 足以启动 App。它不等待 Full maintenance、module reconcile 或完整 OPL status refresh。完成后按模型访问状态继续分流。 | 已有安装修复通常为数秒到几十秒；全新安装或 VM smoke 可能更长。必须记录阶段耗时。 |
| 模型访问配置 | gflabtoken API key 缺失、无效、不可读取，或用户主动进入 Access 设置更新 key。 | “模型访问”配置向导或 Access Settings。只显示 gflabtoken API key / 模型访问，不显示 provider marketplace、自定义 Base URL 或其它 provider key。 | 阻塞发送 Codex turn 和需要模型的 assistant 工作；不代表本机初始化失败。保存成功后进入主界面或恢复原会话。 | 用户输入时间不固定；保存和验证目标为数秒级。 |
| 后台 OPL 状态刷新 | Codex adapter ready、主界面可显示之后启动；也可由用户在 Runtime/Diagnostics 显式刷新。 | Header connected-state、Runtime/Diagnostics surface 或后台 activity indicator。不得使用首启 checklist。 | 非阻塞。刷新结果只更新 runtime refs、diagnostics、维护提示或后续 action，不阻塞首次进入 chat。失败时显示可恢复状态，不回退成启动失败。 | 取决于 full OPL status/readback 成本；必须异步运行并记录耗时。 |

## Checklist UI 使用规则

Hermes checklist/progress UI 只用于“用户必须等待且 App 不能安全进入主 chat”的本机准备。
允许出现在 checklist 的项目包括：

- 检查 One Person Lab CLI。
- 检查 Codex CLI / Codex app-server 可用性。
- 读取并验证 OPL 初始化 marker。
- 在 marker 缺失、过旧或核心缺失时准备 OPL 核心组件。
- 验证 Core launch readiness。
- 写入或刷新本机初始化 marker。
- 启动 Codex desktop adapter 所需的最小本机桥接。

不允许出现在安装 checklist 的项目包括：

- 每次启动都运行 full `opl system initialize --json`。
- Full OPL status refresh、Operator full drilldown、module reconcile、ecosystem update
  或 background maintenance。
- gflabtoken API key 表单本身。模型访问可以在本机初始化完成后作为单独配置向导
  出现，但不是“安装进度”的一个 stage。
- Hermes Agent installer、provider marketplace、OAuth provider accounts、自定义
  Base URL 或其它 provider key。

## 当前候选实现映射

当前 `opl-hermes-shell` 的初始化 checklist 使用 7 个可见 stage。它们不是每次启动
都跑完；热启动只会快速通过 CLI 检查，然后把一次性初始化 stage 标为 `skipped`。

| Stage | 显示含义 | 运行条件 | 预期耗时 |
| --- | --- | --- | --- |
| `opl-cli-check` | 检查 One Person Lab CLI。 | 每次启动。 | 通常小于 1 秒。 |
| `codex-cli-check` | 检查 Codex CLI。 | 每次启动。 | 通常小于 1 秒。 |
| `opl-initialize` | 读取一次性本机初始化状态。 | marker 缺失、过旧或核心组件缺失时阻塞运行；marker 新鲜时跳过。 | 热启动为跳过；真正初始化通常数秒到几十秒。 |
| `opl-core-setup` | 准备或修复 One Person Lab 核心组件。 | 只有 Core launch readiness 不满足且不是单纯缺模型访问时运行。 | 已安装机器通常跳过；需要修复时可能几十秒或更长。 |
| `opl-post-setup-check` | 复核初始化结果。 | `opl-core-setup` 运行后才需要。 | 通常数秒到几十秒。 |
| `opl-codex-adapter` | 准备 Codex desktop adapter。 | CLI 和本机初始化路由完成后运行。 | 目标为 1-2 秒内。 |
| `opl-maintenance-schedule` | 安排后台维护。 | 模型访问已配置时标为完成；缺 key 时跳过，并在保存 key 后再启动后台维护。 | 只安排任务，通常小于 1 秒。 |

因此用户在已安装机器启动时不应该再看到第三步长时间卡住。若第三步仍耗时十几秒，
说明 fast app state readiness probe 失败、核心缺失检查触发了重初始化，或实现回退
到了 full initialize gate；这必须按启动日志和 packaged smoke 作为 bug 处理。

## 验收清单

| 场景 | 初始状态 | 预期结果 | 必需证据 |
| --- | --- | --- | --- |
| 热启动 | marker 新鲜、核心组件存在、Codex/OPL CLI 可用、gflabtoken API key 可用。 | 不运行 full initialize 作为阻塞 gate；不显示安装 checklist；直接进入 chat-first 主界面；full OPL status refresh 后台异步。 | 启动日志或 smoke artifact 证明没有 launch-gate full `opl system initialize --json`，并记录轻量检查耗时、主界面可见时间、后台刷新开始时间。 |
| 无 key | marker 新鲜、核心组件存在，但 gflabtoken API key 缺失或不可用。 | 进入“模型访问”配置向导；不显示本机安装 checklist；不暴露 provider marketplace、Base URL 或其它 provider key。 | UI smoke 截图或事件记录证明模型访问页可见；保存路径调用 `opl system configure-codex --api-key-stdin --json`。 |
| 无 marker 但已安装 | 初始化 marker 缺失或过旧，但 fast app state 能证明 Codex CLI 与模型访问状态可用。 | 不显示 OPL 本机初始化 checklist；不运行 launch-gate full initialize；补写 marker 后进入模型访问或主界面；full OPL status refresh 后台异步。 | 启动日志或 smoke artifact 证明 `opl app state --profile fast --json` 通过、没有 checklist manifest、没有 adapter ready 前的 `opl system initialize --json`。 |
| 无 marker 且 readiness 不明 | 初始化 marker 缺失或过旧，且 fast app state 不能证明 readiness，或核心组件需要准备。 | 显示 OPL 本机初始化 checklist；只等待 Core launch readiness；完成后按 key 状态进入模型访问或主界面。 | checklist stage 事件、阶段耗时、marker 写入/刷新证据、无 Hermes Agent installer 执行证据。 |
| 核心缺失 | marker 存在但核心组件缺失、不可发现或版本不满足 Core launch readiness。 | 显示本机初始化 checklist 并修复/准备核心；如果 key 已存在，初始化完成后不再要求模型访问。 | 核心缺失诊断、修复阶段耗时、初始化后 adapter startup 证据。 |
| 全新安装 / VM smoke | 干净机器或隔离 VM，无 marker，可能无 key。 | 记录轻量检查、本机初始化、模型访问、adapter startup、后台 OPL status refresh 各阶段耗时；Full maintenance 保持后台。 | smoke artifact 中包含每阶段 started/finished/duration、阻塞/非阻塞分类、最终路由结果。 |
| 后台刷新失败 | 主界面已进入，full OPL status refresh 或 maintenance readback 失败。 | 主 chat 不被关闭；Runtime/Diagnostics 显示可恢复状态或重试入口；不回退成首启安装失败。 | 后台刷新错误事件、非阻塞 UI 状态、仍可发送或恢复 conversation 的证据。 |

## 当前 packaged smoke 证据

当前 Hermes candidate 已把 packaged first-run smoke 纳入 App-root candidate
validation：`npm run validate:shell-candidates -- --candidate hermes-codex
--run-candidate-commands` 会先通过 App wrapper 打包候选 `.app`，再进入 sibling
Hermes checkout 执行 `npm run smoke:opl-first-run`，最后读取
`/Users/gaofeng/workspace/opl-hermes-shell/out/smoke-opl-first-run/summary.json`
作为行为证据。

该 smoke 覆盖以下场景：

- `missing_key`：marker 缺失但 fast app state 证明核心可用、缺 gflabtoken API key，
  预期进入模型访问路径，不进入 Hermes Agent installer。
- `missing_key_hot_launch`：marker 新鲜但仍缺 key，预期不跑 full initialize gate。
- `configured_key`：模型访问已配置，预期进入 Codex adapter ready 路径，并在真实
  packaged `.app` 内通过 Codex app-server fixture 完成一轮 session/turn/delta/complete；
  同时验证 MAS route receipt 可进入 conversation stream。
- `configured_key_hot_launch`：marker 新鲜且 key 存在时，即使后台出现
  `system initialize --json`，也必须发生在 `OPL Codex adapter is ready` 之后。
- `fast_probe_not_ready_first_run`：fast probe 不能证明 readiness 时，允许走一次性初始化
  checklist，再进入 adapter。

这仍不是 VM clean install 证据。2026-06-17 的 Tart 尝试已拿到
`opl-first-run-no-clt-clean-base-26-5-18` guest IP，但 guest SSH 关闭连接而未能进入
guest smoke；阻塞证据保存在
`artifacts/hermes-tart-smoke-20260617T092442Z/blocker.txt` 和同目录
`ssh-probe.log`。因此当前只能把 VM 项标记为 blocked/partial，不能把本机隔离
packaged smoke 包装成 VM 通过。

## 证据分级

以下清单用于避免把文档或 contract 当成 runtime 完成：

| 主张 | 可由 contract/docs 支撑 | 还需要 packaged/VM evidence 的部分 |
| --- | --- | --- |
| active shell 仍是 AionUI | 可以。验证脚本读取 active adapter、runtime bridge 和 GUI contract。 | 不需要打包；除非声称 release artifact fresh。 |
| Hermes 有 app-server adapter 目标 | 可以。contract 能声明 gateway route、事件流和禁用 backend。 | 需要 package/source smoke 证明 adapter 真能启动、创建 session、发送 turn、展示 response。 |
| 模型访问单一 | 可以。contract 能声明 gflabtoken-only、禁用 Base URL/provider marketplace。 | 需要 UI smoke 证明 onboarding 和 Settings 没暴露其它 provider 控件，且保存路径可用。 |
| 首启四线语义 | 可以。contract 能声明四条流程、触发条件和阻塞关系。 | 需要热启动、缺 key、无 marker、全新安装/VM smoke 的阶段日志和耗时。 |
| MAS/MAG/RCA route declaration | 可以。contract 能声明普通入口和 forbidden claims。 | 需要 runtime route receipt、domain readback 或 packaged turn evidence 才能声称智能体调用可用。 |
| 视觉不低于 AionUI | 不可以。docs/contract 只能定义门槛。 | 必须有 AionUI baseline 与 Hermes packaged candidate 的截图或视觉 smoke 对比。 |

当前 source 级实现还补了一条首启防回归证据：即使旧 Hermes local endpoint 触发状态进入
onboarding，普通 OPL 模型访问页也只能显示 gflabtoken API key，不能预选或展示
`OPENAI_BASE_URL`。这条证据来自 renderer test；它仍需要 packaged UI/VM smoke 复核真实
窗口行为。

## 实施注意

- 每次启动的 light check 应该是显式、可测、可计时的独立步骤。它可以决定是否进入
  checklist，但不能把 full initialize 当作默认启动路径。
- 初始化 marker 是本机准备的路由依据，不是 runtime readiness 或 release-ready 证据。
- Full OPL status refresh 只提供 runtime refs 和诊断更新；它不能成为普通启动 gate。
- Candidate 验证应同时覆盖 source、packaged app、事件日志和截图。只看到文档或
  contract 不足以声称 Hermes candidate 可用。
- 当前 Hermes shell runtime 若仍在 fallback bootstrap 中使用 full initialize 作为
  阻塞步骤，只能视为实现差距。App-owned target spec 和 contract 以本文为准；
  runtime 完成度必须由 packaged smoke / VM smoke 证明，不能用本文替代。
