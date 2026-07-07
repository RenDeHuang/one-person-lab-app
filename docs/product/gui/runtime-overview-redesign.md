# Runtime 总览重构设计

Owner: `one-person-lab-app`
Purpose: `runtime_progress_page_information_architecture`
State: `active_policy`
Machine boundary: 本文是产品与落地设计。机器真相归 `contracts/`、`opl app state`、`opl app action`、shell renderer、focused tests 与 release-boundary validation。

## 背景

当前 Runtime 页能读到 OPL runtime queue 和 MAS paper line 的 refs，但产品表达仍然沿用
`running / attention / inactive` 这类运行时 bucket。对用户而言，这会把不同层级的信息
混在一起：

- 显示的是 provider/runtime 过程态，不是用户真正关心的项目状态。
- 顶层默认是“当前工作区的项目运行台”，但 OPL App 实际可以多会话、多项目并行；“当前工作区”
  只能推断，不能当唯一范围。
- 任务列表直接暴露 `stage attempt`、`current_control_state`、`provider` 这类内部术语，
  用户很难判断“这篇论文到底是在做、停了、还是需要我决定”。
- 当前 aggregation 只盯 active MAS workspace，导致展示面容易退化成“当前这个 DM workspace
  的几篇论文”，而不是 OPL 项目总览。

这次重构的目标，是把 Runtime 页改成一个**可切换范围的项目运行总览**：先说人话，再保留
技术细节。

## 目标定义

Runtime 页默认回答五个问题：

1. 现在看的范围是什么。
2. 这个范围里哪些项目在推进，哪些已经暂停，哪些需要我决定，哪些需要系统处理。
3. 当前智能体跑到哪个 stage。
4. 下一个 stage 或 action 是什么，归用户还是系统处理。
5. 数据是否新鲜；缺 telemetry 时明确显示缺失，而不是推断健康。

这不是新的 runtime truth。它仍然只是 App 对 OPL Framework refs-only projection 的产品化表达。

## 默认页口径

Runtime 页默认是任务运行 cockpit，不是 runtime 诊断页。默认页只展示用户判断项目进展需要的信息：

- 项目 / 论文 / 任务名称。
- 智能体或模块，例如 MAS。
- 用户主状态和自动运行副状态。
- 当前 stage。
- 下一 stage 或 action。
- 下一步归属：用户、系统、智能体或具体 owner。
- 加载时间、最近进展和 telemetry missing。

默认页不展示 raw proof ref、receipt refs、`stage_attempt_id`、`run_id`、`workflow_id`、raw blocker route、MAS currentness drift 原文、`provider`、`projection`、`ledger`、`current_control_state` 或 full drilldown。这些字段只能出现在任务详情或高级信息折叠层。

## 顶层信息架构

### 1. 顶层定位

- 页面名称仍可沿用 `运行状态` / `Runtime`。
- 顶层对象改成：**项目运行总览**。
- 不是“当前工作区的项目运行台”。

### 2. 范围模型

Runtime 页必须显式支持范围切换。最小范围层级：

- `全部项目`
- `按智能体 / 模块`
- `按 workspace`
- `按 project`
- `按 task / paper`

同时保留一个推断态：

- `当前工作区（推断）`

但这个推断态只能作为快捷筛选提示，不能替代总览。

### 3. 双层状态模型

用户先看主状态，再看自动运行副状态。

#### 主状态

- `进行中`
- `已交付，自动暂停`
- `已暂停，等待后续决定`
- `需要你决定`
- `需要系统处理`

#### 自动运行副状态

- `自动运行中`
- `当前无自动任务`
- `最近一次自动结果待收口`
- `自动流程异常`

原则：

- `provider`、`stage attempt`、`current_control_state` 不是主状态文案。
- 同一个技术差异如果对用户没有认知价值，就不要拆成两个主状态。
- 技术态只进高级信息。

## 页面结构

### 顶部

- 范围切换器，默认保留 `全部项目`
- 当前范围来源：`用户选择` / `系统推断`
- 推断提示：例如“当前工作区推断为 `dm-cvd-mortality-risk`”
- 刷新动作

### Freshness bar

- 加载时间
- 最近进展或最近 heartbeat
- 当前状态来源
- telemetry missing

### KPI 行

KPI 改成用户状态计数，而不是 runtime bucket：

- `进行中`
- `自动运行中`
- `需要系统处理`
- `需要你决定`
- `最近活动时间`

### 主列表

主列表按主状态分组，不再按 `running / attention / inactive` 分组。

每个项目行默认包含：

- 项目
- 任务 / 论文
- 智能体 / 模块
- 主状态
- 自动运行副状态
- 当前阶段
- 本阶段已持续多久
- token 用量，允许合并阶段用量和累计用量
- 下一步 stage 或 action
- 责任方

### 高级信息

折叠展示：

- runtime/control-plane 术语
- liveness proof
- refs
- receipts
- stage/run/workflow IDs
- MAS owner consumption/currentness diagnostics
- raw blocker route
- safe actions
- provider diagnostics
- full drilldown

## 设计图对齐口径

本页按“先判断项目，再进入诊断”的顺序组织，而不是按 runtime 技术层级组织。
设计图中的每个区域对应一个稳定职责：

- 顶部标题和说明：告诉用户这是项目运行总览，不是日志页或 provider 诊断页。
- 右上范围与刷新：用户先确定“我在看全部项目，还是某个智能体 / workspace / project / task”。
- Freshness bar：只回答“数据什么时候读的、是否已加载、是否缺 telemetry”。
- KPI 行：只放用户状态计数，包括 `进行中`、`自动运行中`、`需要系统处理`、`需要你决定` 和最近活动。
- 主任务列表：一行对应一个用户认知任务，默认按主状态分组；同一论文或项目被多个 runtime binding 投影时只能显示一行。
- 右侧范围卡：保留显式范围切换，避免把“当前工作区推断”误当成唯一工作区。
- 右侧模块 / 智能体状态：模块健康和任务进展分离；没有 project / study 的 `module_runtime` 行不能进入主任务列表。
- 高级信息：只放维护诊断、refs、receipts、stage/run/workflow IDs、safe actions 和 full drilldown。

默认任务行的认知脊柱固定为：

1. 项目 / 论文。
2. 智能体 / 模块。
3. 任务 / stage。
4. 下一步 stage 或 action。
5. 状态。

这条脊柱比直接展示 `task_id`、`stage_attempt_id`、`workflow_id` 更符合 OPL 智能体设计：用户先知道哪篇论文、哪个智能体、当前 stage、下一步动作和归属；需要追查证据时再展开高级信息。

## 去重与文案策略

Runtime projection 可能因为不同 binding、不同 provider attempt 或不同 read-model 来源，给同一篇论文投出多条 refs。默认页必须按用户认知去重：

- 优先按 `agent + project/study + work item` 合并。
- 其次按 `agent + project/study + active stage` 合并。
- 再使用 task ref、去掉 binding id 的 task id、原始 task id 兜底。
- 合并时优先保留 `进行中`、`自动运行中`、`最近一次自动结果待收口`，再比较字段完整度和最近活动时间。
- 被合并掉的 raw refs 只能进入高级信息。

`next_visible_step` 允许来自 runtime 或 domain projection，但默认页不直接展示长命令、route、readback、receipt、stage attempt 或 currentness drift 原文。默认页应把这类内容压成短动作文案，例如“最近一次自动结果待收口”“需要系统处理”“需要你决定”；原文保留到高级信息或任务详情。

## 模块职责

### one-person-lab

负责：

- 跨 workspace / project 的 runtime aggregation
- scope projection
- 用户主状态 / 自动副状态投影
- token / stage / liveness / owner routing refs

不负责：

- App copy
- page layout
- shell-local 状态机

### one-person-lab-app

负责：

- 顶层产品定义
- scope contract
- 双层状态 contract
- Runtime 页展示 policy
- validator / release-boundary evidence

不负责：

- runtime truth 生产
- shell renderer 细节

### opl-aion-shell

负责：

- 范围切换 UI
- 分组呈现
- badge / card / drawer 呈现
- i18n
- focused DOM tests

不负责：

- 第二套 runtime truth
- 状态词语的独立发明

## 当前落地状态

- App contract 已定义 `runtime_progress_page_display_policy`，固定默认 cockpit 与高级诊断边界。
- Shell Runtime 页应按本文展示默认视图：顶部范围与刷新、freshness bar、KPI 行、主任务分组列表、右侧模块状态和高级信息。
- Framework 仍是 runtime truth owner。App 和 shell 只消费 `opl app state --profile fast --json` 与 drilldown refs，不写 runtime truth、domain truth、owner receipts 或 typed blockers。
- 本文、contract 和 focused validation 不能作为 live/runtime readiness、release currentness 或 owner acceptance 证据。

## 落地顺序与完成度

| 条目 | 完成度 | 建议顺序 | 权威位置 / 证据边界 |
| --- | ---: | --- | --- |
| 产品信息架构：项目 cockpit 默认页，高级诊断后置 | 100% | 1 | 本文 + `contracts/app-runtime-bridge.json#runtime_progress_page_display_policy` |
| 默认字段 allowlist 与 advanced-only 字段 | 100% | 2 | `contracts/app-runtime-bridge.json` + runtime bridge validator；default visible fields 必须属于 allowlist，advanced-only 字段精确校验 |
| 任务去重：同一论文 / work item 只显示一行 | 100% | 3 | App contract 锁定 policy；Shell companion lane 用 DOM test 验证同一 DM003 binding 只显示一行 |
| `module_runtime` 分流到右侧模块状态 | 100% | 4 | App contract 锁定 policy；active-shell validator 同时要求主列表过滤 `module_runtime` 且右侧 `moduleStatusItems` 渲染存在 |
| long next-step 人话归一 | 100% | 5 | App contract 锁定 policy；Shell companion lane 用 DOM test 验证 raw terminalization/readback 文案默认隐藏 |
| 设计图布局：顶部、freshness、KPI、主列、右侧范围/模块/高级 | 100% | 6 | `layout_regions` + Shell companion source/DOM evidence；不等同于 installed App 截图证据 |
| installed App 视觉截图验收 | 0% | 7 | release / install owner；不能由 contract 或 focused test 代替 |

## 完成标准

以下四条同时满足，才能算这次 Runtime 总览重构完成：

1. 文档、contracts、shell UI 对同一套范围模型和状态模型一致。
2. Runtime 页默认不再把内部技术术语当作用户主状态。
3. 用户可以看总览，也可以显式切换查看某个 workspace / project / paper。
4. raw evidence、refs、receipts、stage/run IDs、MAS currentness diagnostics 和 full drilldown 默认收起。
5. 验证证明 App contract 与 shell renderer 对齐；runtime/live readiness 另走 Framework 或 release owner 证据。
