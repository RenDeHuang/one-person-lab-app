# Superseded OPL Package Durable Design Review

Owner: `one-person-lab-app`
Purpose: `opl_package_durable_research_supersession_record`
State: `historical_only_superseded`
Date: `2026-07-23`
Machine boundary: 本文压缩保存一次只读调研的输入、裁决和可复用安全不变量。它不是
当前 Package lifecycle、installed truth、恢复协议、实现计划、合入或发布 authority。
当前目标只由
[`../../active/opl-package-platform-composition-migration.md`](../../active/opl-package-platform-composition-migration.md)
和核心架构/决策文档拥有。

## 来源与当时问题

原调研题为“OPL Package Durable 轻量架构设计”，状态为 `review_ready`，性质明确为
只读建议。它基于当时的 Framework Package Manager，审计了一个约 `+5k` 行的通用
filesystem transaction 候选，并比较了：

1. 通用 path snapshot/batch/rollback engine；
2. 完整 Plan/Stage/Activate 与 generation pointer；
3. Package-local intent + authority commit + forward reconcile。

当时调研拒绝方案 1，将方案 2 留作远期观察，并建议方案 3 作为较小的恢复机制。
它仍把 Package lock、payload/generation、lifecycle receipt、LKG 和 Framework
Package Manager 当作长期 authority；这正是后来生态减法审计重新裁决的前提。

当时记录的代码基线、远端 SHA 和候选分支只用于历史 provenance。它们不证明当前
分支仍存在、代码仍相同或任何实现已合入。

## 保留的结论

以下结论与当前 thin-adapter 架构一致，保留为安全不变量和删除回归素材：

- 拒绝任意路径、任意 callback、多 Package 的通用 transaction engine。
- 一个 Package 的失败不得取消其他独立 Package；required dependency 缺失只局部
  阻止依赖它的 root。
- 外部 mutation 的 exit code 不是完成证明；未知结果只做有界 fresh inspect，不
  自动重试、不猜测成功。
- 薄 adapter 只修改自己明确拥有的 surface，拒绝 path escape、symlink 和 unexpected
  ownership。
- 共享配置必须保留未知 Package、未知字段和第三方内容；不能按局部 schema 重建整份
  文件。
- external drift 不自动覆盖；无法证明 owner/currentness/无损写入时局部停止并公开
  attention。
- 幂等、atomic replace、stale-write protection、immutable build/release bytes 和
  domain evidence receipt 仍可由各自真实 owner 使用，但不能提升为 Package installed
  truth。
- 没有可复现 crash gap 和 retained consumer 时，不新增 durable abstraction。

## 被 supersede 的结论

以下建议不进入目标实现：

| 原建议 | 当前裁决 | 原因 |
| --- | --- | --- |
| Package-local durable intent | `superseded` | 日常 lifecycle 委托 carrier/platform；Framework 不再拥有需要恢复的中央 Package mutation。 |
| lock/ledger 作为 Package authority commit | `superseded` | installed/callable 来自实际 carrier fresh readback；lock/ledger 是待删除的兼容状态。 |
| lifecycle receipt/LKG/rollback 状态机 | `superseded` | 原生 owner 的 terminal readback、repair/reinstall/rollback route 足够；OPL 不复制第二套恢复机。 |
| 将 lock/ledger 迁入 SQLite | `superseded` | 这会加深已决定删除的 Package Manager authority，而不是降低维护成本。 |
| exact-path 实施预算和 fault-injection 计划 | `historical_test_material_only` | 可以帮助验证旧 writer 删除和 adapter 安全，但不能授权新 intent/schema/consumer。 |
| startup recovery scan、跨 Package transaction、external rollback | `rejected` | 范围无界、无法证明 ownership，且违反独立组合与局部失败原则。 |

最终裁决不是把旧 Package Manager 改成一个较小 Package Manager，而是删除不必要的
中央 ownership：

```text
Package owner publication
  -> carrier/platform native lifecycle
  -> fresh installed/callable readback
  -> Framework thin aggregation
  -> App/Shell generic consumption
```

只有某个薄 adapter 出现可复现、原生平台无法处理的 crash gap，才可以重新审计一个
严格 adapter-local 的最小机制。该审计必须给出真实 caller、exact owned surface、
失败测试、无标准库/平台替代的证据和独立授权；不得恢复通用 journal、Package
lock/ledger authority或跨 Package transaction。

## 当前读法

- 当前架构与 owner boundary：
  [`../../architecture.md`](../../architecture.md)。
- 当前迁移顺序与删除门：
  [`../../active/opl-package-platform-composition-migration.md`](../../active/opl-package-platform-composition-migration.md)。
- 当前统一维护体验：
  [`../../product/managed-update-three-layer.md`](../../product/managed-update-three-layer.md)。
- 旧 Package Manager 实现 provenance：
  [`../agent-package-management-implementation-snapshot.md`](../agent-package-management-implementation-snapshot.md)。

本文只回答“此前 Durable 调研哪些判断仍有用、哪些已经被新架构取代”。不得从本文
创建实现 backlog、恢复候选分支、增加新 writer，或把历史 fault matrix当作 Package
implementation、publication、Stable/Latest/WebUI mutation 授权。
