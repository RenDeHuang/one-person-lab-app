# ADR: OPL App Cross-Thread Orchestration

Owner: `one-person-lab-app`
Purpose: `opl_app_cross_thread_orchestration_boundary`
State: `accepted_product_target_active_shell_same_host_source_implemented_remote_deferred`
Date: `2026-07-13`
Machine boundary: 本文定义产品和架构目标。App contracts、page-state、active-shell validator与
active AionUI Shell `fae4f694b1ab3eb615b7f527b792adfa6b3165e1` 已实现本机 flexible
cross-thread policy和可见入口；Native candidate 的历史 cohort仍需重做。Current pixels、packaged
two-root UI、installed user path、remote host与 release promotion仍需独立 evidence。

## 结论

OPL App 必须具备 Codex App 式的跨线程会话协调能力，使具备主动编排能力的模型能够在
用户可见、遵循 Codex 自身 permission/approval、可审计的前提下发现其他任务线程、读取必要
上下文并投递协作消息。
当前首要消费者是 GPT-5.6：它可以判断何时需要协调多个 agent，但只有 OPL host 暴露
受控工具后，判断才能变成真实的跨线程发现和消息投递。

这不是“多开几个独立 CLI”，也不等同于同一根任务下的 subagent 工具：

1. 模型负责判断何时需要分派、协调或汇总，不负责创建或猜测线程身份；
2. Codex Core / App Server 负责线程 ID、持久化历史、运行状态、恢复、分叉和 turn；
3. OPL App host 负责跨顶层线程发现、统一状态投影、消息路由、幂等重试、advisory 和审计；
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
runtime 或权限模型。App Server 始终是线程身份、历史和运行状态的 source of truth；OPL 仅
保存幂等重试、用户解释和审计所需的轻量协调元数据与 receipt。

## Local/Worktree 与跨线程协调的边界

Workspace locality handoff 与跨顶层线程消息是两条不同链路，不能共用一个含糊的
“handoff”完成声明：

1. Home 的 New task 可选 Local/Worktree 与 starting branch。Worktree 通过既有
   `gitWorkspace.inspect` / `ensureManagedWorktree` 创建或复用，不建立第二 Git store。
2. 既有同主机 task 只在 `not_loaded`/`idle` 时从 Conversation Environment 提供
   Local↔Worktree；真实协议是 `thread/settings/update { threadId, cwd }`。
3. `running`/`archived`/`system_error` 时 locality action 显示 unavailable，不 silent fallback。
   这是 Codex thread protocol 的状态限制，不是 workspace permission gate。
4. 更新顺序固定为真实 Codex cwd在先、AionUI conversation projection在后；projection失败时
   best-effort恢复旧 cwd并显示错误，不伪造切换成功。
5. `opl_workspace_handoff.v1` 只保存 locality、`localWorkspace`、`worktreePath`、task/start ref和
   `worktreeRetention` 等 projection metadata。`preserve_for_reuse_until_snapshotted_cleanup` 是
   future cleanup前置标记，不证明 snapshot或 cleanup 已存在。
6. Worktree当前默认保留复用；snapshot/restore与 cleanup UI deferred。Cross-host handoff当前
   unsupported/unavailable，不能由本机 Local/Worktree source或跨线程 receipt推导为成功。

Project/workspace仍只是默认 cwd、侧栏分组和上下文提示。跨目录文件、网络和命令能力只服从
Codex permission/approval/sandbox，OPL不增加目录授权域或额外确认。

## 目标架构

```text
Model in source thread
  | decides whether coordination is useful
  v
OPL coordination tools
  | list / read / dispatch / steer / fork / archive
  v
OPL App coordination host
  | opaque-key idempotency, grouping metadata,
  | write-set / route advisory, audit receipt
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

默认视图按当前 project 展示相关线程；用户可显式切换到跨 project 或 archived 范围，避免把
Home 或 rail 变成全局运维 dashboard。该筛选只影响发现和分组，不改变线程的授权范围。
Project/workspace 仅是新任务的默认 cwd、侧栏分组和可见元数据，不是 sandbox 或授权域。

### 2. 线程读取

用户和获得授权的模型可以读取目标线程的摘要、最近状态和必要历史。默认读取应遵循最小化：

- 先读 metadata、goal、status 和摘要；
- 只有完成协调所需时才读取 turn history；
- 不因“可读取”而把其他线程全文自动注入当前模型上下文；
- 本机跨 project/workspace 读取不增加 OPL 确认；读取能力和内容访问继续服从 Codex/App
  Server 自身 permission/approval。跨 host 在实现前返回 unsupported。

### 3. 跨线程投递

OPL host 根据目标线程状态选择协议动作：

| 目标状态与意图 | 默认动作 | 说明 |
| --- | --- | --- |
| 已持久化但未加载 | `thread/resume` 后 `turn/start` | 恢复目标并开始新的可审计 turn |
| 已加载且空闲 | `turn/start` | 作为新的用户输入进入目标线程 |
| 正在运行，信息会改变当前工作 | `turn/steer` | 标记为实时 steering 并显示来源，不增加 OPL 确认 |
| 正在运行，信息不紧急 | host queue，空闲后 `turn/start` | 避免无意打断目标推理 |
| 需要从共同历史独立探索 | `thread/fork` | 新线程保留明确的 fork 来源 |

不得把 `thread/inject_items` 用作普通跨线程消息通道，因为它绕过正常用户 turn 和可见交互
语义。不得把 `send_input` 扩大解释为可寻址任意本地历史线程的全局消息总线。

### 4. 生命周期管理

OPL App 应允许用户恢复、分叉、直接归档和取消归档线程。Archive 是可恢复的任务管理动作，
OPL 不增加确认。永久删除不属于跨线程协调 MVP；未来如接入，权限和 approval 继续服从
Codex/App Server，不建立 OPL confirmation layer。

### 5. 可见协调记录

每次投递至少产生以下用户可读记录：

- source thread、target thread、project/workspace 和 host；
- 发起者是用户、模型还是系统规则；
- 协调意图和发送内容摘要；
- 使用 `turn/start`、`turn/steer`、queue 或 fork；
- created、accepted、delivered、running、completed、failed、cancelled 状态；
- target 的结果摘要或可导航引用；
- Codex permission/approval 结果、project/workspace 上下文、write-set/route advisory 和失败原因。

记录进入 source 与 target timeline 的轻量 coordination event，并可从 rail/thread detail
查看；不新增默认常驻第三列，也不把协议 JSON 暴露给普通用户。

## 模型可调用工具

OPL host 可以向模型暴露稳定的高层工具，具体名称不是 App Server 协议的一部分：

- `list_threads(scope, filters)`；
- `read_thread(thread_id, detail)`；
- `send_message_to_thread(thread_id, message, intent, expected_write_set?)`；
- `fork_thread(thread_id, through_turn_id?)`；
- `archive_thread(thread_id)`；
- `wait_thread(thread_id, condition)`。

工具实现必须把 OPL thread key 解析到明确的 host + App Server `threadId`，再执行底层协议。
模型不得直接拼接 host 地址、猜测线程 ID、绕过 Codex permission/approval 或直接写协调 ledger。

## 权限和自主性

OPL App 是 Codex App 的薄壳，不建立 project/workspace sandbox 或第二套 filesystem permission。

1. **Project/workspace:** 只为新任务提供默认 cwd，并用于 rail 分组和可见元数据；任务启动后
   可按 Codex 自身能力访问其他目录。
2. **Read/dispatch:** 本机跨 project、跨 workspace、`workspace_write`、write-set overlap、
   running `turn/steer` 均不触发 OPL 拒绝或额外确认。
3. **Codex authority:** 文件、网络、命令及其他工具访问只服从 Codex 自身 permission/approval；
   OPL host 投影结果，但不预先收窄或扩大。
4. **Lifecycle:** archive 直接执行且可 unarchive；OPL 对 read/send/steer/archive 均不增加确认。
   Interrupt 或未来 destructive delete 的权限/approval 同样由 Codex Core/App Server 决定。
5. **Remote host:** 当前未支持的跨 host 路由明确返回 unsupported，不伪装成本机完成。

“模型主动协调”表示模型可以调用 host 工具，并和普通 Codex 任务一样灵活；审计可见不等于
额外授权域。

## Advisory、循环信息和幂等重试

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
  "idempotency_key": "opaque-request-key",
  "ancestor_coordination_ids": [],
  "created_at": "RFC3339"
}
```

Host 在投递时遵循：

- source/target、project/workspace、write set、ancestor route 和 hop 信息进入 receipt，帮助模型
  和用户判断协调风险，但不作为本机 dispatch blocker；
- 同一 opaque request/idempotency key 的重试返回幂等 duplicate 结果且不二次投递；不同 key
  即使消息内容相同也属于合法投递，不做内容去重；
- write-set overlap、A -> B -> A route、跨 project/workspace 和 running steer 只产生 advisory，
  不 fail closed、不降级 read-only、不要求 owner confirmation；
- 目标不存在、已归档、不可写、协议无效、跨 host 尚不支持，或 Codex permission/approval
  阻止执行时返回 typed failure，不静默创建替代线程；
- OPL 不允许消息绕过或扩大 Codex 自身 filesystem/network 权限。

写集声明是协调提示，不是锁、授权域或冲突 gate。最终 source、git 和 owner readback 仍帮助
用户判断实际并发风险，但选择权保留给独立 Codex agent。

## GUI 信息架构

跨线程能力复用现有 Codex-based 主工作流：

- **Rail:** project 下展示 conversation/thread 状态与轻量协作标记；不新增 agent dashboard；
- **Thread detail/popover:** 展示 goal、host、workspace、owner、关系、write set 和最近协调记录；
- **Composer/command action:** 用户可选择目标线程并发送协作消息；普通 send 保持当前线程；
- **Timeline:** source/target 双边显示 coordination event、状态和结果入口；
- **Notifications:** target waiting/failed 等需要用户处理的状态进入可操作通知；overlap/loop 仅
  作为非阻断 advisory；
- **Runtime:** 只承载跨 project 的聚合运行视图，不复制 conversation timeline。

Desktop 可使用 rail context action + dialog/popover；mobile 使用 action sheet + full-height detail。
两端能力和语义必须等价，不能在 mobile 隐藏跨线程投递或冲突结果。

## AionUI 实现与上游维护

该能力应作为 thin host adapter 落地，不要求 AionUI upstream 原生拥有 OPL 跨线程功能：

1. App contract 定义可见能力、Codex permission passthrough、advisory、状态和验收；
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
- opaque-key idempotency、project/workspace、loop 和 write-set advisory；
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
| Contract | App GUI contract 定义 discover/read/dispatch/steer/receipt/advisory；page-state matrix 覆盖 idle/running/protocol/target/Codex permission states |
| Adapter | App Server fake/fixture 证明 list pagination、opaque ID、status routing、resume/start/steer/fork 与 typed failure |
| Policy | 负例证明 project/workspace、workspace-write、overlap、loop advisory 和 running steer 不被 OPL 拒绝或额外确认；opaque-key retry 幂等且同内容不同 key 可重复 |
| Shell source | rail/detail/composer/timeline/mobile 只消费 host projection，不直接拥有协议策略 |
| DOM | 用户可发现目标、看见双边 receipt 与 advisory，并处理协议、目标、cross-host unsupported 和 Codex permission 失败；archive 直接且可恢复，无 OPL confirmation |
| Visual | desktop/mobile 的 thread directory、coordination event、advisory 和真实 failure state 无遮挡 |
| Packaged | 同一真实用户数据下，至少两个独立根线程完成 list -> read -> send -> target result -> source readback |
| Remote | 只有在 connected host 的真实 list/read/send/断线恢复通过后才能声明 remote ready |

实现完成声明必须绑定 exact App/Shell SHA、App Server/Codex 版本、package fingerprint 和用户路径
证据。文档、contract、mock adapter 或 focused test 均不能单独证明 packaged capability。

## Authority 与实现状态

产品 owner 已把目标语义吸收到以下现有 authority，未创建平行 machine model：

- `docs/product/gui/feature-inventory.md`：新增 OPL adopted cross-thread capability；
- `docs/product/gui/ideal-interaction-spec.md`：定义 rail、composer、timeline 和 mobile 交互；
- `docs/product/gui/shell-implementation-guide.md`：定义 host/adapter/composition 边界；
- `docs/active/aionui-mainline-gui-convergence-plan.md`：进入 P0/P1/P2 实施顺序；
- `contracts/app-gui-product-contract.json`：定义行为、权限、receipt 和非降级规则；
- `contracts/app-page-state-matrix.json`：定义状态和负例 acceptance；
- active-shell validators/tests：证明 shell 消费 App truth，且未退化为同一 agent tree only。

Active AionUI Shell `fae4f694b1ab3eb615b7f527b792adfa6b3165e1` 已实现 production App
Server `thread/*` / `turn/*` adapter、thread directory、flexible routing、可见 audit receipt，以及
同主机 Local/Worktree source链路。该 exact SHA 的 current pixels、package与 installed-path gate
仍由集成 owner独立闭合。Native candidate 的 `c1d9db...` 历史 cohort仍绑定旧 hard-gate policy，
只保留 protocol/package evidence，不能证明 corrected candidate conformance。

该状态不等于 packaged 产品验收。Packaged UI 两根线程端到端、live `turn/steer` 竞态、current
pixels、安装路径与 release promotion仍按验收矩阵独立关闭，未取得证据前不得宣称
`packaged_ready` 或 `release_ready`。Remote host是独立 future capability，当前明确 unavailable；
只有真实连接、路由与断线恢复 evidence完成后才能声明 `remote_ready`。
