# OPL Package 平台组合迁移计划

Owner: `one-person-lab-app` for product contract and GUI acceptance; cross-repo
implementation owners are listed below.
State: `target_planned_docs_first`
Date: `2026-07-24`
Purpose: `package_platform_composition_and_dynamic_agent_runtime`
Machine boundary: 本文是目标架构、迁移顺序和删除门禁，不是当前实现、合入、安装、
发布或 latest/currentness 证明。当前机器真相仍在各 repo 的 contracts、source、
tests、平台 installed state 和 fresh readback。

## 结论

可以达到目标生态，而且不需要牺牲用户功能：

```text
OPL Base        ~= R
OPL App         ~= RStudio / 可替换 GUI 与部署载体
OPL Package     ~= R Package
OPL standard agent = OPL Package(kind=agent)
```

减法对象是 OPL 自研的 resolver、版本/ABI 组合门禁、lock、payload、
materialization、LKG、receipt、rollback 状态机、固定 Package/Agent/Skill 清单和
App 领域 schema；保留的是安装、统一状态、独立静默更新、依赖补齐、启停/显隐/
卸载、Home shortcut、Runtime task 状态和 Agent 自定义视图这些用户结果。

核心判断是：**统一体验不等于统一实现**。App 提供一个入口，底层优先委托 Codex
Plugin Manager、Git、OS package manager 或其他平台原生能力。Framework 只保留
installed discovery、presence/callability 检查、状态聚合和确有必要的薄 adapter。

同时必须拆开三个经常被混用的角色：

```text
OPL Package = executor-neutral identity + capabilities + dependencies
Carrier     = Codex Plugin Manager / Git / OS package manager / local platform
Executor    = Codex CLI / Claude Code / Hermes Agent / future executor
```

Codex Plugin Manager 可以是当前首个 carrier adapter，但不能成为 Package identity、
installed truth、capability contract 或唯一 lifecycle owner。普通 App 当前继续固定
Codex CLI 不影响该边界，也不要求本轮立即增加 executor selector。

实施策略是 **Codex-first, OPL-owned boundaries**：

- 当前生产实现只优化 Codex CLI + Codex Plugin Manager 这一条最低成本主路径；
  不同时维护 Claude Code、Hermes 或抽象到所有假想 executor。
- OPL 自己长期拥有 Package/capability identity、Official Profile、用户偏好、
  business Work Item、Temporal refs、typed views 和领域交付语义。
- Codex 私有 plugin id、marketplace、config/cache/path 和 invocation shape 全部封装
  在 Codex adapter 内。将来替换 Codex 时，只替换 carrier/executor adapter，不迁移
  OPL identity、用户状态或业务数据。
- 第一阶段只要求一个最小 executor-neutral Git/local proof，机械证明公共 contract
  没有 Codex 私有字段；它不是第二套正式产品或长期并行维护线。
- 新的完整 executor adapter 只在出现真实用户需求、Codex 风险或更优底层时实现，
  不为未来猜测预先建立通用 framework。

## 目标原则

1. Package 是安装单元；Skill、Tool、Plugin、MCP、Agent task producer 和 typed
   view 是 Package 可暴露的 capability。
2. Required dependency 只表达 identity presence 和 callability。没有 version
   range、ABI range、lock、payload、digest 或 family cohort 组合门禁。
3. 一个 breaking capability 通过新 capability identity 或 owner-side adapter
   演进，不扩张中央兼容解析器。
4. App 只有一个 Official Profile。Standard 与 Full 使用相同 desired roots；
   Full 只带离线 seed。
5. Official Profile 只在首次安装或用户显式“恢复官方组合”时执行。用户卸载后，
   普通启动和静默维护不得偷偷重装。
6. 每个已安装 Package 独立静默更新。一个失败只影响其自身和直接依赖者。
7. 新 Package、Agent、Skill、Tool、Plugin 或 typed view 不要求修改 App source。
8. 精确 ref/digest/immutable bytes 只服务某次 build/release artifact 的可复现性，
   不服务日常组合或 readiness。
9. App/Shell 只渲染 owner projection；不建立平行目录、状态机或领域 schema。
10. 删除必须通过功能等价门禁；docs、tests 或 compatibility bridge 不算迁移完成。
11. Package identity、capability、依赖、用户偏好和业务 task/view 必须
    executor-neutral；Codex plugin id、marketplace、home/path 和 manifest shape
    只能存在于 Codex adapter 内。
12. Package 安装与 executor 选择是两个动作。切换 executor 只刷新 route
    readiness，不重装 Package，也不丢 Settings/Home preference、required
    capability presence、Work Item 或 typed view。
13. executor adapter 缺失只局部影响该 route。若被移除的 carrier 持有唯一物理
    bytes，则 Package 必须如实变为 `physical_unavailable`，不能由 App metadata
    伪造 installed。
14. 当前生产路径是 Codex-first。可迁移性由 OPL-owned public contract、Codex
    adapter 封装和一个最小中性 proof 保证，不以并行维护多个正式 executor 为代价。

## Current Truth

主线已完成一部分开放组合清理，但仍处于两套模型并存：

| 当前面 | 已有价值 | 与目标的差距 |
| --- | --- | --- |
| Framework Package directory/status/actions | 给 App 一个统一读取和动作入口。 | 同时拥有 resolver、installed lock、receipt、payload/materialization、LKG/rollback 等自研生命周期。 |
| App starter metadata / fixtures / validators | 支撑当前官方 Package 展示和测试。 | 复制 Package/Agent/Skill identity，新增 Package 仍可能需要 App 变更。 |
| Standard / Full | 已区分普通载体与离线首次安装。 | 仍有独立 payload/closure/清单语义，尚未证明消费同一 Official Profile。 |
| Settings Agents | 已能展示 Package 与 Home preference。 | 公开过多 lock、physical surface、receipt、source/compatibility/recovery 实现细节。 |
| Home shortcuts | 已有专业 Agent 快捷入口。 | 仍有 starter/assistant metadata 双轨，未完全由 Agent Package descriptor 动态生成。 |
| Runtime WorkItemProjection | 已证明 App 可以消费统一 Work Item 投影。 | Runtime 仍标为 `X0-01`；scope/availability 复制一方 Agent，MAS 科研路线 schema 复制进 App bridge。 |
| Managed update | 已区分 Base/App/Packages 三对象。 | Framework 仍被设为 Package catalog/resolver/transaction owner，而非平台 adapter/aggregator。 |
| GHCR first-party publication | 每个一方 Package 已有独立发布仓库和 `latest-stable`。 | 普通消费者仍可被共享 `one-person-lab-manifest:latest-stable` 锁在旧选择；Base OCI/Plugin/runtime 的责任尚未按薄 adapter 拆开。 |
| Codex Plugin projection | 当前可复用 Plugin Manager 提供安装/更新能力。 | plugin id、manifest、marketplace/path 仍可能被误当成 Package identity 或 installed truth；尚无非 Codex/中性 adapter 的真实 readback 证明。 |
| Durable Package 调研 | 正确拒绝 `+5k` 通用 filesystem transaction 和跨 Package 原子性。 | 推荐的小 intent/lock/receipt 仍假定 OPL 必须自研 Package manager。 |

因此本计划是 migration target，不得把现有字段改名后继续深化旧设计。

## Owner Matrix

| Owner | 应拥有 | 不应拥有 |
| --- | --- | --- |
| Package owner | Executor-neutral Package identity/kind、entrypoint、provided/required capabilities、Agent business task lifecycle、typed view schema/data、确有差异时的 executor adapter ref。 | App navigation、其他 Package 状态、Temporal execution truth、family release cohort、中央 executor version matrix。 |
| Package publication | 一方 owner 向独立 GHCR repository 发布完整 Package bytes，并只推进自己的 `latest-stable`；其他 owner 可声明自己的发布存储。 | Installed truth、App readiness、family cohort、其他 Package currentness。 |
| Carrier platform | 自己承载的 Package bytes、install/update/uninstall、平台本地状态与恢复。Base 薄 OCI adapter下载/校验 GHCR 完整 bytes，Codex 激活 Plugin/config/cache，Package声明的carrier/runtime adapter激活完整 runtime。 | OPL Package identity、owner publication current stable、业务状态、其他 carrier installed truth、把 Plugin subset 当完整 Package。 |
| Executor adapter | 把已安装 Package capability 暴露给一个 executor，并提供 callable readback。 | Package 安装身份、App preference、业务 Work Item、其他 executor route。 |
| OPL Framework | Adapter discovery、跨 carrier 的完整 Package installed/callable fresh readback、presence graph、executor route readiness、聚合状态/actions、Agent/Temporal join、typed-view validation/proxy。 | Codex registry 作为生态真相、第二套 package bytes、version solver、lock/payload/LKG/receipt/rollback manager、固定 Package/Agent/Skill 清单、领域 view schema。 |
| Temporal | workflow/activity queued/running/attempt/heartbeat/retry/terminal execution。 | Agent business status、科研阶段语义、Package 安装状态。 |
| OPL App | Official Profile、首次安装/显式恢复意图、统一 Settings/Home/Runtime 产品体验、通用 `view_kind` renderer registry。 | Package 版本选择、平台生命周期、Agent task truth、MAS 科研 schema、平行 capability allowlist。 |
| Shell | 渲染 projection、收集用户意图、调用 projected action、fresh refresh。 | Package/Agent id 分支、manifest/lock 解析、任务/领域推断、第二份状态。 |
| Release tooling | 一次实际 build/release 的 exact refs、digests、bytes 和资格证据。 | 日常 Package composition、installed readiness、跨 Package latest。 |

## 目标最小接口面

以下是概念 shape，不是已落地 contract。最终字段应以实现阶段的最小机器合同为准。

### Package Descriptor

```json
{
  "package_id": "mas",
  "kind": "agent",
  "provides": ["agent:mas", "view:research-roadmap"],
  "requires": ["capability:mas-scholar-skills"],
  "optional": [],
  "entrypoints": {
    "task_provider": "agent:mas",
    "typed_views": ["view:research-roadmap"]
  },
  "home_shortcut": {
    "label": "Med Auto Science",
    "default_visible": true
  }
}
```

禁止在组合 contract 中加入 `version_range`、`abi_range`、`lock_ref`、
`payload_ref`、`digest`、`release_set` 或 `receipt_ref`。
`entrypoints` 使用 executor-neutral capability identity。Codex plugin id、path、
marketplace 和 invocation shape 只存在于 Codex adapter 自己的私有配置/readback，
不得写入公共 Package descriptor；也不预先枚举未来 executor 或加入中央版本矩阵。

### Installed Status

```json
{
  "package_id": "mas",
  "installed": true,
  "enabled": true,
  "callable": true,
  "missing_required": [],
  "update_state": "current",
  "executor_routes": {
    "codex_cli": "ready"
  },
  "attention": null,
  "actions": ["update", "disable", "uninstall"]
}
```

Framework 从 carrier adapter fresh readback 产生该状态。App 不从 checkout、
manifest、version、lock 或文件路径推断。Package installed/callable 与单个
executor route readiness 分开。未实现的 Claude/Hermes route 不是当前合同的必填
占位或完成门禁；只有用户实际配置某 route 时，缺失 adapter 才局部报告 unavailable，
且不能把 Package、Home、Runtime task 或其他 route 隐藏。

### Official Profile

```json
{
  "profile_id": "opl-official",
  "desired_roots": [
    "<package-id-selected-by-current-official-profile>"
  ],
  "apply_on": ["first_install", "explicit_restore"]
}
```

`desired_roots` 是可替换默认值，不是固定数量、生态上限、运行时 guard 或
后台 reconciliation desired state。依赖 Package 不必重复列为 root。

### Agent Task And Typed View

```json
{
  "task_id": "opaque-owner-id",
  "agent_package_id": "mas",
  "title": "DM-CVD-Mortality-Risk",
  "business_status": "in_progress",
  "progress_text": "正在验证主要假设",
  "next_action": "review_results",
  "execution_ref": "opaque-temporal-ref",
  "views": [
    {
      "view_id": "research-roadmap",
      "view_kind": "research-roadmap",
      "title": "科研路线",
      "read_action": "opaque-action-ref"
    }
  ]
}
```

Temporal fields通过 `execution_ref` 聚合但不替代 `business_status`。App renderer
只依赖 `view_kind`；MAS schema和医学语义留在 MAS owner。

## 功能等价矩阵

| # | 不可降级结果 | 目标简化 | 删除/完成门禁 |
| --- | --- | --- | --- |
| 1 | Standard 与 Full 自动安装同一组必要官方 Package。 | 一个 Official Profile；Full 只增加 offline seed。 | 两种 clean install 的 root/capability readback 相同；删除 Full 独立清单。 |
| 2 | MAS 自动获得 MAS Scholar Skills。 | `requires=["capability:mas-scholar-skills"]` presence edge。 | 缺失依赖场景能自动安装并 fresh callable；删除 App/Framework 的 MAS 特判。 |
| 3 | 有依赖也能自由组合。 | 只检查 identity presence/callability。 | 不带 version/ABI/lock/payload/digest 的 Package 可以安装、调用、更新；删除 resolver 门禁。 |
| 4 | 新 Package 无需修改 App。 | 动态 Package/capability descriptor。 | 用测试 Package完成 Settings、Home、Runtime 接入且 App source diff 为零；删除固定 id 清单。 |
| 5 | 已安装 Package 静默自动更新。 | 每包调用 native updater，独立 fresh readback。 | 一个 Package 更新时 Base/App/其他 Package 不变；失败不取消其他更新；删除跨包 planner/transaction。 |
| 6 | Settings 统一查看和维护。 | compact list + lazy detail，仅暴露用户动作/状态。 | Install/Update/Enable/Show/Uninstall 和 attention 可用；lock/payload/receipt/physical surface 不在普通 UI。 |
| 7 | 用户卸载选择被尊重。 | Official Profile 非持续 desired state。 | 卸载官方 root 后跨重启、日更、App 更新均不重装；显式 Restore 才恢复。 |
| 8 | Home 显示可配置快捷方式。 | Agent Package shortcut descriptor + user preference。 | 安装/卸载/显隐/排序 fresh readback 动态更新；删除 assistant/starter 第二清单。 |
| 9 | Runtime 查看所有已安装 OPL 智能体任务。 | 动态发现 `kind=agent` task producers。 | 新 Agent producer 不改 App 即出现；一个 producer 失败不隐藏其他 Agent。 |
| 10 | 业务进展与实际运行状态都准确。 | Agent owns business lifecycle；Temporal owns execution。 | queued/running/retry/terminal 与业务 status 可独立变化且 App 不猜测或互相覆盖。 |
| 11 | MAS 提供科研路线。 | MAS-owned `research-roadmap` typed view。 | App 只按 `view_kind` 渲染；MAS schema/version演进不要求 App 携带医学字段。 |
| 12 | 未知扩展不破坏 App。 | unsupported-view 局部降级。 | 未知/invalid `view_kind` 时 task row、其他详情、其他 Agent 继续工作。 |
| 13 | 维护成本实质下降。 | native lifecycle + thin adapters + one projection。 | retained consumer 清零后删除 resolver、lock、payload、LKG、receipt、materialization、rollback machine 和 App/Shell mirrors；不得保留“备用”写路径。 |
| 14 | 更换 executor 不丢 Package 或业务状态。 | installed state 与 executor route readiness 分离。 | 安装 MAS 后禁用或改变 Codex route readiness，或改用中性 Git/local carrier；Settings、Home、Runtime、ScholarSkills presence、MAS 科研路线和用户 preference 保持，只有 route readiness 可变化。本轮不要求实现第二 executor。 |
| 15 | Codex adapter 不是唯一生态真相。 | 同一 executor-neutral descriptor 可由中性 carrier 消费。 | 一个测试 Package 不使用 Codex plugin id/manifest/path，由中性 Git/local adapter 完成真实 install/discovery/callable readback；公共 descriptor 无 Codex 私有字段。 |
| 16 | executor adapter 缺失只局部降级。 | Package 状态与 route 状态分别投影。 | Claude/Hermes adapter 缺失只使对应 route unavailable；Codex route、其他 Packages、普通对话和已有任务不受影响。 |
| 17 | 移除唯一 Codex carrier 不产生虚假 installed。 | installed truth 始终来自实际 carrier fresh readback。 | Codex Plugin Manager 是唯一物理 carrier 时移除它，Package 变为 `physical_unavailable`；App metadata 不伪造 installed。 |

## 迁移阶段

### Phase 0：Docs And Inventory

目标：

- 统一顶层模型、presence-only、Official Profile、Runtime owner split。
- 冻结旧 resolver/lock/payload/receipt/Durable 扩展，不再加字段或新 writer。
- 在 Framework、App、Shell、各官方 Package repo 建立 retained-consumer inventory。
- inventory 覆盖 Codex plugin id、marketplace、Codex home/path、manifest 和 plugin
  status 的全部 producer/consumer，并区分 Package identity 与 Codex projection。

退出门禁：

- 架构、决策、不变量、First Run、Settings、Managed Update、Runtime 文档一致。
- 每个旧 authority 字段有 producer、consumer、删除前置和 owner。
- 本阶段只证明目标一致，不证明实现完成。

### Phase 1：Minimum Descriptor And Native Adapters

顺序：

1. 选 Codex Plugin Manager 作为首个正式 carrier adapter，但不把其 plugin id、
   registry、manifest 或路径提升为 OPL identity/installed truth。
2. Framework 增加最小 Package descriptor、installed discovery、
   presence/callability、executor route readiness 和 generic action projection。
3. 对现有目录做 dual-read：优先最小 projection，旧 lock/receipt/status 只作
   fallback，不允许新消费者依赖。
4. MAS、ScholarSkills 和一个非 Agent Package 先迁移验证 capability edge。
5. 同一最小 descriptor 再通过一个 executor-neutral Git/local proof。该 proof
   只验证 public contract 无 Codex 私有字段，不建设第二套正式 GUI/executor。

退出门禁：

- 无版本/lock/payload descriptor 能完成 install/discovery/callable readback。
- 公共 projection 不要求 Codex 字段；至少一个中性 Git/local adapter 完成真实
  install/discovery/callable readback。
- native mutation结果未知时只 fresh inspect，不创建 OPL recovery state machine。
- 旧路径与新路径对用户动作结果等价。

删除门禁：

- 未完成 dual-read consumer迁移前，不删旧 reader。
- 一旦所有 retained consumers使用 minimum projection，删除旧 writer，不保留双写。

### Phase 2：Official Profile And First Install

顺序：

1. App contract 只保留一个 Official Profile desired roots。
2. Standard clean install在线安装 roots；Full 用相同 Profile消费 offline seed。
3. 对 root 展开 required presence；结果按 root 聚合。
4. 持久化的是用户显式安装/卸载偏好，不是 Profile desired-state loop。

退出门禁：

- Standard/Full clean install 得到同一 roots/capabilities。
- MAS 缺 ScholarSkills 自动补齐；失败只影响 MAS。
- 用户卸载后启动、日更、App 更新不重装；显式 Restore 可恢复。

删除门禁：

- 删除 fixed-seven、Standard/Full 双清单、Release Set readiness 和 Package count gate。

### Phase 3：Unified Independent Maintenance

顺序：

1. App scheduler只枚举 carrier fresh readback 得到的已安装 Package，不从当前
   executor 或 Codex plugin inventory 枚举生态。
2. Framework逐 Package调用 native adapter并聚合结果。
3. Settings改为 compact list + lazy inspect；高级诊断链接到 native owner。
4. Home完全从 Agent descriptor + user preference生成。
5. executor switch 只刷新 route readiness，不重置 Package preference 或业务状态。
6. 一方 Package currentness读取 owner 的 per-Package GHCR `latest-stable`；共享
   Release Set仅作为 bounded dual-read fallback并显式暴露命中来源。

退出门禁：

- 单 Package silent update terminal proof。
- 一个更新失败不阻止无关 Package；dirty/user-managed source 不被覆盖。
- Install/Update/Enable/Disable/Show/Hide/Uninstall/Home preference结果不降级。
- Base 薄 OCI adapter完成下载/校验，Codex Plugin/config/cache和Package声明adapter
  激活的完整 runtime均有 restart 后 fresh readback；Plugin-only结果不得报告
  installed。

删除门禁：

- 删除 custom planner、跨 Package transaction、lock/receipt/LKG/rollback UI、
  physical materialization UI、assistant/starter shortcut mirror。

### Phase 4：Dynamic Runtime And Agent Views

顺序：

1. Agent Package 注册 task provider，不注册到 App Agent id list。
2. Framework分离业务 task 与 Temporal execution，再通过 opaque refs join。
3. App Runtime升为核心 route，scope从 installed producers动态生成。
4. 建立通用 typed-view registry；先接 MAS research roadmap，再接一个测试未知 view。
5. 从 App runtime bridge 删除 MAS 科研 schema和一方 Agent scope复制。
6. executor attempt 可切换 adapter，但保持 Agent Package identity、业务 task id
   和 typed-view owner 不变。

退出门禁：

- 所有已安装标准 Agent task 可见；新增测试 Agent无 App source修改。
- Temporal状态与业务状态分别有 fresh producer/readback。
- MAS view可用，unknown view局部降级，App没有 MAS id/schema branch。

删除门禁：

- 新 Runtime contract/source/installed evidence 完成前保留旧 WorkItem reader；
  完成后删除 `X0-01` optional gate、固定 scope/availability 和领域 schema mirror。

### Phase 5：Legacy Removal And Release Proof

顺序：

1. 对 retained-consumer inventory 做零引用验证。
2. 删除兼容 schema、fixtures、validators、writers、state machines、CLI verbs 和
   fail-only workflows；迁移文档转 history。
3. 删除 App/Framework/Shell 中把 Codex plugin id、marketplace、Codex path 或
   manifest 当作 Package identity、installed truth 或固定 Agent membership 的逻辑；
   保留与其他 adapter 同级的 Codex adapter。
4. 删除普通更新对 `one-person-lab-manifest:latest-stable` 的读取和同步 promotion；
   Release Set 只保留 Full/offline/integration-test/QA snapshot。
5. 分别完成安装、静默更新、Runtime、Desktop Latest 和 WebUI stable terminal proof。

终态：

- Framework只剩平台 adapters、discovery、presence/status aggregation 和 Runtime join。
- App只剩 Official Profile、通用 Package/Home/Runtime UX 和 typed-view renderers。
- 没有固定 Package/Agent/Skill/Tool/Plugin清单或 OPL package-manager state。

## Legacy Deletion Map

| Legacy surface | 替代能力 | 删除前证据 |
| --- | --- | --- |
| Framework repository compatibility resolver | Native source currentness + presence check | 无版本 descriptor全链路；所有 consumers不读取 selected version。 |
| Installed Package lock / Release Set | Native installed discovery | 跨重启 installed/callable readback；Standard/Full同 Profile proof。 |
| Payload inventory / physical materialization | Native platform install surface | Plugin/Skill/Tool实际可调用；uninstall清除由 native owner证明。 |
| Lifecycle receipt ledger | Native terminal status + App operation event if user feedback需要 | success/failed/unknown均可 fresh readback；无 retained receipt consumer。 |
| LKG / rollback_ref / rollback machine | Native owner recovery/reinstall route | 普通功能无 rollback依赖；高级 owner route可达。 |
| Package-local durable intent proposal | Native platform crash semantics | 有界 fault/readback证明无需 OPL journal；若有真实 adapter缺口再单独授权窄修。 |
| App schema/fixture/validator mirror | Minimum Framework projection | App不解析 manifest；dynamic test Package通过。 |
| Fixed Agent/Skill/Tool/Plugin allowlists | Installed capability discovery + user preference | 未列入 App 的 capability可发现/调用；显式 deny仍局部。 |
| Codex plugin registry/id/path as Package truth | Executor-neutral Package identity + carrier/executor adapter projection | 公共 projection 无 Codex 字段；同一 identity 的非 Codex/中性 readback完成；无 Codex 环境仍可列出其他 carrier Packages。 |
| Shared Release Set ordinary currentness | Package owner per-Package GHCR `latest-stable` | 共享 manifest不变时普通更新仍看到新 Package；Full/offline/QA snapshot保持可复现。 |
| MAS runtime schema in App | MAS-owned typed view | view_kind渲染、unknown降级、MAS独立演进proof。 |

## Durable 调研整合裁决

`OPL Package Durable 轻量架构设计` 与本迁移相关，但只保留以下结论：

- 拒绝通用 filesystem transaction、跨 Package 原子事务和自动覆盖 external drift。
- 一个 Package失败不否决其他 Package。
- mutation 必须幂等；未知结果需要 fresh inspect，不能虚报成功或自动覆盖现场。
- corrupt shared state只有在确实仍被某个薄 adapter拥有、且无法证明安全写入时才
  fail closed；不能为了这个异常重建全生态 lock/ledger。
- 没有复现故障和真实 consumer，不新增 durable abstraction。
- 保留 immutable release/build artifacts 的 exact-byte binding、domain/evidence
  receipts、用户 preference/config 的 stale-write protection + atomic replace，以及
  外部 mutation unknown 时的有界 fresh inspect。它们各自服务真实 owner，不构成
  Package installed truth 或通用 transaction engine。

其 `Package-local intent + lock/receipt authority commit` 推荐被本计划
**supersede**。原因不是该设计不严谨，而是它优化了一个不再需要由 OPL 自己拥有的
Package manager。其 fault matrix 可作为迁移期旧 writer 的删除回归素材，但不得成为
目标 schema 或新 consumer。只有某个薄 native adapter出现可复现 crash gap，且原生
平台无法提供恢复时，才可按 exact adapter写集重新评估一个 adapter-local mechanism；
不得恢复通用 journal、Package lock/ledger authority或跨 Package transaction 候选。

## 后续精确实现类别

本 docs-first tranche 不修改以下表面。后续按 owner、独立 worktree和精确写集分段：

| 类别 | 后续变更 |
| --- | --- |
| App contracts | Official Profile；executor-neutral minimum Package/capability/status/action；separate route readiness；dynamic Home；Runtime core；typed view envelope；删除 starter/lock/payload/receipt/physical surface兼容字段。 |
| Framework contracts/source | Carrier/executor adapter interface；per-Package GHCR source adapter；Base thin OCI download/verification；Package-declared carrier/runtime activation；executor-neutral installed discovery与complete-runtime aggregate readback；presence graph；route readiness；per-Package update aggregate；Agent/Temporal join；typed-view validation/proxy；dual-read后删除 shared Release Set currentness 和 resolver/lock/receipt/materializer/LKG。 |
| Official Package repos | Executor-neutral Package descriptor；provides/requires identities；Agent task producer；可选 typed view；carrier/executor 私有配置留在各 adapter；MAS/ScholarSkills真实 presence edge。 |
| Shell source | Compact Settings；dynamic Home；dynamic Runtime scope；generic view registry；unknown-view fallback；删除 id/schema分支和物理细节。 |
| First-run/Full/release | 一个 Official Profile；online/offline source差异；用户卸载保护；artifact exact-byte记录与 composition解耦。 |
| Tests | Contract migration、platform adapter、presence graph、independent update、user removal、dynamic Package/Home/Runtime、Temporal split、typed view、unknown local degradation、legacy zero-consumer。 |

跨仓不兼容改动必须按 `compatibility bridge -> authority main -> consumer
switch -> legacy delete` 顺序吸收；不得让 App 依赖尚未进入 Framework/Package
canonical main 的候选。

## Fresh Terminal Proofs

至少需要以下 fresh 终态，才能声称目标已落地：

1. Standard clean install读取一个 Official Profile，所有 roots 与 required
   capabilities installed/callable。
2. Full offline clean install读取同一 Profile，结果与 Standard一致。
3. MAS在 ScholarSkills缺失时自动补齐；补齐失败只让 MAS unavailable。
4. 用户卸载一个官方 root；重启、日更和 App update 后仍未安装；显式 Restore 后恢复。
5. 一个全新测试 Agent Package不改 App source即可出现在 Settings、Home和Runtime。
6. 一个已安装 Package静默更新成功，Base/App/其他 Packages字节/状态不变。
7. 一个 native update失败时其他 Package继续，dirty/user-managed source未被覆盖。
8. Agent business status与Temporal queued/running/retry/terminal分别从owner读取并正确合并。
9. MAS research roadmap通过typed view显示；未知view_kind仅局部 unavailable。
10. 同一 Package在 Codex carrier与至少一个真实中性 Git/local adapter 下保持同一
    identity；Codex route readiness变化不重装 Package，不丢 Home preference、Work
    Item 或 typed view。本轮不要求第二 executor执行。
11. Codex plugin id、manifest、marketplace 和路径只存在于 Codex adapter；无 Codex
    环境仍能列出并调用由其他 carrier 安装的 OPL Package。
12. 用户实际配置的非 Codex route 若缺 adapter，只局部影响该 route；未配置的
    Claude/Hermes adapter 不是本轮必填占位或完成门禁。移除唯一物理 Codex carrier
    后 Package 如实变为 `physical_unavailable`。
13. retained-consumer inventory 为零，旧 resolver/lock/payload/LKG/receipt/
    materialization/rollback writer和App mirrors从canonical main删除。
14. 一方 Package由 owner独立推进 GHCR `latest-stable`；共享 Release Set保持不变时，
    普通更新仍发现并只更新该 Package。
15. Base薄 OCI下载后，Codex Plugin/config/cache与Package声明adapter激活的完整
    runtime均跨重启 installed/callable；Full离线使用同一 Official Profile。
16. App Stable -> GitHub Latest -> updater readback。
17. WebUI exact digest -> `:stable` -> anonymous pull。

任何 docs、contract、unit test、dry-run、candidate branch、未吸收 commit 或
非 live fixture 都不能替代上述终态；mock/schema/unit test 不能替代中性 Git/local
adapter 的真实 readback。完整 Claude/Hermes adapter不属于本轮完成门禁。
