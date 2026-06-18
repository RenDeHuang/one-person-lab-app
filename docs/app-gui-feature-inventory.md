# OPL App GUI 能力清单

Owner: `one-person-lab-app`
Purpose: `product_level_gui_feature_inventory`
State: `active`
Machine boundary: 本文是人读能力清单。机器可读 GUI 真相在 App-owned contracts、
page-state matrices、adapter contracts 和 release evidence 中。

本文列出 One Person Lab App 不依赖当前 shell implementation 的目标 GUI 能力。
它不是 AionUI 修改列表。AionUI 和未来 shell 必须通过 App-owned contracts、
page-state matrices 和 release validation 实现这份清单。

因为当前 active shell 是 AionUI fork，清单里的能力不应默认解释为“继续深改
AionUI”。每个能力都应先有 App-owned contract/profile/source，再由 shell 用
thin adapter delta 表达：读取 generated profile、复用 existing primitives、
映射 legacy routes、调用 App state/action bridge，并用 focused tests 和 App-root
validation 证明。这样后续跟随 AionUI upstream 或替换为其他 shell 时，迁移的是
contract implementation，而不是 fork-local 产品逻辑。

对 `hermes-codex` 这样的成熟 upstream candidate，清单里的能力也不应解释为
“从零设计并重写 Hermes”。Hermes Desktop 已经拥有 chat、文件/预览、工具输出、
settings、onboarding 和原生打包能力；OPL 的目标是在这条成熟基线上做品牌化、
Codex CLI 后端桥接、普通路径收窄、必要 OPL 功能接入和 release isolation。能力
提升前先做 Hermes 原生功能对比，明确哪些保留、隐藏、重命名、替换或延后。

本文是能力清单，不是完整交互细则。理想且不绑定具体 shell 的交互模型看
[`app-ideal-gui-interaction-spec.md`](app-ideal-gui-interaction-spec.md)；
Codex App 变成 OPL App 的产品增量看
[`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md)。

## 产品形态

理想 OPL App GUI 是 Codex App 形态的 chat-first desktop surface：

- 从已选 workspace directory 开始 conversation。
- 固定 Codex CLI 作为 executor，并把模型控制收敛为 App-owned selector。默认
  必须从 App product profile 派生为最新最强模型，例如 `GPT-5.5（超高）`；用户
  可以合理切换模型，但 executor、backend 和 permission 仍不是普通选择项。
- Home entries 路由到 OPL capabilities：Research/MAS、Grant/MAG、
  Presentation/RCA。
- 第一屏保持 chat-first，不出现 dashboard 或解释性 landing page copy。
- 第一屏不展示 runtime activity、continue-work、per-assistant running badges、
  needs/active/recent refs 或底部 feedback/favorite/web 图标。
- 提供持久 workspace frame，包含轻量 workspace/session rail、conversation
  area 和可收起右侧 context panel。
- Backend 和 permission choices 不进入普通 home 和 conversation flow；模型选择器
  可以进入普通路径，但必须服从 App-owned 默认与退休模型过滤策略。
- 支持简体中文/英文双语 UI；普通界面同屏单一语言呈现，不随机中英混排。繁体中文
  和日文不进入 OPL App 普通维护范围。

这份清单描述的是 App 总目标，不是当前 AionUI shell 的改动列表。合格 shell
应该像一个专门服务 OPL 工作的 Codex App：workspace-aware、chat-first、
executor-first，并能展示 runtime status、purpose routing、receipts 和 packaged
App settings，同时不把第一屏变成 dashboard。

第一屏规范以
[`app-ideal-gui-interaction-spec.md`](app-ideal-gui-interaction-spec.md) 为准：
普通 home 打开即是 chat canvas，workspace/session rail 和右侧 inspector 默认
收起，contextual surfaces 只在用户主动触发时打开。

## Codex App 目标功能集

App 目标是专门服务 OPL 工作的 Codex App 体验，不是通用 agent dashboard。
完整功能集包括：

- 在已选 workspace directory 上打开 App，并在 frame 中保持 workspace 可见。
- 新建 conversation、恢复 recent conversations，并把 thread/session history
  放在 workspace rail 中。
- 主 surface 保持工作 chat canvas，带 pinned composer、compact route tag、
  file/context controls 和 visible run state。
- 普通 turns 绑定 Codex app-server/Codex CLI，作为固定 executor。
- 把 assistant text、tool/process progress、user-input prompts 和 receipts
  streaming 到用户安全的 conversation surfaces。
- 为选中的 workspace/conversation 展示 file 和 artifact refs，但不拥有
  artifact bodies。
- Backend 发出 diff、command/process output、review refs、runtime receipts
  时，在 conversation 附近展示。
- 提供可收起右侧 panel，用于 secondary context、runtime inspection 和
  App-owned settings，同时保持 chat canvas 为主面。
- 提供右侧 contextual inspector tabs：Files、Skills/Capabilities、
  Routing/runtime refs、Memory refs、Always-On/Automations、Settings；这些
  tabs 不能和主 chat canvas 竞争。
- MAS/MAG/RCA 是 Codex 之上的 built-in purpose entries。普通 chrome 使用
  `科研`、`基金`、`演示` 或 `Research`、`Grant`、`Presentation`，route receipts
  和 technical refs 再记录 MAS/MAG/RCA，不把它们当 separate backend choices。
- UI labels、empty states、button titles、aria labels、first-run、runtime、
  activity 和 settings copy 有简体中文/英文两套显示；切换语言不改变 runtime truth、
  route receipt 或 workspace/thread state。
- Workspace/session rail、context inspector、context tabs 和 routing summary
  是普通用户层 chrome，必须按当前语言完整渲染；隐藏 DOM 或 raw details 可以
  保留技术标签，但可见中文普通层不能混入 `New Codex turn`、`Local assistant`、
  `Codex CLI`、`MAS/MAG/RCA`，英文普通层不能残留中文目的/状态标签。
- Backend、provider、permission mode selectors 不进入普通 home 和
  conversation flows；model selector 只能作为 App-owned Codex 模型控制出现。
- Codex conversation composer 仍要显示同一个 App-owned model selector/status，
  并在 pending/running 时显示已经等待的秒数。
- 当前 turn 的运行状态应作为 conversation live artifact 呈现，包含 elapsed time、
  最近 tool/process/file/diff/receipt refs、permission/action 状态和完成/失败摘要。
  它不是全局 workbench 面板；跨项目 runtime refs 仍进入 Runtime 页或 inspector。
- Desktop Electron 和 WebUI surfaces 使用同一套 App product truth。
- 窄桌面和 WebUI 宽度下，二级 context 不变成首页工作台；用户打开后必须以
  overlay/drawer/右侧浮层形式可见，至少保证 `opl-context-tabs` 和
  `opl-routing-panel` 实际显示。

WebUI 目标与 Electron candidate 共享同一个 React/CopilotKit renderer。Electron
通过 native preload/IPC 提供 `window.oplCandidate`；browser mode 通过 local
Web transport bridge 暴露同样 App-owned API shape，使用 HTTP actions 和 SSE
Codex events。WebUI 是同一 chat-first surface 的 delivery surface，不是拥有
独立 state 或 authority 的第二个产品。

Hermes Desktop candidate 的 WebUI 要求遵循同源 UI 原则。Hermes upstream renderer
已经是 React/Vite Web 技术栈；OPL 不应为 Docker/WebUI 另写一套相似界面。正确做法是
保留同一 renderer 和 App product profile，只把 Electron preload/IPC adapter 替换为
browser shim + Web server transport。Docker/WebUI 的 server 负责连接 Codex CLI、
OPL CLI、workspace volume、HTTP/WebSocket/SSE events 和 file/preview APIs；浏览器
只消费 bridge，不取得 runtime truth 或宿主机任意文件系统 authority。

## PilotDeck 启发的信息组织

PilotDeck 可作为 interaction 和 visual reference 来学习 information
organization，但不能作为 source code、runtime authority 或第一屏 workbench
template。PilotDeck 的 evaluated ref、license、reference value 和 forbidden
reuse 由 `contracts/app-shell-candidates.json#design_references` 持有；本文只保留
App-owned feature mapping。PilotDeck 是 AGPL-3.0，而本 App repo 是 Apache-2.0；
没有明确 license 决策前，OPL 不能复制或 vendoring PilotDeck 代码。可复用经验是
信息组织方式：

- 轻量 left rail 按 workspace 或 project 分组，再按 conversation 分组，但不
  成为 primary UI。
- Main pane 保持 chat-first，并把 composer 固定在底部，让第一屏是工作面，
  而不是 dashboard 或 landing page。
- Compact grouped tabs 暴露相邻 context，且不强迫用户离开 selected chat：
  PilotDeck 中是 Agent、Files、Skills、Routing、Memory、Always-On；OPL 应映射
  为右侧可收起 inspector tabs：conversation context、Files、Capabilities、
  Runtime/cost refs、Memory refs、Automations、Settings。
- File browsing、process traces、routing/cost readouts、memory inspection 和
  long-running work views 是 chat 背后或旁边的 contextual surfaces，不是和
  conversation 竞争的 first-screen panels。
- Composer 用紧凑 controls 表达 mode、attachments、mentions、context usage 和
  send state。OPL 应保留这种密度，但普通界面使用 App-owned purpose labels、
  file attachment、refs 和 Codex status 替代 mode、permission controls 和
  `@MAS`/`@MAG`/`@RCA` 技术标签。

OPL adaptation 故意比 PilotDeck 窄。OPL 保持 Codex app-server 作为 primary
backend，App-owned purpose routing 作为普通路径，OPL Framework/domain
projections 作为 runtime、memory、action、artifact refs 的来源。PilotDeck 的
gateway、agent runtime、memory store、router、always-on store、provider model
list 和 WorkSpace state model 只是可研究的 implementation material，不是 App
authority。

## Codex App-like 视觉目标与 Stitch 工具边界

`hermes-codex`、`agui-codex` 和未来 shell 的主目标是 Codex App-like chat-first surface：
中心对话、底部多行 composer、轻量顶部 chrome、窄 icon rail，以及默认收起的
workspace/session rail 和右侧 inspector。Google Stitch 可以持续作为在线设计
工具，用来生成草图、校准比例、字体、圆角、留白和视觉层次；它不是唯一参考，
更不是 product truth。任何 Stitch、PilotDeck、CopilotKit 或 AG-UI demo 的输出
都必须回到 Codex App-like 目标上评估。

这里的目标不是持续沿用某一次 Google Stitch 设计稿，而是持续逼近 Codex App
的一比一普通交互。Stitch 只是设计工具：可以用它生成新的视觉建议、比较比例或
检查美术风格，但不能把生成稿里的信息架构、demo 数据、默认 inspector、工作台
密度或组件层级当成 OPL App 的验收标准。

Google Stitch reference 的 source URL、本地 artifact、evaluated state、
reference value 和 forbidden reuse 由
`contracts/app-shell-candidates.json#design_references` 持有。本文只保留对
`agui-codex` 和未来 shell 仍有效的 visual-token mapping：美术风格、视觉比例和
组件语言可以参考，源码和 demo 语义不能采纳：

- 主屏保持 chat-first，使用约 780-820px fixed reading lane，避免大面积居中卡片。
- Bottom composer 是第一屏视觉锚点，位于底部渐隐层上，带目的 chips、attach
  和 send 控件。
- Nav rail 是窄 icon rail，active state 用浅灰 tonal fill，不用高饱和色块。
- 右侧 inspector 是可收起的次级 surface，用 Runtime、Files、Context、
  Automations 等 tabs 组织信息。
- 视觉系统采用 Quiet Utility：`#f8f9fa` canvas、`#ffffff` active surface、
  `#e1e3e4/#c6c6cd` outline、`#111827/#191c1d` primary text/action、4px spacing
  base、pill/circle controls、约 32-36px radius 的 composer sheet、轻 outline
  替代重 shadow。
- Typography 使用 Inter 为主，JetBrains Mono 仅用于 code、receipt、process 和
  technical refs。
- Header route line、model status 和 composer status 必须保持辅助权重；主视觉
  锚点是 conversation reading lane 和 composer input。右侧 inspector 打开后要用
  spacing、outline 和清晰标题分层，避免所有 cards 同权重堆叠成 workbench。
- Composer 是底部唯一主 action surface。第三方 chat input 的外层 adapter
  container 必须透明，真正可见的输入 pill/sheet 只能有一层背景、一层 outline、
  一组 shadow 和统一圆角裁剪；不能在圆角输入框背后露出白色矩形底板。Purpose、
  workspace、send/stop 和 context controls 使用 pill/circle 形态，避免 4-10px
  随机小圆角造成的方块感。
- Composer 不能被做成过度装饰的大卡片。它应该像 Codex App 的任务输入区：
  底部固定、可多行、轻 outline、克制 shadow、工具行可见但不抢主输入焦点。
- Composer 默认必须像 Codex App 一样能承载多行任务描述：桌面默认 surface 高度
  至少约 100px，内部 textarea 至少约 60px，字号约 16px，line-height 约 22-24px；
  不能让用户感觉只能打一行字。
- 双语界面中，中文 first screen 主标签使用 `科研`、`基金`、`演示`、`本机助手`
  和 `自动`，英文界面使用 `Research`、`Grant`、`Presentation`、
  `Local assistant` 和 `Auto`；`Codex CLI`、`MAS/MAG/RCA` 等技术标签进入
  二级详情、diagnostics 或 evidence，不作为中文普通首页主要文案。

OPL adaptation 必须比 Stitch 窄：不要复制 Stitch HTML、Tailwind class 或生成
源码；不要采用其中的 local inference、model/VRAM 或 demo data 语义；不要让
示范 inspector 默认打开。App-owned 规则仍是 ordinary home 默认 chat-first，
workspace rail 和 inspector 默认收起，运行与 continue-work 信息进入 Runtime 或
secondary context，不在 composer 附近显示 compact entry。若 Stitch 生成稿偏向
workbench、表格化 dashboard 或默认右侧 inspector，应只吸收视觉 token，不吸收
信息架构。

## Core Conversation 功能

- 创建 new conversation。
- 发送前选择或更改 workspace directory。
- 向 Codex 发送 text instruction。
- Shell 支持 native file picking 时，可以 attach files 或 folders。
- Codex 运行中展示 streaming 或 pending assistant state。
- 当前 turn 运行中展示 live run artifact；完成后保留 compact receipt，必要时可
  展开查看事件 refs。
- Assistant replies 保持在可读 chat thread 中。
- 不离开 conversation 也可以切换 purpose routing。
- 选中的 purpose route 以普通语言标签保留；`@MAS`、`@MAG`、`@RCA` 只作为
  route receipt 或 diagnostics 技术信息。
- Conversation history 可从 navigation rail 访问。
- 支持 pop-out 或可收起右侧 Copilot panel 作为 secondary context。
- Backend 发出 safe tool、process、diff、file/context events 时展示这些事件，
  但不把 protocol details 变成用户导航。
- Codex 需要 decision 时，user-input prompts 和 permission confirmations 留在
  conversation 中。
- Logs、raw protocol frames、adapter diagnostics 留在 technical 或 developer
  surfaces，而不是 ordinary chat UI。
- Composer 保持高密度且面向工作：purpose tag、file attach、mention/ref
  insertion、context status、send/stop state 要能共存，同时不把 composer 变成
  backend settings panel。
- Composer 的运行反馈必须能被用户直接看见：发送后显示处理中状态和 elapsed
  seconds，直到 response 完成、停止或失败。

## OPL Capability Entries

- `科研` 路由到 MAS。
- `基金` 路由到 MAG。
- `演示` 路由到 RCA，用于 PPT、汇报和视觉交付物。`ppt` 是 App contracts、
  product profile 和 page-state matrix 当前稳定的内部 purpose id，只在机器合同
  和 route receipt 语境使用，不进入普通中文 chrome。
- OMA 保持 explicit 或 settings-only，直到产品决策让它默认可见。
- Assistant-scoped skills 来自 App-owned packaged skill profiles，而不是
  shell-local discovery。

## Runtime 与 Settings 功能

- 普通 page state 从 `opl app state --profile fast --json` 读取。
- 普通 page state refresh 也使用同一个 fast profile。
- Full state 和 Operator full drilldown 只在 explicit diagnostic/release paths
  使用。
- Runtime 页默认展示 `opl app state --profile fast --json` 的用户任务和项目线：
  summary cards、activity center、task drilldowns 和 active project refs。Operator
  drilldown 和 `current_control_state` 是 secondary diagnostics，不是普通运行任务
  计数来源。
- Running task 只由显式 `running`、`in_progress` 或 `advancing` status/state
  产生；`active_run_id` 可显示为上下文，但不能单独证明正在运行。
- Runtime/inspector 中的“进行中项目”来自 `opl app state --profile fast --json`
  的 `operator.workbench.activity_center.active_projects`、summary card 和
  `operator.visual_ref_groups.active_project_refs`。它表示用户视角仍在推进的
  project/paper line；`queued`、`escalated` 等 owner-handled 状态可以计入，但
  UI 必须同时展示 status、active_run_id 和 next visible step，避免误读为 active
  worker execution。
- Queued、waiting、stopped、parked、checkpointed、blocked 或其它非运行项目线
  默认折叠，只在 Runtime 页显示数量、状态和下一步摘要，用户展开后再看具体 refs。
- Home 不展示 runtime activity、continue-work、needs-attention/active/recent
  refs、per-assistant running badges 或底部 feedback/favorite/web 图标；这些信息
  进入 Runtime 页、右侧 inspector、drawer 或其他 secondary context surface。
- Module 和 path 只作为 refs 展示，不取得 runtime 或 domain authority。
- Settings sections 是 General、Access、Agents & Capabilities、Local
  Environment、Appearance、Advanced、About & Updates。
- Agents & Capabilities 的内置技能列表和自动注入技能只展示 App packaged skill
  whitelist 中的技能；AionUI implementation helper 如 `aionui-skills` 不作为 OPL 能力展示。
- Home/new conversation 的普通技能/MCP 选择不使用完整 packaged skill dump 或
  AionUI backend MCP catalog。普通技能来自 MAS/MAG/RCA assistant profile allowlist；
  MCP 默认空白名单，只能由 App product profile 显式加入。
- AionUI upstream Team 入口不作为 OPL 普通能力、普通导航或 Settings tab 暴露；
  Team sidebar section、Team 自动跳转和 Team deep link 默认禁用，兼容 route 只做
  App-owned redirect。
- Update state 和 release channel labels 本地化。
- Runtime、memory、automations、files、capabilities 作为可收起 contextual
  tabs 或 inspector surfaces 展示，并 scoped 到 selected workspace/conversation。
- Inspector 在窄桌面/WebUI 下仍是可收起次级层。若横向空间不足，用 overlay 或
  drawer 保持可用宽度；不能让 context toggle 进入 active 状态但 tabs 和 Routing
  panel 不可见。
- Long-running work 呈现为 plans、runs、receipts、deliverable refs 和 operator
  actions；不要表现成无人管理的 background daemon。
- Cost/routing/model details 作为 technical 或 connected-state readouts 展示，
  不作为 home 或 ordinary conversation path 上的普通 model picker。

## First-Run 功能

- Launch readiness 只 gate Core items：workspace root、Codex CLI、Codex config。
- 从 `opl system initialize --json` 展示 first-run phase、Core progress、Full
  readiness progress、background maintenance counts、blockers 和 next visible
  step。
- Core readiness 完成后，允许用户进入 main guide。
- Full readiness 和 background maintenance 保持非阻塞，除非 App-owned
  contract 另有声明。

## Shell 要求

任何 shell candidate 必须实现这份清单，但不能成为 product authority：

- 消费 adapter contract 生成的 App product profile。
- 使用 App-owned state/action command surfaces。
- 通过 App wrapper 编译为可启动 `.app`。
- 用 thin-shell delta 实现 OPL product behavior：profile consumer、route
  redirects、bridge calls、局部 renderer 组合、CSS/i18n 和 focused tests。
- 实现 App-owned bilingual copy policy：普通 UI 在简体中文/英文下分别一致呈现，
  中文普通首页不混入 `Med Auto Science`、`Med Auto Grant`、`RedCube AI`、
  `PPT`、`Codex CLI`、`Local assistant` 这类英文技术/产品文案；workspace rail、composer、
  context inspector 和 routing summary 也不得混入 `MAS`、`MAG`、`RCA`、
  `app_state.actions`、`opl_app_state.v1` 等技术标签；协议或 backend 名称不进入
  ordinary chat surface。
- 新 Home/Settings/capability/runtime/first-run 产品行为先进入 App contract，
  再进入 shell implementation。
- 声称 WebUI support 时，使用与 Electron shell 相同的 renderer 和 App-owned
  bridge shape，并提供 Web transport evidence 和 WebUI smoke。
- Adoption 前通过 App-owned page-state 和 first-run matrices。
- Adoption 前只能通过 explicit candidate adapter 被选择。
- 修改 primary chat surface 时，用 visible pixels 证明 source 和 packaged UI
  smoke。

## Hermes Desktop Candidate 投影

`hermes-codex` 是当前最高优先级 Codex-like GUI candidate。它的来源是
`NousResearch/hermes-agent` 的 `apps/desktop`，许可证记录为 MIT。Hermes 的价值
在于它比通用 agent dashboard 更接近 Codex-like desktop 形态；但它仍必须通过
App-owned contracts、adapter 和验证脚本进入 OPL App，不能直接成为 product truth。

Hermes 的候选策略是 upstream-first，而不是 blank-slate。它应该先回官方 Hermes
Desktop 功能基线，把官方 `apps/desktop` 当成可升级参考系：后续跟随 upstream 时
记录 ref，对比 `apps/desktop` 和 shared package 变化，再重放 OPL 最小 delta。
最小 delta 只包括 OPL candidate branding、中文/英文 copy、图标、bundle metadata、
OPL App-managed first-run、模型访问 API key 配置、Codex app-server-backed
Hermes gateway adapter、MAS/MAG/RCA Codex Skill 入口和 explicit candidate wrapper。
除这些面外，任何新增 OPL surface 都要先说明 upstream 已有能力、OPL 需要保留/隐藏/
替换什么、truth owner 是谁，以及是否触发 App-owned adoption gate。

Hermes 第一版接入边界：

- Candidate registry：`contracts/app-shell-candidates.json` 中的 `hermes-codex`。
- Explicit adapter：`contracts/shell-adapters/hermes-codex.json`。
- Source checkout：优先 `shells/hermes`；可接受同级外部 checkout
  `../opl-hermes-shell`；两者都不存在时，验证报告 `blocked_missing_checkout`。
- Build wrapper：
  `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/hermes-codex.json npm run package`。
- Active shell：仍为 AionUI；Hermes 不进入默认 stable/nightly release packaging。

Hermes 第一版按三阶段路线推进。当前 Phase 1 不是“实现所有 Hermes Desktop
功能”，而是 compatibility firewall：每个 upstream 前端依赖必须被分类为
`implement`、`adapt`、`diagnostic_only` 或 `hide_or_remove`。能自然映射到 Codex
App-like OPL 普通路径的能力才实现；能帮助排障但不应给普通用户管理感的能力进入
Advanced/Diagnostics；Profiles、Cron mutations、Skills/Toolsets、Messaging/Handoff、
provider marketplace、update/restart、audio/media remote helpers 等 full-Hermes
backend 面默认从普通入口隐藏或降为诊断。Phase 2 才把 OPL 品牌化能力做成更自然的
产品入口；Phase 3 才评估完整 App product profile 和 active-shell adoption。

Hermes 第一版只替换最小几类上游面，才能声称 minimal candidate package acceptance：

- Branding：替换为 One Person Lab App candidate 产品名、bundle id 和图标。
- Bilingual copy：通过 Hermes i18n catalog 管理简体中文/英文普通 UI；不维护
  繁体中文或日文 locale。
- First-run / startup：复用 Hermes onboarding/progress UI，但实际行为由 OPL CLI
  和 App-owned startup contract 执行，不下载或执行 Hermes Agent installer。启动
  分成四条线：每次启动轻量检查 marker、One Person Lab CLI、Codex CLI、gflabtoken
  模型访问和 Codex adapter startup；marker 缺失、过旧或核心组件缺失时才显示
  一次性本机初始化 checklist；缺模型访问 API key 时显示单独的“模型访问”配置，
  具体 key 可来自 gflabtoken，保存时调用
  `opl system configure-codex --api-key-stdin --json`；`opl system initialize --json`、
  startup maintenance、module reconcile、MAS/MAG/RCA 状态和 contract diagnostics
  在 adapter ready、主界面可见后后台异步刷新，不进入热启动阻塞路径。
- Renderer bootstrap routes：fallback Codex adapter 必须提供 `/api/profiles`、
  `/api/profiles/active`、`/api/profiles/sessions`、`/api/config`、
  `/api/config/defaults`、`/api/config/schema` 和 `/api/cron/jobs` 的
  renderer-safe 形状，避免复用官方 Hermes UI 时首页、侧栏或 settings 因基础数据
  缺失而空白。这些 route 只提供默认 profile/config/empty automation 投影，不接管
  完整 Hermes profile/runtime/cron authority；Cron mutation 不能在普通 UI 中显示成
  已有真实 scheduler。
- Icon：使用 OPL/AionUI 官方图标族，1024px 资源必须保留 macOS Dock safe margin；
  当前候选要求 alpha bounds 不超过 900px，目标为 `840x840+92+92`。
- Executor/Skill adapter：新增 Hermes-compatible Codex app-server adapter；
  Hermes UI 继续调用 `session.create` / `prompt.submit`，adapter 内部启动
  `codex app-server --listen stdio://`，并将 `session.create` 映射到
  `thread/start`、`prompt.submit` 映射到 `turn/start`、`item/agentMessage/delta`
  映射成 Hermes `message.delta`、`turn/completed` 映射成 Hermes `message.complete`。
  MAS/MAG/RCA 作为 Codex Skill/Plugin 调用入口，由 GUI slash shortcut 转成显式
  `$mas` / `$mag` / `$rca` prompt，并由 Codex app-server 的 structured skill input
  与本机 Skill/Plugin/MCP registry 决定实际加载；GUI 不做关键词 route，不直接执行
  domain CLI，也不拥有 runtime/domain truth。
- Candidate package wrapper：使用 explicit adapter packaging，不能进入默认
  stable/nightly release packaging。

普通用户体验目标是套壳 Codex App，而不是把 Hermes 的通用 backend/provider 工作台
暴露为 OPL home。用户应看到 workspace-aware chat、Codex conversation、Skill
shortcuts 和必要 refs；Hermes backend/runtime/provider 细节只在 Advanced、diagnostics
或明确 technical refs 中出现。Codex/MAS/MAG/RCA 接入是 Skill/Plugin extension，
不是全量替换 Hermes backend。

以下面必须先做 Hermes 原生功能对比，再决定是否进入候选：

- App product profile generated config。
- `opl app state/action` bridge。
- App page-state / first-run matrix mapping。
- Full packaged runtime。
- Stable release asset normalization / verification。
- WebUI parity wrapper。
- 自定义 workspace/session rail、right inspector、Runtime、Memory、Always-On 或
  其它 workbench-like surface。

当前 Hermes contract/build wrapper/docs 第一版只表达 candidate 接入和明确 blocker；
它不表示 release-ready、active-shell-adopted、production-ready 或 full-release-ready。
但候选包的“能启动并进入 OPL App”必须包含 first-run owner 修正：packaged smoke
需要证明没有 fetch/execute `install.sh` 或 `install.ps1`，有 OPL bootstrap events，
有 OPL Codex adapter startup，并且缺 key 时进入模型访问 onboarding；维护命令
只能作为 adapter ready 后的后台动作。

Hermes WebUI parity TODO：

- 盘点 renderer 依赖的 `window.hermesDesktop` 方法，划分 desktop-only、web-equivalent
  和 unavailable/diagnostic 三类。
- 定义 browser bridge：保持 App-owned bridge shape，使用 HTTP actions、
  WebSocket/SSE event stream 和 workspace volume APIs。
- 实现 Docker/WebUI server wrapper：静态托管同一 renderer，启动/代理 Codex CLI 与
  OPL state/action，不引入第二 runtime truth。
- 建立 WebUI smoke：同一 renderer paint、bridge init、Codex turn、workspace/file
  access、preview/tool output 和 settings 基本路径。
- 通过 App-owned Docker/WebUI release gates 后，再把 `webui_parity` 从 deferred
  surfaces 提升为 Hermes candidate capability。

Hermes 后续 OPL 定制的优先级：

- **保留：** upstream Hermes chat-first frame、files/previews、tool output、
  settings/onboarding、i18n 和 native packaging，只要不冲突。
- **品牌化/双语：** 产品名、bundle id、图标、普通文案和 OPL purpose labels；
  简体中文/英文 copy 跟随 Hermes i18n。
- **启动与首启：** 复用 Hermes onboarding/checklist UI 承载 OPL 一次性本机准备；
  模型访问是独立向导，热启动只做轻量检查，维护和 full status refresh 不阻塞进入 chat。
- **桥接：** Codex app-server adapter、route receipt、App state/action 和
  runtime refs，但必须等对应 App contract/gate 明确。
- **WebUI：** 通过同源 React/Vite renderer 加 browser transport adapter 提供
  Docker/WebUI，不复制第二套 UI。
- **隐藏/收窄：** 普通 OPL 路径不展示 provider/backend/permission/Hermes runtime
  细节；必要时留在 diagnostics、Advanced 或 explicit mode。
- **不替换 backend：** Codex 和 MAS/MAG/RCA 是 executor/purpose/agent route
  extension，不是重写 Hermes runtime 或拥有 OPL authority 的新 backend。
- **替换：** 只有 upstream 功能与 App-owned truth 冲突，或不能满足 Codex/OPL
  必需语义时才替换。

## AG-UI/CopilotKit Candidate 投影

AG-UI/CopilotKit candidate 应使用：

- CopilotKit React v2 作为用户可见 UI/runtime layer，承载 chat、popup、
  sidebar 和 agent runtime binding。
- AG-UI events 作为 renderer runtime 与 Codex 或 ACP adapters 之间的内部
  event/protocol layer。
- Codex app-server 作为 protocol boundary 后面的 primary Codex backend。
- `codex-acp` 只作为测试 external ACP clients 或 non-Codex agents 时的 ACP
  interoperability lane。
- CopilotKit examples 作为 UI integration reference，尤其是 v2 React Router
  和 React demo examples。
- AG-UI Dojo 作为 protocol capability 和 debugging reference，而不是直接复制
  的 desktop shell。
- `namanrajpal/acp-to-agui` 作为最接近的公开 ACP-to-AG-UI reference，因为它
  把 ACP agent streams bridge 到 AG-UI，并包含 CopilotKit demo。
- `agentclientprotocol/agent-client-protocol` 作为 ACP wire contract 和
  capability negotiation reference。
- Zed `codex-acp`、AionUi ACP setup、`formulahendry/acp-ui`、Harnss、
  OpenClaw `acpx`、Datalayer Agent Runtimes、`beyond5959/acp-adapter`、
  `cola-io/codex-acp`、`0xcaff/codex-web` 作为 compatibility 和 implementation
  references，而不是 primary OPL Codex path。
- OpenBMB PilotDeck 作为 polished lightweight workspace/session rail、
  chat-first main pane，以及 grouped Files、Skills、Routing、Memory、
  Always-On context 的信息组织参考。PilotDeck 的 AGPL code 和 runtime 不能复制
  到 App repo；OPL 应通过 App-owned contracts 和 selected shell 重新表达可用的
  organization pattern。
- Google Stitch `One Person Lab` 设计稿作为 Quiet Utility 视觉参考：灰阶
  tonal layers、1px outline、760px reading lane、底部 pinned composer、窄 rail
  和右侧 inspector。它不能成为源码或 runtime authority。

AG-UI/CopilotKit reference inventory、research conclusion、adapter policy 和
candidate adoption gate 由 `contracts/app-shell-candidates.json` 持有。当前产品
读法是：还没有成熟公开项目可以直接作为完整 Codex ACP adapter 到
AG-UI/CopilotKit desktop shell；可复用部分仍是分散的。Codex app-server 提供
native Codex GUI protocol，codex-acp style adapters 提供 ACP compatibility，
AG-UI 加 CopilotKit 提供 visible event/UI layer。因此 OPL 保留 normalized
adapter contract，把 Codex 或 ACP session events 映射到 AG-UI events。

AG-UI 不是普通 App path 的用户可见产品概念。用户应该看到 OPL chat surface、
purpose entries、conversation state、receipts 和 runtime status。Protocol names、
event frames、debug dashboards 只属于 diagnostics 或 developer verification
material。

当前 candidate proof path 的命令、最低验收和 evidence lifecycle 由
`docs/agui-codex-candidate-verification.md`、candidate manifest、shell artifacts、
CI logs 和 App-root validation output 持有。本文只保留 feature-level target shape：

- Electron thin shell 加载 generated App product profile。
- Renderer 使用 CopilotKit React v2 chat primitives 和紧凑 OPL frame；形态来自
  public chat-agent demo，而不是 dashboard 或解释性 landing page。
- 同一个 renderer 必须能作为 WebUI 使用；Electron preload 缺失时，browser
  bridge 创建 `window.oplCandidate`。
- Main process 拥有 Codex app-server JSON-RPC over stdio。
- WebUI gateway 拥有 local HTTP action routes 和 SSE Codex event stream，同时
  继续消费 App-owned `opl app state/action` 和 Codex app-server surfaces。
- Candidate 必须通过 shell-side `npm run validate:state-model`，证明 active
  project line projection/state model 来自 `opl app state --profile fast --json`，
  且只作为 refs/projection consumption 使用。
- Codex `thread/start`、`turn/start`、`item/agentMessage/delta` events 映射到
  AG-UI run/text/step events。
- Workspace selector 打开 native directory picker；切换 directory 会在该
  workspace 中为后续 Codex turns 启动 fresh app-server thread。
- New-conversation action reset 当前 Codex thread，同时保留 selected workspace。
- 普通 UI 保持 chat-first，带 lightweight workspace/session rail 和右侧可收起
  Files/Skills/Routing/Memory/Always-On inspector tabs；信息组织参考 PilotDeck。
- Continue-work refs 和运行活动只能进入 Runtime 或 secondary context，
  不能在 ordinary home 第一屏显示为 compact entry 或 Activity/refs grid。
- Candidate packaging 必须产出可启动 `.app`，并通过真实 Codex backend 的 source
  与 packaged UI smoke。
- Candidate WebUI smoke 必须证明 shared renderer、browser transport bridge、
  HTTP action routes 和 SSE event stream。
- Candidate UI smoke 必须包含 pixel-visible paint check，避免 DOM-only pass
  掩盖视觉空白窗口。
- Candidate UI smoke 必须包含 chat-first visual polish gate：composer 内层输入
  surface 至少 32px radius、默认高度至少约 100px、textarea 至少约 60px 且呈
  多行输入体验；overflow clipping 生效、外层 Copilot/adapter 容器透明、内部
  layout 子层无额外白底/阴影，send/chip controls 达到 pill/circle 半径要求。
- Candidate UI smoke 必须保持 AG-UI 作为内部 event boundary，并拒绝 ordinary
  chat surface 上出现用户可见 AG-UI/debug dashboard copy。

## AG-UI/CopilotKit Candidate 验证 Owner

本文只保留 AG-UI/CopilotKit candidate 的 GUI 能力清单、reference mapping 和
产品语义投影。候选 shell 的命令、最低验收、evidence lifecycle 和 release
replacement gate 由下列 owner 承接：

| 验证主题 | Current owner |
| --- | --- |
| Candidate runbook、命令顺序、最低验收、evidence lifecycle | `docs/agui-codex-candidate-verification.md` |
| Candidate registry、explicit adapter participation、replacement gate、reference implementations | `contracts/app-shell-candidates.json` |
| Explicit adapter selection and shell root | `contracts/shell-adapters/agui-codex.json`; Hermes uses `contracts/shell-adapters/hermes-codex.json` |
| Candidate registry validation | `scripts/validate-shell-candidates.ts` and `npm run validate:shell-candidates` |
| Default active-shell guard | `contracts/app-shell-adapter.json` and `scripts/validate-active-shell.ts --quick` |
| Candidate evidence | candidate manifests, shell artifacts, CI logs, source/WebUI/package smoke, and App-root validation output |

`agui-codex` 当前仍是 technical verification candidate。默认 release shell 仍是
AionUI；candidate 只有在 `contracts/app-shell-adapter.json` 被明确修改并通过正常
release gates 后，才会进入默认 stable/nightly release path。

`hermes-codex` 同样仍是 technical verification candidate，并且当前优先级高于
AG-UI/CopilotKit candidate。Hermes 缺 checkout 时，验证结果应停在明确 blocker；
补齐 `shells/hermes` 或 `../opl-hermes-shell` 后，才能继续做 branding/runtime
bridge/build wrapper 替换和后续 smoke evidence。
