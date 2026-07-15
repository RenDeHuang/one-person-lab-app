# OPL App GUI Shell 实现指南

Owner: `one-person-lab-app`
Purpose: `app_gui_shell_implementation_guidance`
State: `active`
Machine boundary: 本文是 shell adapter 的人读实现指南。产品行为、page-state、模型
策略、Settings registry、state/action surface 和 release gate 仍由现有 contracts、
validators、source/tests 与 evidence 拥有。

设计体系入口见 [`README.md`](README.md)。

## 定位

本指南提炼 active AionUI 路线中可复用的方法，不是 AionUI 代码复制指南。未来 shell
应实现同一套 App-owned contracts，而不是继承 AionUI 的目录、组件名、状态模型或
fork-local 产品逻辑。

正确目标是：

- App repo 定义产品、profile、page-state 和验收边界；
- shell 负责 renderer、platform integration、bridge、i18n/CSS 和 focused tests；
- Framework/domain/release owners 继续拥有各自 truth；
- carrier 可以替换，产品语义和 action/state contract 不随 carrier 分叉；
- 多个 GUI 是同一逻辑控制面的独立 client，不共享 renderer dependency tree 或 GUI 私有
  database；本机 launch selection 与正式 release-shell adoption 是两条独立路径。

“不降级”只保护已进入 OPL App contracts、ordinary routes 或正式用户路径的能力。
AionUI fork 中存在但未被 OPL 采纳的 Team、provider/backend、任意 skills/MCP、Sites/Chat
等产品面可以在 profile/route adapter 层隐藏或拒绝；不要为保持上游功能数量扩大 OPL IA。

## Contract-first 顺序

实现任何用户可见变化前，按以下顺序定位 owner：

1. 功能要求：[`feature-inventory.md`](feature-inventory.md) 与
   `contracts/app-gui-product-contract.json`。
2. 默认值和 generated config：`contracts/app-product-profile.json`。
3. 页面状态与显示边界：`contracts/app-page-state-matrix.json`。
4. Settings registry/route/action：`contracts/app-settings-control-plane.json`。
5. Release-shell adoption 与 local launch selection：active/candidate adapter contract、
   `contracts/app-shell-candidates.json#interactive_launcher_policy`。
6. 理想交互与视觉：[`ideal-interaction-spec.md`](ideal-interaction-spec.md)、
   [`visual-system.md`](visual-system.md)。
7. 当前差距与验证入口：
   [`shell-conformance-matrix.md`](shell-conformance-matrix.md)。

若现有 shell 行为与目标不同，先分类差异，不在 renderer 中偷偷建立新默认。当前
Codex-based ideal target 是宽桌面 persistent project/conversation rail；active
AionUI 读取动态 state source，native candidate contract 记录 ideal target。两者是否
收敛由 validator readback 动态计算，不在人读实现指引复制当前 profile 值；应由产品
contract/实现收敛 lane 处理。

## Thin Adapter 结构

一个合格 shell delta 通常只需要以下边界：

| Adapter surface | 职责 | 禁止事项 |
| --- | --- | --- |
| Product profile consumer | 读取 generated App profile，提供品牌、默认模型、purpose、locale 和 feature flags。 | 硬编码模型 allowlist、provider policy 或 shell-local default。 |
| State bridge | 把 App state readback 规范化为 renderer 可消费 envelope。 | 从本地组件状态推断 runtime/domain readiness。 |
| Action bridge | 执行 App-owned action，并返回 dry-run/result/receipt。 | 直接调用 domain CLI、绕过 confirmation 或自建 mutation kernel。 |
| Package launch adapter | 在 Home starter launch 前请求 Framework-owned use-boundary activation，并消费 `launch_allowed`、receipt 与 binding。 | 从 installed flag 推断可用、绕过 activation、在失败后仍创建/发送 conversation。 |
| Thread directory / coordination adapter | Rail 只投影 App Server canonical thread directory/actions；rename/archive/restore/delete 映射 `thread/name/set`、`thread/archive`、`thread/unarchive`、`thread/delete`，pin 仅 Shell metadata；thread-detail context action 与 model host tool 封装 `turn/*`、advisory、delivery audit 与 interactive request pending flow。 | 用 Shell DB 拥有 history、把 local reset 冒充 history reset、挂载独立“线程协调”页面、隐藏按需 context action/host tool、把 pending approval 当 dispatch failure、用 project/workspace 建 sandbox、增加 OPL confirmation、用 `send_input` 作为跨根线程总线。 |
| Projectless local-input adapter | 让 attachment、file/directory picker、paste/drop、`/open` 在无 workspace 时继续进入 Codex 原生权限路径。 | 因缺 project 禁用输入、把 workspace membership 当授权、复制第二套 path permission model。 |
| Artifact ref adapter | 用户显式打开的合法绝对本地路径或 workspace-scoped project ref 解析为现有 Preview target，保持只读和 fail-closed。 | 复制 artifact body、新建 renderer/store、路径穿越、非法 scheme、自动静默读取或猜测未知格式。 |
| Local / Worktree handoff adapter | Home 通过既有 `gitWorkspace` adapter投影 Local/Worktree、starting branch 和 managed worktree create/reuse；Conversation Environment 为同主机 `not_loaded`/`idle` task 调用 `thread/settings/update` 双向切换。复用同一 Git adapter为确定的 managed worktree创建 durable snapshot receipt，再移除；按 receipt 恢复原 path、HEAD/branch、index、tracked、untracked 与 ignored user files。Worktree默认保留，cleanup只由显式动作触发。 | 复制 Git/thread store、把 project/workspace 当权限域、running/archived/error 静默 fallback、remove-before-snapshot、删除branch/ref、覆盖冲突路径、伪造partial success、把本机lifecycle冒充cross-host handoff。 |
| Cross-host handoff adapter | 只在Codex App Remote Connections / host-handoff owner提供真实连接、任务与Git状态迁移、目标readback和断线恢复协议后接入；当前返回 `remote_host_handoff_owner_surface_unavailable`，Shell角色是 `blocked_thin_adapter`。 | 用远端`turn/start`、Aion Remote Agent、Framework connection registry或本地receipt冒充任务迁移；把owner blocker降级成无期限future。 |
| Review adapter | 在现有 Files/Changes diff surface补 uncommitted/base branch/commit/custom、inline/detached、Unstaged/Staged/Commit/Branch/Last turn、PR context、stage/commit/push；Last turn复用 message store，`gh` 缺失明确 unavailable。Custom instructions只进入`review/start.target.custom`。公开协议缺少非custom focus input时隐藏该输入，并在`review/start`前返回typed `protocol_unavailable`。Line comments仅在 typed Codex file/line protocol存在后接入。 | 恢复 equal-weight Review tab、复制 diff/Git store、创建本地 annotation store、用`turn/steer`冒充Review focus、启动无效Review、把focus只写audit、重复custom instructions、伪造成功或在 React 层直接实现 Git protocol。 |
| Route adapter | 把 legacy/upstream route 映射到 App-owned page。 | 让 compatibility route 重新成为 ordinary navigation。 |
| Settings slot | 从 Control Plane registry 渲染 ordinary/secondary pages。 | 复制一套 shell-owned Settings IA。 |
| Presentation adapter | 复用 shell primitives 实现 App layout、tokens、i18n 和 accessibility。 | 复制外部源码或把视觉 token变成产品 truth。 |
| Platform adapter | Electron/Web/native file picker、window、notification、secure storage。 | 把平台能力提升成 runtime/domain authority。 |

只有在现有 primitive 无法表达 App contract 时才新增 shell-local component。新增组件
应围绕一个明确 slot 或 page-state，而不是创建未来可能使用的 framework。

## 多 GUI 运行边界

[`gui-shell-candidates.md`](gui-shell-candidates.md) 是本机 GUI 选择的操作 owner。Shell
实现只需满足下面的 client contract：

- App-root launcher 按 `shell id + mode` 选择本次启动目标，默认目标来自 active adapter；
  launcher 不得改写 active adapter、release role 或 updater channel。
- 每个 shell 保持独立 bundle id、checkout、lockfile、依赖树和 GUI user-data root；不要
  为复用而共享 `node_modules`、SQLite、localStorage 或 renderer store。
- 两个 shell 最终都必须通过 App command-resolution policy 取得 OPL/Codex executable。
  App launcher 已为 Native Candidate 注入显式 executable identity；Native 直接打开 bundle
  与 active AionUI parity 仍是 current deviation，不能声明 same-runtime parity。
- Runtime readback 至少绑定 OPL/Codex path、version 和 cohort ref。Shell-local cache 不得
  覆盖 resolver readback，也不得把缺失 readback 改写成 ready。
- Codex Core/App Server 拥有 thread history 和 opaque thread id。两个 shell 最终都从
  `thread/list/read/resume` 投影 conversation directory；本地存储仅用于 UI preferences、
  draft 和可重建 cache，不得直接读取另一个 GUI 的 private store。
- 双 shell parity 必须用 exact cohort 证明跨 workspace、并发写与 steer 保持 Codex
  flexibility，并把 overlap/loop 作为 advisory；queue 只有双方真实实现后才进入 parity gate。
  Side-by-side install 或 sequential switching
  不能替代该行为证据。

统一 launcher 已实现本机 launch selection；Runtime resolver 只完成 launcher-started Native
范围，conversation continuity 仍是 target contract。局部实现不得提升为双 shell parity。

## AionUI 最小定制阶梯

AionUI 主线定制必须从维护成本最低的层开始，前一层能完成就不得进入后一层：

| Level | 优先手段 | 适用内容 | Closeout 要求 |
| --- | --- | --- | --- |
| `L1 profile/data` | Generated profile、registry、已有配置 | 品牌、labels、默认值、可见入口、capability exposure。 | 不修改 upstream component tree。 |
| `L2 bridge/adapter` | 既有 IPC/API adapter、App state/action bridge | Codex/OPL data、actions、receipts、platform capability。 | 单一 truth、typed failure、focused bridge coverage。 |
| `L3 composition/token` | Existing layout primitive、slot、wrapper、CSS variable、i18n | Rail section、composer strip、timeline event、Environment secondary content、视觉 token。 | 不复制状态模型，不整页重写，不用广域 CSS selector 接管 upstream DOM。 |
| `L4 fork-body patch` | 对 upstream component 的最小直接修改 | 只有稳定边界无法表达且属于 P0/P1 的交互。 | 记录 upstream file、必要性、冲突热点、focused regression 和下一次 intake 处理。 |

以下情况不是进入 `L4` 的理由：现有组件样式不完全一致、测试更容易写、短期绕过
profile hydration、或 Settings 页面已有类似布局。视觉对齐优先复用 composition/token，
不能通过重写大组件把 AionUI 变成第二套私有 shell。

每次主线 GUI 工作都应输出 delta inventory：修改的 upstream fork-body 文件、OPL-owned
overlay/adapter 文件、tests/evidence 文件分别计数。文件数不是机械 gate，但 fork-body
范围持续扩大时必须先重新检查是否能退回 `L1-L3`。

## Profile-driven

Generated product profile 是 shell 的默认值入口：

- Home/conversation 的模型、推理、purpose 和 capability exposure 从 profile 读取。
- 当前默认值、具体模型列表、顺序、退休策略和持久化规则只引用
  `contracts/app-product-profile.json`，不在 shell 或人读实现文档复制。
- Branding、locale、ordinary capability allowlist 和 optional modes 使用同一 profile。
- Profile 缺失、schema 不兼容或字段无效时 fail closed，显示可理解 blocker；不要
  回退到 upstream provider/model defaults 后假装一致。
- Shell-local cache 只能作为加载优化，必须保留 profile version/source，不能成为
  独立配置 authority。

## State / Action Bridge

普通读取：

```text
opl app state --profile fast --json
```

显式刷新通常仍使用 fast profile。Runtime 只消费合同允许的 Work Item、Stage、Attempt、
Token 和 visibility 投影；Stage Popover 不得触发 Full state 或 Operator drilldown。
Full state 和 Operator full drilldown 只允许 Settings Advanced 与 release tooling 请求，
不得作为 Runtime 的 detail fallback。各页面只渲染自身 allowlist；不得从
`active_run_id`、module dirt、DOM presence 或缓存推断 running、ready、synced、
domain-ready 或 release-ready。

页面所有权固定如下：

| Surface | Owns | Must not absorb |
| --- | --- | --- |
| Runtime | Agent/Project scope、Work Item status、running/elapsed、Stage/Attempt、Token、archive/restore | provider/platform repair、updates、module health、raw diagnostics、artifact provenance、release controls |
| Settings Environment | provider/platform repair、Temporal/worker readiness、软件更新与维护 | Work Item lifecycle 或论文进度 |
| Settings Capabilities | 模块/智能体安装、同步、可用性和健康 | 论文/任务状态列表 |
| Settings Advanced | raw diagnostics、State Index、operator drilldown、logs、command refs、safe-action catalog | 普通 Runtime 默认信息 |
| Inspector | task/conversation artifact provenance、preview、lineage refs | artifact authority 或 Runtime status |
| Release tooling | 同 cohort 的完整 evidence bundle | 普通用户 Runtime UI |

Mutation 统一使用：

```text
opl app action execute --action <id> [--payload <json>] [--dry-run] --json
```

实现要求：

- 先从 App state/action catalog 取得可用 action 和 disabled reason。
- Runtime 只能调用任务 archive/restore；next action/owner 在 Runtime 中是只读语义。
  其他 action 必须由 Environment、Capabilities、Advanced、Inspector、conversation
  或 release tooling 的合同明确授权。
- 高风险或状态改变动作先 dry-run/preview，再 confirmation，再 execute。
- UI 明确显示 what changes、what does not change、receipt/recovery ref 和 refresh 行为。
- Result receipt 是动作事实，不代表 runtime、domain、artifact 或 release readiness。
- 网络、CLI、schema 和 permission failure 保留 typed reason，不转换成模糊 `unknown`。
- Package launch 是独立的 fail-closed prepare/activate/launch 流程。Shell 不拥有 package
  currentness 或 materialization，只在 Framework 返回完整 use receipt/binding 后继续。

跨顶层线程协调是另一条 host boundary：Codex Core/App Server 拥有 opaque thread ID、history、
status、turn 和 permission/approval；OPL host 执行 list/read/resume/fork/archive/unarchive/start/steer、
opaque-key 幂等、project/workspace/write-set/route advisory，并产生可见 delivery audit。
Project/workspace 只作默认 cwd、分组和元数据；不得在 Shell/host 中变成授权域。
`spawn_agent/send_input/wait_agent`
只用于同一 agent tree。协议适配集中在 host/preload boundary，并作为模型/host tool 按需调用；
普通 rail 不挂载独立“线程协调”入口；模型 host tool 与线程上下文动作复用同一 adapter，且不得
建立独立 dashboard 或第二套 history。
Canonical rows 来自 App Server；rename/archive/restore/delete 映射对应 `thread/*`，pin 只作 UI
metadata，local reset 不能改写 history。Shell DB 只能保存 draft、preference 与可重建 cache。
任何调试视图也只能消费 typed projection，不直接解析 App Server JSON 或拥有路由策略。

模型 tool access 必须复用同一 host adapter，但实现证据与用户 thread-detail action 分开：App Server experimental
`dynamicTools` 必须在创建普通 thread 的 `thread/start` 路径注册，并闭合 `item/tool/call`
request/response 和 turn result。当前 AionUI 的 ACP/AionCore ordinary conversation 未经过本
coordination port 的 `thread/start`，因此只能声明 user-facing coordination source implemented；
不得把 thread-detail 结构检查提升为 model tool implemented，也不得为此新增第二套 thread runtime、
MCP/socket 总线或 duplicate store。

当前真实链路是 ordinary conversation HTTP -> AionCore ACP `session/new/load` -> codex-acp
ThreadManager。ACP session输入与callback都没有 dynamic-tool surface，事后给另一个 coordination
App Server client加 JSON-RPC handler无法收到 ordinary thread的 `item/tool/call`。优先 owner route是
AionCore让同一 App Server client执行 `thread/start(dynamicTools)`并代理tool call；若继续使用
codex-acp，则由 codex-acp补齐dynamic-tool输入、Core response提交和 ACP callback。

Cross-host task handoff也不能由Shell补一条旁路。当前production只拥有本机App Server stdio client，
没有host transfer/migrate RPC；Aion Remote Agent和Framework connection registry不是Codex host truth。
因此该项是当前required parity target下的owner-blocked unavailable，路由到Codex App Remote
Connections / host-handoff owner，Shell不新增remote thread store或伪success投影。

同一 opaque idempotency key 重试必须返回第一次 receipt/result、`ok=true` 且不再次 dispatch；
不得返回 duplicate-delivery error。同内容不同 key 继续允许。跨 host transition 必须走 handoff，
不能把 direct message 当作跨 host 支持。

App Server 发起 command/file/permission approval、user-input 或 MCP elicitation 时，host 必须把
请求保留为 typed pending state，并在 selected target thread detail 中保留 thread/turn/item context。
`currentTime/read` 可自动回答；未知 server request 必须 JSON-RPC fail closed。Pending 不得转换成
dispatch failure；只有 decline/cancel、请求已失效或 handler/protocol 无效才失败。Delivery audit
只证明目标沿用既有 Codex policy，不得伪造独立持久化 approval receipt。独立非紧急 queue 在真实
host queue 落地前保持 deferred。

## Settings Control Plane

Settings 是 App-owned OPL Control Center。Shell 应通过 Control Plane registry 和
adapter slot 承接，而不是遍历 upstream settings pages 后临时隐藏。

实现边界：

- `SettingsHost` 负责页面 frame、search、navigation、deep-link 和 shared protocols。
- `SettingsShellAdapterSlot` 把 App registry entry 映射到当前 shell component。
- Ordinary routes、secondary routes、legacy redirects 和 extension anchor remap 由
  contract hydration 提供。
- 概览先显示结论、影响范围和下一步；raw path、id、receipt、JSON 与 diagnostics
  默认折叠。
- Toggle、menu、segmented control、input、confirmation drawer 和 post-action notice
  使用统一 interaction protocol，不为每页另造 action semantics。
- Upstream 新增 Settings 页面必须先经过下面的 intake classification，不能自动进入
  ordinary navigation。
- Capability 选择从 Home starter 进入；package 安装、Home visibility 和 lifecycle 进入
  Settings → Agents & Capabilities。`/capabilities` 等历史入口只允许 compatibility redirect。

## Settings Upstream Intake 分类

Broad AionUI intake 先使用 adapter contract 的 `absorbed / rejected / deferred`。只有
Settings route、registry、slot 与 compatibility 变化再使用以下四类判定：

| Class | 何时使用 | 实现动作 |
| --- | --- | --- |
| `accepted` | 行为、copy、authority 和视觉均符合 App contract。 | 原样复用或只做品牌/i18n token 映射。 |
| `adapt` | Primitive 有价值，但信息架构、默认值、copy 或 bridge owner 不同。 | 保留 primitive，改为 profile/state/action driven 的薄适配。 |
| `redirect` | 旧 route/deep link 仍需兼容，但不应出现在普通产品层。 | 在 route adapter 中映射到最近 App-owned page，不渲染旧 ordinary tab。 |
| `reject` | 会引入第二 truth、暴露 forbidden surface、复制不兼容源码或破坏 chat-first。 | 不吸收；必要时在 validator 中加入 forbidden probe。 |

分类记录应说明 App source ref、用户影响、authority owner 和验证入口。不要用
`accepted` 代表“upstream 已有所以直接拿来”，也不要用 `adapt` 合法化深 fork rewrite。

## 视觉实现边界

- ChatGPT macOS 26.707.41301 是当前布局、密度、composer、timeline、project rail 和
  Environment floating details 基准；`26.707.31428` 与 `26.707.31123` 仅保留为历史
  observation。OPL branding 与 product contracts 是例外。
- AionUI 是 active implementation carrier 和 native candidate 的 regression floor，
  不是理想视觉 authority。
- 优先通过 tokens、CSS、existing layout primitives、composition 和 i18n 对齐。
- 不复制 ChatGPT/Codex、AionUI upstream 或外部 demo 源码来建立产品层。
- DOM presence 不能证明视觉可用。Rail、drawer、Environment/details 和 canvas 必须在
  目标 viewport 中有可见像素、正确尺寸、可操作 controls 和无重叠布局。
- Visual change 不得以恢复旧 UI 的方式满足 stale validator；先判断 contract/gate
  是否已经落后于产品目标。

## Visual QA 与证据层级

| Level | 能证明什么 | 不能证明什么 |
| --- | --- | --- |
| Contract/profile validation | 字段、引用、route 和 adapter shape 一致。 | 页面真实渲染、交互和视觉对齐。 |
| Focused unit/DOM test | 指定 state、action、route 和可见行为存在。 | 像素布局、packaged behavior、完整用户路径。 |
| Source browser screenshot | 当前 source renderer 在指定 viewport 可见。 | Packaged App、clean VM、release currentness。 |
| Packaged screenshot/smoke | 某一 package cohort 可启动并渲染目标路径。 | Stable promotion、owner acceptance、domain readiness。 |
| Same-cohort user-path/VM evidence | 指定构建在目标环境完成验收路径。 | 未经 release authority 的发布或 currentness claim。 |

视觉 QA 先覆盖 P0/P1：宽桌面、窄桌面、rail、Home、conversation、composer、
Environment open、light/dark、简体中文/英文和 composer running/error。Settings 属于
P2 独立矩阵，不能替代主工作流证据。截图必须绑定 route、viewport、source/package ref、
command 和可见状态 anchor。

## 实现步骤

1. 读 App contracts、三层文档和当前 adapter；先确认精确 Codex observation、OPL delta
   与 current deviation。
2. 按 `P0 Codex Core -> P1 OPL Professional -> P2 Administration` 排序，不用 Settings
   完成度替代主体验。
3. 先用 `absorbed / rejected / deferred` 分类 broad AionUI intake；Settings 变化再追加
   `accepted / adapt / redirect / reject`，然后从 `L1-L4` 定制阶梯选择第一个可行层级。
4. 只实现 profile consumer、bridge、slot、route、presentation 所需最小 delta。
5. 为用户可见行为增加 focused existing-test coverage；视觉变化增加截图/pixel evidence。
6. 运行 adapter 对应 validation，不用 candidate evidence 替代 active-shell evidence。
7. 更新 conformance matrix 的 source refs 和状态；未取得的 evidence 保持
   `not evidenced` 或 current deviation。

## 反模式

- 在 shell 中复制模型 allowlist、Settings IA、purpose list 或 page-state rules。
- 让 upstream route、Team、多 backend/provider controls 或 raw permission-mode terminology 回到 ordinary UI；App-owned user-language permission/access control 必须保留在 composer。
- 为保留 AionUI 未采纳功能而扩大 ordinary IA，或把 Settings capability management 重新挂回 rail。
- 从 module health、Git dirt、active id、缓存或 DOM 推断 runtime/domain readiness。
- 直接执行 domain CLI、写 artifact body、memory body、owner receipt 或 release truth。
- 为兼容一个 carrier 新建 App-wide wrapper/factory 或第二 bridge protocol。
- 用共享 `node_modules`、直接访问另一个 GUI 的 private store 或 PATH-only executable
  resolution 冒充多 GUI 一致性。
- 把本机启动 candidate、side-by-side bundle 或 session resume smoke 当成 active-shell
  adoption、同 Runtime cohort 或并发写安全。
- 在 Shell 中建立第二套 thread store、global agent registry、跨线程 permission policy，或把
  `send_input` 扩大为任意历史 thread 的消息总线。
- 把 Home 做成 dashboard、launcher、activity grid 或三列 scientific workbench。
- 宽桌面隐藏 project rail，却把该实现现状写成理想目标。
- 默认打开右侧 inspector，或在窄屏只切换按钮状态而不显示 panel。
- Card inside card、双层 composer surface、随机 radius、混合语言和技术 id first。
- 用 docs、contract-only、focused test 或 source screenshot 宣称 packaged/release-ready。

## 最小验收

一个 shell adapter 至少需要证明：

- App product profile 被读取，模型策略没有 shell-local 分叉；
- ordinary state/action 只通过 App bridge；
- local launch selection 不修改 release adoption，shell bundle/user-data identity 保持隔离；
- OPL/Codex resolver path、version、cohort 有 readback；PATH-only deviation 不被包装成 parity；
- conversation directory/history 以 App Server thread authority 为准，不创建 shell-owned
  canonical thread store；
- rename/archive/restore/delete 使用 App Server methods，pin 仅 Shell metadata，local reset 不冒充
  App Server history reset；
- Projectless attachment/file/directory/paste/drop/`/open` 不被 workspace gate 禁用；
- Home/chat-first、timeline、composer、rail 和 Environment/details 行为符合对应 target 或被明确
  标成 current deviation；
- 跨顶层 thread list/read/dispatch 使用 App Server adapter，idle/running/stale 状态选择正确；
- protocol/target/Codex permission failures返回真实错误；cross-host 当前明确 unavailable；cross-project/workspace、
  workspace-write、overlap、running steer 与 loop 信息只 advisory，不拒绝或额外确认；
- 同一 opaque request/idempotency key 重试幂等，同内容不同 key 允许重复投递；
- 同一 key 重试返回第一次 receipt/result、`ok=true`，不二次 dispatch 或返回 duplicate error；
- archive 直接且可 unarchive；Shell/host 不得为 read/send/steer/archive 增加 OPL confirmation；
- 用户显式合法绝对本地路径与 workspace-scoped project refs 只在安全解析后进入现有 Preview，
  traversal、非法 scheme、自动静默读取失败时保留原 ref 且不打开空 preview；
- Home Local/Worktree、starting branch 与 managed worktree create/reuse 复用既有 `gitWorkspace` adapter；
  既有同主机 `not_loaded`/`idle` task 只从 Conversation Environment 通过
  `thread/settings/update` 切换真实 cwd，`running`/`archived`/`system_error` 显示 unavailable且
  不 silent fallback；AionUI projection 失败时 best-effort 恢复旧 cwd；
- `opl_workspace_handoff.v1` 只承载 locality projection metadata；worktree默认保留复用。显式cleanup
  只允许确定的managed worktree，必须先生成可解析到durable Git ref/object的
  `opl_worktree_snapshot_receipt.v1`；restore覆盖HEAD/branch或detached HEAD、index、tracked、
  untracked与ignored user files，冲突typed fail，不删branch/ref。Cross-host handoff仍需独立真实transport；
- Review 复用 Files/Changes diff surface，覆盖四类 target、inline/detached、五个 sections、PR
  context/stage/commit/push，并在 `gh` 缺失时明确 unavailable；Last turn复用既有message store且
  不新增状态源，line-level comments在typed Codex protocol缺失时必须保持 unavailable；
- Settings 从 Control Plane registry/slots 渲染，legacy routes 只 redirect；
- Home package starter 在 unavailable/activating/blocked 状态有真实 readback，launch 前
  activation fail closed；
- 普通 UI 不拥有 runtime/domain/artifact/release truth；
- focused behavior、visual pixels 和 package/release claim 使用匹配层级的证据。
