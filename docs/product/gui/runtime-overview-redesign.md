# Runtime 总览重构设计

Owner: `one-person-lab-app`
Purpose: `runtime_overview_product_redesign`
State: `active_design`
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
3. 当前自动流程有没有在跑，跑到哪一步，持续多久了。
4. 这个任务已经消耗了多少 token，这一阶段又消耗了多少。
5. 如果有问题，问题属于谁处理，下一步是什么。

这不是新的 runtime truth。它仍然只是 App 对 OPL Framework refs-only projection 的产品化表达。

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

- 范围切换器
- 当前范围来源：`用户选择` / `系统推断`
- 推断提示：例如“当前工作区推断为 `dm-cvd-mortality-risk`”
- 刷新动作

### 概览卡

概览卡改成用户状态计数，而不是 runtime bucket：

- `进行中`
- `已交付，自动暂停`
- `已暂停`
- `需要你决定`
- `需要系统处理`

附加统计：

- `自动运行中`
- `最近活动时间`

### 主列表

主列表按主状态分组，不再按 `running / attention / inactive` 分组。

每个项目卡片最少包含：

- 智能体 / 模块
- 项目
- 任务 / 论文
- 主状态
- 自动运行副状态
- 当前阶段
- 本阶段已持续多久
- 最近一次 heartbeat / liveness
- 当前阶段 token
- 累计 token
- 下一步
- 责任方

### 高级信息

折叠展示：

- runtime/control-plane 术语
- refs
- receipts
- safe actions
- provider diagnostics
- full drilldown

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

## 当前缺口

### 已完成

- 已确认用户认知模型：范围必须可切换，状态必须人话化。
- 已确认根因：当前 framework 绑定 active MAS workspace，shell 顶层按 runtime bucket 分组。
- 已确认现有 4 篇论文示例里，用户认知状态和技术状态并不等价。

### 待落地

1. Framework 从 active-workspace-bound 改成 overview-first aggregation。
2. App contract 增加 scope model 和双层状态模型。
3. Shell Runtime 页改成按主状态分组，并提供范围切换。
4. 运行时 token / liveness / duration 字段稳定呈现。
5. 高级技术术语完全下沉到折叠层。

## 一步到位落地顺序

### 阶段 A：文档与 contract

完成度：`0% -> 本轮落地`

- 更新 Runtime 总览产品定义。
- 把 scope / 双层状态写入 App contracts。
- 同步 one-person-lab product/runtime README 的 owner split。

### 阶段 B：Framework

完成度：`0% -> 本轮落地`

- runtime aggregation 改成跨 binding 的 overview-first。
- 产出 `scope_options`、`current_scope`、`scope_source`、`inferred_scope_hint`。
- 产出 `primary_state`、`automation_state`、对应 label/reason。

### 阶段 C：Shell

完成度：`0% -> 本轮落地`

- 顶部范围切换器。
- 主列表按主状态分组。
- 副状态 badge、token、stage duration、liveness 呈现。
- 高级技术信息折叠。

### 阶段 D：验证与吸收

完成度：`0% -> 本轮落地`

- Framework focused tests
- App contract / release-boundary tests
- Shell DOM / projection tests
- 主会话复核 diff、吸收回 main、清理 worktree

## 完成标准

以下四条同时满足，才能算这次 Runtime 总览重构完成：

1. 文档、contracts、shell UI 对同一套范围模型和状态模型一致。
2. Runtime 页默认不再把内部技术术语当作用户主状态。
3. 用户可以看总览，也可以显式切换查看某个 workspace / project / paper。
4. 验证证明 framework、App contract、shell renderer 三层已经对齐。
