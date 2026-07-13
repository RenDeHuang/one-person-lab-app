# Runtime V2 产品设计

Owner: `one-person-lab-app`
Machine truth:
`contracts/app-gui-product-contract.json#pages.runtime_status.runtime_cockpit_product_contract`、
`contracts/app-runtime-bridge.json#work_item_projection`、
`contracts/app-runtime-bridge.json#agent_availability_projection`、
`contracts/app-page-state-matrix.json#pages[id=runtime]`

## 结论

Runtime 是 OPL 的跨项目“用户与智能体协作控制台”，不是 observability dashboard。
默认页只帮助用户判断：正在看哪个智能体和项目、每项工作处于什么状态、当前和下一
stage 是什么、下一步归谁、运行与 Token 数据是否可信。

Runtime V2 不再直接拼接项目目录、Temporal attempt、业务生命周期、Token telemetry 和
package 状态。OPL Framework 先生产稳定的 `WorkItemProjection v2` 与独立的
`AgentAvailabilityProjection`；App 定义用户语言、字段位置和验收；Shell 只渲染。

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
5. 最近是否真的运行过，已用多久，当前 stage 与任务累计 Token 是否有可靠记录？

raw ID、attempt、workflow、receipt、provider、日志和 refs 不参与默认判断，只进入诊断层。

## 产品数据模型

### WorkItemProjection v2

每个 canonical work item 必须投出以下八个一级对象：

| 对象 | 职责 |
| --- | --- |
| `identity` | 智能体、项目和工作项的稳定 ID、全称、显示名与 generation。项目身份只来自 canonical registry/inventory。 |
| `lifecycle` | 业务生命周期，以及 Framework 投出的用户主状态和原因。 |
| `execution` | 是否运行、当前/下一 stage、开始时间和 heartbeat；没有执行历史也必须保留对象和任务行。 |
| `attention` | `none/user/system`、摘要、owner；`system` 还必须有完整 responsibility envelope。 |
| `telemetry` | elapsed、当前 stage Token、任务累计 Token，以及 observed/partial/missing/stale。 |
| `conditions` | 带 reason、message、owner、transition time 和 observed generation 的当前条件。 |
| `freshness` | 投影读取时间、最近进展和 fresh/stale/unknown。 |
| `action` | 下一行动、owner、说明和可执行 action ref；mutating action 仍走 `opl app action`。 |

`attempt`、runtime ID、workflow ID 和 evidence refs 不再是默认行必需字段。它们可以作为详情
或诊断 refs 存在，但不能决定 work item 是否存在、属于哪个项目或用户主状态。

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
全部可用时 panel 折叠为一行摘要，出现问题时才展开具体智能体和原因。

## Scope 与 Saved Views

Scope 固定为两个级联层：

1. **Agent**：全部智能体或某个完整智能体名称。
2. **Project**：该智能体 canonical Project Registry 中的真实项目；首项为全部项目。

论文或 work item 不进入 scope。它们只作为主列表行出现。workspace path 可以支持 project
identity，但不再作为与 project 并列的用户范围层。

Saved views 只做主状态筛选：全部、自动推进中、等待你决定、系统处理中、已交付或暂停、
已停止、状态待同步。Saved views 禁止出现 MAS、其他智能体、项目或论文入口，避免与 scope
形成第二套导航。

## 用户主状态

Framework 根据 lifecycle、execution、attention、conditions 和 freshness 投出唯一主状态；
Shell 不得从原始字段重新推断。

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

## 默认页面

### 顶部

- 标题与一句职责说明。
- Agent、Project 两级 scope。
- 刷新动作和 freshness 摘要。
- 状态 saved views；不重复 scope 中的智能体或项目。

### 工作项列表

宽屏固定四列：

1. **项目 / 论文**：项目与工作项标题；智能体全称作为次级标签。
2. **状态**：唯一用户主状态和短原因。
3. **当前进展 / 下一步**：当前 stage、下一 stage 或 action、owner。
4. **时间 / Token**：elapsed、当前 stage Token、任务累计 Token。

一篇论文或一个 work item 只显示一行，row key 为 `identity.work_item_id`。去重由 Framework
canonical projection 完成，Shell 不按标题、stage、binding 或最近时间启发式合并。

在 375、768、1024 和 1440 px 验收视口中，页面不得横向溢出或文字重叠。窄屏按语义重排
为堆叠行，不把四列硬塞入固定最小宽度表格。

响应式证据使用确定性的九论文静态 fixture：1440 px 为四列，1024/768 px 为两列，375 px
为单列。每个视口必须同时断言 scope 级联、一论文一行、语义列重排和无页面横向溢出，
并输出截图；详情 drawer 另存截图，证明 Stage Map 首屏可见且 artifacts、timeline、evidence、
diagnostics 默认折叠。静态 fixture 证据属于 Shell consumer 验收，不等于 live runtime 证据。

### Token

默认显示当前 stage 与任务累计两项。每项 Token 是判别联合：

- `observed`：包含 input、output、total、source 和 observed time；只有此状态可显示数字。
- `missing`：显示“尚无用量记录”，并在详情保留原因。
- `stale`：显示记录已过期，不把旧数字冒充当前。

整体 telemetry 可以是 `observed / partial / missing / stale`。Missing 不能显示为 `0`；只有明确
观测到零才显示零。当前没有 Token 上限，因此不显示预算、百分比或进度条。

## 工作项详情

点击工作项后，首屏按工作流判断顺序展示：

1. Stage Map。
2. 当前和下一 stage。
3. 运行时长与最近 heartbeat。
4. 当前 stage 与任务累计 Token。
5. 当前行动、owner 和可执行入口。

Artifacts、Timeline 与 Evidence 是次级折叠区；Evidence 承载 Framework 投影的来源引用。
raw IDs、logs、provider diagnostics 只进入诊断区。详情不得恢复为六个等权 tab 的工具墙。

## 模块边界

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| Domain Agent | Project/WorkItem inventory、业务 lifecycle、stage catalog 和领域 action refs。 | App copy、页面布局、Shell 本地状态机。 |
| OPL Framework | Join catalog/inventory/lifecycle/execution/usage，生产 WorkItemProjection v2、availability 和 currentness。 | App 信息层级和视觉布局。 |
| One Person Lab App | 产品语言、scope、字段 allowlist、详情层级、validators、page-state 和证据分账。 | runtime/domain truth、Token 估算、owner receipt。 |
| Shell | 渲染 projection、级联筛选、语义重排、打开详情和 App actions。 | 猜项目、状态、stage、owner、Token，或实现第二套去重。 |

## 证据分账

以下四项必须独立记录，禁止用百分比合并：

| 账目 | 本文档与 App 合同能证明什么 | 当前变更后的状态 |
| --- | --- | --- |
| Product contract | V2 用户语义、字段、页面结构和 validator 已成为 App machine truth。 | 本分支实现并由 focused tests 验证。 |
| Framework producer | `opl app state` 是否真实生产完整 V2 projection、inventory、usage 和 availability。 | 不由 App 合同声明完成，需 Framework lane 及 producer tests。 |
| Shell consumer | active Shell 是否仅渲染 V2、完成交互和响应式实现。 | Runtime V2 Shell lane 以 focused unit/DOM、确定性 Playwright fixture 和 375/768/1024/1440 截图独立验收。 |
| Live evidence | 本机真实项目、运行、heartbeat、Token、截图和 installed App user path 是否贯通。 | 不由 contract/focused tests 声明完成，需独立 E2E 验收。 |

合同、文档或 focused tests 通过，不等于 Framework producer、Shell、像素、安装包或 live runtime
完成。只有四项分别提供证据，Runtime V2 才能整体关闭。

## 验收标准

- Scope 只有 Agent -> Project 两层，work item 不进入菜单，saved views 不含 MAS。
- 五个一方智能体使用全称；MAS Scholar Skills 不作为智能体；全健康时 availability 折叠。
- 每个 canonical work item 一行，默认四列，智能体为次级标签。
- 七个主状态只能来自 Framework V2 projection，Shell 不做状态或身份推断。
- `system_attention` 缺任一责任字段、不是当前 generation 或不再阻塞时不能出现。
- Token missing 不显示零，无上限时不出现进度条。
- 默认页不显示 raw refs、IDs、logs、receipt 或 provider 术语。
- 详情首屏先呈现 Stage Map、stage、heartbeat、Token 和行动；artifacts/timeline 次级，诊断后置。
- 375/768/1024/1440 px 均无横向页面溢出与文字重叠。
- Product contract、Framework producer、Shell consumer、Live evidence 四条完成度独立报告。
