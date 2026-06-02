# OPL App GUI 能力清单

Owner: `one-person-lab-app`
Purpose: `product_level_gui_feature_inventory`
State: `active`
机器边界：本文是人读能力清单。机器可读 GUI 真相在 App-owned contracts、
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
- 支持中文/英文双语 UI；普通界面同屏单一语言呈现，不随机中英混排。

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
  activity 和 settings copy 有中文/英文两套显示；切换语言不改变 runtime truth、
  route receipt 或 workspace/thread state。
- Workspace/session rail、context inspector、context tabs 和 routing summary
  是普通用户层 chrome，必须按当前语言完整渲染；隐藏 DOM 或 raw details 可以
  保留技术标签，但可见中文普通层不能混入 `New Codex turn`、`Local assistant`、
  `Codex CLI`、`MAS/MAG/RCA`，英文普通层不能残留中文目的/状态标签。
- Backend、provider、permission mode selectors 不进入普通 home 和
  conversation flows；model selector 只能作为 App-owned Codex 模型控制出现。
- Codex conversation composer 仍要显示同一个 App-owned model selector/status，
  并在 pending/running 时显示已经等待的秒数。
- Desktop Electron 和 WebUI surfaces 使用同一套 App product truth。
- 窄桌面和 WebUI 宽度下，二级 context 不变成首页工作台；用户打开后必须以
  overlay/drawer/右侧浮层形式可见，至少保证 `opl-context-tabs` 和
  `opl-routing-panel` 实际显示。

WebUI 目标与 Electron candidate 共享同一个 React/CopilotKit renderer。Electron
通过 native preload/IPC 提供 `window.oplCandidate`；browser mode 通过 local
Web transport bridge 暴露同样 App-owned API shape，使用 HTTP actions 和 SSE
Codex events。WebUI 是同一 chat-first surface 的 delivery surface，不是拥有
独立 state 或 authority 的第二个产品。

## PilotDeck 启发的信息组织

PilotDeck 可作为 interaction 和 visual reference 来学习 information
organization，但不能作为 source code、runtime authority 或第一屏 workbench
template。2026-05-30 的 review 使用
`OpenBMB/PilotDeck@33394d1069c3528052c3f12eb1d905060b34cc2f` 和 public demo。
PilotDeck 是 AGPL-3.0，而本 App repo 是 Apache-2.0；没有明确 license 决策前，
OPL 不能复制或 vendoring PilotDeck 代码。可复用经验是信息组织方式：

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

## Stitch 启发的视觉语言

Google Stitch 生成的 `One Person Lab` 设计稿可作为 `agui-codex` 和未来 shell
的 visual reference。它的价值是美术风格、视觉比例和组件语言，不是源码采纳：

- 主屏保持 chat-first，使用约 760px fixed reading lane，避免大面积居中卡片。
- Bottom composer 是第一屏视觉锚点，位于底部渐隐层上，带目的 chips、attach
  和 send 控件。
- Nav rail 是窄 icon rail，active state 用浅灰 tonal fill，不用高饱和色块。
- 右侧 inspector 是可收起的次级 surface，用 Runtime、Files、Context、
  Automations 等 tabs 组织信息。
- 视觉系统采用 Quiet Utility：`#f8f9fa` canvas、`#ffffff` active surface、
  `#e1e3e4/#c6c6cd` outline、`#111827/#191c1d` primary text/action、4px spacing
  base、8px 以内 radius、轻 outline 替代重 shadow。
- Typography 使用 Inter 为主，JetBrains Mono 仅用于 code、receipt、process 和
  technical refs。
- Header route line、model status 和 composer status 必须保持辅助权重；主视觉
  锚点是 conversation reading lane 和 composer input。右侧 inspector 打开后要用
  spacing、outline 和清晰标题分层，避免所有 cards 同权重堆叠成 workbench。
- 双语界面中，中文 first screen 主标签使用 `科研`、`基金`、`演示`、`本机助手`
  和 `自动`，英文界面使用 `Research`、`Grant`、`Presentation`、
  `Local assistant` 和 `Auto`；`Codex CLI`、`MAS/MAG/RCA` 等技术标签进入
  二级详情、diagnostics 或 evidence，不作为中文普通首页主要文案。

OPL adaptation 必须比 Stitch 窄：不要复制 Stitch HTML、Tailwind class 或生成
源码；不要采用其中的 local inference、model/VRAM 或 demo data 语义；不要让
示范 inspector 默认打开。App-owned 规则仍是 ordinary home 默认 chat-first，
workspace rail 和 inspector 默认收起，运行与 continue-work 信息进入 Runtime 或
secondary context，不在 composer 附近显示 compact entry。

## Core Conversation 功能

- 创建 new conversation。
- 发送前选择或更改 workspace directory。
- 向 Codex 发送 text instruction。
- Shell 支持 native file picking 时，可以 attach files 或 folders。
- Codex 运行中展示 streaming 或 pending assistant state。
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
- `演示` 路由到 RCA，用于 PPT、汇报和视觉交付物。底层 route id 可继续是 `ppt`
  以兼容既有 profile。
- OMA 保持 explicit 或 settings-only，直到产品决策让它默认可见。
- Assistant-scoped skills 来自 App-owned packaged skill profiles，而不是
  shell-local discovery。

## Runtime 与 Settings 功能

- 普通 page state 从 `opl app state --profile fast --json` 读取。
- 普通 page state refresh 也使用同一个 fast profile。
- Full state 和 Operator full drilldown 只在 explicit diagnostic/release paths
  使用。
- Runtime 页先展示 `opl runtime app-operator-drilldown --json` 的
  `current_control_state` provider running activity，再展示 project progress
  refs 和 detailed drilldown。
- Runtime/inspector 中的“进行中项目”来自 `opl app state --profile fast --json`
  的 `operator.workbench.activity_center.active_projects`、summary card 和
  `operator.visual_ref_groups.active_project_refs`。它表示用户视角仍在推进的
  project/paper line；`queued`、`escalated` 等 owner-handled 状态可以计入，但
  UI 必须同时展示 status、active_run_id 和 next visible step，避免误读为 active
  worker execution。
- Home 不展示 runtime activity、continue-work、needs-attention/active/recent
  refs、per-assistant running badges 或底部 feedback/favorite/web 图标；这些信息
  进入 Runtime 页、右侧 inspector、drawer 或其他 secondary context surface。
- Module 和 path 只作为 refs 展示，不取得 runtime 或 domain authority。
- Settings sections 是 General、Access、Agents & Capabilities、Local
  Environment、Appearance、Advanced、About & Updates。
- Agents & Capabilities 的内置技能列表和自动注入技能只展示 App packaged skill
  whitelist 中的技能；AionUI implementation helper 如 `aionui-skills` 不作为 OPL 能力展示。
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
- 实现 App-owned bilingual copy policy：普通 UI 在中文/英文下分别一致呈现，
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

2026-05-29 的调研结论是：还没有成熟公开项目可以直接作为完整 Codex ACP
adapter 到 AG-UI/CopilotKit desktop shell。可复用部分是分散的：Codex
app-server 提供 native Codex GUI protocol，codex-acp style adapters 提供 ACP
compatibility，AG-UI 加 CopilotKit 提供 visible event/UI layer。因此 OPL 保留
一个 normalized adapter contract，把 Codex 或 ACP session events 映射到 AG-UI
events。

AG-UI 不是普通 App path 的用户可见产品概念。用户应该看到 OPL chat surface、
purpose entries、conversation state、receipts 和 runtime status。Protocol names、
event frames、debug dashboards 只属于 diagnostics 或 developer verification
material。

当前 candidate proof path：

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
- Candidate UI smoke 必须保持 AG-UI 作为内部 event boundary，并拒绝 ordinary
  chat surface 上出现用户可见 AG-UI/debug dashboard copy。

## AG-UI/CopilotKit Candidate 验证

Candidate 只能通过 explicit adapter contract 选择：

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json
```

App-root verification 和 packaging commands：

```bash
node --experimental-strip-types scripts/validate-active-shell.ts --quick
npm run validate:shell-candidates
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json node --experimental-strip-types scripts/validate-active-shell.ts --quick
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

Candidate-shell verification commands：

```bash
cd shells/agui-codex
npm install
npm run validate:adapter-events
npm run validate:state-model
npm run validate:candidate
npm run build:renderer
npm run smoke:webui
npx electron . --ui-smoke-test
'./out/One Person Lab AG-UI Codex Candidate.app/Contents/MacOS/One Person Lab AG-UI Codex Candidate' --ui-smoke-test
```

该 candidate 的最低验收：

- App-root active-shell validation 仍把默认 release shell 解析为 AionUI。
- Candidate registry validation 通过，并确认只有 explicit candidate build
  participation。
- Generated product profile 由 App 拥有，并包含 Codex fixed executor、
  MAS/MAG/RCA purpose entries 和 hidden ordinary selectors。
- Candidate state-model validation 通过，并覆盖 active project line
  `status`、`active_run_id`、`next_visible_step`、
  `progress_delta_classification`、`deliverable_progress_delta`、
  `platform_repair_delta` 和 `next_forced_delta`；该证据不能写成 domain ready、
  production ready、clean-VM ready、Full release ready 或 active-shell adoption。
- Source renderer build 成功。
- WebUI smoke 通过，使用同一 renderer、browser `window.oplCandidate` bridge、
  HTTP action routes 和 SSE Codex event stream。
- Source UI smoke 在默认 chat-first home 上绘制 visible pixels，展示 purpose
  entries，启动真实 Codex app-server turn，收到 `OK`，并证明 workspace/session
  rail 和 inspector 默认收起，首页不显示 runtime activity、continue-work 或
  Activity/refs grid；refs 只在 Runtime/secondary context 出现。
- UI 把 lightweight workspace/session rail 和右侧可收起 Files、Skills、Routing、
  Memory、Always-On inspector tabs 暴露为 optional context surfaces，不采用
  PilotDeck runtime authority，也不把它们做成 first-screen panels。
- Candidate packaging 产出带 `Contents/Info.plist` 和 `Contents/MacOS`
  executable 的可启动 `.app`。
- Packaged UI smoke 针对 `.app` bundle 通过，ordinary chat surface 不出现
  AG-UI/debug protocol copy，并证明同样 default-collapsed chat-first home。
- Page-state、first-run、runtime summary/full-drilldown 和 safe App action
  dry-run evidence 由 candidate smoke 记录，并由 App-root candidate validation
  检查。
- Release replacement 保持 explicit：candidate 不会成为默认 stable/nightly
  shell，直到 `contracts/app-shell-adapter.json` 被明确修改。

2026-06-02 chat-first / bilingual 技术验证 evidence：

- Source renderer build 在 `/Users/gaofeng/workspace/opl-agui-codex-shell` 通过；
  Vite 仍有 node-fetch browser externalization 和大 chunk warning，未导致失败。
- App-root candidate gate 现在要求 `/Users/gaofeng/workspace/opl-agui-codex-shell`
  侧 `npm run validate:state-model` 通过后，才能刷新 candidate implementation
  currentness claim；当前记录不把 state-model gate 解释为 release、domain 或
  production readiness。
- Candidate `.app` bundle 当前构建到
  `/Users/gaofeng/workspace/opl-agui-codex-shell/out/One Person Lab AG-UI Codex Candidate.app`。
- Package 后重新运行 WebUI smoke，通过同一 renderer、browser bridge 注入、
  `window.oplCandidate` shape、Settings IA、secondary Runtime/refs surface、
  七类 conversation events、bilingual UI 和 default-collapsed home parity。
- Package 后重新运行 source UI smoke，普通中文 purpose entries 为 `科研`、`基金`、`演示`，
  route label 为 `科研本机助手/Users/gaofeng`，`model_status=自动`，
  `default_home_layout_status=passed`，stage classes 为 `without-rail` 和
  `without-inspector`，`home_continue_work_visible=false`，
  `home_runtime_activity_visible=false`，`bilingual_ui_status=passed`，
  `locale_switch_status=passed`，visible paint 成功，并收到 Codex reply `OK`。
- Package 后重新运行 packaged UI smoke，`packaged=true`，同样证明
  default-collapsed chat-first home、中文默认 UI、英文切换、secondary runtime
  context refs、safe App action dry-run、visible paint 和 Codex reply `OK`。
- Final manifest 当前包含 `source_ui_smoke_status=passed`、
  `packaged_ui_smoke_status=passed`、`webui_smoke_status=passed`、
  `bilingual_ui_status=passed`、`default_home_layout_status=passed`、
  `secondary_runtime_context_refs_status=passed`、
  `runtime_summary_detail_action_bridge_status=passed`、`settings_ia_status=passed`、
  `chat_event_rendering_status=passed`、`webui_parity_status=passed` 和
  `action_dry_run_status=passed`。
- Candidate shell final gate 通过：
  `npm run validate:candidate -- --require-app --require-smoke`。

当前默认 release shell 仍是 AionUI，直到该 candidate 满足
`contracts/app-shell-candidates.json` 中的 shell replacement gate。
