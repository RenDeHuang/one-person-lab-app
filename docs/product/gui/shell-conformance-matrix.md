# OPL App GUI Shell Conformance Matrix

Owner: `one-person-lab-app`
Purpose: `app_gui_shell_conformance_read_model`
State: `active_read_model`
Currentness rule: contract/source status must be refreshed from current owner contracts,
adapter/candidate source and repo-native validators; exact-cohort pixel evidence keeps its
own dates and hashes, while Pixel/Install/Release status requires fresh owner readback.
Machine boundary: 本文是人读 read model，不是第二真相源。状态必须能回指 App
contracts、adapter/candidate contracts、shell source/tests 或 fresh evidence；本文不能
改变 product truth、active shell、candidate stage 或 release readiness。

设计体系入口见 [`README.md`](README.md)，实现方法见
[`shell-implementation-guide.md`](shell-implementation-guide.md)。

## 读法

状态必须独立读取 contract、source、pixel、install 与 release，不能用任一轴替代另一轴：

| Axis | Status | 含义 |
| --- | --- | --- |
| `contract_status` | `aligned_contract` | App target 与当前 carrier contract 一致；不表示源码已实现。 |
| `contract_status` | `current_contract_deviation` | 当前 machine contract 与理想目标不同。 |
| `contract_status` | `candidate_target` | 只属于候选 contract；不能推导 active-shell adoption。 |
| `contract_status` | `not_claimed` | 当前 contract set 不作该项声明。 |
| `source_status` | `source_implemented` | Fresh source/tests 能证明主要行为已实现。 |
| `source_status` | `source_partial` | 已有实现，但缺行为、数据接入、状态或与目标存在已知漂移。 |
| `source_status` | `source_missing` | Fresh source audit 未找到要求的实现。 |
| `source_status` | `source_not_assessed` | 当前 owner readback 尚不足以分类 source。 |
| `pixel_status` | `pixel_verified` | 有绑定当前 source/package 的 fresh 可见像素证据；不表示视觉 parity。 |
| `pixel_status` | `pixel_unverified` | 没有足够的当前像素证据。 |
| `pixel_status` | `pixel_blocked` | 已尝试当前视觉验证，但被明确启动/环境断点阻断。 |
| `pixel_status` | `not_applicable` | 该项是 authority/transport/release-role 等非像素结论。 |
| `install_status` | `install_verified` | 有 exact source/package binding 和安装后 readback；不表示 release promotion。 |
| `install_status` | `install_unverified` | 没有绑定当前 exact source 的安装/readback 证据。 |
| `install_status` | `install_blocked` | 已尝试安装验收，但被明确环境或授权断点阻断。 |
| `release_status` | `release_verified` | 有 owner-approved release、公开 artifact 与安装/运行 readback。 |
| `release_status` | `release_unverified` | 没有该功能绑定当前 release cohort 的完整证据。 |
| `release_status` | `release_blocked` | release owner 已记录明确 terminal blocker。 |

`pixel_verified` 可以与 `source_partial` 同时出现。它只证明画面非空且对应路径被实际
打开，不能证明元素位置、交互、视觉一致、package/VM acceptance 或 release-ready。

默认实施与关单顺序是 `Contract -> Source -> Pixel -> Install -> Release`：先确认
carrier-neutral B0/R1/U1/X0 目标和 carrier contract，再落 source/behavior，随后绑定 exact
source/package 的 pixels、安装后 readback 和 release-owner cohort。各 lane 可以并行准备，但后轴
不能回填前轴，前轴通过也不能外推后轴；任何摘要都必须保留五轴原状态。

Renderer replacement 另有一个前置 compatibility/admission 轴：App wrapper 必须在启动命令前
验证 Host-derived graph、App allowlist、Contribution ABI、typed slots/actions、RPC/events 和
state semantics。当前 AionUI 是 `admitted_current_active_shell`；Studio 仍是
`candidate_validation_only_not_active_shell_admitted`。通过该轴只允许显式选择并启动相应 adapter，
不能回填 Pixel、Install、Release，也不等于运行中无验证热切换。

R1/U1 功能实现程度不得再用 `2/4`、`3/4` 等单一分数表示；这种写法会把 contract、source、
pixel、install 和 release 混成一个不可审计结论。需要功能摘要时仍逐轴报告，不能把
`source_implemented` 外推为 installed 或 released。

## B0-11 Codex subagent 证据

`B0-11` 不进入 R1/U1 12 项矩阵，但必须按相同证据纪律读取。AionUI Team 是独立的
upstream collaboration surface；ordinary App 关闭 Team 与 Codex subagent 是否存在没有因果关系。

| Evidence axis | Current read | Evidence boundary |
| --- | --- | --- |
| App contract | `aligned_contract` | B0 inventory 要求展示真实 delegated execution，禁止第二编排 authority；Team 继续按 ordinary surface policy 关闭。 |
| Codex runtime / execution | `source_implemented` | Fresh Codex app-server schema readback包含 `spawnAgent`、`collabAgentToolCall`、`subAgentActivity` 与 `parentThreadId`；具体 CLI 版本不在本文冻结。Schema readback不替代 App UI evidence。 |
| Existing App Server adapter | `source_implemented` for metadata intake | Shell adapter 接受 `subAgent`、`subAgentReview`、`subAgentCompact`、`subAgentThreadSpawn` 与 `subAgentOther` source kinds，并投影 `parentThreadId`、`agentRole`、`agentNickname`。 |
| Canonical discovery / generic tool display | `source_implemented` | Canonical thread discovery 与基本 generic tool display 已有 source。真实 delegated-turn fixture 与 ordinary Active/Done/detail/open-thread UI 的缺口单独记在下一行，不能反向降级 discovery source。 |
| Codex App-style activity UI | `source_implemented` | AionUI 从现有 ACP tool-call 的 `_meta.codex.collaboration` / `_meta.codex.subagent` 读取真实 delegated-turn metadata shape，按 canonical child thread 去重为 read-only Active/Done，展示 prompt/update/result/model/reasoning/path/thread id，并通过既有 App Server adapter 复用或按需 materialize canonical task。未知 metadata 回退 generic tool row；打开失败保留当前对话且可重试。没有第二 client、Team store、scheduler、Shell execution authority 或 bespoke direct-control button。 |
| Pixel | `pixel_unverified` | Unit fixture、schema inspection、docs 或 source test 不能关闭像素轴。 |
| Install | `install_unverified` | 没有绑定该 UI 的 exact installed readback。 |
| Release | `release_unverified` | 没有绑定该功能的 release-owner cohort evidence。 |

禁止为 B0-11 新建第二 App Server client、Team store、scheduler、独立 coordination page 或
shell-owned subagent execution path。若现有 adapter 能表达真实 fixture，就只补显示；若不能，
也只允许最小 metadata extension，并保持 Codex runtime authority。

### 其它 fresh B0 source readback

| ID | Contract | Source | Pixel | Install | Release | 当前最小缺口 |
| --- | --- | --- | --- | --- | --- | --- |
| `B0-08` Review | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 四类 target、inline/detached、PR context、stage/commit/push、Last turn/custom 与 truthful unavailable 已有 source。Line-level comment 和 non-custom focus 是可选 protocol limit，不降级 baseline，也不授权 local annotation store。 |
| `B0-12` Scheduled Tasks | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | AionUI 复用单一 carrier scheduler/store，已挂载 ordinary Sider entry/section；create/edit 从 generated enabled Codex identity 解析 exact `Assistant.id`，missing/ambiguous discovery 只局部阻止写入，并保留 legacy non-Codex executor identity。 |
| `B0-13` Personalization / instructions | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | Agents & Capabilities > Instructions 复用 Workspace personalization carrier；AGENTS/action routes 与可选用户附加说明已形成 baseline source，不生成 Agent route/base-context fallback，下一步只走独立 Pixel/Install/Release。 |
| `B0-14` Settings shell / accessibility | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 既有 focused suites 覆盖 keyboard、focus、ARIA、Escape/focus restore、Settings search focus 与 reduced motion；semantic token regression 锁定 light/dark muted text `4.5:1` 和 focus indicator `3:1` 基线。真实 screen-reader、完整 rendered keyboard traversal、rendered contrast 与 installed readback 仍按后轴独立验收。 |

当前 B0 source classification为 `B0-08/B0-11/B0-12/B0-13/B0-14 source_implemented`。
B0-11 的 execution、metadata intake、canonical discovery 与 ordinary activity UI 都已有 source
和 focused tests；Pixel、Install、Release 仍是独立未验证轴。其它 B0 不在本表汇总，不能从
该 slice外推完整 B0完成度。

## R1 / U1 必要功能实现矩阵

本表只维护 OPL 必须自维护的 12 项。功能定义对 AionUI 与 Native 完全相同，五个状态轴
逐列独立记录。当前 12 项的 Pixel、Install、Release 都未验证：已有截图、安装包或测试没有
逐功能同时绑定 exact source、安装 readback 与 release promotion，不能互相回填或外推完成。

| ID | 功能与为什么必要 | Contract | AionUI 承载方式 | AionUI Source | AionUI Pixel | AionUI Install | AionUI Release | Native Source | Native Pixel | Native Install | Native Release | 当前最小缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R1-01` | Gateway 身份。OPL 必须管理自己的智能体账号，同时保留既有 Codex/API Key。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | Native 补 typed login、refresh、disconnect；WebUI 账号登录复用现有 runtime HTTP proxy。 |
| `R1-02` | Gateway 模型 entitlement、余额、Token 和成本。没有真实访问与消耗信息就无法做模型选择。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | Native 补余额、今日/累计 Token、actual cost、managed key 和 freshness。 |
| `R1-03` | 非阻断 OPL Core setup。OPL 多了环境准备，但首启不能变成长时间 blocker。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_missing` | `pixel_unverified` | `install_unverified` | `release_unverified` | Native 实现可恢复、尽量非阻断的 Core setup；只局部 gate 确认的身份/安全/核心执行器失败。 |
| `R1-04` | Agents / Capabilities IA。用户按智能体和能力理解 OPL，而不是理解底层 Plugins/Skills 打包。 | `aligned_contract` | `upstream reuse + L1 profile + L3 composition` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | Native 补独立 owner routes/registry；AionUI 底层复用 SkillsHub 不算缺口。 |
| `R1-05` | OPL Control Center owner routes。多 authority 必须有统一、可发现且不复制 truth 的入口。 | `aligned_contract` | `upstream reuse + L1 profile + L2/L3` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | Native 消费 registry、redirect 和 anchor，不停留在 shell-local localStorage。 |
| `R1-06` | OPL bundle、update、deep link、feedback/support。安装、唤起、更新和求助必须是同一产品。 | `aligned_contract` | `L1 profile + L2 bridge/adapter` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | AionUI 已迁移为单一 `opl://navigate?route=...`，只允许 App-owned exact route；cold argv、second-instance、macOS `open-url` 共用校验路径，renderer ready 后 pull pending payload。credential action、额外/重复参数、encoded payload 与 secret-like value 均局部拒绝并只记录 reason code；Pixel/Install/Release 不回填，Native 仍需正式 updater/deep-link/support。 |
| `U1-01` | Agent Package 目录与 lifecycle。这是“调用和管理自己的智能体账号/包”的核心。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | Native 从 preview/dry-run 补到真实 lifecycle 与 readback。 |
| `U1-02` | Purpose/Starter 与 active context。用户应从目标直接进入专业 Agent。 | `aligned_contract` | `L1 profile + L3 composition` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | Native 把 prompt/dry-run 接到 package-backed launch 和 active binding。 |
| `U1-03` | 弹性 Agent 启动适配 / JIT prepare。AI-first 交互不能因普遍 preflight 动辄全局 block。 | `aligned_contract` | `L2 bridge/adapter` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_missing` | `pixel_unverified` | `install_unverified` | `release_unverified` | AionUI 已消费 owner-projected action 和 `ready / degraded / package_unavailable` 三态，移除 `operational_ready=false` 二次一刀切与普遍 Workspace 要求；仍需绑定当前 source 的逐轴证据。 |
| `U1-04` | App / OPL Base / Packages 三对象 lifecycle。三类 owner 不同，混成一个 updater 会产生假成功。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | AionUI 已按 `opl_base / opl_app / opl_packages` 区分 owner，并覆盖 check/plan/apply/terminal readback、retry 与 failed-apply no-checkpoint；下一步只关三对象各自 Pixel、Install、Release，不反向降级 Source。 |
| `U1-05` | Docker/WebUI 同产品语义。WebUI 是 OPL 的部署入口，不能成为另一个产品。 | `aligned_contract` | `upstream reuse + L2 transport adapter` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | AionUI Web Storage 使用同一 `/settings/storage` route；Desktop 保留 Electron local lifecycle，WebUI 不调用该 bridge，只消费有效 owner projections并在 refresh 单项失败时 fail-open。浏览器态 DOM 与 Web host SPA fallback 已锁测；exact Docker cohort、Pixel、Install、Release 仍独立未验证。 |
| `U1-06` | OPL 数据、缓存、包体空间与安全清理。长期使用必须可预览、可确认、可恢复。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | `source_missing` | `pixel_unverified` | `install_unverified` | Framework 已投影 owner inventory；Web host 已实现认证且有界的 capability/plan/execute/restore、单次确认、opaque archive/manifest/receipt refs、幂等终态回读或 typed conflict 及恢复；薄 Shell/Web consumer 在 owner 或 host capability 缺失时保持 fail-open。Package lifecycle 仍在 Agents，Shell 不得直接改 raw package/path state 或调用 generic prune。 |

微信/频道接入不作为 AionUI 私有功能复制到 Native。两端共享 App-owned `channel_access` 标准 view
和目标 `app_state.transport_bindings` ABI：provider 缺失时不显示占位，Studio 不得推断或写入绑定。
当前 producer callback 尚未完成；AionUI 的 workspace inference 与 SQLite write 仍是有界 legacy
fallback，只有 Framework 当前 binding 不可用时才运行，且不得把该现态外推为 Studio 的实现要求。
因此本次只关闭 Contract 轴；两端 Source/Pixel/Install/Release 仍须由各 owner 的 fresh evidence 独立更新。

Source 状态说明：AionUI `R1-01..06`、`U1-01..06` 均为 `source_implemented`。Native 的 `R1-03`、
`U1-03`、`U1-06` 为 `source_missing`，其余为 `source_partial`。这里的 `source_implemented`
只证明主要源码路径和专项测试存在，不等于后续 fresh test pass，更不等于 pixels、install 或 release。
Native 状态只用于不定期手动技术评估和选定实验的差距判断，不构成主线 backlog、parity
计划、排期、release blocker 或必须清零的完成义务。

下一轮顺序由 Active Truth 的 P0-P7 five-axis ledger 统一维护。U1-04 与 AionUI U1-06
已关闭 source 轴；任何实现顺序都不能把不同状态压成一个 aggregate completion 值。

本矩阵的功能/交互目标来自：

- `contracts/app-gui-product-contract.json`
- `contracts/app-product-profile.json`
- `contracts/app-page-state-matrix.json`
- [`feature-inventory.md`](feature-inventory.md)
- [`ideal-interaction-spec.md`](ideal-interaction-spec.md)
- [`visual-system.md`](visual-system.md)

Carrier 角色和候选边界读取 active adapter、`contracts/app-shell-candidates.json` 和
`contracts/shell-adapters/opl-studio.json`。后者只描述实现/候选边界，不能
覆盖上面的 App product authority。

Active AionUI 默认状态通过 README 治理段声明的动态 state source 读取；当前值与
理想目标的差异由 `validate:gui-design-system` readback 计算，不在本文复制。

## Currentness and evidence routing

- AionUI GUI conformance ancestor：`opl-aion-shell@a0ce713b65801fd9ca7f46ad168c977c75a187de`。
  这是 `contracts/app-shell-adapter.json` 持有的最低 verified ancestor；current Shell HEAD、
  upstream version和 ancestry必须从 active checkout与 adapter validator fresh-read，不写入本文。
- Current Shell source cohort：symbolic `session_workspace_minimal_current_source_cohort`。当前
  contract/source分类由 active checkout、App contracts与 `validate:gui-design-system` /
  `validate:active-shell` 共同验证；本文不保存某轮测试计数、warning数、topic SHA或 closeout。
- Visual cohort identity、scene inventory、baseline approval与 comparator边界归
  `contracts/app-gui-visual-reference-cohort.json`。Package-bound历史像素证据继续归
  [`evidence/aionui-41301-parity-20260714/manifest.json`](evidence/aionui-41301-parity-20260714/manifest.json)
  和 [`evidence/aionui-41301/manifest.json`](evidence/aionui-41301/manifest.json)；不得改绑为
  current source或外推为 Install/Release。
- OPL Studio candidate currentness从 `contracts/app-shell-candidates.json`、Studio adapter、candidate
  source/tests和显式验证入口读取；旧 smoke、package、branch或 SHA不承担 active truth。
- Pixel、Install与Release只从绑定当前 exact cohort的各自 owner evidence更新。Source/validator
  通过不能填充这三轴，旧 evidence也不能被描述为 current proof。

## 验证入口

| ID | Entry | 证明边界 |
| --- | --- | --- |
| `A1` | `bun run validate:active-shell -- --quick` | Active adapter、contracts 和 source probes 的快速结构检查。 |
| `A2` | `bun run validate:active-shell` | Active shell 完整 App-root contract validation。 |
| `C1` | `npm run validate:shell-candidates` | 只验证 active/foreground/retained/archived 固定角色，不读取 candidate detail。 |
| `N1` | `npm run test:candidate:studio` | Explicit OPL Studio candidate contract、单 App Server adapter、Codex subagent projection 与 no-private-layer 边界。 |
| `N2` | `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/opl-studio.json node --experimental-strip-types scripts/validate-active-shell.ts --quick` | Explicit native adapter contract 结构。 |
| `N3` | Candidate repo `npm run validate:candidate` 和 `npm run validate:state-model` | Candidate source 与 state-model consumption。 |
| `N4` | Candidate repo `npm run smoke:visual` | Manual/foreground visual smoke；不等于 packaged acceptance。 |
| `N5` | `npm run package:candidate:studio` | Explicit candidate package path；不改变 active release shell。 |
| `G1` | `npm run validate:candidate:agui` | AGUI archived role tombstone 与显式 replay route；不恢复 routine lane。 |
| `V1` | Route/viewport/ref-bound screenshots、pixel checks、packaged/VM evidence | 对应视觉、package 或用户路径；每层 evidence 只证明自身。 |

## Active AionUI Priority Matrix

本表是主线决策入口。先看 P0/P1，再看 P2；Settings 完成不能抵消核心工作流偏差。
X0 只记录已保留 source 的收敛债务，不进入核心完成度、默认 release gate 或 Native phase-1 parity。

| Priority | Product surface | OPL-owned target informed by verified official design observations | AionUI current implementation | Contract | Source | Pixel | Install | Release | Next decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | App frame | 左 project/conversation rail + 中央单列 timeline + 底部 composer + 右上按需 Environment details。 | Rail/timeline/composer/Environment composition 保留；默认无综合第三列。 | `aligned_contract` | `source_implemented` | `pixel_verified` | `install_unverified` | `release_unverified` | Current desktop/mobile Home与conversation package pixels覆盖主 composition；不外推为完整视觉 parity。 |
| X0-01 | Runtime cockpit | 条件保留的跨项目 Work Item projection / owner route；不是 B0/R1/U1 核心。 | Runtime V2 与入口已有 source；Framework producer 保留，AionUI route 可选，Native phase-1 不要求页面/full drilldown/capability。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 默认 product/design/release gates 已解耦；完整 route 只跑 `npm run validate:runtime-route`。历史 cohort 不回填 Pixel/Install/Release。 |
| P0 | Project hierarchy | Project affinity 为零或一；Project/directory 提供 thread 的初始 cwd、projectless 一次性 adoption、可见 metadata 与分组，不拥有 session、context 或 artifact；rail canonical history/actions 来自 App Server。 | 既有单一 App Server adapter 的 typed affinity IPC 执行一次 assignment，再以 exact `thread/read.projectId` 和 recorded cwd 不变回读；成功后才写本地 projection，失败保持 projectless，已有显式 affinity 禁止改绑。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 保持无 Git-origin/cwd affinity inference、通用重绑、writable-root mutation、pending/receipt/Handoff 层；后续只补 Pixel/Install/Release。 |
| P0 | Home / New task | 与 conversation 共用 chat canvas/composer，不是 dashboard；composer 上方独立 context bar 只设置新任务初始 cwd，`+` 不承载 workspace。 | Composer-first Home、全部用户可见 starters、stable order、responsive wrap、package readiness 与独立 context bar 已实现。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 旧 desktop/mobile pixels 绑定已被 supersede 的无 context-bar 合同，不能证明当前 target。 |
| P0 | Conversation chrome | 只显示 task identity/直接动作；model/access 留在 composer。 | Header 保留 identity/navigation/Environment/Files；model/access 不再重复挂 header/side panel。 | `aligned_contract` | `source_implemented` | `pixel_verified` | `install_unverified` | `release_unverified` | Current desktop pixels覆盖timeline、composer、Environment与Files composition；维持compact chrome。 |
| P0 | Composer | `+`、access、model/reasoning 与 send-stop 位于发送决策点；`+` 始终打开可搜索、分组、可滚动的真实能力 palette，文件/目录与可选能力分组显示。 | Resolver、draft failure restore、权限/模型控件与 composer-width capability palette 已实现；local inputs 始终可用，真实 Agent/Skill/mode/connection 分组按 adapter 与 owner/carrier projection 显示，workspace 不进入 palette。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 后续绑定 context bar、palette 展开态、搜索、空态与 desktop/mobile pixels；不恢复第二 provider/service truth。 |
| P0 | Environment details | 右上 anchored floating summary，默认关闭；只读显示 recorded workspace 与 live Git context。 | Environment 渲染真实 workspace、branch、changes 与 refs，使用 live Git inspection，不提供 cwd、locality 或 Worktree mutation；与 Files/Preview 分离。 | `aligned_contract` | `source_implemented` | `pixel_verified` | `install_unverified` | `release_unverified` | Current pixel覆盖Environment popover与Browser入口；只读边界由 focused DOM/source tests 证明。 |
| P0 | Visual grammar | 白 main、浅灰 rail、窄 reading lane、低对比、小圆角、极少页面卡片。 | Current 9场景覆盖light/dark、desktop/mobile与zh-CN/en-US；历史8场景保持原字节。 | `aligned_contract` | `source_implemented` | `pixel_verified` | `install_unverified` | `release_unverified` | 只证明指定route/layout非空且无声明溢出，不宣称1:1 parity。 |
| P1 | OPL capabilities | Purpose 优先从 Home starter 选择；new-session `+` palette 是同一 active capability 的备用入口，既有 conversation 不允许 Agent 重绑；管理进入 Settings。 | Home package shortcuts、Settings directory/visibility/lifecycle 与 palette 备用入口已实现并同步 active capability；既有 conversation 不提供 Agent 重绑。启动消费 owner-projected `ready / degraded / package_unavailable`，只在 action 明确要求时 gate Workspace；generic backend/provider/Team 未回 ordinary UI。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 后续只补 palette selection 与三态 Pixel/Install/Release 证据。 |
| P1 | Progress / approval / receipt | 进入当前 timeline；沿用 AionUI ACP 的 permission、user-input 与错误状态。 | Current-task summary 保持 timeline 单一实例，不增加跨线程 pending-request 或 delivery-audit 控制面。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 补真实 approval/user-input packaged route evidence。 |
| P1 | Artifacts / evidence | Environment 次级 refs、Preview、Files 或 turn disclosure。 | Files 与 Preview 按需且窄屏互斥；mobile Preview 使用完整可读 overlay；transcript export 已按 cursor 与脱敏合同加固。 | `aligned_contract` | `source_implemented` | `pixel_verified` | `install_unverified` | `release_unverified` | Current pixels覆盖desktop Files与mobile Preview composition；PDF/Mermaid/KaTeX内容渲染另做专项 evidence。 |
| P1 | Artifact preview adapter | 当前 session 显式 attachment、可见 conversation result 或用户选择的合法绝对本地路径薄接现有 Preview；隐式 workspace ref、traversal、非法 scheme、自动静默读取返回明确失败。 | Current Shell source复用既有 renderer/store，覆盖 projectless file access、session ref 与 absolute-path 分流。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | Current Preview pixel未证明session/absolute-path分流与非法输入；保持行为测试边界。 |
| P1 | User-triggered thread operations | Existing directory/actions 复用一个 App Server adapter执行 list/read/start/resume/fork/archive/restore；普通 conversation 继续走现有 ACP。 | 单一 production adapter 与 focused tests 已实现；旧 coordination service/page、dynamic tools、audit/idempotency、pending control plane 和 cross-host 均缺席。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 安装版覆盖 list/start/resume/fork/archive/restore 的可见路径与错误。 |
| P1 | Session Project-affinity boundary | 新任务选择初始 cwd；仅无 canonical `projectId` 且 `thread/read` 再确认缺失的 session 可一次归口；recorded cwd 不创建或阻止 affinity，turn cwd、shell `pwd`、显式输入与 writable roots 不反写 rail metadata。 | Drag/menu 通过既有 App Server adapter 先 typed assign、再 exact `projectId` 与 recorded-cwd-unchanged readback，最后提交本地 projection；失败保持 projectless，已有显式 affinity 阻止 reassignment。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 后续只做 Pixel/Install/Release；保持无第二 client/private adoption service、`workspace_handoff`、managed Worktree/Handoff 或任意 bound reassignment。 |
| P1 | Review pane | 复用 Files/Changes；四类 target、inline/detached、PR context、stage/commit/push；缺失能力显示 unavailable。 | 保留四类 `review/start` target、inline/detached、PR context、stage/commit/push、`gh` unavailable与Last turn；custom instructions只经`review/start.target.custom`。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | Line-level comment/non-custom focus 是可选 protocol limit；保持 truthful unavailable，不开发 local annotation store 或伪造成功。 |
| P2 | Settings | Secondary configuration/control surface，保持 OPL IA。 | 四类 surface 与 bounded cards 已进入 source；本次 core matrix 不复用旧 Settings pixels。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 冻结 IA，只修回归；按需要重建当前 Settings evidence。 |
| X0-03/04 | Optional external resource owner routes | Hosted Workspace、Fabric、HPC、Console 只在 canonical owner/backend projection 存在时显示 refs/route；空 projection 无 group、anchor 或占位。 | App contract/fixture/validator 与 AionUI `ResourcesSettings` 已对齐；workspace/external 分组独立条件渲染，空 projection 不挂载 group、anchor、placeholder 或 hosted promise copy。 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `install_unverified` | `release_unverified` | 保持本机浏览器、Docker/WebUI 基线独立；后续只补 exact-feature Pixel/Install/Release。 |

## Cross-shell Detail Appendix

以下明细保留 active/candidate 的逐轴审计价值，但不作为 AionUI 主线工作的优先级入口；
OPL Studio candidate 不得与 active-shell P0 差距竞争实施资源。每行保留 Contract、Source、Pixel、
Install、Release 五轴；没有 exact-feature installed/release evidence 的列保持 unverified。

| 功能或交互要求 | AionUI contract | AionUI source | AionUI pixel | Native contract | Native source | Native pixel | AionUI install | AionUI release | Native install | Native release | 验证入口与当前差距 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
|   App repo 拥有 GUI product truth | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | `A1/A2`, `N1/N2`；两边 adapter 均禁止 authority transfer。   |
|   最新官方 ChatGPT Codex macOS observation 只作设计参考 | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | 外部 observation 不承担 Pixel/Install/Release authority；historical AionUI evidence只证明自身manifest声明的route/layout。 |
|   Home 是动态问题标题、全部用户可见 configured starters，不是 dashboard/landing | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Pixel status只由当前绑定仍有效的evidence manifest支撑；source仍负责证明无静默截断。   |
|   宽桌面 rail 默认展开且 `280-340px` 可调 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current Home desktop pixel证明rail展开且不覆盖main；resize行为由source/DOM证明。   |
|   窄窗口 rail 可收起并以 drawer/overlay 打开 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current mobile Home pixel证明collapsed rail与main viewport；drawer交互仍由source/DOM证明。   |
|   Active AionUI Rail 顶部 New task/运行状态/Scheduled tasks/Archived，底部 account/help/Settings | `aligned_contract` | `source_implemented` | `pixel_unverified` | `not_claimed` | `source_not_assessed` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 必须在 expanded/collapsed/mobile drawer 持续显示 `/runtime` 入口；Runtime 产品分类仍为 `retained_optional_x0_owner_route`，默认 release gate 与 Native phase-1 不因此扩张。   |
|   Workspace-initialized 与 projectless session | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current source保持无workspace text/attachment、任意file/directory picker、paste/drop与`/open`可用；historical pixels使用workspace fixture，不证明projectless path。   |
|   Projectless session 一次性归入一个目录组 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 通过既有 App Server adapter typed assign，并以 exact `thread/read.projectId` 和 recorded cwd 不变回读后提交 projection；失败保持 projectless，已有显式 affinity 不改绑。Native 仍缺；turn `pwd`、writable roots、pending/receipt/Handoff 均保持独立。   |
|   Bound session Project affinity 保持单一 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_not_assessed` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current source cohort 不提供 `bound(A) -> bound(B)`、projection transaction 或任意 rail 重分组；命令/turn 可使用自己的执行 `pwd`。   |
|   独立 context bar 设置新 session 初始 cwd；`+` 打开可搜索能力 palette | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 已把 cwd 放到 composer 上方独立 context bar；`+` 始终展开 composer-width、可搜索/分组/滚动的 files、folders 与真实 owner/carrier-projected capabilities palette。Native 当前仍没有真实目录切换闭环。   |
|   当前 session 显式输入可添加、查看、移除 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 使用当前 composer attachment/file/directory/paste/drop/`/open`；rail 不提供 workspace-keyed context source。Native `App.tsx` 的固定虚构 inputs 违反合同。   |
|   Session attachment 可添加、查看、移除 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Native 缺真实 attachment actions；AionUI attachment 能力已存在，但缺绑定当前 source 的像素证据。   |
|   一个目录组可展示 N 个独立 App Server sessions | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 以 `thread/list/read/resume` 为 canonical directory；分组只来自各 session 显式 `projectId`，recorded cwd 仅为 runtime metadata，不建立目录所有权，完整 directory/actions 仍由 source/protocol gates 证明。   |
|   对话 search/pin/rename/archive/restore/delete/reset 与独立 Archived | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current source将rename/archive/restore/delete映射App Server；pin仅UI metadata，现有pixels未打开这些actions。   |
|   主区保持单一 conversation timeline | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_implemented` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current AionUI desktop conversation pixel覆盖单timeline、底部composer与按需secondary surface。   |
|   Composer 是当前 session 显式 inputs + textarea + bottom action row | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Working directory 归 rail，locality/branch 归 Environment；composer 不持久化 workspace context。   |
|   模型与推理策略由 App profile 驱动 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI desktop/mobile controls 共用 App Auto/fixed resolver；legacy intelligence proxy UI 已移除。   |
|   Permission/access mode 在 composer 可见且不用 backend/provider 术语 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current desktop composer与mobile action-sheet pixels均绑定access control且不暴露backend/provider。   |
|   Purpose 从 Home starter 选择，Home 不重复 capability 标签，管理进入 Settings | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 使用 `HomeStarters + Settings Capabilities`，Home 由 starter 选中态表达能力，普通 composer 不再持久显示 purpose selector。   |
|   Selected package launch uses ready/degraded/package_unavailable without gating ordinary Codex | `aligned_contract` | `source_implemented` | `pixel_unverified` | `not_claimed` | `source_missing` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 已精确消费 owner-projected action、支持 JIT/degraded continuation、optional Workspace 和单包故障隔离；仍需绑定当前 source 的三态 pixels/install 证据。   |
|   可 pin current-task summary bar | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | `CurrentTaskAwareness` 提供 pin、status、elapsed、progress、next action 和 stop。   |
|   Environment popover 与 workspace surfaces 分离 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current dark desktop pixel覆盖Environment popover与Browser入口；recorded workspace 与 Git context 保持只读。   |
|   Advanced surfaces 默认无第三列；Files/Changes 按需，Preview 独立 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current desktop Files与mobile Preview pixels证明按需surface；旧八类equal-weight taxonomy保持退出。   |
|   Terminal/Browser 从 Environment 或任务需要按需打开，无 Runtime duplicate | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Source/DOM已证明入口与默认关闭；现有core manifest未单独证明Terminal/Browser。   |
|   Codex CLI 固定 executor；普通路径隐藏 backend/provider | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | 两边走既有 Codex/App bridge；permission/access 可见不等于暴露 backend/provider。   |
|   普通 state 读取走 fast App state | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | `A1/A2`, `N2/N3`；Full/detail 只允许进入明确 diagnostics。   |
|   Mutation 走 App action preview/confirm/execute/receipt | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Native 已有 preview/action bridge，但完整高风险确认、receipt、rollback UX 尚未覆盖全部动作。   |
|   Runtime/Files/Memory/Artifacts 只展示 refs | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Native `workbenchModel.ts` 仍保留 `GlycoFold` 等 demo fallback，必须去除后才能算完整真实投影。   |
|   Artifact Markdown/PDF/Mermaid/Code/KaTeX preview | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current source覆盖当前session ref、绝对本地路径与非法输入拒绝；Preview pixel不证明各renderer内容。   |
|   Managed Worktree/Handoff 不进入当前 App | `aligned_contract` | `source_implemented` | `not_applicable` | `not_claimed` | `source_missing` | `not_applicable` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | 一次性 projectless adoption 不授权 managed Worktree/Handoff、receipt、rollback 或第二 workspace 生命周期。   |
|   Review 复用 Files/Changes diff surface | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_not_assessed` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | 四 targets、inline/detached、PR context、stage/commit/push、`gh` unavailable、Last turn 与 custom target instructions 已关闭 baseline source；non-custom focus 和 line-level comments 是可选 protocol limits，不降级 B0-08。   |
|   Settings 使用 full-window return/search/grouped rows且 OPL IA 不变 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 保留 8+2 IA、search/redirect/state/action semantics，并使用 bounded page-section cards + flat rows；历史 Settings cohort只作provenance，不代表current pixels。   |
|   白色 main、`#FCFCFC` rail、中性 selected surface | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | 视觉 token 只由 App contract 维护；最终同尺寸light/dark/narrow installed pixels仍待验。   |
|   Desktop Back/Forward、Previous/Next Task、New Window | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | titlebar/menu、focused/unfocused command gate、focus resync 与 history boundary 已有 focused coverage；packaged multi-window 仍是独立证据缺口。   |
|   OPL 品牌、双语与普通语言一致 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_verified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Current exact cohort覆盖OPL brand、zh-CN/en-US；文案完整性仍由i18n gate负责。   |
|   Keyboard、focus、contrast、reduced motion | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 既有 focused coverage 加上 light/dark semantic contrast regression 关闭 Source；真实 screen-reader、完整 rendered keyboard traversal、rendered contrast 和 installed readback 仍未验证。Native 仍须单独完成自身 Source。   |
|   First-run 使用 App-owned readiness/page-state | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | Native 尚无完整 FirstRun；contract 和 test matrix 不能替代 clean-machine path。   |
|   Desktop/WebUI 同 product semantics | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 已复用同一产品 route、认证后端和 owner projection；Native 共享 renderer/bridge 有基础，但缺当前 Desktop/WebUI route-by-route parity evidence。   |
|   Release role | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `install_unverified` | `release_unverified` | `install_unverified` | `release_unverified` | AionUI 仍是 active stable shell；Native 是 experimental candidate，package/smoke 不得推导 adoption 或 release-ready。   |

## Remaining Source / Pixel Boundaries

- **Package readiness pixels：** unavailable、activating、blocked、repair/doctor等状态必须由绑定
  current source/package的route/viewport evidence逐项证明；历史manifest不回填。
- **Thread operations：** 单一App Server adapter的source/focused tests只关闭Source；安装版仍需
  覆盖用户触发的list/start/resume/fork/archive/restore。第二client、Shell scheduler或私有控制面
  不是补证据的合法路径。
- **Artifact ref adapter：** Current source覆盖session attachment、可见conversation result、用户选择的
  合法绝对路径和非法输入拒绝；Preview surface像素不证明各renderer或ref分流。
- **Session locality / Review：** Current source支持新任务初始cwd、projectless conversation、typed
  one-time affinity assignment和四类Review target；Pixel/Install/Release仍独立，且不得恢复managed
  Worktree/Handoff、同线程focus fallback或local annotation store。
- **Settings / Accessibility：** Source/DOM regressions只守IA、窄窗、keyboard/focus/ARIA、reduced-motion
  和semantic contrast；真实screen-reader、rendered traversal/contrast及installed pixels仍由各自owner验收。
- **OPL Studio candidate：** Candidate contract/source/pixel状态从当前 Studio owner surface与显式验证入口读取；
  旧smoke、package或设计观察不授权active-shell adoption或release-ready。

这些边界继续按对应owner单独推进；不能用source validator、历史manifest或本表状态外推公开
release readiness。

## 更新规则

更新本矩阵时：

1. 先读取 fresh contracts、adapter/candidate source 和对应 evidence。
2. 每个实现要求必须同时填写两套 shell 的 `contract_status`、`source_status`、
   `pixel_status`，不得留空或自造状态词。
3. Contract、source、pixel 独立判断；`aligned_contract` 不能推导
   `source_implemented`，`pixel_verified` 也不能推导视觉 parity。
4. Source/test、screenshot、package smoke、VM、owner acceptance 和 release promotion
   分层记录；证据失效时降级对应轴，不改写其它轴。
5. Product target 变化先改 owner contract/design doc；实现变化先取得 fresh source/tests；
   pixel 状态只从绑定当前 source/package 的 fresh visual evidence 更新。
6. 本文最后同步 read model，不得用文档状态提升 active-shell 或 release readiness。
