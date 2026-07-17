# Runtime V2 产品设计

Owner: `one-person-lab-app`
Purpose: `runtime_work_item_projection_retained_support`
State: `active_retained_route_reference`
Product classification: `X0-01`
Maintenance debt: `core_gate_pruning_pending`
Machine boundary: 本文解释条件保留 Runtime route 的既有字段职责。当前机器实现归
`contracts/app-gui-product-contract.json#pages.runtime_status.runtime_cockpit_product_contract`、
`contracts/app-runtime-bridge.json#work_item_projection`、
`contracts/app-page-state-matrix.json#pages[id=runtime]`、validators、source 与 tests；本文不拥有
Framework runtime、domain truth、artifact authority 或 release evidence。上述 contract/validator
目前仍把 Runtime 当硬门，后续需单独收薄；validator pass 只证明现有 contract/source 一致。

## 结论

Runtime 是当前 AionUI 条件保留的极简项目工作状态页，不是 observability dashboard，也不是平台
运维控制台。它归 `X0-01`，不是 B0/R1/U1 核心、P0、默认 release gate 或 Native phase-1 parity。
已有 route/source/pixel 可以继续维护；若 route 启用，默认页只帮助用户判断：正在看哪个智能体和
项目、有哪些任务、每项任务是什么状态、是否在跑、当前和下一 Stage 是什么、用了多少 Token。
当前 Attempt 按需在 Stage 弹层和任务详情中显示。

现有 Runtime cockpit contract、page-state、design-system/release validators 仍带 core hard gate。
产品分类是 `retained_x0_route`，Source 状态只在五轴矩阵读取，`core_gate_pruning_pending`
作为独立 maintenance debt。移出这些硬门是后续 machine cleanup；本文只纠正文档读法，
不把现有一致性检查解释为产品必要性。

Codex/App 更新、Temporal/provider/platform repair、托管依赖与 raw diagnostics 归 Maintenance；
Agent Package lifecycle 归 Agents；Skills/Plugins/Flow 和本机能力归 Capabilities；artifact
provenance 归任务/会话 Inspector；同 cohort 完整证据归 release tooling。
这些内容一律不进入 Runtime。

Runtime V2 不再直接拼接项目目录、Temporal attempt、业务生命周期、Token telemetry 和
package 状态。OPL Framework 先生产稳定的 `WorkItemProjection v2`；App 定义用户语言、字段
位置和验收；Shell 只渲染。`AgentAvailabilityProjection` 仍可供 Settings 使用，但不占据 Runtime。

项目名严格取 canonical `workspace_path` 的 basename；Framework 投出语言无关的 action
semantic fields，Shell 按当前 App locale 渲染；手工归档是独立 visibility 轴，并进入独立
归档库。以上均是 App 产品 truth，不由 binding label、runtime history、Shell 本地状态或
Framework raw 文案覆盖。

## 问题背景

旧页面把五类事实放进同一条 runtime task：

1. 智能体及 package 是否可用。
2. 项目是否存在、目录和显示名是什么。
3. 项目内有哪些论文或工作项。
4. 当前是否有执行、stage、attempt 和 heartbeat。
5. Token 是否被真实观测。

这些事实的生命周期不同。用 active binding 或最近 attempt 代替项目与工作项库存，会造成
项目串名、历史论文消失、旧失败覆盖已交付状态、智能体被伪装成论文任务和 Token missing
显示为零。V2 的目标是消除这种结构性耦合，而不是为每个症状增加展示兜底。

## 用户默认判断

默认页必须在一次扫视中回答五个问题：

1. 当前范围是全部智能体，还是某个智能体下的某个项目？
2. 每个项目真实有哪些论文或工作项？
3. 每项工作是在自动推进、等待我、系统处理中、已交付暂停、暂停、停止，还是状态待同步？
4. 当前 stage、下一 stage 或行动是什么，归谁处理？
5. 最近是否真的运行过，已用多久，当前 Stage 与任务累计 Token 是否有可靠记录？

raw ID、workflow、receipt、provider、日志和 refs 不参与默认判断。唯一例外是当前 Attempt ID：
它只在用户点击 Stage 后的弹层和所选任务详情中出现，不污染默认任务行。

## 产品数据模型

### WorkItemProjection v2

每个 canonical work item 顶层必须有全局 canonical `item_id`，并投出以下九个一级对象：

| 对象 | 职责 |
| --- | --- |
| `identity` | 智能体、项目和工作项的 ID、全称、显示名与 workspace path。项目身份只来自 canonical registry/inventory；并发 generation 只属于 visibility。 |
| `lifecycle` | 业务生命周期，以及 Framework 投出的用户主状态和原因。 |
| `visibility` | 独立的 `visible / archived` 可见性、来源、更新时间、control ref 和作为并发 token 的 generation。 |
| `execution` | 是否运行、当前/下一 stage、开始时间和 heartbeat；没有执行历史也必须保留对象和任务行。 |
| `attention` | `none/user/system`、摘要、owner；`system` 还必须有完整 responsibility envelope。 |
| `telemetry` | elapsed、当前 stage Token、任务累计 Token，以及 observed/partial/missing/stale。 |
| `conditions` | 带 reason、message、owner、transition time 和 observed generation 的当前条件。 |
| `freshness` | 投影读取时间、最近进展和 fresh/stale/unknown。 |
| `action` | 下一行动、owner 和说明的只读语义；Runtime 不执行该 action，归档/恢复使用独立 visibility mutation。 |

顶层 `item_id` 由 Framework 以 `project_id + encoded work_item_id` 形成，是列表 row key 和
详情选择 key。`identity.work_item_id` 只在项目内唯一，不同 MAS workspace 可以重复使用同一
local ID。因此 Shell 不得用 `identity.work_item_id` 单独去重、选择详情或匹配 mutation
readback。

`attempt`、runtime ID、workflow ID 和 evidence refs 不再是默认行必需字段。当前 Attempt 可在
Stage 弹层或详情中按需显示；历史 Attempt 和其他 raw ID 只属于 Maintenance diagnostics。任何 Attempt
都不能决定 work item 是否存在、属于哪个项目或用户主状态。

### AgentAvailabilityProjection

智能体 availability 与工作项状态独立。Framework canonical ID 与用户全称固定为：

| canonical ID | 用户全称 |
| --- | --- |
| `mas` | Med Auto Science |
| `mag` | Med Auto Grant |
| `rca` | RedCube AI |
| `oma` | OPL Meta Agent |
| `obf` | OPL Book Forge |

ID 只用于合同和数据关联，不进入默认页面。App 合同不得用 package slug
`med-autoscience`、`med-autogrant` 等替代 Framework canonical ID。

MAS Scholar Skills 是 Med Auto Science 的专业能力依赖，不是第六个智能体。availability 只表达
`available / attention_required / unavailable`；任务数量、运行数量或 `0/2` 不是 availability。
Runtime 不显示 availability panel；智能体安装、可用性和模块健康统一在 Settings > 能力中处理。

## Scope 与 Saved Views

Scope 固定为两个级联层：

1. **Agent**：全部智能体或某个完整智能体名称。
2. **Project**：该智能体 canonical Project Registry 中的真实项目；首项为全部项目。

论文或 work item 不进入 scope。它们只作为主列表行出现。workspace path 是 Project 名称和
当前 `project_id` 的 canonical 输入，但不再作为与 project 并列的用户范围层。

Runtime Project 的用户显示名必须严格等于 canonical `workspace_path` basename，例如
`DM-CVD-Mortality-Risk`、`NF-PitNET`、`Obesity`。binding label、口头名称和 runtime history
都不能覆盖它。当前 Framework 的 `project_id` 来自 canonical workspace path hash，所以目录
改名会同时改变 `project_display_name` 和 `project_id`；App 不声称 identity 在改名后保持稳定。

状态筛选使用单一 Select：全部、自动推进中、等待你决定、系统处理中、已交付或暂停、已停止、
状态待同步。筛选禁止出现 MAS、其他智能体、项目或论文入口，避免与 scope 形成第二套导航。
visibility 也不进入状态筛选；归档库是独立入口，不是一个“已归档”状态筛选。

## 用户主状态

Framework 根据 lifecycle、execution、attention、conditions 和 freshness 投出唯一主状态；
Shell 不得从原始字段重新推断。`WorkItemBusinessState` 仍可包含 domain/legacy `archived`；这不
等于手工归档，也不能据此把业务状态集合收窄或把 visibility 反推为 lifecycle。

| machine value | 用户文案 | 含义 |
| --- | --- | --- |
| `automatically_advancing` | 自动推进中 | 当前有可信运行证据，系统正在推进。 |
| `awaiting_user_decision` | 等待你决定 | 下一步需要用户提供决定或信息。 |
| `system_attention` | 系统处理中 | 当前系统问题阻塞继续推进，并有完整责任与修复说明。 |
| `delivered_auto_paused` | 已交付自动暂停 | 已交付约定里程碑，自动流程正常停住。 |
| `paused` | 已暂停 | 已停止自动推进，等待后续条件或方向。 |
| `stopped` | 已停止 | 已明确结束、放弃或归档前停止。 |
| `sync_pending` | 状态待同步 | 当前状态不能被可靠确认，不能用旧执行历史猜测。 |

### 系统处理中

`system_attention` 只有在以下条件全部满足时才允许：

- 问题绑定当前 work item generation。
- 问题当前仍阻塞继续执行。
- `responsible_component`、`issue`、`repair_action`、`impact`、`expected_outcome` 完整。
- 默认文案能够说明谁在处理、处理什么以及对交付的影响。

责任信息不完整时，保留 lifecycle 推出的主状态，并把技术诊断后置；不得显示笼统的
“需要系统处理”。历史失败 condition 只进入时间线，不能覆盖更新的已交付、暂停或停止状态。

## Action 与本地化

Framework action 的语言无关字段为 `title_key`、`summary_key`、单一 `message_args`、`owner`
和 `owner_kind`。`owner_kind` 只允许 `user / system / agent / other`；title 与 summary 共用同一个
参数对象，不声明分离参数、copy-locale metadata 或额外 semantic key namespace。

Shell 使用当前 App locale 解析 title、summary、Next Step 与 owner；Framework 仍负责状态和
action 语义，Shell 不得借本地化重新推断状态。raw `title / summary` 仅为兼容 fallback，不能
覆盖 semantic key 的当前 locale 结果。英文界面不得出现 Framework 硬编码中文 action、Next
Step 或 owner 文案，中文界面同理。

Stage 名称继续由 Agent package 持有。Framework 在 `stage_map[].display_names` 中传输各 locale
名称，Shell 按当前 App locale 选择；`stage_map[].display_name` 只作旧 projection 的兼容回退。
App 不维护 MAS 或其他智能体的 Stage 名称对照表，也不根据 Stage id 猜测翻译。

## 默认页面

### 顶部

- 标题与一句职责说明。
- Agent、Project 两级 scope。
- 最近读取时间和刷新动作。
- 一个状态筛选菜单和归档库入口；不使用统计卡片墙，不重复 scope 中的智能体或项目。

### 工作项列表

宽屏固定四列：

1. **项目 / 论文**：项目与工作项标题；智能体全称作为次级标签。
2. **状态**：唯一用户主状态和短原因。
3. **当前进展 / 下一步**：当前 stage、下一 stage 或 action、owner。
4. **时间 / Token**：elapsed、当前 stage Token、任务累计 Token。

一篇论文或一个 work item 只显示一行，row key 为顶层 `item_id`。去重由 Framework
canonical projection 完成，Shell 不按标题、stage、binding 或最近时间启发式合并。

当前 Stage 是独立可点击控件。点击后打开轻量 Popover，显示完整 Stage 顺序、当前/下一 Stage
和当前 Attempt；此点击不得同时打开任务详情 Drawer。默认任务行不显示 Attempt ID，点击任务名称
才打开完整详情。

当前业务 stage 只读取 canonical `current_stage` 投影。`execution.stage_id` 属于运行尝试诊断，
不得在业务 stage 为空时回退展示；例如已交付暂停的论文不能把
`runtime_token_telemetry_verification` 显示成当前论文阶段。历史运行仍可贡献经过观测的任务累计
Token，但不能改写业务阶段或 lifecycle 状态。

当 `lifecycle.primary_state=delivered_auto_paused` 或
`lifecycle.package_status=milestone_delivered` 时，Stage Map 已进入 terminal boundary：详情只显示
真实发生过的 `completed` 历程，也可以为空。`pending / next / current / failed / stopped` 等状态
不得再作为未交付里程碑包展示；后续动作统一由 ActionEnvelope 表达。

在 375、768、1024 和 1440 px 验收视口中，页面不得横向溢出或文字重叠。窄屏按语义重排
为堆叠行，不把四列硬塞入固定最小宽度表格。

用户可见普通文本按 normal word boundary 换行，不得在存在空格断点时随意拆词。只有路径、
ID、hash 等无断点技术长串可在必要时断开，且四个验收视口仍不得横向溢出。

响应式证据使用确定性的九论文静态 fixture：1440 px 为四列，1024/768 px 为两列，375 px
为单列。每个视口必须同时断言 scope 级联、一论文一行、语义列重排和无页面横向溢出，
并输出截图；四个视口还必须分别打开 Stage Popover，证明其不溢出、Stage 顺序完整并能显示当前
Attempt。详情 drawer 另存截图，证明只呈现 Work Item、Stage/Attempt、运行/heartbeat、Token 和
只读下一步信息。静态 fixture 证据属于 Shell consumer 验收，不等于 live runtime 证据。

Fast profile 即使携带诊断计数或空的 `diagnostics.items`，Runtime 也不得据此生成 operator summary、
safe actions 或平台维护区。Shell 必须保留 `project_catalog` 和 `items`，不得因为诊断详情未内嵌
而隐藏项目或工作项。平台诊断由 Settings 显式读取和呈现。

### Visibility 与归档库

默认 Runtime 主列表只显示 `visibility.state=visible`。独立的 `Archived tasks / 归档库` 入口
显示 archived 项，并继续沿用 Agent -> Project scope；visibility 不混入主列表 status filters。
归档项保留原 lifecycle status、stage、usage 与 Framework evidence，恢复后回到默认主列表；
Runtime 不因此展示 evidence refs。

手工归档只改变 visibility，不改变业务生命周期、不停止任务，也不删除 evidence。归档确认
必须明确提示“工作可能继续运行；停止任务需前往该任务的所属控制面”。Runtime 不提供 stop 或
其他 safe-action 控件；执行中的工作也不能因归档而被描述为 stopped、paused 或 delivered。

Framework visibility 对象精确包含 `state`、`source`、`updated_at`、`control_ref`、`generation`；
`generation` 就是并发 token，没有独立 `token` 字段。Shell 禁止以 localStorage 或 optimistic
state 作为 visibility truth。

归档与恢复统一执行 Framework action `work_item_visibility_set`：

1. payload 必须包含 `agent_id`、`project_id`、`work_item_id`、`visibility_state`。
2. `reason`、`expected_generation` 可选；projection 有 `visibility.generation` 时 Shell 必须将其
   作为 `expected_generation` 发送。
3. mutation 成功后立即读取 `opl app state --profile fast --json`。
4. readback 必须按 `agent_id + project_id + work_item_id` 完整 tuple 定位，并核对顶层 `item_id`、
   新 visibility 及原 lifecycle、execution、telemetry；不得只按 local `work_item_id` 匹配。
5. `work_item_control_generation_conflict` 表示 stale generation。Shell 必须先刷新权威 projection，
   再提示用户重试，禁止自动覆盖较新的控制状态。

page-state matrix 必须覆盖主列表空态、归档库空态、归档中、恢复中、归档失败、恢复失败、
stale generation conflict，以及 `en-US / zh-CN` 切换。pending 或失败状态都保留最近一次
Framework readback，不能提前把本地 optimistic 结果提交为真相。

### Token

默认显示当前 stage 与任务累计两项。每项 Token 是判别联合：

- `observed`：包含 input、output、total、source 和 observed time；只有此状态可显示数字。
- `missing`：显示“尚无用量记录”；技术原因只进入 Maintenance diagnostics。
- `stale`：显示记录已过期，不把旧数字冒充当前。

整体 telemetry 可以是 `observed / partial / missing / stale`。Missing 不能显示为 `0`；只有明确
观测到零才显示零。当前没有 Token 上限，因此不显示预算、百分比或进度条。

## 工作项详情

点击由顶层 `item_id` 标识的工作项后，首屏按工作流判断顺序展示：

1. Stage Map。
2. 当前和下一 stage。
3. 运行时长与最近 heartbeat。
4. 当前 stage 与任务累计 Token。
5. 当前行动和 owner 的只读说明。

当前 Attempt 属于 Stage/运行事实，可显示在详情首屏。Runtime 详情不包含 Artifacts、Timeline、
Evidence、provider diagnostics、operator drilldown、safe-action catalog、raw workflow IDs、历史
Attempt 或 logs。artifact provenance 通过任务/会话 Inspector 查看；技术诊断通过 Settings
Maintenance diagnostics 查看。

## Surface 所有权

| Surface | 拥有 | Runtime 中的处理 |
| --- | --- | --- |
| Runtime | Work Item 状态、是否运行、elapsed、Stage/当前 Attempt、Token、archive/restore | 直接显示 |
| Settings Maintenance | provider/platform repair、Temporal/worker readiness、Codex/App update、托管依赖、raw diagnostics 与维护 | 全面禁止 |
| Settings Agents | Agent Package lifecycle、开发来源与 Home visibility | 全面禁止 |
| Settings Capabilities | Skills、Plugins、OPL Flow、MCP、图像与语音能力 | 全面禁止 |
| Task/Conversation Inspector | artifact provenance、preview、lineage、manifest/hash/receipt refs | 全面禁止 |
| Release tooling | 同 cohort Runtime screenshot、full-state/operator capture、action receipt、VM/installed smoke、remote verification 与 manifest | 全面禁止 |

## 模块边界

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| Domain Agent | Project/WorkItem inventory、业务 lifecycle、stage catalog 和领域 action refs。 | App copy、页面布局、Shell 本地状态机。 |
| OPL Framework | Join catalog/inventory/lifecycle/visibility/execution/usage，生产 WorkItemProjection v2、状态语义、action semantic fields、availability 和 currentness。 | App 信息层级、locale 文案、视觉布局和 Settings/Runtime 路由。 |
| One Person Lab App | 产品语言、scope、各 surface 字段 allowlist、validators、page-state 和证据分账。 | runtime/domain truth、Token 估算、owner receipt。 |
| Shell | 按当前 App locale 渲染 projection、级联筛选、语义重排、打开 Stage/任务详情，并仅对 archive/restore 执行 Framework action + refresh/readback。 | 猜项目、状态、stage、owner、Token，以 localStorage 保存 visibility truth，实现第二套去重，或从 Runtime 执行其他 action。 |

## 历史 exact-cohort 证据边界

下方只保留 `2026-07-15` exact-cohort 的历史实现与安装验收事实，不是当前完成度账本，也不得
外推新的 Source、Pixel、Install 或 Release 状态。当前唯一五轴 authority 是
[`app-ideal-state-gap-plan.md`](../../active/app-ideal-state-gap-plan.md) 与
[`shell-conformance-matrix.md`](shell-conformance-matrix.md)；Contract、Source、Pixel、Install、
Release 必须在那里逐轴读取。该历史 cohort 的合同、Framework producer、Shell consumer 与本机
installed user path 证据只证明 retained X0-01 route 的对应字节和路径，不把它提升为核心产品门、
默认 release gate 或当前 release-ready 结论。

### 2026-07-15 本机安装版验收

本次验收以 `/Applications/One Person Lab.app` 为唯一 UI 对象，精确记录见
[`runtime-local-installed-acceptance-2026-07-15.json`](../../delivery/release-evidence/runtime-local-installed-acceptance-2026-07-15.json)。

- 安装版与构建产物的 `app.asar` SHA-256 均为
  `4b399c3326dcdc989fa1eb6427fd95b5103d6528014ddba9ca7413df5e121c08`，
  `codesign --verify --deep --strict` 通过；App 退出、重启后再次验收通过。
- Framework fast readback 为 5 个智能体、6 个项目、9 个 work item、9 visible、0 archived、
  0 running；MAS 项目名严格为 `DM-CVD-Mortality-Risk`、`NF-PitNET`、`Obesity`。
- Agent 选 Med Auto Science 后仍有 9 项；Project 选 `DM-CVD-Mortality-Risk` 后为 4 项。
  默认列表、Stage Popover、详情 Drawer、归档确认和归档库均走真实安装版界面。
- DM003 展示完整 8 个 MAS Stage，全部为已完成；当前无 Stage/Attempt，当前 Stage Token
  显示“不适用”，任务累计显示 `25,490 tokens`。历史无 telemetry 的项目继续诚实显示未记录。
- 归档一项后主列表为 8、归档库为 1；恢复后回到 9 visible、0 archived，并在 App 重启后保持。
- `zh-CN` 和 `en-US` 均通过；英文 Runtime 与 Stage Map 未混入中文状态、Next Step、owner 或 Stage。
- 1358、1024、768、375 px 均无 document/body/Runtime 横向溢出，Stage Popover 与 680 px
  Drawer 完整落位；Playwright 期间 console error 与 page error 均为 0。

这是一条本机安装版 Runtime user-path 证据。它不声明当前显示的 `26.7.14` 等同于已发布的
同版本公共 cohort，也不声明 Stable/latest、clean VM、跨机器、release-ready、owner acceptance、
领域 ready 或 OPL family production-ready。

## 验收标准

以下标准只在 X0-01 route 被显式保留或启用时约束该 route，自身不进入默认 release gate，也不
要求 Native phase-1 实现。机器 hard gate 移除前，现有 validator pass 仅作 retained source 回归证据。

- Scope 只有 Agent -> Project 两层，work item 不进入菜单，状态筛选不含 MAS。
- Project 显示名严格等于 canonical workspace path basename；目录改名同时改变当前 path-hash `project_id`。
- 五个一方智能体使用全称；MAS Scholar Skills 不作为智能体；Runtime 不显示 availability 或模块健康 panel。
- 每个 canonical work item 以顶层 `item_id` 保持一行并选择详情；跨项目重复 local `work_item_id` 不串行。
- action 使用 `title_key / summary_key / message_args / owner / owner_kind`，Shell 按当前 locale 渲染，raw title/summary 只作 fallback。
- 默认列表只显示 visible；归档库独立于 lifecycle、scope 和 saved views，并允许恢复。
- visibility mutation 使用完整 identity tuple 与可用的 expected generation，随后 refresh/readback；stale conflict 刷新后重试。
- 归档不改变 lifecycle、不停止执行、不删除 evidence；停止任务需前往所属控制面，Runtime 不提供 stop。
- 七个主状态只能来自 Framework V2 projection，Shell 不做状态或身份推断。
- `system_attention` 缺任一责任字段、不是当前 generation 或不再阻塞时不能出现。
- Token missing 不显示零，无上限时不出现进度条。
- 默认页不显示 raw refs、IDs、logs、receipt、provider、operator summary、safe actions、软件更新或平台维护动作。
- 当前 Stage 可点击；Popover 显示完整 Stage 顺序、当前/下一 Stage 与当前 Attempt，且不打开详情 Drawer。
- 详情只呈现 Work Item、Stage Map、当前 Attempt、heartbeat、Token 和只读行动；artifact provenance 只在 Inspector。
- delivered Stage Map 只显示 completed 历程或为空，后续动作只来自 ActionEnvelope。
- 普通文案按词边界换行，仅无断点技术长串可为防溢出而断开。
- 375/768/1024/1440 px 均无横向页面溢出与文字重叠。
- Environment、Capabilities、Advanced、Inspector 与 release tooling 的所有权边界均通过契约和测试验证；Runtime 不提供这些内容的次级或折叠入口。
- Product contract、Framework producer、Shell consumer、Live evidence 四条完成度独立报告。
