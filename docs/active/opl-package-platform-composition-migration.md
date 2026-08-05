# OPL Package 平台组合迁移计划

Owner: `one-person-lab-app` for the cross-repository product plan. Each
implementation package below names its producer and consumer owners.
State: `controlled_breaking_cutover_in_progress`
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
- **Phase 2 - controlled breaking cutover**：已获用户批准并执行中。先让 successor
  Package plane 形成可验证、可回退的真实纵向链路，再切换 production caller，最后在
  受控批次中移除 legacy Manager。逐字段、逐 family retirement 不再是实施主路径。

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
`next_action=按 M1-M4 完成 successor cutover、consumer switch、OUT01-17 和 bulk delete`。

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
10. 切换顺序固定为：先让 successor 纵向链路可验证、可回退，再切换 caller并在新路径
    补强，最后按 structural caller、build 和 affected OUT 证明批量删除旧实现；只有平台
    确有缺口时才增加最薄 adapter。
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

当前主线已具备 owner currentness、installed descriptor动态发现、configured carrier动作和
通用 projection 的大部分基础，但公共动作仍可能回落旧 lock、payload、materializer、
receipt、rollback或transaction。Phase 2 先闭合 successor-only纵向链路，再切换 App/Shell
caller并执行受影响 OUT，最后一次性移除旧 Manager生产 reader/writer。

| Surface | Current classification | 仍缺什么 |
| --- | --- | --- |
| App Official Profile policy | `canonical_partial`：单一 Profile、presence-only、Standard/Full 同 roots、persistent uninstall policy、data-driven roots 和只接受 first-install/explicit-Restore 的 one-shot consumer 已进入主线。 | 将 consumer 接入真实 first-install/Restore 入口，并完成跨重启不回装及 Standard/Full clean-install proof。 |
| App Package UX | `canonical_partial`：App contracts 已把 directory/presence/actions 设为 Settings/Home authority，Framework App-state 已从 fresh Package directory 派生状态。 | Shell/Home 端到端消费、真实未知 Package proof，以及固定 starter/assistant metadata、receipt/lock/physical detail parser 的 consumer-zero 删除。 |
| Role-neutral App contributions v1 | `owner_bound_source_checkpoint`：App 合同、Framework directory/App-state 投影、Shell parser/resolver 和 Relay 首个 descriptor 已在各自 task branch 收敛，且不按 `package_role` 或 executor 过滤。 | 仍须按 producer-before-consumer 顺序吸收 canonical，接入真实 navigation mount/标准 view renderer、Relay data/action bridge、invalid-package isolation，并分别完成 Pixel、Install、Apple Mail review path 和 Release proof。 |
| Framework Package plane | `canonical_partial_successor`：owner-channel `latest-stable` currentness、installed descriptor动态发现、configured carrier动作、fresh presence/App-state projection和 installed-only invocation 已进入主线。 | 让所有普通 install/update/remove/repair/enable/disable/list/status只走 successor facade，移除 lock/Full snapshot/managed-update/scope-transaction runtime fallback。 |
| Package publication | `canonical_policy_partial`：一方 Package 使用独立 GHCR repository 和 owner `latest-stable`；普通 target discovery 已有 owner-channel实现。 | 不是所有 owner latest 都有 fresh publication proof；shared snapshot和显式 maintenance 的旧 catalog/cache retained consumers仍须清零。 |
| Shell Package consumption | `canonical_partial`：Capabilities 已消费动态 directory 和 exact carrier identity，App contracts 已删除固定 directory authority。 | Home/Settings全路径、generic actions和显式 uninstall preference闭环；consumer必须切到 successor projection，而非等待旧 family逐项退役。 |
| Runtime | `canonical_partial`：Framework 已从 installed Agent descriptor 动态发现 task/view producer，App Runtime 已升级为 core generic Agent scope和 typed-view contract。 | Shell 端到端 generic consumer、真实 owner descriptor/live installed proof，以及剩余固定 Agent/MAS compatibility consumer 删除。 |
| Durable Package proposal | `superseded_research`：正确拒绝大型 filesystem transaction 和跨 Package 原子性。 | 其小 intent/lock/receipt authority 仍是假设自研 Package Manager，不进入目标实现。 |

机器合同和 source 中仍出现 version、lock、payload、receipt 或 materialization，不代表
目标反悔，也不能被新 consumer 深化。它们只允许作为 compatibility-to-delete；M1/M2
canonical、production caller完成切换且受影响 OUT green 后，在 M4 受控批次中删除。

## Sealed Evidence And Non-Authority

下表只防止丢失已知学习，不是实现 inventory、write authorization 或 completion：

| Surface | Classification | Phase 2 disposition |
| --- | --- | --- |
| Framework per-owner currentness / MAS local closure | `canonical_incremental`：owner-channel currentness、MAS + ScholarSkills required selection、shared request/other-root exclusion、fresh presence projection和 installed-only invocation 已进入 Framework主线；这不等于 successor-only公共动作已经闭合。 | 不重做已 canonical能力；M1直接切换仍命中 SemVer/ABI/lock/payload/receipt 的普通 maintenance caller。 |
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
| `OUT-13` | 维护成本实质下降。 | Native lifecycle + thin adapters + one projection。 | M1/M2 canonical、production caller=0、affected OUT green 后批量删除旧 writer/reader/schema/fixture；最终无备用 Package Manager写路径。 |
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

## Controlled Cutover Work Packages

Phase 2 保持一个 Package canonical integrator，并按独立 repo、write set 和资源边界展开
四类 lane。依赖只限制最终吸收顺序；共享 `main` CAS、真实 installed/public mutation 和
heavy aggregate 使用短时唯一 baton。

每条 lane 启动时必须 fresh fetch canonical `main`，登记 owner、execution owner、exact
write set、可立即执行的 next action、remote recoverable checkpoint、acceptance 和 integration
boundary。独立 worktree可并行准备；consumer在吸收前必须按 fresh producer contract做
semantic replay。不能独立交付的等待 lane必须并回 integrator，不能保留假 ACTIVE。

### `M1` Successor-Only Public Actions

- Owner: 唯一 Framework Package source/canonical integrator。
- Scope: installed descriptor动态发现、owner OCI `latest-stable`、configured/native carrier
  `install|update|remove|repair|enable|disable`、fresh physical installed/callable/status/actions
  readback和公共 facade。
- Acceptance: explicit root与update-all都不读取shared snapshot作为ordinary currentness；
  普通 list/status不以legacy lock伪造installed；native动作不可用时fail closed，不回落旧
  Manager。覆盖`OUT-02`、`OUT-03`、`OUT-05`、`OUT-06`、`OUT-14..17`。
- Five roots: MAS、MAG、RCA、OMA、OBF是五个同级first-party Agent/package roots；
  `mas-scholar-skills`只作为MAS required closure，不是第六个root。

### `M2` App/Shell Consumers And Preferences

- Owner order: App contract/intent owner -> Shell renderer/action consumer。
- Scope: dynamic directory、presence、status、actions、Agent task、typed view、Home shortcut
  visibility/order，以及无法从fresh carrier重建的显式uninstall intent。
- Acceptance: unknown Package无需App id分支即可进入Settings/Home/Runtime；用户卸载后普通
  启动、日更、App更新不回装；只有显式Restore恢复。覆盖`OUT-01`、`OUT-04`、`OUT-06..12`。
- Forbidden: 迁移可从carrier重建的lock、receipt、payload、generation或物理路径；App/Shell
  不解析carrier私有状态，也不成为第二lifecycle writer。

### `M3` OUT01-17 And Real Carrier Acceptance

- Owner: 独立test/acceptance lanes可并行准备，唯一 integrator串行真实 installed/public
  mutation与heavy aggregate。
- Scope: install/update/remove/repair/enable/disable、unknown Package、Home、Runtime、
  failure isolation、Standard/Full five-root parity和隔离fresh carrier readback。
- Acceptance: `OUT-01..OUT-17`逐项回读；发现缺口只修successor plane，不为通过测试恢复
  legacy fallback。publication与release仍按独立authority分账，source/test不能冒充生效。

### `M4` Legacy Bulk Deletion And Parity

- Entry gate: M1/M2 canonical；所有production callers已切换；structural call graph、
  TypeScript/build和exact literal guard证明旧入口caller=0；受影响OUT在删除前green。
- Scope: 一次删除中央registry/resolver/lock/payload/materializer/activation/LKG/receipt/
  rollback/transaction的生产reader、writer、schema和fixture，然后复跑同一affected OUT。
- Exclusions: Release receipts、Release Bundle exact-byte evidence、Temporal durability、
  Foundry/domain evidence、用户preference/config atomic-write保护不得删除。
- Terminal: Framework/App/Shell canonical parity、fresh carrier readback、task-owned
  worktree/ref/process/receipt清理全部闭合。

## Parallel Execution And Canonical Order

```text
M1 Framework successor facade ----------------------+
                                                     +--> M3 OUT01-17
M2 App contract -> Shell consumer + preference -----+          |
                                                                v
M4 deletion patch/call-graph preparation ----------------> bulk delete
```

`parallel_work_serialized_integration`允许独立worktree/write set并行；write-set overlap只影响
fresh-main replay顺序。producer authority必须先于consumer canonical absorption；每个repo的
`main` CAS、真实installed/public mutation、legacy writer停用和唯一heavy aggregate必须串行。
回滚使用canonical Git revert、上一版immutable artifact和受控安装回退；新runtime不得保留
legacy dual-write、automatic fallback或私有rollback state machine。

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

每个里程碑至少完成：

- sorted exact write set和`unexpected=0`；
- repo-native focused tests、type/structure gates和`git diff --check`；
- producer/consumer canonical order；
- local/origin/wire/API/tree/blob/raw readback；
- affected `OUT-*` 的隔离真实 readback；
- M4删除前后的structural caller/build证明和同一affected OUT复验；
- task worktree/branch/process/lock清理。

Phase 2完成报告必须分别列出：

1. Core development outcomes `OUT-01..OUT-17`；
2. Package publication outcome `PUB-01`；
3. Production delivery outcomes `REL-01/REL-02`；
4. legacy bulk-delete清单、production caller=0和明确排除的合法durability；
5. 未执行的独立 public mutations。

任何未完成项必须保持 open，不得用相邻测试或其他 owner结果替代。

## Estimated Delivery Shape

在没有新的authority冲突且本地/hosted资源可用时：

| Window | 并行重点 | 串行收口 |
| --- | --- | --- |
| M1 | Framework successor-only公共动作与fresh readback。 | 单一Framework source/canonical integrator；预计1-2工程日。 |
| M2 | App/Shell consumer与preference迁移可跨仓准备。 | producer先canonical，consumer按fresh contract replay；预计1-3工程日。 |
| M3 | OUT01-17、five-root和真实carrier验收。 | heavy aggregate与installed/public mutation唯一baton；预计1-2工程日，不含外部发布排队。 |
| M4 | caller-zero证明、bulk delete、删除后复验与三仓parity。 | legacy writer停用和canonical吸收串行；预计2-4工程日。 |

最快可用版本以M1+必要M2 consumer+关键OUT通过为准，目标2-4工程日；完整M4终态目标
5-10工程日。估算不是发布日期承诺，外部publication/install只在其唯一authority下执行，
不得反向阻塞可独立完成的source cutover。
