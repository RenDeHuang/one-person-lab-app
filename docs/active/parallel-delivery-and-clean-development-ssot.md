# 并行交付与开发清洁 SSOT

Owner: `one-person-lab-app` delivery coordination
Purpose: `cross-target_coordination_contract`
State: `active_policy`
Machine boundary: This document defines coordination rules only. Volatile task,
thread, owner, branch, worktree, checkpoint, and readiness state must be read
from the current Ledger, thread/lifecycle surfaces, product owners, and remote
readback at operation time.

Machine-readable operational state is read from fresh lifecycle and thread
readback at operation time; this document intentionally does not freeze a
volatile JSON snapshot.

本文只拥有跨目标的执行编排、并发吸收规则和开发清洁终态。产品语义、发布权限、
远端状态和 installed truth 仍由对应合同、owner、受保护操作和 fresh readback 拥有。
Active ledger 中的 thread、ETA、current evidence和next action会快速漂移，只是协调路由；
它们不是产品合同、mutation authority、run admission或完成证明，执行前必须fresh验证。

## 最新用户 SSOT

最新直接用户指令决定 objective、action、target、constraints 和 terminal outcome。
旧合同、旧 ledger、历史 callback、候选分支或 AI 推断与最新用户目标冲突时，必须先把
它们标为 `stale`、`derived` 或 `unknown`，再修订实现流程；不得用旧流程拒绝、降级或
改写用户目标。真实权限、安全、数据完整性和不可伪造性边界仍然 fail closed。

## 中央总账治理边界

唯一持久协调真相是 OPL Ledger/Bead；Dashboard thread 只是当前人读投影和操作入口，不是永久
controller、release state、checkpoint 或 mutation authority。所有跨对话的 scope、owner、handoff、merge、
cleanup、publication、install 和 archive 决策必须写回总账；对话、callback 与 peer-to-peer
消息只携带当前 instruction revision、objective fingerprint、event cursor 和 next action，不能
私下延长 owner、operation、deadline 或 authority。每条开发线只有一个 line lead 负责路由，
实际源码、canonical `main`、外部运行和生命周期清理仍由登记的 execution owner 负责。

长等待默认使用 owner event + immutable envelope：执行任务达到自己的 terminal 后立即关闭，
下游 consumer 在匹配事件到达时从 envelope 新建短生命周期任务。没有新增决策、没有可执行
next action 的 watcher 进入 `EVENT_IDLE`，不得靠持续 wait/poll 保持 `ACTIVE`。push transport
不可用时，只允许有界 owner-authoritative status readback；相同状态不得重复生成 callback、
delegation 或总结。

模型与 reasoning 是对话自己的配置事实。任何唤醒、续派、handoff 或 reassignment 都必须
省略 `model` 和 `thinking` 参数，保持原对话配置；总账不得在恢复或交接时覆盖已有模型
与 reasoning 配置。

任务数量、状态、owner、write set、checkpoint、next action 和 integration overlap 不在本文
冻结。它们必须从 fresh lifecycle/thread readback 获取；任何历史快照都不得用于准入、吸收、
cleanup 或 archive。

每次执行、吸收或清理前都必须重新读取 canonical/wire、worktree lifecycle、thread owner
和 exact write set；历史 commit/tree/count 只作当时证据，不在本文冻结，也不限制独立任务
并发或把已启动的 read-only evidence 工作变成等待。

恢复规则：仍有未完成义务的误中止任务，沿 fresh readback 证明仍有效的原 owner、receipt、
worktree 和 next action 恢复；已 canonical/owner-close 的任务不复活，不创建 replacement writer。

每个 ACTIVE task 必须同时具备唯一 controller、可验证 execution owner、精确或有界 write
set、立即可执行的 next action、可恢复 checkpoint 和明确的 canonical absorption plan。
任务只有在 fresh main/wire/tree/blob parity、必要的 installed/public/runtime 终态、holder/
lock=0 和 owner-native lifecycle close 全部完成后，才可转为 `SAFE_TO_ARCHIVE`。

## 长目标的 bounded lane contract

需要同时闭合多个发布、安装、公开 readback 或清理缺口的长目标，必须拆成可独立验收的
bounded lanes。父 objective 只是这些 lane 的合取汇总：只有所有 required
`publication`、`install`、`readback` 和 `cleanup` gaps 均已关闭，父 objective 才能完成；
任何一个 lane 的成功、候选产物或测试通过都不能替代其他 gap，也不能提前关闭父 objective。

每条 lane 在 OPL Ledger 中必须有且只有一个 `owner`、一个 `execution_owner`、精确或有界
`write_set`、可立即执行的 `next_action`、typed `dependency`/`trigger`、明确的
`integration_plan` 和独立的 `terminal_evidence`。这些是动态协调记录，不在本文冻结具体
thread、SHA、checkpoint、ETA 或当前 lane 清单；产品文档只维护本合同，OPL Ledger 才是
任务真相。

`dependency` 描述消费的前置事实，`trigger` 描述何时可重新准入，例如
`source_checkpoint_ready`、`immutable_artifact_published`、`public_readback_ready`、
`installed_readback_requested` 或 `owner_cleanup_authorized`。它们必须带 schema/identity、
版本或 digest、producer/consumer 角色和恢复条件；裸 tag、短期 Actions artifact、模糊的
“等上游”或 peer callback 不是 typed trigger。

并行开发只在 lane 自己的 worktree/write set 内进行。producer 与 consumer 可以先用已登记的
contract、fixture 或兼容桥实现和验证，但进入同一 repo 的 canonical `main`、同一 public
pointer、同一 install target 或同一 runtime/database 的真实 mutation 时，必须由单一
integrator 在短时窗口内按 fresh main 做 semantic replay、受保护或普通非 force 吸收并完成
wire/tree/blob/raw parity。其他 lane 仍可继续本地验证，不因集成窗口而形成全局总锁。

只有存在可执行 next action 的 lane 才能保持 `ACTIVE`。若唯一状态是等待某个未来 artifact
或事件，lane 必须记录 typed trigger 后转为 `EVENT_IDLE`；事件到达时再 fresh readback 并
创建或恢复 bounded execution task。不得创建或维持只能等待 artifact 的 `ACTIVE` task。

`terminal_evidence` 必须证明该 lane 自己的终态表面（例如 exact public bytes/digest、安装后
有效状态、canonical absorption 或 owner-native cleanup），并记录失败、延迟和无变化的真实
结果。证据不得从 sibling lane、历史 receipt、候选 checkpoint 或父 objective 的摘要推导。

基线整理顺序固定为：

```text
fresh repo/wire inventory
-> owner checkpoint and local gates
-> semantic replay on fresh main
-> one integrator protected absorption per repository
-> local/tracking/wire/tree/blob parity
-> owner-native worktree/branch/PR/receipt/temp cleanup
-> clean baseline snapshot
```

基线优先不等于全局冻结。清洁与收敛工作必须尽量透明：独立的明确修复、文档更新、
只读证据和已经启动的 operation，只要不争用同一 source lane、canonical `main` 临界区、
runtime 或 public target，就继续推进。只有 owner 即将进入真实重叠 mutation 的那一刻才短时
暂停，完成 fresh parity 后立即恢复。已经启动且仍有 owner authority 的外部 operation 不取消、
不重跑、不掩盖；mutation 指令被最新用户 SSOT supersede 后，其终态只保留只读证据，除非
用户重新给出对应 publication、install 或其他 mutation authority。

总账文档本身也遵守同一规则：mutation 使用 owner 登记的隔离写集，并在 fresh main 上串行
吸收；不得把当前 checkout、task branch 或 owner lane 写成长期政策。PR、task branch、worktree
和测试通过都不是 SSOT，只有 canonical main 的 fresh 回读才是产物 SSOT。

长期协调原则是：

```text
parallel_work_serialized_integration
```

- 可独立实现、验证和 checkpoint 的任务应并行推进。
- 文件级或字段级小范围 overlap 不阻止在独立 worktree 并行开发；它只影响最终吸收
  顺序和冲突解决 owner。
- 每个 repo 的 canonical `main` mutation、wire readback 和 owner-native close 串行。
- 合并冲突按 fresh `main`、最新用户 SSOT 和机器合同做 semantic replay，不按“谁先改”
  或旧 patch 文本机械获胜。
- 依赖只约束消费和终态证明，不制造跨仓总锁。producer 与 consumer 可以并行实现
  兼容桥、fixture 和测试，最终按 fresh producer contract 重放 consumer。
- 并行规模按 fresh execution graph 动态决定，不设全局 `ACTIVE` 数量上限；只有写集、
  宿主容量、受保护权限、安全边界或外部配额不足时才收缩并发。`ACTIVE` 对话数量、
  execution owner 数量和同时进入 canonical `main` 的 Integrator 数量不是同一个指标。

## Objective 与 owner 规则

每个未完成 objective 必须在 fresh lifecycle/thread readback 中有且只有一个 controller
和 execution owner。没有真实外部 blocker 时，必须存在一个可立即执行 next action 的
execution owner。只有所需外部权限或输入确实不可获得时，`ACTIVE` objective 才可以暂时
没有可运行的 execution owner：controller 必须记录缺失的精确权限或输入、外部 authority、
fresh evidence 和恢复条件；不得虚构 mutation、checkpoint、owner 或可执行 next action。
controller 仍负责在恢复条件满足后重新准入唯一 execution owner；它不能用 `blocked` 或
`waiting` 把 objective 伪装成终态。一个 controller 可以管理多个互不冲突的 execution lane；
多个 owner 不得同时声称同一 canonical mutation 权限。历史 lifecycle/thread readback 只作
当时审计证据，不得由 consumer 猜测延长有效期。

任务状态只使用：

- `ACTIVE`：仍有缺口；存在可运行 execution owner 时必须继续推进、修复首个真实断点或完成
  终态 readback。仅在已记录的外部权限或输入 blocker 存在时，允许 controller 暂无可运行
  execution owner，直至恢复条件满足。
- `EVENT_IDLE`：当前没有可独立执行切片；Ledger 记录精确 trigger event/schema、Bundle 或
  artifact digest、consumer cursor、恢复条件和下一 owner route。它不持有运行中的 controller，
  不轮询、不占用 active conversation；事件到达后 fresh readback，再创建或恢复一个 bounded
  execution task。Ledger 实现可映射为 `deferred`，但必须保留 typed trigger。
- `SAFE_TO_ARCHIVE`：用户终态、canonical/wire/installed/public proof 和 owner-native
  cleanup 均已完成，且该 objective 的 `terminal_gaps=[]`。

`blocked`、`waiting`、failed run、候选 checkpoint、测试通过和 source canonical 都不是
objective 终态。外部权限或不可获得输入是唯一可暂停执行的 blocker；普通冲突、失败
或 main 漂移由 owner 自行重放和修复。

## 并行模式与吸收优先级

保持所有具备实际执行动作的 lane；没有可执行切片的只读 watcher 不应伪装成 `ACTIVE`，
而应转为 `EVENT_IDLE`、`SAFE_TO_ARCHIVE` 或被重新分配到独立缺口。下面只是可复用的
协调模式，不是当前 lane inventory、owner 清单、branch/SHA、ETA、准入结论或完成证明。
当前任务、owner、write set、next action 和 terminal evidence 必须在执行时从 OPL
Ledger、thread/lifecycle readback 与对应产品/发布 owner 重新读取。

1. **Public pointers pattern**：WebUI GHCR `stable/latest` 与 Desktop Stable/Latest
   可以独立推进；是否存在、由谁负责以及是否可吸收必须以 fresh owner/readback 为准。
2. **Source and release repair pattern**：Stable 首断点、安装统一和 GUI artifact consumer
   可以并行；GUI 只能消费 fresh immutable published+installed carrier artifact 及其
   Framework compatibility receipt，不能由本模式推导发布或安装 ready。
3. **Hygiene and convergence pattern**：活跃分支 semantic convergence、历史 exact-merged
   detached lane 的 proof-backed cleanup、跨仓 stale receipt reconcile 可以并行；每项都须
   重新确认 owner、holder、remote recovery 与 cleanup authority。
4. **Package retirement pattern**：Framework producer、App/Shell consumer、carrier-native
   lifecycle 和 consumer-zero inventory 可以并行准备；具体 Package 写集仍归现有 owner，
   每个 legacy family 的最终删除必须以 fresh no-active-consumer proof 和 owner-native
   authorization 单独串行完成。

同一 repo 最终吸收优先级为：

```text
baseline source checkpoints and owner replay
-> active product contracts and consumers
-> historical branch convergence
-> documentation-only coordination snapshots
```

优先级只调度 canonical integration 窗口，不要求较低优先级停止开发、测试或 remote
checkpoint，也不阻断无重叠的 straightforward 修复、文档或只读 operation。若较高优先级
在较低优先级开发期间进入 `main`，较低优先级 owner fresh-main semantic replay 后继续。

## Local-first / push-last

手工开发必须先完成所有本地或本地等价验证，再使用远端 Actions 补充 hosted OS、受保护
secret、public mutation 或 owner-authoritative readback。标准顺序是：

```text
fresh base and exact write set
-> local focused tests
-> local affected aggregate / typecheck / lint / diff
-> clean checkpoint commit
-> ordinary task-ref push
-> fresh-main semantic replay
-> serialized main absorption and wire parity
-> owner-native close
```

不得把 GitHub Actions 当第一轮调试器；也不得因为本地测试通过就声称公共或 installed
终态完成。

## 开发清洁终态

`worktree` 只是隔离施工面，不是任务终态，也不是成果 SSOT。每个 Git 写任务都必须由
owner 将已验证成果吸收到 canonical `main`，完成 local/tracking/wire/API/tree/blob
fresh readback，再清理自有 worktree、local/remote branch、临时产物、process 和
lifecycle receipt；只有这一整套闭环完成后，对应任务才可标记 `SAFE_TO_ARCHIVE`。
根目录存在其他 owner 的 dirty write set 时，Integrator 不得覆盖、reset 或代替其吸收，
而应在独立集成窗口按 fresh main 逐项重放。

清洁目标不是活跃开发期间强求 non-root worktree 数量为零，而是：

```text
stale=0
ownerless=0
duplicate_writer=0
unexpected_dirty=0
git_locks=0
```

每个 non-root worktree 必须满足以下之一：

1. `ACTIVE`：有唯一 owner、objective、exact/bounded write set、next action、clean 或已说明
   的 contained dirty state，以及可恢复 remote checkpoint；
2. `SAFE_TO_ARCHIVE`：已证明 absorbed/canonical parity、holders=0、locks=0，并由原 owner
   执行 repo-native worktree/ref/receipt/temp cleanup。

`exact_merged`、clean、没有 remote ref 或标题含 `preview/manual` 都不自动授权删除。
ownerless lane 必须先 recovery disposition；历史 detached lane 必须先做 holder、patch/tree
equivalence 和用户数据归属证明。任何删除都必须使用 exact allowlist，不对 workspace 根、
通配路径或未解析 symlink 做递归清理。

每个 owner 完成后必须回读：worktree path/registration、local/remote task ref、lifecycle
entry、task receipt/temp、holders/process、Git locks、canonical local/tracking/wire/API parity。

## 时间估算的使用方式

Ledger 中 ETA 是基于当前最深可证断点的滚动规划值，不是等待理由或硬合同。owner 每完成
一个 checkpoint 就缩短或重估剩余步骤；可以并行的步骤不得相加为墙钟时间。发布、安装、
GUI、Package retirement 与其他领域 lane 的调度关系必须以本轮 fresh execution graph 为准；
本合同不冻结任何当前分账，也不授予跨 owner 的 mutation、publication、install 或 release
authority。任何已具备执行条件的终态都不应因无关 objective 而等待，但仍须由其 canonical
owner 完成本 lane 的验证、吸收和 closeout。
