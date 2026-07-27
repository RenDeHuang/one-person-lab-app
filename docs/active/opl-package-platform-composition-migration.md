# OPL Package 平台组合迁移计划

Owner: `one-person-lab-app` for the cross-repository product plan. Each
implementation package below names its producer and consumer owners.
State: `phase_2_family_retirement_in_progress`
Date: `2026-07-24`
Purpose: `package_platform_composition_and_dynamic_agent_runtime`
Machine boundary: 本文是目标架构、current/canonical/sealed 分账、冻结工作包、依赖
关系和删除门禁。只有本 exact blob 进入 canonical `main` 并完成远端 readback 后才是
migration SSOT authority；它不是当前实现、安装、发布、Package currentness 或用户状态
mutation 的证明。机器真相仍在各 repo 的 canonical contracts/source、平台 installed
state 和 fresh owner readback。

## 结论

目标生态可以实现，而且不需要牺牲用户功能：

```text
OPL Base        ~= R
OPL App         ~= RStudio / 可替换 GUI 与部署载体
OPL Package     ~= R Package
OPL standard agent = OPL Package(kind=agent)
```

统一的是产品入口、Package identity 和聚合体验，不是中央 Package Manager。
Package、carrier、executor 和 publication 是四个正交角色：

```text
Package identity = executor-neutral identity + capabilities + dependencies
Publication      = owner GHCR or another owner-declared immutable source
Carrier          = Codex Plugin Manager / Git / OS manager / local adapter
Executor         = Codex CLI / future configured executor
```

当前正式产品只维护 Codex CLI 和 Codex Plugin Manager 主路径。OPL 长期拥有
Package/capability identity、Official Profile、用户偏好、Work Item、Temporal refs、
typed views 和领域交付语义。Codex 私有 plugin id、marketplace、config/cache/path
和 invocation shape 只能存在于 Codex adapter 内。一个最小 Git/local 中性 proof
用于防止公共合同被 Codex 锁死，不代表现在并行建设 Claude/Hermes 产品。

减法对象是普通 Package composition/lifecycle 中 OPL 自研的版本/ABI resolver、
installed lock、payload、materialization、LKG、lifecycle receipt、rollback 状态机、
固定 Package/Agent/Skill 清单和 App 领域 schema。保留的用户结果是安装、统一状态、
独立静默更新、required presence 补齐、启停/显隐/卸载、Home shortcut、Agent task
状态和 typed views。

## 阶段边界

- **Phase 1 - SSOT 与冻结计划**：已完成。目标、功能等价 ledger、工作包和删除门禁
  已进入 canonical documentation authority。
- **Phase 2 - 逐 family 实施**：已获用户批准并执行中。每条 lane 只在已登记的
  bounded surfaces 内修改 contracts/source/tests 或隔离测试状态；source checkpoint、
  canonical absorption、installed/live proof 和 cleanup 继续分账。

Phase 2 的实施授权已经成立，但 candidate、测试通过、owner handoff、内部 ACK、未吸收
commit 或封存 worktree 都不是 canonical 或迁移完成证明。Phase 2 也不自动授权 Package GHCR/tag、
Stable/Latest、WebUI promotion、真实用户 managed state 或其他 public mutation；这些
仍需要各自 owner 和独立授权。

本迁移文档不是 Stable、Package publication、Foundry 或任何零交叉工作前置。它们
可以独立推进，只在同仓 `main` CAS 的瞬间按 fresh exact write set 串行。

### Phase 1 历史文档写集

Phase 1 只包含以下 SSOT/引用面；exact path 和临时状态不在其他 durable 文档复制：

```text
App exact16
AGENTS.md
docs/README.md
docs/active/aionui-mainline-gui-convergence-plan.md
docs/active/app-ideal-state-gap-plan.md
docs/active/opl-package-platform-composition-migration.md
docs/active/over-engineering-cleanup.md
docs/architecture.md
docs/decisions.md
docs/delivery/distribution-and-install-ssot.md
docs/product/gui/claude-science-runtime-task-awareness-plan.md
docs/product/gui/codex-to-opl-app-delta.md
docs/product/gui/openscience-console-projection.md
docs/product/gui/runtime-overview-redesign.md
docs/product/managed-update-three-layer.md
docs/project.md
docs/status.md

Framework exact4
docs/active/current-state-vs-ideal-gap.md
docs/active/standard-agent-private-platform-inventory.md
docs/specs/standard-agent-interface.md
docs/status.md
```

Phase 1 的完成条件已经满足：两个仓的 docs-only commit 均进入各自 canonical `main`，
文档/链接/结构/diff 门禁与远端 wire/API/tree/blob/raw readback通过。当前
`next_action=按 Per-Family Deletion Loop 继续 Phase 2 source/canonical/live proof/cleanup`。

## 持久原则

1. Package 是安装单元；Skill、Tool、Plugin、MCP、Agent task producer 和 typed
   view 是 Package 暴露的 capability。
2. Required dependency 只表达 identity presence 和 callability。普通组合不使用
   version range、ABI range、lock、payload、digest、Release Set 或固定 cohort。
3. Breaking capability 使用新 capability identity 或 owner-side adapter 演进，
   不扩张中央兼容求解器。
4. App 只有一个 Official Profile。Standard 与 Full 使用同一 desired roots；
   Full 只增加离线 seed。
5. Official Profile 只在首次安装或显式 Restore 执行。用户卸载后，普通启动、静默
   维护和 App 更新不得重装该 root。
6. 每个已安装 Package 独立更新。一个失败只影响自身和直接 dependents。
7. 新 Package、Agent 或 typed view 不要求 App/Shell 增加 Package-id 分支。
8. Exact ref/digest/immutable bytes 只绑定一次真实 build/release artifact，不参与
   日常 composition 或 readiness。
9. App/Shell 只消费通用 projection，不复制 carrier state、Package catalog、领域
   task truth 或 typed-view schema。
10. 删除顺序固定为：删除需求或重复 authority，委托现有平台能力，合并为一个通用
    projection，只有平台确有缺口时才增加最薄 adapter。
11. 安全不变量不能随旧 Manager 一起删除：native mutation 必须幂等；unknown 只做
    bounded fresh inspect；不得覆盖 external drift、dirty/user-managed source、
    unexpected ownership、path escape 或越界 symlink。
12. 删除以 fresh user outcome 为门禁。docs、schema、unit test、mock、dry-run 或
    compatibility bridge 都不是迁移完成。

## Owner Boundary

| Owner | 应拥有 | 不应拥有 |
| --- | --- | --- |
| Package owner | Executor-neutral identity/kind、entrypoints、provided/required capabilities、Agent business task lifecycle、typed-view schema/data、必要的 adapter descriptor。 | App navigation、其他 Package 状态、Temporal execution truth、family release cohort、中央 executor version matrix。 |
| Package publication | 一方 owner 向独立 GHCR repository 发布完整 bytes，并只推进自己的 `latest-stable`；其他 owner 可声明自己的 immutable source。 | Installed truth、App readiness、其他 Package currentness、family cohort。 |
| Carrier | 自己承载的 bytes、install/update/uninstall 和 fresh local readback。Codex 只拥有 Plugin/config/cache 子状态；Package-declared adapter 负责完整 runtime。 | OPL Package identity、owner publication currentness、业务状态、其他 carrier 状态。 |
| OPL Base | 薄 OCI download/verify/bytes handoff。 | 完整 Package lifecycle、Package currentness、Plugin-only installed claim。 |
| Executor adapter | 把已安装 capability 暴露给一个已配置 executor，并报告 route readiness。 | Package 安装身份、App preference、业务 Work Item、其他 executor route。 |
| OPL Framework | Adapter discovery、完整 Package fresh installed/callable 聚合、presence graph、route readiness、通用 status/actions、Agent/Temporal join、typed-view validation/proxy。 | 中央 version solver、lock/payload/LKG/lifecycle receipt/rollback manager、固定 Package/Agent/Skill 清单、领域 view schema。 |
| Temporal | Workflow/activity queued/running/attempt/heartbeat/retry/terminal execution。 | Agent business status、领域 stage、Package 安装状态。 |
| OPL App | Official Profile intent、统一 Settings/Home/Runtime 产品体验、通用 task/view envelope 和可选 rich renderer registry。 | Package version selection、carrier lifecycle、Agent task truth、MAS 科研 schema、平行 capability allowlist。 |
| Shell | 渲染 projection、收集用户意图、调用 projected action、fresh refresh。 | Package/Agent id 分支、manifest/lock 解析、任务/领域推断、第二份状态。 |
| Release tooling | 一次实际 build/release 的 exact refs、digests、bytes 和 qualification evidence。 | 日常 Package composition、installed readiness、跨 Package latest。 |

`kind=agent` 的标准 Agent 仍保留一个 owner-owned `primary_skill` rich entrypoint。
删除 Framework/App 固定 Agent/Skill 清单不等于删除 Package owner 的真实入口；carrier
只能安装/投影并报告 callability，不能取代 canonical source 或 domain authority。

## Current Truth

当前主线已经进入逐 family 删除阶段：目标 policy、若干 producer/consumer 和第一批
legacy family 已 canonical；尚未满足 consumer-zero 的旧 lifecycle machinery 继续作为
有界 compatibility surface 运行，不能反向成为新 authority。

| Surface | Current classification | 仍缺什么 |
| --- | --- | --- |
| App Official Profile policy | `canonical_partial`：单一 Profile、presence-only、Standard/Full 同 roots、persistent uninstall policy、data-driven roots 和只接受 first-install/explicit-Restore 的 one-shot consumer 已进入主线。 | 将 consumer 接入真实 first-install/Restore 入口，并完成跨重启不回装及 Standard/Full clean-install proof。 |
| App Package UX | `canonical_partial`：App contracts 已把 directory/presence/actions 设为 Settings/Home authority，Framework App-state 已从 fresh Package directory 派生状态。 | Shell/Home 端到端消费、真实未知 Package proof，以及固定 starter/assistant metadata、receipt/lock/physical detail parser 的 consumer-zero 删除。 |
| Role-neutral App contributions v1 | `owner_bound_source_checkpoint`：App 合同、Framework directory/App-state 投影、Shell parser/resolver 和 Relay 首个 descriptor 已在各自 task branch 收敛，且不按 `package_role` 或 executor 过滤。 | 仍须按 producer-before-consumer 顺序吸收 canonical，接入真实 navigation mount/标准 view renderer、Relay data/action bridge、invalid-package isolation，并分别完成 Pixel、Install、Apple Mail review path 和 Release proof。 |
| Framework Package plane | `canonical_incremental`：owner-channel `latest-stable` currentness、MAS + ScholarSkills package-local required selection、shared-latest verifier retirement、fresh presence/App-state projection和 installed-only invocation 已进入主线。普通 invocation 只消费 installed Package lock，不访问网络或远端依赖，也不再生成 invocation `offline_lkg`/`recovered_last_known_good`。 | 显式 install/update/remove/repair 仍使用 installed lock、payload/materialization、lifecycle receipt、rollback和 mutex；继续完成 neutral carrier/live proof，并按 consumer-zero 逐 family 删除。 |
| Package publication | `canonical_policy_partial`：一方 Package 使用独立 GHCR repository 和 owner `latest-stable`；普通 target discovery 已有 owner-channel实现。 | 不是所有 owner latest 都有 fresh publication proof；shared snapshot和显式 maintenance 的旧 catalog/cache retained consumers仍须清零。 |
| Shell Package consumption | `canonical_partial`：Capabilities 已消费动态 directory 和 exact carrier identity，App contracts 已删除固定 directory authority。 | Home/Settings 全路径、legacy fallback hit-zero、非固定 Package 与真实 install/uninstall preference proof。 |
| Runtime | `canonical_partial`：Framework 已从 installed Agent descriptor 动态发现 task/view producer，App Runtime 已升级为 core generic Agent scope和 typed-view contract。 | Shell 端到端 generic consumer、真实 owner descriptor/live installed proof，以及剩余固定 Agent/MAS compatibility consumer 删除。 |
| Durable Package proposal | `superseded_research`：正确拒绝大型 filesystem transaction 和跨 Package 原子性。 | 其小 intent/lock/receipt authority 仍是假设自研 Package Manager，不进入目标实现。 |

机器合同和 source 中仍出现 version、lock、payload、receipt 或 materialization，不代表
目标反悔，也不能被新 consumer 深化。它们只在 replacement canonical、affected outcome
通过并且 retained consumer 为零后删除。

## Sealed Evidence And Non-Authority

下表只防止丢失已知学习，不是实现 inventory、write authorization 或 completion：

| Surface | Classification | Phase 2 disposition |
| --- | --- | --- |
| Framework per-owner currentness / MAS local closure | `canonical_incremental`：owner-channel currentness、MAS + ScholarSkills required selection、shared request/other-root exclusion、fresh presence projection和 installed-only invocation 已进入 Framework主线；这不等于显式 lifecycle Manager 已删除。 | 不重做已 canonical family；继续清理仍命中 SemVer/ABI/lock/payload/receipt 的显式 maintenance与下游 consumer。 |
| OMA stale lock/receipt mismatch | `sealed_diagnostic`：只读发现 checkout bytes 与旧记录不一致；未执行 repair 或 state mutation。 | 只有新 Package plane canonical 后，由 OMA lifecycle owner在隔离状态 fresh inspect；不得用全局 `opl update apply` 代替单包 route。 |
| App/Shell distribution and installer work | `independent_lane`：Universal installer、Native packaging/installer source、Full generator和 embedded Base已有 canonical source；Native/managed Full仍未 public promotion或 clean-host qualification。遗留 dirty worktree不是 authority。 | 不属于本迁移 Phase 2。每次只信 fresh distribution SSOT、canonical source 和 installed/public readback；旧候选只做 semantic drop/replay裁决。 |
| RCA owner version/publication | `independent_publication`：owner Git version/tag、GHCR version tag 和 `latest-stable` 是三种不同事实。 | Package owner publication另行授权；不得因 repo version/tag 存在就声称 GHCR current。 |
| Stable release transport/successor-control | `independent_release_lane`：cache assertion修复、fresh Standard 和 protected publication由 release owner控制。 | 本计划不授权或阻塞。只有现有主路径在 fresh、无 deadlock 条件下再次证明不可恢复 deadline failure，才另行评估 successor-control；不预开发 speculative controller。 |

所有 SHA、dirty 行数、测试计数、run id 和本机路径都属于一次性 closeout evidence，
不写入长期 SSOT。每个 Phase 2 工作包启动或恢复时必须重新读取 canonical refs 和 live state。

## Functionality-Equivalence Ledger

这是本迁移唯一的功能不降级清单。工作包引用这些稳定 ID，后文不复制第二份 proof 表。

| ID | 不可降级结果 | 最小目标 | 完成/删除门禁 |
| --- | --- | --- | --- |
| `OUT-01` | Standard 与 Full 自动安装同一组必要官方 Package。 | 一个 Official Profile；Full 只增加 offline seed。 | 两种 clean install 的 root/capability readback相同；删除 Full 第二清单/count gate。 |
| `OUT-02` | MAS 自动获得 MAS Scholar Skills。 | `requires` presence edge。 | 缺失依赖时只补 MAS required closure并 fresh callable；删除 MAS 特判。 |
| `OUT-03` | 有依赖仍可自由组合。 | 只检查 identity presence/callability。 | 无 version/ABI/lock/payload composition gate 的 install/call/update通过；删除 resolver admission。 |
| `OUT-04` | 新 Package 无需修改 App。 | 动态 Package/capability descriptor。 | 隔离测试 Package进入 Settings/Home/Runtime，App source 无 Package-id diff。 |
| `OUT-05` | 已安装 Package 静默独立更新。 | 每包调用 configured carrier。 | 普通 invocation 不推进 generation/currentness；显式或已授权 scheduled maintenance更新一个 Package时 Base/App/其他 Package不变，失败不取消其他更新。 |
| `OUT-06` | Settings 统一查看和维护。 | Compact list + lazy owner detail。 | Install/Update/Enable/Show/Uninstall/attention可用；普通 UI无 lock/payload/receipt/physical detail。 |
| `OUT-07` | 用户卸载选择被尊重。 | Official Profile 非持续 desired state。 | 跨重启、日更、App更新不回装；显式 Restore才恢复。 |
| `OUT-08` | Home 快捷方式可动态配置。 | Agent descriptor + user preference。 | 安装/卸载/显隐/排序 fresh更新；删除 assistant/starter第二清单。 |
| `OUT-09` | Runtime 查看所有已安装 Agent tasks。 | 动态发现 `kind=agent` producers。 | 新 Agent producer不改App即出现；一个 producer失败不隐藏其他 Agent。 |
| `OUT-10` | 业务进展与实际执行均准确。 | Agent owns business lifecycle；Temporal owns execution。 | 两组状态可独立变化，Framework只 join，App不互相覆盖。 |
| `OUT-11` | MAS 提供科研路线。 | MAS-owned typed view。 | App只按通用 envelope/`view_kind`消费；无医学字段 mirror。 |
| `OUT-12` | 未知扩展不破坏 App。 | Generic fallback/local degradation。 | 未知或 invalid view只局部 unavailable，task/其他 view/Agent继续工作。 |
| `OUT-13` | 维护成本实质下降。 | Native lifecycle + thin adapters + one projection。 | 每个 legacy family在 consumer-zero 后删除 writer/reader/schema；最终无备用 Package Manager写路径。 |
| `OUT-14` | 更换 executor不丢 Package或业务状态。 | Installed state与route readiness分离。 | Route变化不重装、不丢 preference/Work Item/dependency/view；本轮不要求第二正式 executor。 |
| `OUT-15` | Codex adapter不是生态唯一真相。 | 同一 descriptor可被中性 carrier消费。 | 真实 Git/local install/discovery/callability通过；公共 descriptor无 Codex私有字段。 |
| `OUT-16` | Adapter缺失只局部降级。 | 只投影已配置 route。 | 已配置 route缺 adapter只影响该 route；未配置 Claude/Hermes不是 placeholder或门禁。 |
| `OUT-17` | 移除唯一 carrier不产生虚假 installed。 | Installed truth来自 fresh physical readback。 | 唯一 physical carrier被移除后状态为 `physical_unavailable`，App metadata不伪造。 |

下列是正交 public outcomes，不属于 Phase 2 默认开发授权：

| ID | Public outcome | 独立 authority |
| --- | --- | --- |
| `PUB-01` | 单个 Package owner独立推进 GHCR `latest-stable`；shared snapshot不变时普通更新只发现该 Package。 | 对应 Package owner的 protected publication route。 |
| `REL-01` | App Stable -> GitHub Latest -> updater readback。 | Stable release owner和 protected publisher。 |
| `REL-02` | WebUI exact digest -> `:stable` -> anonymous pull/run readback。 | WebUI distribution owner和 protected promotion。 |

`PUB-01`、`REL-01`、`REL-02` 可以独立完成，也不能被 docs或代码测试冒充。它们
未执行时不否定已通过的 core migration outcomes；core migration通过也不能声称
这些 public outcomes完成。

## Phase 2 Frozen Work Packages

Phase 2 执行最多保持四条开发 lane。这里冻结行为、owner、bounded surfaces、依赖、
验收和删除目标，不预先列出易漂移的源码路径。

每个工作包启动时必须：

1. fresh fetch对应 repo `main`，确认 canonical authority和当前唯一 writer；
2. 用结构调用链与字面检索冻结本包 sorted exact write set；
3. 证明与其他 active write sets交集为零，或明确串行 owner；
4. 在独立 worktree实现，`unexpected=0`；
5. producer先进入 canonical main并 readback，consumer才可吸收；
6. 每个 legacy family满足门禁后立即删除并复验，不积累到最后一次大删除。

### `W1` Official Profile Consumers

- Owner: App install/profile lane。
- Current state: one-shot consumer 已 canonical，只接受 `first_install` 与
  `explicit_restore`，不保存持续 desired state，也不注册 startup maintenance。
- Bounded surfaces: Official Profile intent、first-run/Restore、Standard/Full consumer、
  installed-only maintenance policy和其 focused contracts/tests。
- Dependencies: 可独立开始；required closure live proof依赖 `W3`，installed-only
  maintenance终态依赖 `W3` aggregate。
- Acceptance: `OUT-01`、`OUT-07`；`OUT-02` 的 App入口部分。
- Delete: Standard/Full第二清单、fixed count、把 `--skip-packages` 作为普通安装默认
  绕过 Profile收敛的路径。开发测试专用 flag若保留，不得进入普通用户语义。
- Forbidden: 持续 desired-state controller、启动时自动恢复已卸载 roots、把 Full
  变成第二生态 profile。

### `W2` Owner Currentness Verification And Legacy Exit

- Owner: Framework Package source lane。
- Current state: owner publication locator、per-Package `latest-stable`读取、MAS required
  local selection、shared-latest verifier retirement和 invocation catalog/cache consumer-zero
  已 canonical；普通 invocation 不读取 owner channel，也不使用 cache/LKG 伪造 current。
- Bounded surfaces: fresh trace shared snapshot/catalog/cache/activation consumers；只有
  确认显式 maintenance 或其他 retained consumer仍读取旧 source时才冻结最窄迁移
  写集。cache只能是 package-scoped、bounded、non-authoritative observed-source cache。
- Dependencies: 无；verify可与 `W1`、`W5`并行。
- Acceptance: owner source failure保持 unknown/attention；shared request=0；`OUT-05` 的
  target discovery基础不回退；`PUB-01` 另行授权和执行。
- Delete: shared Release Set作为普通 currentness、跨 Package planner/currentness和
  cache/LKG authority。
- Forbidden: 新 repository-index product、version/ABI solver、family cohort、cache
  决定 currentness。fresh source失败必须 `unknown/attention`，不能由缓存伪造 current。

### `W3` Presence, Actions, And Neutral Carrier

- Owner: Framework Package lifecycle/read-model lane；在 `W2` canonical后开始。
- Current state: fresh carrier presence/callability/status/actions projection、directory-derived
  App-state和 installed-only invocation 已 canonical。Invocation 保留 scope materialization、
  use receipt和 lifecycle mutex，但只绑定 installed snapshot：
  `source_selection=installed_package_lock`、`network_accessed=false`、
  `remote_dependency_policy=forbidden`。远端 refresh/update和 invocation LKG fallback
  已删除；mutex争用 fail closed，显式 Package update仍是推进 generation的唯一入口。
- Bounded surfaces: required presence closure、package-local install/update/remove、
  complete-runtime readback、configured route readiness、compact list/status、lazy
  owner diagnostics和一个真实 Git/local neutral adapter proof。
- Dependencies: `W2` canonical。与 Framework Runtime join共享写集时短时串行。
- Acceptance: `OUT-02`、`OUT-03`、`OUT-05`、`OUT-06`、`OUT-14` 至 `OUT-17`。
- Delete: resolver admission、installed lock/payload/materializer、lifecycle receipt
  ledger、LKG/rollback manager、全局 repair/apply gate和普通 status中的 receipt历史。
- Forbidden: 明示更新 MAS却选择其他 roots；Plugin-only报告完整 Package installed；
  mock/synthetic carrier替代真实 neutral install/readback；新 durable transaction。

### `W4` Dynamic Settings And Home

- Owner: App product contract consumer -> Shell renderer consumer。
- Current state: `opl-app-contributions.v1` 的 closed declarative contract、Framework
  directory/App-state projection、Shell fail-closed parser/resolver 和 Relay 首个 descriptor
  已形成 owner-bound source checkpoint；尚未 canonical，也没有 production navigation
  caller、标准 view renderer、Relay data/action bridge、Pixel、Install 或 Release 证明。
- Bounded surfaces: generic Package/capability rows、projected actions、Home shortcut
  preference、App-owned Restore intent和局部 unavailable体验。
- Dependencies: `W3` Framework projection canonical；Restore还依赖 `W1` App intent
  canonical。App producer先于 Shell consumer。
- Acceptance: `OUT-04`、`OUT-06`、`OUT-07`、`OUT-08`。
- Delete: App/Shell固定 Package/Agent/Skill metadata、action whitelist、manifest/
  lock/receipt parser、assistant/starter第二清单和 legacy fallback。fallback只在 fresh
  hit count归零后删除。
- Forbidden: App按 Package id分支、Shell推断 installed/readiness、把 Restore放进
  Framework单包 lifecycle authority。

### `W5` Dynamic Agent Runtime Producers

- Owner order: Package owner descriptor/task/view -> Framework Runtime join。
- Current state: Framework descriptor discovery、dynamic Agent catalog、generic task/view
  projection和 bounded lazy owner-view read 已 canonical；owner payload保持 opaque，Temporal
  仍只按通用 execution scope join。
- Bounded surfaces: Agent task inventory/lifecycle、opaque Temporal ref、generic task/
  view envelope、Framework discovery/join/validation和 unknown-view handling。
- Dependencies: Package owner producer先 canonical；Framework只消费 canonical owner
  contract。可与 `W1`、`W2`并行。
- Acceptance: `OUT-09`、`OUT-10`、`OUT-11`、`OUT-12` 的 producer/read-model部分。
- Delete: Framework固定 Agent membership、领域 schema、MAS research-roadmap mirror
  和把 Temporal execution当 business status的逻辑。
- Forbidden: synthetic Agent进入公共 owner repo/GHCR。synthetic只允许隔离 fixture/
  test namespace；MAS真实 descriptor由 MAS owner canonical。

### `W6` Dynamic Runtime Consumers

- Owner order: App Runtime contract -> Shell Runtime renderer。
- Current state: App Runtime core route、dynamic Agent scope、generic typed-view contract和
  unknown-view局部降级已 canonical；Shell consumer/live installed acceptance仍开放。
- Bounded surfaces: Runtime core route、dynamic installed Agent scope、generic task/detail/
  view renderer、optional rich renderer extension和 local fallback。
- Dependencies: `W5` Framework projection canonical。若与 `W4`共享 App/Shell写集，
  candidate可并行审计，实际 source writer和 main CAS串行。
- Acceptance: `OUT-04`、`OUT-09` 至 `OUT-12`。
- Delete: `X0-01` optional gate、固定 scope/availability、Agent-id renderer和 App/Shell
  领域 schema mirror。
- Forbidden: App拥有 Agent task truth、Shell实现 scheduler、未知 view导致整个 Runtime
  或其他 Agent失效。

### Entry And Regression Checks

以下是检查，不是第七/第八工作包：

- `E1` fresh验证已 canonical Official Profile policy；若发现 contract drift，先回报
  exact failure再决定是否扩 `W1`，不能假设旧候选仍适用。
- `E2` fresh复用现有 compact list/status和 lazy diagnostics；只补 `W3` 实际缺口，
  不另建第二 read model。
- `E3` 对每个 Package/publication/installer/release proof使用隔离环境；真实用户
  home/state和 public namespace默认禁止 mutation。

## Parallel Execution And Canonical Order

```text
Phase 2 execution
  |
  +-- Lane 1 App Profile:       E1 -> W1
  |
  +-- Lane 2 Framework Package: W2 -> W3
  |                                |
  |                                +-> W4 App -> W4 Shell
  |
  +-- Lane 3 Runtime Producer: Package owner -> W5 Framework
  |                                            |
  |                                            +-> W6 App -> W6 Shell
  |
  +-- Lane 4 Read-only QA:      inventories, controls, proof preparation
```

并行只适用于独立 worktree和零交叉候选。以下必须串行：

- producer authority canonical -> consumer absorption；
- 同 repo/module的 source write set；
- 每个 repo的 `main` CAS和最终 readback；
- 真实 lifecycle/public mutation；
- legacy writer停止、删除和同 outcome复验。

`W1` 不需要等待全部 Framework/Runtime工作；`W5` Package owner可与 `W2`并行。
只有真实 dependency edge或写集交叉才增加顺序，不建立跨仓总锁。

## Per-Family Deletion Loop

旧系统不做一次性大爆炸删除。每个 family都执行同一循环：

```text
replacement producer canonical
  -> consumer switch canonical
  -> affected OUT fresh pass
  -> retained consumers = 0
  -> stop legacy writer
  -> fresh exact deletion write set
  -> delete writer + reader + schema/fixture
  -> rerun same OUT
  -> next family
```

Family顺序按依赖动态确定，默认优先：

1. fixed App/Shell Package/Agent/Skill metadata和重复 action authority；
2. shared Release Set普通 currentness和跨 Package planner；
3. version/ABI composition resolver；
4. Package lock/payload/materialization；
5. lifecycle receipt/LKG/rollback/durable intent；
6. Runtime固定 Agent scope和领域 schema mirror。

Release receipts、Release Bundle exact-byte evidence、Temporal durability、Foundry build
receipts、domain artifact/evidence receipts、用户 preference/config atomic-write保护不在
删除范围内。字面相同的 `receipt`、`lock` 或 `materialization` 不能作为机械删除依据。

## Durable Research Disposition

`OPL Package Durable 轻量架构设计` 相关，但其 production recommendation已被本计划
supersede。

保留：

- 拒绝通用 filesystem transaction、跨 Package原子事务和外部路径自动回滚；
- 单 Package失败局部化；
- mutation幂等，unknown只做 bounded fresh inspect；
- 不覆盖 drift、dirty/user-managed state、unexpected ownership或路径边界；
- 完成由真实 carrier/runtime owner fresh physical readback证明；
- 只有薄 adapter出现可复现、平台无法处理的 crash gap时才评估 adapter-local修补。

拒绝：

- Package-local durable intent、Package lock/ledger、payload generation、LKG、lifecycle
  receipt、materializer、rollback manager作为长期 authority；
- SQLite Package authority、Plan/Stage/Activate或全局 install-root mutex作为生态协议；
- 将旧 fault matrix自然转成新 schema、consumer或 implementation backlog。

## Non-Goals

Phase 2 默认不包括：

- 第二个正式 executor或 executor selector；
- 新的通用 Package repository index、solver、transaction或rollback engine；
- Package GHCR/tag/publication、Stable/Latest、WebUI promotion；
- Full、Homebrew、Native WebUI或universal installer的独立 delivery实现；
- 真实用户 managed state repair；
- Foundry、Temporal、release或domain evidence系统的合法 durability删除；
- 与本迁移无关的 GUI、release、storage、Windows或upstream refactor。

独立 Stable主路径继续由 release owner负责：使用当时 fresh canonical refs执行现有
Standard operation，再消费该 Standard合法产物进入 protected publication。过期
checkpoint、旧 run、candidate或测试结果都不能冒充完成。successor-control只在主路径
fresh重现不可恢复 deadline机制失败且用户另行授权后评估。

## Validation And Completion

每个工作包至少完成：

- sorted exact write set和`unexpected=0`；
- repo-native focused tests、type/structure gates和`git diff --check`；
- producer/consumer canonical order；
- local/origin/wire/API/tree/blob/raw readback；
- affected `OUT-*` 的隔离真实 readback；
- 删除前后 consumer-zero和同 outcome复验；
- task worktree/branch/process/lock清理。

Phase 2完成报告必须分别列出：

1. Core development outcomes `OUT-01..OUT-17`；
2. Package publication outcome `PUB-01`；
3. Production delivery outcomes `REL-01/REL-02`；
4. 每个 legacy family删除或仍保留的 exact理由；
5. 未执行的独立 public mutations。

任何未完成项必须保持 open，不得用相邻测试或其他 owner结果替代。

## Estimated Delivery Shape

在用户批准全部六包、没有新的 authority冲突时：

| Window | 并行重点 | 串行收口 |
| --- | --- | --- |
| Day 1-2 | `W1`、`W2`、`W5` owner producer并行；`E1-E3`只读准备。 | `W2`先进入 Framework canonical；Package owner producer先于 Framework consumer。 |
| Day 2-4 | `W3`、`W4` App contract、`W5` Framework join。 | Framework Package plane内部串行；App/Shell consumer只读 canonical producer。 |
| Day 4-7 | `W4` Shell、`W6` App/Shell、逐 family删除。 | 同仓 writer/main CAS、live proof和每族删除复验串行。 |
| Day 7-12 | Core OUT终态、跨仓 readback、残留删除。 | `PUB/REL`只有另行授权才执行，不反向阻塞已完成 core outcomes。 |

这是基于当前范围的工程估算，不是发布日期承诺。新增跨层架构、第二 executor或public
delivery范围必须另行评估，不能隐式扩入 Phase 2。
