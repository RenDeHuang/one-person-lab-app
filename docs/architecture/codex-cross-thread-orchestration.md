# ADR: OPL App Cross-Thread Orchestration

Owner: `one-person-lab-app`
Purpose: `opl_app_cross_thread_orchestration_boundary`
State: `accepted_product_target_implementation_pending`
Date: `2026-07-13`
Machine boundary: 本文定义产品和架构目标，不证明 active shell 已实现。用户可见行为、
page-state acceptance 和 release gate 必须后续进入 App contracts、validators、shell
source/tests 与 packaged evidence，才能提升实现状态。

## 结论

OPL App 必须具备 Codex App 式的跨线程会话协调能力，使具备主动编排能力的模型能够在
用户可见、权限受控、可审计的前提下发现其他任务线程、读取必要上下文并投递协作消息。
当前首要消费者是 GPT-5.6：它可以判断何时需要协调多个 agent，但只有 OPL host 暴露
受控工具后，判断才能变成真实的跨线程发现和消息投递。

这不是“多开几个独立 CLI”，也不等同于同一根任务下的 subagent 工具：

1. 模型负责判断何时需要分派、协调或汇总，不负责创建或猜测线程身份；
2. Codex Core / App Server 负责线程 ID、持久化历史、运行状态、恢复、分叉和 turn；
3. OPL App host 负责跨顶层线程发现、统一状态投影、消息路由、权限、冲突控制和审计；
4. AionUI 只承载 rail、timeline、popover、dialog 等组合，不拥有线程协议或产品策略；
5. 同一 agent tree 内继续使用 `spawn_agent`、`send_input`、`wait_agent` 等运行时工具，
   跨根线程使用 App Server 的 `thread/*` 与 `turn/*` 协议。

模型版本可以提高主动协调的概率和质量，但产品能力不得依赖“模型天然知道其他线程”。
没有 host 暴露的线程目录、读取和投递工具，任意独立根线程默认仍彼此不可见。

## 官方协议依据

Codex App Server 当前公开的协议原语包括：

- `thread/list`、`thread/loaded/list`：枚举持久化或已加载线程；
- `thread/read`：在不恢复线程的情况下读取线程和可选 turn 历史；
- `thread/resume`：恢复既有线程，使后续 `turn/start` 追加到该线程；
- `thread/fork`：复制既有历史并获得新的线程 ID；
- `thread/archive`、`thread/unarchive`：管理线程生命周期；
- `turn/start`：向线程增加用户输入并开始新的 turn；
- `turn/steer`：向正在执行的 turn 追加输入；
- `turn/interrupt`：请求中断正在执行的 turn；
- `thread/status/changed`：订阅已加载线程的运行状态变化。

`thread/list` 返回运行状态，并支持 `cwd`、搜索、归档状态及实验性的
`parentThreadId` / `ancestorThreadId` 过滤。OPL 可以消费这些原语，但不得把实验字段变成
不可降级的唯一依赖。

官方来源：

- [Codex App Server API overview](https://learn.chatgpt.com/docs/app-server#api-overview)
- [Codex subagents configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents)

本文不把未由当前公开协议稳定承诺的 `sessionId` 语义、具体 ID 生成算法或某个模型模式的
内部调度策略写成 App 合同。线程 ID 对 OPL 应视为 App Server 返回的 opaque stable key。

## 术语与边界

| 术语 | OPL 定义 | 不等于 |
| --- | --- | --- |
| Thread | App Server 持久化和执行的单个对话线程，以 opaque `threadId` 标识 | UI 列表行、JSON-RPC 请求 ID |
| Agent tree | 一个根任务及其运行时注册的 spawned descendants | 任意本机历史线程集合 |
| Cross-thread | 两个独立顶层线程或不同 agent tree 之间的发现、读取和投递 | `send_input` 对已注册 subagent 的调用 |
| Coordination host | OPL App 中连接一个或多个 App Server、聚合线程并执行路由策略的 host 层 | AionUI 页面组件、第二套 Codex Core |
| Coordination receipt | 描述谁向谁发送了什么、为什么、结果如何的 App-owned 审计投影 | Codex 全量历史副本、domain artifact |

OPL 不直接改写 Codex 的线程存储，不复制完整 thread history，也不创建第二套 conversation
runtime。App Server 始终是线程身份、历史和运行状态的 source of truth；OPL 仅保存实现权限、
冲突控制和用户解释所需的轻量协调元数据与 receipt。

## 目标架构

```text
Model in source thread
  | decides whether coordination is useful
  v
OPL coordination tools
  | list / read / dispatch / steer / fork / archive
  v
OPL App coordination host
  | authorization, project scope, dedupe, loop guard,
  | write-set conflict guard, audit receipt
  v
Codex App Server adapter(s)
  | thread/list, thread/read, thread/resume,
  | thread/fork, turn/start, turn/steer
  v
Codex Core thread stores and active turns
```

本机 App Server 是首要实现。远程主机聚合是同一 host contract 的扩展：每个远程连接仍由
对应 App Server 管理其线程，OPL host 只聚合投影和路由，不把多台主机的存储合并成一个
自定义数据库。

## 产品能力

### 1. 线程发现

OPL App 提供统一线程目录，至少展示：

- 线程名称或可理解摘要、运行状态、最近活动时间；
- project、workspace/cwd、host 和归档状态；
- 当前目标、owner/责任说明和可选 parent/ancestor 关系；
- 是否正在运行、等待用户、已完成、失败或不可连接；
- 当前是否存在可能重叠的 claimed write set。

默认视图只展示当前 project 的相关线程。跨 project、远程 host 和 archived 线程必须通过
显式范围切换进入，避免把 Home 或 rail 变成全局运维 dashboard。

### 2. 线程读取

用户和获得授权的模型可以读取目标线程的摘要、最近状态和必要历史。默认读取应遵循最小化：

- 先读 metadata、goal、status 和摘要；
- 只有完成协调所需时才读取 turn history；
- 不因“可读取”而把其他线程全文自动注入当前模型上下文；
- 跨 project、远程 host 或可能含敏感上下文时要求更高权限或用户确认。

### 3. 跨线程投递

OPL host 根据目标线程状态选择协议动作：

| 目标状态与意图 | 默认动作 | 说明 |
| --- | --- | --- |
| 已持久化但未加载 | `thread/resume` 后 `turn/start` | 恢复目标并开始新的可审计 turn |
| 已加载且空闲 | `turn/start` | 作为新的用户输入进入目标线程 |
| 正在运行，信息会改变当前工作 | `turn/steer` | 必须标记为实时 steering，并显示来源 |
| 正在运行，信息不紧急 | host queue，空闲后 `turn/start` | 避免无意打断目标推理 |
| 需要从共同历史独立探索 | `thread/fork` | 新线程保留明确的 fork 来源 |

不得把 `thread/inject_items` 用作普通跨线程消息通道，因为它绕过正常用户 turn 和可见交互
语义。不得把 `send_input` 扩大解释为可寻址任意本地历史线程的全局消息总线。

### 4. 生命周期管理

OPL App 应允许用户恢复、分叉、归档和取消归档线程。永久删除属于破坏性动作，应沿用
Codex/App Server 的 descendant 语义并要求明确确认；跨线程协调 MVP 不以删除能力为前提。

### 5. 可见协调记录

每次投递至少产生以下用户可读记录：

- source thread、target thread、project/workspace 和 host；
- 发起者是用户、模型还是系统规则；
- 协调意图和发送内容摘要；
- 使用 `turn/start`、`turn/steer`、queue 或 fork；
- created、accepted、delivered、running、completed、failed、cancelled 状态；
- target 的结果摘要或可导航引用；
- 权限决策、冲突决策和失败原因。

记录进入 source 与 target timeline 的轻量 coordination event，并可从 rail/thread detail
查看；不新增默认常驻第三列，也不把协议 JSON 暴露给普通用户。

## 模型可调用工具

OPL host 可以向模型暴露稳定的高层工具，具体名称不是 App Server 协议的一部分：

- `list_threads(scope, filters)`；
- `read_thread(thread_id, detail)`；
- `send_message_to_thread(thread_id, message, intent, expected_write_set)`；
- `fork_thread(thread_id, through_turn_id?)`；
- `archive_thread(thread_id)`；
- `wait_thread(thread_id, condition)`。

工具实现必须把 OPL thread key 解析到明确的 host + App Server `threadId`，再执行底层协议。
模型不得直接拼接 host 地址、猜测线程 ID、绕过权限或直接写协调 ledger。

## 权限和自主性

跨线程协调采用分级策略：

1. **Read:** 当前 project 内 metadata/summary 可按产品策略自动读取；全文、跨 project 和
   remote host 读取受更严格权限约束。
2. **Propose:** 模型始终可以建议联系某个线程，并向用户展示原因、目标和预计影响。
3. **Dispatch:** 同 project、无写集冲突的低风险投递可由用户预授权；跨 project、跨 host、
   改变 active turn 或带来写权限扩张的投递默认确认。
4. **Mutate lifecycle:** fork 可按策略预授权；archive、interrupt 和 destructive delete 需要
   独立风险判断，不能借普通 send 权限隐式获得。

“模型主动协调”表示模型可以调用已授权工具，不表示模型获得全局、无限制或不可见的消息权限。

## 冲突、循环和重复防护

跨线程消息 envelope 至少包含：

```json
{
  "coordination_id": "opaque-id",
  "source_thread_id": "opaque-thread-id",
  "target_thread_id": "opaque-thread-id",
  "source_host_id": "host-key",
  "target_host_id": "host-key",
  "project_key": "project-key",
  "intent": "delegate|inform|review|block|handoff",
  "expected_write_set": ["repo-relative/path"],
  "dedupe_key": "opaque-digest",
  "ancestor_coordination_ids": [],
  "created_at": "RFC3339"
}
```

Host 在投递前必须执行：

- 禁止 source 与 target 相同的无意义投递；
- 以 `dedupe_key` 拒绝同一目标的重复消息；
- 检测 ancestor chain 和 hop budget，阻止 A -> B -> A 循环转派；
- 比较 claimed/expected write set，重叠时 fail closed、转为 read-only 或要求 owner 协调；
- 校验目标 project/workspace/host，防止显示同名任务时误投；
- 不允许投递消息自动扩大目标线程既有 filesystem/network 权限；
- 目标不可连接、已归档或协议不兼容时返回 typed failure，不静默创建替代线程。

写集声明是协调提示和冲突 gate，不是操作系统锁。最终 source、git 和 owner readback 仍决定
实际并发安全。

## GUI 信息架构

跨线程能力复用现有 Codex-based 主工作流：

- **Rail:** project 下展示 conversation/thread 状态与轻量协作标记；不新增 agent dashboard；
- **Thread detail/popover:** 展示 goal、host、workspace、owner、关系、write set 和最近协调记录；
- **Composer/command action:** 用户可选择目标线程并发送协作消息；普通 send 保持当前线程；
- **Timeline:** source/target 双边显示 coordination event、状态和结果入口；
- **Notifications:** target waiting/failed/conflict 等需要用户处理的状态进入可操作通知；
- **Runtime:** 只承载跨 project 的聚合运行视图，不复制 conversation timeline。

Desktop 可使用 rail context action + dialog/popover；mobile 使用 action sheet + full-height detail。
两端能力和语义必须等价，不能在 mobile 隐藏跨线程投递或冲突结果。

## AionUI 实现与上游维护

该能力应作为 thin host adapter 落地，不要求 AionUI upstream 原生拥有 OPL 跨线程功能：

1. App contract 定义可见能力、权限、状态和验收；
2. host bridge 封装 App Server 协议、连接、路由和 receipt；
3. generated profile 只投影 feature availability 和允许的 composition；
4. shell 复用现有 rail、timeline、dialog/popover、notification 和 mobile sheet；
5. fork-body patch 仅限稳定 composition 无法承载的最小入口；
6. App Server 协议差异集中在 adapter，不散落到 React 页面；
7. optional/experimental 字段必须 capability-detect，缺失时降级，不阻塞基本 list/read/send。

禁止在 shell 中创建第二套 thread store、第二套 agent registry、第二套权限模型或解析 Codex
JSONL。AionUI upstream intake 不能删除 OPL 已采纳的跨线程能力；若入口位置变化，必须在同一变更中提供
可见、键盘可达的替代入口并更新 App contract/source/tests。

## 分阶段实现

### P0: 本机跨顶层线程闭环

- 当前 project 的 `thread/list`、status 和 summary；
- `thread/read`、`thread/resume`、`turn/start`；
- active turn 的显式 `turn/steer` 与非紧急 queue；
- source/target timeline receipt；
- dedupe、loop、project/workspace 和 write-set guards；
- desktop/mobile 可见入口和错误状态。

### P1: 完整生命周期和模型主动协调

- fork、archive/unarchive、goal/metadata 投影；
- 用户预授权策略和模型高层工具；
- wait/result aggregation 与 typed timeout/failure；
- parent/ancestor capability-detected projection。

### P2: 远程 host 聚合

- 已保存和已认证 App Server 连接；
- host-scoped thread directory、健康状态和路由；
- 跨 host 权限、断线恢复和 receipt；
- 不可用 host 的明确降级，不伪装本地完成。

P0 关闭前不得宣称 OPL App 已具备跨线程会话能力；P1/P2 可以分别声明，不得用本机 focused
test 替代远程或 packaged evidence。

## 验收矩阵

| 层 | 必须证明 |
| --- | --- |
| Contract | App GUI contract 定义 discover/read/dispatch/steer/receipt/conflict；page-state matrix 覆盖 idle/running/offline/conflict/denied |
| Adapter | App Server fake/fixture 证明 list pagination、opaque ID、status routing、resume/start/steer/fork 与 typed failure |
| Security | dedupe、loop、cross-project、cross-host、permission escalation 和 overlapping write set 均有负例 |
| Shell source | rail/detail/composer/timeline/mobile 只消费 host projection，不直接拥有协议策略 |
| DOM | 用户可发现目标、确认高风险投递、看见双边 receipt、处理失败与冲突 |
| Visual | desktop/mobile 的 thread directory、dispatch confirmation、coordination event 和 conflict state 无遮挡 |
| Packaged | 同一真实用户数据下，至少两个独立根线程完成 list -> read -> send -> target result -> source readback |
| Remote | 只有在 connected host 的真实 list/read/send/断线恢复通过后才能声明 remote ready |

实现完成声明必须绑定 exact App/Shell SHA、App Server/Codex 版本、package fingerprint 和用户路径
证据。文档、contract、mock adapter 或 focused test 均不能单独证明 packaged capability。

## 后续 authority 吸收

本文接受后，产品 owner 必须把目标语义吸收到以下现有 authority，不创建平行 machine model：

- `docs/product/gui/feature-inventory.md`：新增 OPL adopted cross-thread capability；
- `docs/product/gui/ideal-interaction-spec.md`：定义 rail、composer、timeline 和 mobile 交互；
- `docs/product/gui/shell-implementation-guide.md`：定义 host/adapter/composition 边界；
- `docs/active/aionui-mainline-gui-convergence-plan.md`：进入 P0/P1/P2 实施顺序；
- `contracts/app-gui-product-contract.json`：定义行为、权限、receipt 和非降级规则；
- `contracts/app-page-state-matrix.json`：定义状态和负例 acceptance；
- active-shell validators/tests：证明 shell 消费 App truth，且未退化为同一 agent tree only。

在这些 authority 与实现证据落地前，本文状态保持
`accepted_product_target_implementation_pending`。
