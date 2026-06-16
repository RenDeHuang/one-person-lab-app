# OPL App 理想 GUI 交互细则

Owner: `one-person-lab-app`
Purpose: `app_ideal_gui_interaction_spec`
State: `active_definition`
Machine boundary: 本文是人读交互定义。机器可读 GUI 真相在 `contracts/`、
page-state 矩阵、adapter contracts、源码、发布产物和测试输出中。

本文定义 One Person Lab App 的理想用户交互模型。它不绑定具体 shell。
AionUI、`agui-codex`、`hermes-codex` 和未来 GUI carrier 都实现这份 App-owned 产品定义，
不能反过来重新定义它。

当前 active shell 是 AionUI fork。为了后续跟随 upstream 或替换 shell，本文的
要求应通过 App-owned contracts、generated product profile、page-state matrix
和 adapter bridge 落地。AionUI 侧只承担薄实现：读取 profile、映射 legacy
routes、组合已有 renderer primitives、调用 App state/action bridge，并用
focused tests 证明行为。不要把产品 IA、runtime truth、model/provider policy
或 first-run gates 写成 fork-local authority。

`hermes-codex` 是当前最高优先级 Codex-like GUI candidate。它的外部来源是
`NousResearch/hermes-agent` 的 `apps/desktop`，许可证记录为 MIT；当前只允许做
minimal adapter：保留 Hermes Desktop 原生功能基线，替换候选 branding，增加
Codex CLI adapter，并通过 explicit candidate package 产出 `.app`。App
state/action、page-state、first-run、Full runtime、WebUI parity 等面必须先经过
Hermes 功能对比和 App-owned adoption gate，不能按旧 AionUI/AGUI 稳定路径直接
搬运。Hermes candidate 不改变当前 AionUI 默认 release shell，也不表达
release-ready。

Hermes 路线的产品假设和 AG-UI spike 不同：Hermes Desktop 已经是完整通用桌面
Agent GUI，具备 chat、workspace/files、preview、tool output、settings、onboarding
和 native packaging 等基础能力。因此 OPL 对 Hermes 的默认策略不是重新设计一个
GUI，而是在 upstream 功能基线之上做收敛定制：品牌化、Codex CLI 后端适配、隐藏
普通用户不需要的 provider/backend/runtime 概念、把必要的 OPL purpose/runtime refs
接到 App-owned contracts。每一项深层改造都必须先回答 upstream 已有什么、OPL 要
保留/隐藏/替换什么、source of truth 属于谁，以及是否触发 App-owned page-state、
first-run、runtime bridge 或 release gate。

## 产品原则

理想 OPL App 是 Codex App 形态的桌面/WebUI 产品，专门服务 OPL 工作。
第一屏是已选工作目录里的工作聊天画布。用户可以开始或继续一个 Codex
对话，发送任务，观察执行进度，并在需要时打开上下文信息。

App 应该像一个聚焦的工作界面，而不是门户、dashboard、launcher 或多
agent 控制台。OPL 的专用能力来自默认设置、领域上下文、receipt 和次级
inspector，而不是把普通第一屏做得很密很重。

理想第一屏也不应退化成“工作台首页”。Workspace、Runtime、Files、Memory、
Routing、Always-On 都是重要能力，但它们的默认位置是按需 context surface，
不是压在 chat 之前的常驻信息墙。用户打开 App 后第一件事应当是继续或发起
Codex 对话，而不是先读一组面板说明。

对成熟 upstream shell，产品原则还有一条反向约束：能沿用 upstream 的成熟
chat-first 结构、视觉系统和原生桌面能力时，不从零重写。OPL 定制应该优先表现为
更窄的普通路径、更清楚的品牌和执行器、更少不必要选择项，以及 App-owned
contracts 约束下的必要能力增量。只有 upstream 原生功能与 OPL 产品目标冲突，
或缺少 Codex/OPL 必需语义时，才进入替换或新增。

## 默认第一屏

普通 home 状态应该是：

- frame 中能看到已选 workspace 路径。
- 主区域是 chat conversation canvas，并带固定 composer。
- 当前 OPL purpose 以紧凑 route indicator 显示，默认 MAS，除非用户切换。
- model 状态自动、紧凑展示。
- 新建对话、切换 workspace、打开 context、设置等控制是小型直接控件。
- workspace/session rail 默认收起，除非用户主动打开。
- 右侧 inspector 默认收起，除非用户主动打开。
- 普通路径上没有解释性 landing page、marketing hero、dashboard grid、raw
  protocol monitor、backend selector、provider selector 或 permission-mode
  selector；model selector 只作为 App-owned Codex 模型控制出现。

第一屏可以在 chat surface 内展示最近对话或启动状态，但只在有助于下一步
输入时展示。它不能在用户请求 context 前变成独立 dashboard。

普通 home 不展示运行摘要、continue-work 入口、needs-attention/active/recent
project refs、per-assistant running badges 或底部 feedback/favorite/web 图标。
来自 OPL Framework projection 的运行与项目 refs 属于 Runtime 页、右侧
inspector、drawer 或其他次级 context surface。Home 的职责是保持 composer-first，
让用户直接开始或继续对话。

当前 turn 的执行状态例外：用户发出消息后，chat timeline 内可以出现 live run
artifact，用紧凑方式展示 running、tool/process/file/diff/receipt refs、permission
prompt、safe action receipt 和失败恢复动作。这个 artifact 属于当前对话流，不是
全局 runtime dashboard；turn 结束后保留摘要，长列表和跨项目状态进入 inspector
或 Runtime surface。

## Frame 结构

App frame 有四层：

- **Nav rail：** 窄 icon rail，用于当前 chat、新建对话、workspace/session
  rail toggle、context inspector toggle 和 settings。
- **Header：** 产品名、active route、workspace path、App-owned model status
  和轻量 connected-state indicators。
- **Chat canvas：** 主工作面。它承载对话历史、streaming assistant output、
  tool/process summary、user-input prompt、permission prompt 和 composer。
- **Context surfaces：** 可选 workspace/session rail 和右侧 inspector。
  它们是次级上下文，不能在普通 home 中视觉上压过 chat canvas。

运行、continue-work、refs、blockers 和 next steps 属于 Context surfaces。
用户打开 Runtime、inspector 的 Runtime/Files/Memory/Always-On 等相邻面板后
查看这些信息；普通 home 不用图标或计数提前占用 composer 区。

桌面端应该保留足够大的中心 chat canvas。WebUI 使用同一个 renderer 和同样
默认收起状态。移动端或窄窗口把次级 context 折叠成 sheet/drawer。

窄桌面和 WebUI 宽度下，workspace rail 和 inspector 仍然是次级层，不应默认
铺在 home 上；但用户点击 toggle 后必须真的可见、可操作。若横向空间不足，
右侧 inspector 应以 overlay sheet 或 drawer 形式打开，至少保证 context tabs、
Routing summary 和 close/collapse affordance 可见。不能出现按钮 active、
DOM 已挂载，但 inspector 因响应式 CSS 被隐藏或压成 0 宽的状态。

## 双语与界面语言

OPL App 普通界面必须支持中文和英文两套 UI copy。默认语言可以按产品发行策略或
系统语言选择，但同一屏普通 UI 必须单一语言呈现，不能把中文按钮、英文面板标题和
英文状态随机混在一起。

语言切换是 App frame 的轻量全局控制，不应该变成首页设置条或 first-screen panel。
切换语言只改变 UI labels、aria labels、empty states、状态文案和普通产品提示，不
改变 workspace、thread、route receipt、runtime state 或 domain authority。

普通用户层 chrome 必须按当前语言完整呈现。这里的普通用户层包括 Home topbar、
chat composer、workspace/session rail、右侧 inspector 默认 summary、context tabs
和 Routing tab summary。普通中文 first screen 使用
`科研`、`基金`、`演示`、`本机助手`、`自动` 这类中文工作标签；英文 UI 中使用
`Research`、`Grant`、`Presentation`、`Local assistant`、`Auto`。`OPL` 和
`Codex` 可作为产品/执行器品牌保留，但 `Codex CLI`、`MAS`、`MAG`、`RCA`、
`OMA`、命令片段、schema id、receipt id、文件路径和用户/系统原始输出应进入
details、Settings、diagnostics、logs、developer evidence 或原始输出区域，不要
成为中文普通首页、composer、rail 或 inspector summary 的主要视觉文本。

技术长名如 Med Auto Science、Med Auto Grant、RedCube AI 可以进入英文界面、
details、Settings 或 diagnostics；中文普通 first screen 应优先使用短标签和中文
工作意图，避免英文长标题压过用户当前任务。

AG-UI、ACP、app-server、provider、backend、raw event frame 等协议或实现名称继续
属于 diagnostics 和 developer verification surface，不属于普通 UI 文案。

## Chat Canvas

Chat canvas 是产品重心。

- 消息按时间线展示，易读，并优化继续工作体验。
- 用户和 assistant bubble 不能把长任务状态藏进 raw logs。
- Tool call、command、diff、file、receipt、process output 作为紧凑对话事件
  或可展开 refs 出现。
- 当前 turn 运行时，chat timeline 内必须有 live run artifact：展示等待秒数、
  最近事件、必要的 action/permission 状态和结果摘要。它的视觉权重低于用户
  消息和 composer，高于隐藏的 diagnostics。
- Error 出现在失败 turn 内，并在存在 App-owned action 时暴露恢复动作。
- Permission 和 user-input prompt 留在 conversation flow 中。
- Assistant 正在处理时必须有可见等待反馈，并显示已经等待的秒数；即使
  thinking/tool event 已开始，普通用户也应持续看到 App 正在工作。
- Raw adapter frame、AG-UI event name、ACP wire detail 和 shell diagnostic
  留在 developer 或 diagnostic surface。

App 应优先 summary-first rendering。长内容可展开，或打开 context panel；
但用户不离开 chat 也应该能理解发生了什么。

## Composer

Composer 是紧凑的 Codex-style command surface：

- 没有 blocking prompt 时，文本输入始终可用。
- 默认视觉必须像 Codex App 的多行 command box，而不是普通单行 input：
  首屏空状态也要能看出它可以承载一段完整任务描述。
- 选中的 purpose route 以紧凑 tag 显示。
- File/folder attach、mention/ref insertion、context usage、send、stop 都是
  直接控件。
- 可以切换 purpose，但不暴露 backend 或 provider choice。
- Model 信息是可见选择器。Home 和 Codex conversation composer 都应紧凑显示
  默认模型与推理强度，例如 `GPT-5.5（超高）`；默认值、退休模型过滤和选择
  持久化来源是 App product profile，不来自 shell-local provider policy。
- Send 状态明确：idle、running、stopping、blocked、failed。
- Composer 支持 keyboard-only navigation。

Composer 不能变成 settings bar。Model、provider、executor、permission
control 属于技术面，不属于普通发送路径。

## Workspace 与 Conversation Rail

Workspace/session rail 有用，但它是次级 surface。

- 只有用户请求 workspace/session context 时才打开。
- 先按 selected workspace 分组，再展示 recent conversations 或 threads。
- 支持 new conversation、resume conversation、thread reset。
- 可以给 running、blocked、completed 工作显示轻量 status badge。
- 不把 backend、provider、router、permission configuration 作为普通导航暴露。

首次启动和普通 home 中，这个 rail 默认收起。只看主 chat canvas 时，界面仍
必须成立。

## 右侧 Inspector

右侧 inspector 承载相邻上下文：

- Files 和 workspace refs。
- Runtime 和 route refs。
- Skills 和 capability profiles。
- Memory refs 和 receipts。
- Automations 和 Always-On work。
- 与当前 workspace 或 conversation 相关的 Settings sections。

Inspector 默认收起。打开时应该像在当前 chat 旁边展开上下文，而不是切换到另
一个 app。它应保留当前 conversation、保留 scroll position，并且关闭后不丢失
用户输入。

## Runtime 与进度显示

Runtime display 必须 user-task-status-first 且 authority-aware。

- 普通状态读取使用 `opl app state --profile fast --json`。
- 显式 refresh 也使用 fast profile。
- 默认首屏读取 `app_state.operator.workbench.summary_cards`、
  `activity_center`、`task_drilldowns` 和 `visual_ref_groups.active_project_refs`
  形成用户任务状态投影。
- Full state 和 full Operator drilldown 属于 diagnostic 或 release-evidence
  path。
- Mutation 走 App-owned safe action route：
  `opl app action execute --action <id> [--payload <json>] [--dry-run] --json`。
- UI 先回答用户真正关心的四件事：running task count、active project count、
  queued project count 和 attention count；随后展示 task title/status/stage、
  progress label、next step、owner 和 last progress。
- Provider/current_control_state 细节是 secondary diagnostics。`running_provider_attempt_count`
  可以包含 checkpointed provider refs，不能直接显示为用户可见的“正在运行任务数”。
- “正在运行任务”“进行中项目”“排队项目”和“需要关注”必须分层显示。任务数来自
  Framework user-task projection；项目线来自
  `app_state.operator.workbench.activity_center.active_projects`、
  `app_state.operator.workbench.summary_cards[active_projects]` 和
  `app_state.operator.visual_ref_groups.active_project_refs`。`queued` 或
  `escalated` 的 owner-handled paper line 可以计入用户可见项目线，但必须保留原始
  `status`、`active_run_id` 和 next step，不能伪装成 active worker run。
- Running 只来自显式 `running`、`in_progress` 或 `advancing` status/state；
  `active_run_id` 是上下文，不是 liveness proof。Queued、waiting、stopped、
  parked、checkpointed、blocked 或 attention-needed 项目默认折叠，展示数量、
  状态和下一步摘要，展开后再看具体项目 refs。
- 项目进度 refs 来自 `app_state.operator.workbench.task_drilldowns`，作为二级
  project progress；它可以支撑项目线和下一步展示，但不用于从 module/runtime
  dirty state 推断运行任务数。
- UI 从 OPL shared progress projection 展示项目进度，并区分 deliverable
  progress 与 platform repair。
- Runtime panel 只展示 refs、receipts、actions、blockers 和 next steps；
  它不拥有 runtime truth。
- `domain_lane_map.active_task_count`、`module_runtime dirty`、module readiness、
  repo/worktree diagnostics 和 assistant cards 都不能作为 running task truth。

App 不能从 UI rendering、provider completion、release artifact 或
read-model availability 推断 domain readiness、production readiness、paper
quality 或 artifact authority。

## OPL Purpose Routing

OPL purposes 是固定 Codex executor 上的 App-owned defaults：

- `科研` 路由到 MAS，用于 research 和 paper work。
- `基金` 路由到 MAG，用于 grant work。
- `演示` 路由到 RCA，用于 presentation、PPT 和 visual deliverable work。

Purpose selection 改变 route context 和 assistant skill profile；它不是
backend selection。每个 routed conversation 必须带 App-owned receipt，记录
route kind、executor、assistant id、assistant short name 和 source。
`ppt` 是 App contracts、product profile 和 page-state matrix 当前稳定的内部
purpose id，路由到 RCA；普通中文 UI 显示 `演示`，不要把 `PPT` 当作中文
chrome 主标签。

OMA 保持 explicit 或 settings-only，直到单独产品决策把它提升为默认可见。

## First-Run 与安装体验

First-run 应让干净 Mac 在完整维护结束前先进入 App。

- Core launch readiness 是 workspace root、Codex CLI 和 Codex config。
- Full readiness 和 background maintenance 可见，但保持次级。
- Domain modules、runtime provider、recommended skills、repo sync、CLT、
  companion skills 和 ecosystem updates 不阻塞普通 launch，除非 App-owned
  contract 另有声明。
- Beginner path 用普通产品语言展示当前 blocker 和 next visible step。
- 技术细节可展开。

这个 first-run 模型的目标，是让用户先从 App 开始，再通过 Settings 或后台
surface 继续维护。

## Settings

普通 Settings navigation 由 App 拥有：

- General。
- Access。
- Agents & Capabilities。
- Local Environment。
- Appearance。
- Advanced。
- About & Updates。

Model、agent、assistants、skills-hub、tools、display、WebUI、pet 等 legacy
或 upstream settings categories 路由到 App-owned pages 或 diagnostics。它们
不能成为普通产品 tabs。

AionUI upstream Team surface 不进入 OPL 普通路径。Team sidebar entry、Team
leader configuration、Team 自动跳转和 Team deep link 默认隐藏或禁用；保留的
兼容 route 只能 redirect 到 App-owned home 或明确 diagnostics，不能成为普通
capability。

Agents & Capabilities 主视图按科研、基金、演示和显式 OPL Meta Agent 组织。
内置技能列表和自动注入技能只能显示 App product profile 的 packaged skill
whitelist 里的技能；`aionui-skills`、`aionui-webui-setup`、`skill-creator` 等 AionUI
implementation helper 不进入普通能力页。

Home composer 和普通会话里的技能/MCP 选择更窄：只使用 App-owned ordinary
capability allowlist。技能从 MAS/MAG/RCA 的 `assistant_skill_profiles` 推导；
MCP 默认空白名单，只有 App product profile 明确列入的 OPL MCP 才能进入普通
选择器或 loaded-capability 展示。AionUI builtin-auto、用户本机 MCP 配置和 shell
implementation helper 不直接成为 OPL App 普通会话能力。

Project progress 是 runtime/work context surface，不属于 Settings
information architecture。Local Environment 展示 Codex CLI、Temporal、
modules、paths 和 update readiness；Advanced 展示 Developer Profile
capabilities、raw paths、logs 和 developer diagnostics。

## WebUI

WebUI 是同一产品的另一种 delivery surface。

- 它使用与 desktop 相同的 chat-first renderer 和 product profile。
- 它保留同样默认收起的第一屏。
- Electron preload 不存在时，它通过 local browser transport 暴露同样
  App-owned `window.oplCandidate` bridge shape。
- 它不创建单独 runtime truth、memory authority、artifact authority、
  provider selection 或 release channel。

Desktop 可以使用 native directory picking。WebUI 可以使用显式 path input 或
App-owned workspace actions，但产品语义保持一致。

Hermes Desktop 路线的 WebUI 设计要求是同源 UI，而不是另做一套 Web app。Hermes
renderer 本身是 Web 技术栈，Electron 只是 desktop delivery wrapper；因此
`hermes-codex` 声称 WebUI parity 时，必须复用同一套 React/Vite renderer 和
App-owned product profile。差异只能在 transport adapter：desktop 通过 Electron
preload/IPC 暴露 bridge，Docker/WebUI 通过 browser shim 加 HTTP/WebSocket/SSE
server 暴露同等 bridge。

同源 WebUI 的 TODO：

- 抽象 Hermes renderer 当前依赖的 `window.hermesDesktop` / OPL bridge shape，形成
  desktop IPC adapter 和 browser transport adapter。
- WebUI server 在容器内连接 Codex CLI、OPL CLI 和 workspace volume，不在浏览器端
  直接拥有 runtime 或文件系统 truth。
- Browser shim 暴露与 desktop 等价的 bridge 方法；native file picker、OS
  notification、window control、desktop self-update 等 native-only affordance 必须
  映射成 Web 等价能力、diagnostic 状态或明确不可用状态。
- Workspace 通过 Docker volume / path allowlist 进入 WebUI；WebUI 不读取未挂载的
  host path，也不绕过 App-owned workspace policy。
- WebUI smoke 必须证明同一 renderer、同一 product semantics、bridge 可用、
  Codex turn 可跑、workspace/files/tool-output 核心路径可用，且没有第二套 product
  profile、runtime truth 或 release channel。

## 视觉交互标准

视觉标准是安静、高效的 AI work app：

- Chat-first，有充足留白和清晰阅读流。
- 只在重复工作真正受益处使用高密度控件。
- 常见动作使用熟悉 icon。
- 不使用装饰性 hero、marketing panel、dashboard-first grid 或解释性
  first-screen copy。
- Nav rail、composer、route chips、context toggles 使用稳定尺寸。
- 可访问 focus states、keyboard navigation 和足够 touch target。
- Dark mode 和 light mode 作为成对产品 surface 设计，而不是后期反色。
- Header route、model status、workspace path、composer status 都是辅助信息，
  视觉权重必须低于 conversation 和 composer input。
- 右侧 inspector 打开后应有清晰分层：session summary、run state、context tabs、
  first-run/runtime/settings/detail cards 之间用 spacing、outline 和标题层级区分。
  它不应像一组同权重 dashboard cards。
- 窄桌面/WebUI 下，inspector 打开后用 overlay/drawer 保持可读宽度；context
  tabs 和 Routing panel 必须可见，不能为了保留 chat-first 而让二级层按钮不可用。

Codex App-like 是视觉与交互主目标。Google Stitch、PilotDeck、CopilotKit demos
和 AG-UI demos 都只能作为工具或参考输入，用来校准美术风格、比例、字体和组件
细节；它们不能替代 Codex App-like chat-first 目标，也不能定义 App product truth。
后续视觉迭代不能默认延续某一次 Stitch 生成稿。Stitch 可以反复使用来试字体、
间距、圆角和色阶，但每次实现都必须回到 Codex App 的普通交互结构验收：轻量
top chrome、中心 conversation reading lane、底部多行任务 composer、默认收起的
workspace rail 和 inspector。

2026-06-02 的 Google Stitch `One Person Lab` 设计稿可作为视觉参考输入：
采用 Quiet Utility 风格、灰阶 tonal layers、1px outline、圆润但克制的控件、
760-820px fixed reading lane、底部渐隐 pinned composer、窄 icon rail 和
右侧 inspector。该 Stitch 产物只提供视觉 token 和布局比例参考，不成为源码、
runtime、产品 truth 或 license authority。若 Stitch 输出与 Codex App-like
chat-first 目标冲突，以 Codex App-like 为准；尤其不能把 Stitch 的默认 inspector、
表格化工作台或 demo data 带入普通 home。

可吸收的视觉 token 是：`#f8f9fa` canvas、`#ffffff` active surface、
`#e1e3e4/#c6c6cd` outline、`#111827/#191c1d` primary text/action、Inter 主字体、
JetBrains Mono 技术文本、4px spacing base、pill chips、圆形 icon controls、
约 32-36px radius 的 composer input sheet、轻 outline 而非重 shadow。普通 home
的视觉锚点应该是 conversation reading lane 和 composer，而不是大卡片容器。

Composer 必须呈现为一个完整的底部 command surface。若 shell 使用 CopilotKit、
AG-UI 或其他第三方输入组件，外层 adapter/container 必须是透明布局容器，真正
可见的输入 pill/sheet 只能有一层白色 surface、一个阴影层和统一圆角裁剪。不能
出现圆角输入框背后露出白色矩形容器、双层卡片、未裁剪内部背景、或多个 shadow
叠加的状态。Composer 相关 chips、send/stop、workspace 和 context icon controls
使用 pill/circle 形态；右侧 inspector 内部的小型 cards 可保持紧凑，但不应出现
4-8px 随机小圆角造成的方块感。

Codex-like Composer 的最低视觉要求：

- 输入 surface 默认高度足以容纳至少 2 行正文，textarea line-height 和 placeholder
  也必须按多行任务输入设计，不能只靠外层高度制造“假多行”。
- 输入 surface 不能像独立舞台卡片一样压过 conversation。它应贴近 Codex App
  的底部任务输入：轻 outline、克制 shadow、单层白色 surface、工具行低调但可点。
- Composer 和 message reading lane 采用同一宽度节奏，桌面首屏目标宽度约
  780-820px；宽屏不能把输入框做得过窄，窄屏再响应式收缩。
- 顶部 chrome、workspace、model 和 status 信息保持轻权重；字体、字号和字重
  不应比 composer input 或 conversation 正文更抢眼。
- Send/stop 按圆形主动作处理，attach/context/workspace/purpose controls 用 pill
  或圆形，所有交互尺寸稳定，hover/focus 不改变布局。
- Workspace、purpose、attach 和 context controls 如果收进 composer sheet，必须
  在视觉和 hit-test 上位于输入 surface 上层，保持可读、可点；不能被第三方输入
  容器、渐隐层或 overlay 压低到近乎不可见。

视觉优化同样遵守 fork delta budget：优先用 CSS tokens、局部组件组合、profile
driven labels 和现有 layout primitives 完成；只有当 App contract 明确需要新
surface，且 candidate shell 也能通过同一 contract 实现时，才引入更深的
renderer 结构变化。

## Non-Goals

- 构建通用 multi-agent launcher。
- 把 AG-UI、ACP 或 app-server protocol frames 暴露成普通产品概念。
- 让 PilotDeck、AionUI 或任何外部 GUI 成为 product truth。
- 在 Hermes Desktop 已有成熟功能时，从零重写等价 GUI surface。
- 未完成 Hermes upstream 功能对比前，把 AionUI/AGUI 稳定线 wrapper、
  page-state、first-run、Full runtime 或 WebUI parity 迁入 Hermes。
- 把 Hermes WebUI 做成第二套 renderer、第二套产品信息架构或仅相似外观的 Web app。
- 在没有 license 和 authority 决策前复制外部源码到 App repo。
- 默认把 runtime、memory、files 或 automations 变成第一屏 panels。
- 让 WebUI 定义第二套 App 产品。

## 验收清单

一个 shell implementation 匹配本交互细则，需要满足：

- 普通 home 打开就是 chat-first canvas。
- Workspace/session rail 默认关闭。
- 右侧 inspector 默认关闭。
- Workspace/session rail 与右侧 inspector 在窄桌面/WebUI 下仍能通过用户动作
  打开，并且 context tabs 与 Routing summary 实际可见可操作。
- MAS/MAG/RCA 是 Codex 之上的 purpose entries，不是 backend choices。
- 普通 home 和 conversation paths 隐藏 backend/provider/permission selectors；
  model selector 只作为 App-owned Codex 模型控制出现。
- 普通 home 不显示 runtime activity、continue-work、activity refs grid、
  per-assistant running badges 或底部 feedback/favorite/web 图标。
- Composer 是单一圆润 command surface；外层 adapter 容器透明，内层输入 surface
  负责背景、outline、shadow 和 overflow clipping，不能露出矩形白底。
- Composer 必须是可见多行 command box：桌面默认高度至少约 100px，内部 textarea
  至少约 60px，line-height 约 22-24px，不能退化成单行输入体验。
- Nav、topbar、composer、chips、icon buttons 和 inspector controls 使用统一
  radius tokens；普通控件呈 pill/circle，避免随机 4-10px 小圆角带来的方块感。
