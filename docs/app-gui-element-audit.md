# OPL App GUI 页面元素审计

Owner: `one-person-lab-app`
Purpose: `app_gui_element_audit_and_interaction_logic_review`
State: `active_design_review`
Machine boundary: 本文是人读 GUI 元素审计。机器可读 GUI 真相仍在
`contracts/app-gui-product-contract.json`、
`contracts/app-page-state-matrix.json`、active shell validation、UI smoke
和 release evidence 中。

本文逐页说明 One Person Lab App 普通用户路径上的关键元素、作用、缺口和位置。
审计对象是 App-owned 产品界面：first-run、全局 frame、Home/Guid、
conversation、workspace/session rail、右侧 context inspector、Runtime、
Settings、About/Updates。当前实现 carrier 是 `shells/aionui`，但页面目的与
位置判断以 App repo contracts、page-state matrix 和本文为准；active shell 只
承担可替换实现职责。

## Source Of Truth

| 层级 | Owner | Purpose | Machine boundary |
| --- | --- | --- | --- |
| App GUI product truth | `one-person-lab-app` | 定义普通用户可见 GUI 行为、页面状态、Settings IA、文档和 release/user-path 验收边界。 | `contracts/app-gui-product-contract.json`、`contracts/app-page-state-matrix.json`、`contracts/app-shell-adapter.json`、App-root validation、release evidence。 |
| Runtime state/action | `one-person-lab` Framework | 产生 App state、operator/runtime projection 和 safe action 执行结果。 | `opl app state --profile fast --json`、显式 full state、`opl app action execute ... --json`。 |
| Domain truth | MAS/MAG/RCA/OMA | 拥有 domain truth、quality/export verdict、memory body、artifact body、owner receipt 和 typed blocker。 | Domain-owned projections/receipts；App 只展示 refs。 |
| Shell implementation | active shell checkout | 渲染 App-owned 产品定义并桥接 App state/action。 | Active shell source/tests、adapter contract、App wrapper build/smoke。 |

## 总体结论

OPL App 的正确 GUI 方向是 `chat-first command center`：Home 让用户直接在选中
workspace 中向 Codex executor 下达任务；Runtime、continue-work、evidence refs、
Files、Memory、Automations 和 Settings 都是相邻上下文。以前的 App docs 已经写清
contracts 和能力清单，但缺少元素级说明，导致 shell 迭代时容易把元素放回
dashboard、settings bar 或通用 agent 控制台。

当前必须保持的三个位置判断是：

- Home 是 composer-first：主元素是 conversation canvas、composer、workspace、
  purpose route、Codex model/status、attach/context、send/stop 和少量示例。
- Runtime/continue-work/evidence refs 不放普通 Home：它们进入 Runtime 页或右侧
  inspector。
- 右侧 inspector 是辅助上下文：Files、Runtime/Routing、Capabilities、Memory、
  Automations 和 Settings shortcuts 在右侧默认收起，打开后辅助当前 conversation。

## 元素审计

| 区域 | 元素 | 作用 | 正确位置 | 当前判断 |
| --- | --- | --- | --- | --- |
| First-run | Core readiness summary | 告诉新用户是否满足进入 App 的最低条件：workspace root、Codex CLI、Codex config。 | First-run 主视图。 | 正确；Full readiness 和后台维护保持次级。 |
| First-run | Next visible step | 给出用户当前唯一最重要的下一步。 | First-run 主动作区。 | 应保持用户语言；raw command 进入 details。 |
| Frame | Product identity | 明确这是 One Person Lab App，而不是 upstream AionUI 或候选 shell。 | titlebar、header、About、manifest。 | 必需；shell branding 不应回流成 App identity。 |
| Frame | Workspace path | 告诉用户 Codex turn 会在哪个目录执行。 | Header 或 composer 附近的低权重稳定位置。 | 必需；不应做成 Home 大卡片。 |
| Home/Guid | Conversation canvas | 提供第一工作面。 | 中心 reading lane。 | Home 必须 chat-first，不是 dashboard-first。 |
| Home/Guid | Composer input | 接收用户任务。 | Home 视觉中心或 pinned command surface。 | 主元素；不能被 Runtime/continue-work grid 抢占。 |
| Home/Guid | Purpose entries | 快速选择 `科研`、`基金`、`演示`/RCA route intent。 | Composer 附近的 compact click-to-start options。 | Contract-backed；中文 chrome 当前为 `演示`。 |
| Home/Guid | Compact purpose tag | 显示当前 route，不把 assistant 做成 dashboard。 | Composer prefix、input header 或 conversation header。 | 必需；receipt details 可展开。 |
| Home/Guid | Codex model/status | 表示固定 Codex CLI executor、默认 GPT-5.5（超高）和可见模型选择策略。 | Header 或 composer 低权重状态。 | 当前 contracts 允许 Home/conversation 显示 model selector/status，但仍禁止 backend/provider/permission selector。 |
| Home/Guid | Assistant-scoped skill menu | 展示 selected purpose 的 required/optional App packaged skills。 | Composer 次级菜单。 | Required skill locked；shell-local helper skills 不进普通 Home。 |
| Home/Guid | Workspace selector | 发送前选择或确认 workspace。 | Header 或 composer-adjacent control。 | 合理；应支持近期目录和明确状态。 |
| Home/Guid | File/folder attach | 加入本轮本地上下文。 | Composer action row。 | 需要预览、移除和 refs 表示。 |
| Home/Guid | Send/stop | 发送、停止或反映 running/stopping 状态。 | Composer 主动作。 | 必须常显、状态明确。 |
| Home/Guid | Runtime activity / continue-work / evidence refs | 展示运行项目、attention、recent activity、ledger refs。 | Runtime 页或右侧 inspector。 | 不应放普通 Home。 |
| Conversation | Message timeline | 展示 user、assistant、tool/process、errors、prompts、receipts。 | 主 chat canvas。 | 必需；raw protocol frame 进 diagnostics。 |
| Conversation | Pending elapsed state | 告诉用户 Codex 仍在工作。 | 当前 assistant turn 或 composer 状态。 | 必需；应显示等待反馈和 elapsed seconds。 |
| Conversation | Route receipt | 证明 turn 通过 App-owned purpose 和 Codex CLI 路由。 | Turn details 或 compact receipt chip。 | 要可审计，但不默认展示 raw JSON。 |
| Workspace/session rail | Recent conversations | 找回 selected workspace 下的 thread/session。 | 左侧 rail/drawer，用户显式打开。 | 必要缺口；不应漂回 Home grid。 |
| Workspace/session rail | New/resume/reset | 新建、恢复、重置 conversation。 | Rail header 和 list item actions。 | Codex-like session ergonomics 必需。 |
| Right inspector | Files refs | 查看 workspace/conversation 文件引用。 | 右侧 inspector tab。 | 主要缺口；应成为普通 auxiliary surface。 |
| Right inspector | Runtime/Routing refs | 查看 route receipt、current run refs、next owner、blockers、safe actions。 | 右侧 Runtime/Routing tab。 | 必需；不要放 Home。 |
| Right inspector | Capabilities refs | 查看 active assistant profile 和 loaded App packaged skills。 | 右侧 tab；全局 catalog 在 Settings。 | 需要补强。 |
| Right inspector | Memory/receipts refs | 查看 memory 和 receipt refs。 | 右侧 tab。 | 只展示 refs，不拥有 body。 |
| Right inspector | Automations/Always-On refs | 查看长周期任务、monitor 或 scheduled work。 | 右侧 tab 或 secondary page。 | 需要明确；不放普通 Home。 |
| Runtime | User task status | 首先回答任务是否在跑、哪些活跃、哪些排队、哪些需要关注。 | Runtime 首屏。 | 来源必须是 Framework user-task projection。 |
| Runtime | Project progress refs | 展示 active/queued/escalated project lines、stage、next owner、next step。 | Runtime 第二层。 | 保留原始 status，不把 queued/escalated 伪装成 active worker。 |
| Runtime | Safe actions | dry-run/execute App-owned operator action。 | Runtime action/advanced 区。 | Mutation 走 `opl app action execute ... --json`。 |
| Settings | General | 普通设置入口和概览。 | Settings ordinary tab。 | 当前 machine truth。 |
| Settings | Access | Codex CLI/provider access、账号或配置可用性。 | Settings ordinary tab；`/guid` shortcut 进入这里。 | 正确。 |
| Settings | Capabilities | MAS/MAG/RCA/OMA 能力和 App packaged skill 边界。 | Settings ordinary tab。 | Global catalog；Home 保持 purpose-first。 |
| Settings | Local Environment | runtime connection/readiness、module path source 和 refs。 | Settings ordinary tab。 | 配置面，不承载 project progress。 |
| Settings | Advanced | OPL Flow Context、兼容技术项和高级配置。 | Settings ordinary tab。 | 不变成 runtime dashboard。 |
| Settings | About & Updates | App version、shell version、release channel、updates、provenance。 | About surface。 | standard updater 与 Full first-install 必须分清。 |

## 现有缺口

1. **右侧 context inspector 需要成为普通用户可打开的辅助面。** Files、
   Runtime/Routing、Capabilities、Memory、Automations、Settings shortcuts 已经是
   target inventory，但 active shell 还需要完整内容而不是只有入口。

2. **Workspace/session rail 需要稳定承接 session history。** Recent conversations、
   resume、reset、running/blocked badges 应在 rail，不应回到 Home activity grid。

3. **Conversation receipts 需要产品化表达。** 用户应看得出本 turn 走了 `科研`、
   `基金` 或 RCA/演示 route，并由 Codex CLI 执行；schema id、raw JSON、protocol name
   应在 details 或 diagnostics。

4. **Runtime refs 层级需要更明显。** 用户首先关心 user task status，其次是
   project progress refs，再是 safe action，最后才是 full detail/evidence ledger。

5. **空状态和恢复动作需要元素级定义。** Home、Runtime、Files、Memory、Automations、
   Access、Local Environment 都应展示短原因和下一步动作，不能只显示 raw command failure。

## 位置复盘

Home 的用户预期是“我已经在某个工作目录里，可以直接交代任务”。因此 Home 上正确的
元素是 composer、workspace、purpose、Codex model/status、attach、send/stop、少量
prompt examples。Runtime dashboard、continue-work grid、needs-attention/active/recent refs、
per-assistant running badges、footer quick icons、backend/provider/permission selectors
都不符合 Home composer-first 预期。

Conversation 的用户预期是“这轮任务发生了什么、下一步能做什么”。Message timeline、
pending elapsed state、tool/process summary、queue、stop、attach preview、route receipt
放在 conversation 内符合预期。

Runtime 的用户预期是“现在有没有任务真的在跑、下一步是谁、是否卡住”。它应 user
task status first、project progress refs second、safe action third、full detail/evidence
ledger on demand。

Right inspector 的用户预期是“当前 conversation 旁边有哪些有用上下文”。它默认收起，
打开后保留当前 conversation、scroll position 和 composer draft，只展示 refs、receipts
和 next actions，不拥有 runtime truth 或 domain artifact body。

Settings 的用户预期是“App 如何配置、系统是否 ready”。它管全局配置、access、
capabilities、appearance、advanced、about/update；project progress、continue-work、
evidence refs 应在 Runtime 或 inspector。
