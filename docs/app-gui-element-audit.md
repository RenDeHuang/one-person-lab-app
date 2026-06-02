# OPL App GUI 页面元素审计

Owner: `one-person-lab-app`
Purpose: `app_gui_element_audit_and_interaction_logic_review`
State: `active_design_review`
Machine boundary: 本文是人读设计审计。机器可读 GUI 真相仍在
`contracts/app-gui-product-contract.json`、`contracts/app-page-state-matrix.json`、
active shell source、UI smoke 和 release evidence 中。

本文回答三个问题：

1. 当前 OPL App 页面上的元素分别承担什么作用。
2. 这些元素之外，用户还需要哪些目前缺失或不足的元素。
3. 现有元素是否在符合用户预期的位置。

审计对象是 App-owned 普通用户路径：first-run、全局 frame、Home/Guid、
conversation、workspace/session rail、右侧 context inspector、Runtime、Settings、
About/Update。当前实现 carrier 是 `shells/aionui`，但页面目的和位置判断以 App repo
contracts 与本文为准。

## 总体判断

当前 OPL App 的正确方向是 `chat-first command center`：第一屏让用户直接向 Codex
executor 下达工作目标，Runtime、Files、Memory、Automations、Settings 和 evidence
refs 都是相邻上下文。这个方向正确，但设计文档以前更多写了 contracts 和能力清单，
还没有把页面元素逐一解释清楚，导致 shell 迭代时容易把元素放回 dashboard、settings
bar 或通用 agent 控制台。

本轮复盘后的核心结论：

- Home 的中心元素应该只有 conversation canvas/composer、workspace、purpose route、
  model selector、attach/context、send/stop 和少量启动示例。
- Runtime、continue-work、needs-attention、active/recent refs、operator action、
  evidence ledger 和 raw protocol 信息应进入 Runtime 页或右侧 inspector。
- Settings 应回答“App 能不能工作、有哪些能力、本机环境是否 ready、外观和更新怎样”，
  不应成为 upstream AionUI model/backend/provider 设置总表。
- 当前文档与部分 contract 字段仍残留 `PPT` 中文主标签；普通中文 chrome 应统一为
  `演示`，`ppt` route id 和 `RCA` short name 只作为兼容/receipt/details。
- Model selector 已从只读状态转为 App-owned selector，这符合用户希望可控的预期；
  它仍必须受 App product profile 管理，不能变成 backend/provider selector。

## 元素审计

| 区域 | 元素 | 作用 | 正确位置 | 当前判断 |
| --- | --- | --- | --- | --- |
| First-run | Core readiness summary | 告诉新用户是否已具备进入 App 的最低条件：workspace root、Codex CLI、Codex config。 | `/guid` 之前的 first-run surface。 | 正确；Full readiness 和后台维护必须保持次级。 |
| First-run | Full readiness/background maintenance | 告诉用户 domain modules、provider、repo sync、CLT 等维护状态。 | first-run 技术展开区、Settings Local Environment。 | 正确作为次级信息；不应压过 Core ready。 |
| First-run | Post-install AI self-check entry | 让用户用 Codex 做只读安装后自检。 | Core ready 后进入 `/guid` 的预填 prompt 或显式入口。 | 正确；应继续保持 diagnose-first。 |
| Frame | Product title/window identity | 明确这是 One Person Lab App，不是 AionUI。 | titlebar、About、manifest、login/first-run。 | 正确；禁止 AionUI branding 回流。 |
| Frame | Workspace path | 告诉用户当前任务会在哪个目录执行。 | Header 或 composer 附近的稳定低权重位置。 | 必需；Home 里的 workspace footnote 合理，但长期应与 header/frame 保持一致。 |
| Frame | Nav rail | 进入 current chat、新建 conversation、workspace/session rail、Runtime、Settings 等主路径。 | 窄 rail；桌面常驻，窄屏折叠。 | 必需；不应放入普通 Home content。 |
| Frame | Workspace/session rail toggle | 打开会话历史和 workspace context。 | nav rail 或 chat frame 左侧。 | 正确为次级；默认收起。 |
| Frame | Context inspector toggle | 打开 Files/Runtime/Skills/Memory/Automations 等相邻上下文。 | nav rail、header 或 conversation edge。 | 需要更明确；不能只在 candidate 文档里定义。 |
| Home | Hero/title prompt | 提示用户当前 App 的工作目标。 | Home 上方，低密度，一句话即可。 | 可保留；不能变成 landing page 或 marketing hero。 |
| Home | Assistant description | 当前选中 purpose 的简短说明。 | Home title 下方或 assistant card details，最多一两行可展开。 | 位置合理；长文本应折叠。 |
| Home | Model selector/status | 显示并允许切换 App-owned Codex model，默认 `GPT-5.5（超高）`。 | Composer action row 或其上方紧凑 pill；conversation composer 同步。 | 正确；禁止露出退休模型、backend、provider、permission。 |
| Home | Composer input | 用户输入任务的主控件。 | 第一屏视觉中心，底部或中心 reading lane 的固定 command surface。 | 正确；应始终是 Home 的主元素。 |
| Home | Purpose route tag | 显示当前会话路由到科研/基金/演示哪个工作意图。 | Composer prefix 或 input 顶部紧凑 tag。 | 正确；中文标签应是 `科研`、`基金`、`演示`。 |
| Home | Purpose entries/cards | 快速选择 Research/MAS、Grant/MAG、Presentation/RCA。 | Composer 下方或附近，作为 click-to-start options。 | 正确；卡片数量应少，不能膨胀成 agent dashboard。 |
| Home | Prompt examples | 帮用户快速开始典型任务。 | 选中 purpose 后的轻量 chips。 | 有价值；应短、可点击、可替换输入。 |
| Home | File/folder attach | 把本地文件或目录加入当前 turn。 | Composer action row 左侧 `+`/attach 控件。 | 正确；需要清晰预览和移除。 |
| Home | Skill menu | 显示当前 assistant required/optional skill profile。 | Attach/plus 菜单中的次级 group。 | 合理；required skill locked，optional selectable。 |
| Home | Workspace picker | 选择本次 conversation 的 workspace。 | Composer footnote/header，用户发送前可见。 | 合理；近期目录搜索和清除是必要控制。 |
| Home | Send button | 发送当前任务。 | Composer 右侧主动作。 | 正确；应有 disabled/loading/stop 状态。 |
| Home | Permission/backend selectors | 技术执行配置。 | 不在普通 Home。 | 当前合同判断正确：不显示。 |
| Home | Runtime activity/continue-work grid | 运行项目、refs、attention、recent activity。 | Runtime 页或右侧 inspector。 | 不应在普通 Home；否则会抢走 composer-first 心智。 |
| Conversation | Message timeline | 展示用户、assistant、tool/process、errors 和 receipts。 | 主 chat canvas。 | 必需；长日志应 summary-first。 |
| Conversation | Pending elapsed seconds | 让用户知道 Codex 仍在工作。 | Composer 附近或当前 assistant turn 内。 | 必需；当前合同已要求。 |
| Conversation | Thought/tool display | 展示正在处理、可停止、可展开的执行过程。 | Message timeline 或 composer 上方。 | 正确；raw protocol 不应默认可见。 |
| Conversation | Command queue | 忙碌时排队、暂停、编辑、重排后续命令。 | Conversation composer 上方。 | 有价值；适合 conversation 内，不适合 Home。 |
| Conversation | Stop action | 停止当前 response 或 backend run。 | Send button 状态切换或 thought display。 | 必需；不能藏在菜单。 |
| Conversation | Attach/file previews | 展示已附加文件和 workspace refs。 | Composer prefix/body。 | 正确。 |
| Conversation | Slash commands/side question | 高级输入辅助。 | Composer 内，按需触发。 | 合理；普通用户不应先看到复杂列表。 |
| Workspace rail | Conversation history | 找回 recent conversations。 | 左侧 rail/drawer。 | 必需；默认收起或窄 rail。 |
| Workspace rail | New/resume/reset | 开新对话、恢复线程、重置上下文。 | Workspace/session rail。 | 必需；不应挤进 Home card grid。 |
| Workspace rail | Running/blocked/completed badge | 快速辨认历史会话状态。 | Conversation list item 旁的小 badge。 | 有用；不能替代 Runtime truth。 |
| Inspector | Files refs | 让用户查看当前 workspace/conversation 相关文件引用。 | 右侧 inspector tab。 | 缺口偏大；应成为明确普通 context surface。 |
| Inspector | Runtime/Routing refs | 展示 route receipt、current run、next owner、safe action refs。 | 右侧 inspector tab 或 Runtime page。 | 必需；不要放 Home。 |
| Inspector | Skills/Capabilities refs | 展示本会话 loaded skills 和 assistant profile。 | 右侧 inspector tab；Settings 里是全局 catalog。 | 需要补强。 |
| Inspector | Memory/receipts refs | 展示可追踪的记忆和 receipt 引用。 | 右侧 inspector tab。 | 需要补强；只展示 refs，不展示 domain body。 |
| Inspector | Automations/Always-On | 长周期任务和监控入口。 | 右侧 inspector 或独立 secondary page。 | 需要明确；不放普通 Home。 |
| Runtime | Running activity summary | 首先回答是否有真实 active provider executions。 | Runtime 页首屏。 | 正确；来源是 operator drilldown current_control_state。 |
| Runtime | Project progress refs | 展示仍在推进的 project/paper line、stage、next owner、next step。 | Runtime 页第二层。 | 正确；需保留 queued/escalated 原始状态。 |
| Runtime | Progress delta tags | 区分 deliverable progress、platform repair、typed blocker 等。 | Project item metadata。 | 正确；不能把 platform repair 说成交付进度。 |
| Runtime | Safe actions dry-run/execute | 通过 App action route 执行可选 operator action。 | Runtime advanced/operator action 区。 | 正确；执行前 dry-run 明确。 |
| Runtime | Full detail/evidence ledger | 诊断和 release evidence。 | Advanced collapse 或 on-demand full detail。 | 正确；不做默认焦点。 |
| Settings | General | workspace、startup、tray、language 和常用入口。 | Settings 默认 tab。 | 正确；当前已要求默认 General。 |
| Settings | Access | Codex CLI/provider access/API key/base URL 等可用性。 | Settings 普通一级 tab。 | 正确；raw token/path 进入 advanced disclosure。 |
| Settings | Agents & Capabilities | MAS/MAG/RCA/OMA 能力、required/optional skills、tools detail。 | Settings 普通一级 tab。 | 正确；不是 Home 默认 agent dashboard。 |
| Settings | Local Environment | Codex CLI、Temporal、modules、paths、release 本机状态。 | Settings 普通一级 tab。 | 正确；不承载 project progress。 |
| Settings | Appearance | theme、language-adjacent visual preferences。 | Settings 普通一级 tab。 | 正确；主题不是 runtime readiness。 |
| Settings | Advanced | developer mode、logs、paths、OPL Flow context、diagnostics。 | Settings 普通一级 tab 末端。 | 正确；不应前置给新用户。 |
| Settings | About & Updates | App version、shell version、framework revision、channel/update state。 | Settings/About 或独立 About page。 | 正确；standard updater 与 Full first-install 要区分。 |

## 缺失或不足的用户元素

1. **右侧 context inspector 的普通用户入口还不够明确。** 文档已经定义 Files、Runtime/Routing、
   Skills、Memory、Automations、Settings tabs，但 active AionUI shell 的当前主路径更偏
   Home、Runtime page 和 Settings。下一轮 UI 应把 inspector 作为可打开的相邻上下文，而不是
   只在候选 shell 文档里出现。

2. **workspace/session rail 与普通 Home 的关系需要更稳定。** 用户需要找 recent
   conversations、resume、new conversation 和 running/blocked badges，但这些应该在 rail，
   不应回到 Home 的 activity grid。

3. **Home 的 purpose 文案需要完全去技术化。** 中文普通界面应显示 `科研`、`基金`、`演示`；
   `MAS/MAG/RCA`、`PPT`、Med Auto Science、RedCube AI 进入 receipt、details、Settings
   或英文界面。当前 contracts/status 仍有 `PPT` 残留。

4. **Conversation 内的 route receipt 可见性还需要产品化。** 用户应能看出当前 turn 是
   科研/基金/演示路线，且 receipt 已记录 executor、assistant、source；但普通 UI 不应展示
   schema id 或 raw JSON。

5. **状态层级需要更明显。** 用户实际关心三件事：Codex 是否正在回答、有没有真实 runtime
   worker run、有哪些 project line 仍需推进。当前 contracts 已区分，UI 文案和 layout 也要
   按这个顺序呈现。

6. **空状态和错误恢复需要补齐到元素级。** Home、Runtime、Files、Memory、Automations、
   Access、Local Environment 都应有短空状态、当前原因和下一步动作；不能只显示 Empty 或 raw
   command failure。

7. **模型选择器需要 App-owned 列表治理。** 用户需要能切换模型，但列表要过滤退休模型，默认项
   要能恢复到最新最强 frontier，且 selector 不应把 provider/backend/permission 一起带回普通路径。

8. **窄桌面/WebUI 的 inspector 可见性要有明确验收。** 用户点击 context 后必须看到实际 tabs 和
   Routing summary，不能出现 active 状态但 DOM 隐藏或宽度为 0。

## 位置复盘

### Home

Home 的用户预期是“我已经在某个工作目录里，可以直接交代任务”。因此 Home 上正确的元素是：
composer、workspace、purpose、model、attach、send、少量 prompt examples。Home 上错误的元素是：
runtime dashboard、continue-work grid、needs-attention/active/recent refs、per-assistant running
badges、footer feedback/favorite/web icons、backend/provider/permission selectors。

当前 App contracts 对 Home 的位置判断是正确的；需要补的是把这个判断写成元素级设计语言，并把
shell 与 candidate 的 UI smoke 都按这个语言验收。

### Conversation

Conversation 应保留完整工作流：message timeline、pending elapsed seconds、tool/process summary、
queue、stop、attach previews、route/model status。这里放这些元素符合用户预期，因为用户已经进入
一个具体工作回合，需要看到这次任务的上下文和执行状态。

不应在 conversation composer 里恢复 backend/provider/permission selector。权限如需显示，应是当前
App 默认权限语义或 advanced/settings disclosure。

### Runtime

Runtime 的第一焦点应是真实 running activity，其次才是 project progress refs，再下面是 safe actions、
operator summary、full detail 和 evidence ledger。这个顺序符合用户问“现在有没有在跑、下一步是谁、
是否卡住”的心理模型。

Runtime 不应把 module dirty、domain lane active_task_count 或 checkpointed provider refs 直接显示成
“正在运行任务数”。这些元素可以出现在 advanced diagnostics。

### Settings

Settings 的正确位置是全局配置和 readiness，不是项目进度看板。默认 tab 应是 General；
Access、Agents & Capabilities、Local Environment、Appearance、Advanced、About & Updates
按普通用户问题组织。Legacy AionUI 的 model、agent、assistants、skills-hub、tools、display、
webui、pet 等入口应作为 redirects 或 secondary sections，不应重新成为普通 tabs。

### Context Inspector

Inspector 是当前最大设计缺口。它应承接用户在 conversation 旁边需要的 context：Files、Runtime/Routing、
Skills、Memory、Automations、Settings shortcuts。它默认收起，打开后不丢失当前 conversation、scroll
position 或 composer draft。它不拥有 runtime truth 或 domain artifact body，只展示 refs、receipts 和
next actions。

## 下一轮设计验收项

- 中文普通 Home 的 purpose labels 统一为 `科研`、`基金`、`演示`。
- Home source/package smoke 同时证明：composer-first、no runtime activity、no continue-work、no
  footer quick icons、no backend/provider/permission selectors。
- Conversation smoke 证明：model selector/status 与 Home 一致，pending elapsed seconds 可见，route tag
  可见，send/stop/attach/queue 行为在同一 composer flow 内。
- Inspector smoke 证明：默认收起，用户打开后 Files/Runtime/Routing/Skills/Memory/Automations tabs 有真实可见尺寸。
- Runtime smoke 证明：running activity first，project progress second，full detail/evidence ledger
  secondary on-demand。
- Settings smoke 证明：默认 General，普通 tabs 只有 General、Access、Agents & Capabilities、
  Local Environment、Appearance、Advanced、About & Updates。
- Model selector smoke 证明：默认 `GPT-5.5（超高）`，可恢复 auto/latest strongest，退休模型不可见。

