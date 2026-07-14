# OPL App GUI Shell Conformance Matrix

Owner: `one-person-lab-app`
Purpose: `app_gui_shell_conformance_read_model`
State: `active_read_model`
Snapshot basis: `2026-07-14`
Machine boundary: 本文是人读 read model，不是第二真相源。状态必须能回指 App
contracts、adapter/candidate contracts、shell source/tests 或 fresh evidence；本文不能
改变 product truth、active shell、candidate stage 或 release readiness。

设计体系入口见 [`README.md`](README.md)，实现方法见
[`shell-implementation-guide.md`](shell-implementation-guide.md)。

## 读法

状态必须同时读取三条独立轴，不能用 contract 状态代替 source 或 pixel 结论：

| Axis | Status | 含义 |
| --- | --- | --- |
| `contract_status` | `aligned_contract` | App target 与当前 carrier contract 一致；不表示源码已实现。 |
| `contract_status` | `current_contract_deviation` | 当前 machine contract 与理想目标不同。 |
| `contract_status` | `candidate_target` | 只属于候选 contract；不能推导 active-shell adoption。 |
| `contract_status` | `not_claimed` | 当前 contract set 不作该项声明。 |
| `source_status` | `source_implemented` | Fresh source/tests 能证明主要行为已实现。 |
| `source_status` | `source_partial` | 已有实现，但缺行为、数据接入、状态或与目标存在已知漂移。 |
| `source_status` | `source_missing` | Fresh source audit 未找到要求的实现。 |
| `source_status` | `source_not_assessed` | 本 snapshot 未完成足以分类的 source audit。 |
| `pixel_status` | `pixel_verified` | 有绑定当前 source/package 的 fresh 可见像素证据；不表示视觉 parity。 |
| `pixel_status` | `pixel_unverified` | 没有足够的当前像素证据。 |
| `pixel_status` | `pixel_blocked` | 已尝试当前视觉验证，但被明确启动/环境断点阻断。 |
| `pixel_status` | `not_applicable` | 该项是 authority/transport/release-role 等非像素结论。 |

`pixel_verified` 可以与 `source_partial` 同时出现。它只证明画面非空且对应路径被实际
打开，不能证明元素位置、交互、视觉一致、package/VM acceptance 或 release-ready。

本矩阵的功能/交互目标来自：

- `contracts/app-gui-product-contract.json`
- `contracts/app-product-profile.json`
- `contracts/app-page-state-matrix.json`
- [`feature-inventory.md`](feature-inventory.md)
- [`ideal-interaction-spec.md`](ideal-interaction-spec.md)
- [`visual-system.md`](visual-system.md)

Carrier 角色和候选边界读取 active adapter、`contracts/app-shell-candidates.json` 和
`contracts/shell-adapters/opl-native-workbench.json`。后者只描述实现/候选边界，不能
覆盖上面的 App product authority。

Active AionUI 默认状态通过 README 治理段声明的动态 state source 读取；当前值与
理想目标的差异由 `validate:gui-design-system` readback 计算，不在本文复制。

## Snapshot evidence

- Current human reference：本机 ChatGPT macOS `26.707.41301`（bundle build `5103`），
  `2026-07-11` 观察。App GUI contract、product profile 与 page-state matrix 已统一为 schema v2；
  `26.707.31428/31123` 只保留为 superseded observations。
- AionUI GUI conformance ancestor：`opl-aion-shell@a0ce713b65801fd9ca7f46ad168c977c75a187de`。
  当前 Shell HEAD 从 active checkout Git readback 获取，本矩阵不复制瞬时 HEAD。
- Current Shell source cohort：
  `opl-aion-shell@586b8847840712e536e5b6a85036263a995fb14e`（以 Runtime archive main `6639744c...`
  为祖先，包含 `ba28c49a...`）。它合并当前 Runtime V2 main、Gateway
  account/UI `e282f4d5d...` ancestry 与 parity source，覆盖同主机 Local/Worktree handoff、Home managed
  worktree、durable snapshot/cleanup/restore、Review四targets/Last turn/same-turn focus steer、按需 thread
  coordination、projectless file access、Runtime cockpit、Environment Git inspection、profile-driven feedback、
  avatar/help、窄窗Access布局、Runtime generic fallback 本地化与 disabled workspace selector marker。Main/remote最终currentness仍从
  Git readback获取，不由本矩阵推断。
- Latest reviewed upstream：`AionUI v2.1.33@a819d175683d5a0aada20064888da07bfcecdb6a`；无 GUI delta，
  只进入 release/runtime selective intake，不触发 GUI history merge。
- Generated profile currentness：使用 App 官方生成器和当前 OPL Flow workflow policy 重建后，
  current Shell generated profile 与生成结果 canonical JSON diff 为空；compatibility projection
  字段是有意派生，不要求与 raw App profile 字节相等。
- Current source gates：Shell `586b88478...` full active-shell `302 files pass / 1 skip`、
  `2430 pass / 9 skip`；TypeScript、1548-file format、i18n与lint `0 errors / 888 warnings`通过；
  final Guid + Runtime DOM `23/23`、Runtime projection `42/42`，avatar/help owner focused logic
  `28 pass`、DOM `5 pass`。App release-boundary
  `364 pass / 2 platform skip`。这些计数均绑定final exact source或该exact包含的focused owner
  handoff。本轮未运行package/build/E2E/install。
- Latest package-bound visual evidence（相对current source为historical）：
  [`evidence/aionui-41301-parity-20260714/manifest.json`](evidence/aionui-41301-parity-20260714/manifest.json)
  精确绑定 Shell `b2c05a1c...`、生成时间 `2026-07-13T17:54:36.964Z` 与 9 个 Home、Runtime、
  conversation/composer/Environment/Files/mobile Preview 场景；unmatched anchors、failed layout checks与
  coverage gaps均为0。Package为 `26.7.13`、bundle id `cn.onepersonlab.opl`，`app.asar` SHA-256为
  `726200362ed6038211dfb610b7639cb7fe395df54b92bade752c9b8f5a538823`，codesign通过但未安装。
  Manifest明确保持 `parity_1_to_1=false` 与 `release_ready=false`，不得改绑到`586b88478...`。
- Verified GUI ancestor source gates：Shell `a0ce713b...` full suite `293 files / 2172 tests` 通过、
  `1 file / 3 tests` skip；root TypeScript、1514-file format 与 i18n通过。该结果仅保留最低祖先审计价值。
- Historical source gates：Shell `0ebc1fdd...` 的 `test:full` 为 `282 files pass / 1 skip`、
  `2044 tests pass / 3 skip`；TypeScript、1487-file format、i18n 与 lint `0 errors / 854 warnings`。
  这些结果只属于历史 source cohort，不能直接升级为 current source gates。
- Historical packaged visual evidence：[`evidence/aionui-41301/manifest.json`](evidence/aionui-41301/manifest.json)
  精确绑定 Shell `0ebc1fdd...`、真实 `E2E_PACKAGED=1` 命令和 8 个 desktop/mobile、light/dark、
  zh-CN/en-US Home/conversation 状态；旧 manifest不修改 SHA，也不替代当前9场景 evidence。
- Settings 专项历史 evidence：14-entry desktop Light manifest 精确绑定
  `fadd91f9f0808eb090087f48c34d7c26d69df6ab`；更早 Settings screenshots 继续保留历史用途，
  均不外推为 current Settings pixels。
- `dbff7370fa956541ace3378296c5a000eb64399d` 已在当前 ancestry；本轮不整体重放，最终
  keep/adapt/drop 结果见 [`aionui-41301-delta-audit.md`](aionui-41301-delta-audit.md)。
- Native source snapshot：`opl-native-workbench@43569d8beb5119d674c6fecae367b2915eacbfb0`；
  `npm test` 与 native live smoke 通过，像素证据为 candidate repo
  `out/native-live-smoke.png`。该证据不改变 `active_shell_adopted=false`、
  `release_ready=false`。
- Source anchors：AionUI 的 rail/Home/conversation/context 主要读取
  `packages/desktop/src/renderer/components/layout/Layout.tsx`、
  `components/layout/Sider/`、`pages/guid/GuidPage.tsx`、
  `pages/guid/components/HomeStarters.tsx`、
  `pages/conversation/platforms/acp/AcpSendBox.tsx`、
  `pages/conversation/components/ChatLayout/`、
  `pages/conversation/components/ChatSlider.tsx` 和
  `pages/conversation/runtime/CurrentTaskAwareness.tsx`；Native 的数据和页面主要读取
  `src/workbench/workbenchModel.ts`、`src/workbench/App.tsx`。

## 验证入口

| ID | Entry | 证明边界 |
| --- | --- | --- |
| `A1` | `bun run validate:active-shell -- --quick` | Active adapter、contracts 和 source probes 的快速结构检查。 |
| `A2` | `bun run validate:active-shell` | Active shell 完整 App-root contract validation。 |
| `N1` | `npm run validate:candidate:native` | Native candidate registry 与声明边界。 |
| `N2` | `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/opl-native-workbench.json node --experimental-strip-types scripts/validate-active-shell.ts --quick` | Explicit native adapter contract 结构。 |
| `N3` | Candidate repo `npm run validate:candidate` 和 `npm run validate:state-model` | Candidate source 与 state-model consumption。 |
| `N4` | Candidate repo `npm run smoke:visual` | Manual/foreground visual smoke；不等于 packaged acceptance。 |
| `N5` | `npm run package:candidate:native` | Explicit candidate package path；不改变 active release shell。 |
| `V1` | Route/viewport/ref-bound screenshots、pixel checks、packaged/VM evidence | 对应视觉、package 或用户路径；每层 evidence 只证明自身。 |

## Active AionUI Priority Matrix

本表是主线决策入口。先看 P0/P1，再看 P2；Settings 完成不能抵消核心工作流偏差。

| Priority | Product surface | OPL-owned target translated from 26.707.41301 | AionUI current implementation | Status | Next decision |
| --- | --- | --- | --- | --- | --- |
| P0 | App frame | 左 project/conversation rail + 中央单列 timeline + 底部 composer + 右上按需 Environment details。 | Rail/timeline/composer/Environment composition 保留；默认无综合第三列。 | `source_implemented`, `pixel_verified` | Current desktop/mobile Home与conversation package pixels覆盖主 composition；不外推为完整视觉 parity。 |
| P0 | Runtime cockpit | 独立跨项目用户与智能体协作控制台，不用 conversation Runtime 或诊断页替代。 | Runtime V2 与 cockpit入口保留；summary-only diagnostics与 projection unavailable均有显式状态。 | `source_implemented`, `pixel_verified` | Current pixel只覆盖 `/runtime` 的 projection-unavailable状态；真实 populated/blocked/action states仍需独立 live evidence。 |
| P0 | Project hierarchy | Project 是 thread 的默认 cwd、分组与 context hint；rail canonical history/actions 来自 App Server。 | App Server canonical thread directory/actions 保留；pin 保持 UI metadata，local reset 不冒充 history reset。 | `source_implemented`, `pixel_unverified` | Current pixels只证明 rail composition，未覆盖完整 hierarchy/actions。 |
| P0 | Home / New task | 与 conversation 共用 chat canvas/composer，不是 dashboard；新任务可选 Local/Worktree 与 starting branch。 | Composer-first Home、全部用户可见 starters、stable order、responsive wrap、package readiness 以及既有 `gitWorkspace` managed worktree create/reuse 已实现。 | `source_implemented`, `pixel_verified` | Current desktop/mobile pixels覆盖Home、rail与mobile action sheet；Worktree lifecycle仍按source/tests验收。 |
| P0 | Conversation chrome | 只显示 task identity/直接动作；model/access 留在 composer。 | Header 保留 identity/navigation/Environment/Files；model/access 不再重复挂 header/side panel。 | `source_implemented`, `pixel_verified` | Current desktop pixels覆盖timeline、composer、Environment与Files composition；维持compact chrome。 |
| P0 | Composer | Add/access、model/reasoning 与 send-stop 位于发送决策点；不重复 rail/Environment context。 | Desktop/mobile 共用 App resolver/profile；mobile `+` sheet 收纳次级动作；legacy intelligence proxy controls 已移除。 | `source_implemented`, `pixel_verified` | Current pixels覆盖desktop controls/model menu与mobile action sheet；不恢复第二 provider/service truth。 |
| P0 | Environment details | 右上 anchored floating summary，默认关闭；承载既有同主机 task locality handoff 与 Git context。 | `b2c05a1c...` 仅渲染真实 workspace/locality/branch/changes/refs，使用 live Git inspection，并为 `not_loaded`/`idle` task 提供 Local↔Worktree；与 Files/Preview 分离。 | `source_implemented`, `pixel_verified` | Current pixel覆盖Environment popover与Browser入口；handoff状态仍由focused行为测试证明。 |
| P0 | Visual grammar | 白 main、浅灰 rail、窄 reading lane、低对比、小圆角、极少页面卡片。 | Current 9场景覆盖light/dark、desktop/mobile与zh-CN/en-US；历史8场景保持原字节。 | `source_implemented`, `pixel_verified` | 只证明指定route/layout非空且无声明溢出，不宣称1:1 parity。 |
| P1 | OPL capabilities | Purpose 从 Home starter 选择，composer 只显示 active capability；管理进入 Settings。 | Home package shortcuts、Settings directory/visibility/lifecycle 与 fail-closed readiness gate 已实现；generic backend/provider/Team 未回 ordinary UI。 | `source_implemented`, `pixel_unverified` | 补 current unavailable/activating/blocked starter pixels。 |
| P1 | Progress / approval / receipt | 进入当前 timeline 或 selected target thread context；App Server interactive request 是 pending state，不是 dispatch failure。 | Current-task summary 保持 timeline 单一实例；`f7fd71765...` 接通 command/file/permission approval、user-input、MCP elicitation 与 `currentTime/read`，未知 request fail closed。Delivery audit 只显示 Codex policy inheritance，不宣称独立 approval receipt。 | `source_implemented`, `pixel_unverified` | 补真实 approval/user-input packaged route evidence。 |
| P1 | Artifacts / evidence | Environment 次级 refs、Preview、Files 或 turn disclosure。 | Files 与 Preview 按需且窄屏互斥；mobile Preview 使用完整可读 overlay；transcript export 已按 cursor 与脱敏合同加固。 | `source_implemented`, `pixel_verified` | Current pixels覆盖desktop Files与mobile Preview composition；PDF/Mermaid/KaTeX内容渲染另做专项 evidence。 |
| P1 | Artifact preview adapter | 用户显式合法绝对本地路径或 workspace-scoped project ref 薄接现有 Preview；traversal、非法 scheme、自动静默读取返回明确失败。 | `b2c05a1c...` 已复用既有 renderer/store，覆盖 projectless file access、absolute-path 与 workspace-ref 分流。 | `source_implemented`, `pixel_unverified` | Current Preview pixel未证明absolute-path/workspace-ref分流与非法输入；保持行为测试边界。 |
| P1 | Cross-thread coordination | 普通 navigation 不展示独立页面；keyboard-reachable thread-detail context action 与 model host tool 复用 App Server list/read/resume/fork/archive/unarchive/start/steer；同 key 返回首个 receipt/result、`ok=true`。 | Canonical directory、App Server lifecycle、flexible advisory、running steer、首结果 replay、typed pending requests 与无额外 OPL confirmation 保留；普通 rail 不挂载 `ThreadCoordinationSection`。 | `source_implemented`, `pixel_unverified` | 无独立入口由 source/DOM 负向 gate 证明；cross-host是required target但owner协议面缺失，当前typed unavailable；独立非紧急 queue 未实现。 |
| P1 | Model-triggered coordination | 模型通过同一 host adapter调用 list/read/resume/fork/archive/unarchive/start/steer。 | Ordinary conversation经ACP -> AionCore -> codex-acp创建；ACP session输入/callback没有dynamic tools，coordination port是另一App Server client，因此thread-detail user dispatch和post-hoc handler都不构成实现。 | `source_missing_protocol_blocked`, `not_applicable` | 优先由AionCore同一client承接`thread/start(dynamicTools)`；或由codex-acp补齐input/response/callback。禁止第二runtime/store。 |
| P1 | Local / Worktree lifecycle | Home 新任务选择 Local/Worktree 与 starting branch；既有同主机 `not_loaded`/`idle` task 在 Environment 双向 handoff，真实 cwd 先于 projection 更新；remove前必须可恢复。 | `586b88478...` 复用 `gitWorkspace` 与 `thread/settings/update`，并以 `opl_worktree_snapshot_receipt.v1` Git ref持久化HEAD/branch或detached/index/tracked/untracked/ignored user files，remove失败恢复，restore冲突typed fail。 | `source_partial`, `pixel_unverified` | Same-host lifecycle已闭合；cross-host required target因Codex Remote Connections/host-handoff owner协议面缺失而blocked。 |
| P1 | Review pane | 复用 Files/Changes；四类 target、inline/detached、PR context、stage/commit/push；缺失能力显示 unavailable。 | `586b88478...` 已实现四类 `review/start` target、inline/detached、PR context、stage/commit/push、`gh` unavailable、Last turn，并把非custom focus经同client `turn/steer(expectedTurnId)`送回原Review turn。 | `source_partial`, `pixel_unverified` | Line-level comments等待typed Codex file/line request；禁止local annotation store或假成功，不恢复legacy equal-weight Review tab。 |
| P2 | Settings | Secondary configuration/control surface，保持 OPL IA。 | 四类 surface 与 bounded cards 已进入 source；本次 core matrix 不复用旧 Settings pixels。 | `source_implemented`, `pixel_unverified` | 冻结 IA，只修回归；按需要重建当前 Settings evidence。 |

## Cross-shell Detail Appendix

以下明细保留 active/candidate 的历史审计价值，但不作为 AionUI 主线工作的优先级入口；
Native candidate 不得与 active-shell P0 差距竞争实施资源。

| 功能或交互要求 | AionUI contract | AionUI source | AionUI pixel | Native contract | Native source | Native pixel | 验证入口与当前差距 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| App repo 拥有 GUI product truth | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `A1/A2`, `N1/N2`；两边 adapter 均禁止 authority transfer。 |
| ChatGPT macOS 26.707.41301 是当前人读交互基线 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | Current 9-scene AionUI evidence只证明指定route/layout；不宣称与Codex 1:1 parity。 |
| Home 是动态问题标题、全部用户可见 configured starters，不是 dashboard/landing | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | Current desktop/mobile Home pixels绑定 `b2c05a1c...`；source仍负责证明无静默截断。 |
| 宽桌面 rail 默认展开且 `280-340px` 可调 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_verified` | Current Home desktop pixel证明rail展开且不覆盖main；resize行为由source/DOM证明。 |
| 窄窗口 rail 可收起并以 drawer/overlay 打开 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_unverified` | Current mobile Home pixel证明collapsed rail与main viewport；drawer交互仍由source/DOM证明。 |
| Rail 顶部 New task/Runtime/Archived，底部 account/help/Settings | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI `SiderToolbar/SiderPrimaryNav/SiderFooter` 承接全局骨架；已连接账户使用绿色圆形 locale-aware initials，帮助/反馈使用标题栏 Font Awesome Regular 线框问号；Capabilities 不再是 ordinary rail entry。 |
| Project task 与 projectless conversation | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `b2c05a1c...` 保持无 workspace text/attachment、任意 file/directory picker、paste/drop 与 `/open` 可用；current pixels使用workspace fixture，不证明projectless path。 |
| 项目选择器切换真实 active project | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | AionUI 有 workspace/project 路径；Native 当前没有真实项目切换闭环。 |
| 项目 Context inputs 可选、可增删 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | AionUI 使用 workspace-keyed 单一 context source；Native `App.tsx` 仍固定生成四个虚构 inputs。 |
| 项目附件可添加、查看、移除 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | Native 缺真实 attachment actions；AionUI 附件能力已存在，但缺绑定当前 source 的像素证据。 |
| 一个项目对应 N 个 App Server threads | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | `b2c05a1c...` 以 `thread/list/read/resume` 为 canonical directory；当前无ordinary coordination入口pixel，完整directory/actions仍由source/protocol gates证明。 |
| 对话 search/pin/rename/archive/restore/delete/reset 与独立 Archived | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | `b2c05a1c...` 将rename/archive/restore/delete映射App Server；pin仅UI metadata，current matrix未打开这些actions。 |
| 主区保持单一 conversation timeline | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_implemented` | `pixel_verified` | Current AionUI desktop conversation pixel覆盖单timeline、底部composer与按需secondary surface。 |
| Composer 是 send-local refs/attachments + textarea + bottom action row | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | Project 归 rail，locality/branch 归 Environment；composer 不再重复持久 context。 |
| 模型与推理策略由 App profile 驱动 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | AionUI desktop/mobile controls 共用 App Auto/fixed resolver；legacy intelligence proxy UI 已移除。 |
| Permission/access mode 在 composer 可见且不用 backend/provider 术语 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | Current desktop composer与mobile action-sheet pixels均绑定access control且不暴露backend/provider。 |
| Purpose 从 Home starter 选择，composer 只显示 active capability chip，管理进入 Settings | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI 使用 `HomeStarters + Settings Capabilities`，普通 composer 不再持久显示 purpose selector。 |
| Package starter readiness 与 use-boundary activation fail closed | `aligned_contract` | `source_implemented` | `pixel_unverified` | `not_claimed` | `source_missing` | `pixel_unverified` | Current AionUI source覆盖 missing/unavailable/blocked package、activation wait/readback 和 send guard；current state pixels 待补。 |
| 可 pin current-task summary bar | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `CurrentTaskAwareness` 提供 pin、status、elapsed、progress、next action 和 stop。 |
| Environment popover 与 workspace surfaces 分离 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | Current dark desktop pixel覆盖Environment popover与Browser入口；locality handoff仍由source/DOM证明。 |
| Advanced surfaces 默认无第三列；Files/Changes 按需，Preview 独立 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | Current desktop Files与mobile Preview pixels证明按需surface；旧八类equal-weight taxonomy保持退出。 |
| Terminal/Browser 从 Environment 或任务需要按需打开，无 Runtime duplicate | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | Source/DOM 已证明入口与默认关闭；本轮 core manifest 未单独打开 Terminal/Browser。 |
| Codex CLI 固定 executor；普通路径隐藏 backend/provider | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | 两边走既有 Codex/App bridge；permission/access 可见不等于暴露 backend/provider。 |
| 普通 state 读取走 fast App state | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `A1/A2`, `N2/N3`；Full/detail 只允许进入明确 diagnostics。 |
| Mutation 走 App action preview/confirm/execute/receipt | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native 已有 preview/action bridge，但完整高风险确认、receipt、rollback UX 尚未覆盖全部动作。 |
| Runtime/Files/Memory/Artifacts 只展示 refs | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native `workbenchModel.ts` 仍保留 `GlycoFold` 等 demo fallback，必须去除后才能算完整真实投影。 |
| Artifact Markdown/PDF/Mermaid/Code/KaTeX preview | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | `b2c05a1c...` 覆盖绝对本地路径、workspace ref与非法输入拒绝；current Preview pixel不证明各renderer内容。 |
| Local/Worktree new task 与同主机 idle handoff | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_not_assessed` | `pixel_unverified` | `586b88478...` 覆盖same-host managed create/reuse、handoff、durable snapshot-before-remove（含ignored user files）、cleanup rollback与receipt restore；cross-host为owner blocker。 |
| Review 复用 Files/Changes diff surface | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_not_assessed` | `pixel_unverified` | `586b88478...` 覆盖四targets、inline/detached、PR context、stage/commit/push、`gh` unavailable、Last turn与same-turn focus steer；line-level comments为protocol blocker。 |
| Settings 使用 full-window return/search/grouped rows且 OPL IA 不变 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | AionUI 保留 8+2 IA、search/redirect/state/action semantics，并使用 bounded page-section cards + flat rows；Shell `74848adf77360903c5ac7d64c32455a78fb3901a` 的 42 张图只作为历史专项 evidence，不代表当前 cohort pixels。 |
| 白色 main、灰色 rail/subtle surface、OPL teal | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | Current 9场景覆盖light/dark、desktop/mobile与双语；只证明指定画面，不宣称完整视觉parity。 |
| Desktop Back/Forward、Previous/Next Task、New Window | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | titlebar/menu、focused/unfocused command gate、focus resync 与 history boundary 已有 focused coverage；packaged multi-window 仍是独立证据缺口。 |
| OPL 品牌、双语与普通语言一致 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_verified` | Current exact cohort覆盖OPL brand、zh-CN/en-US；文案完整性仍由i18n gate负责。 |
| Keyboard、focus、contrast、reduced motion | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | rail/context focus、Escape、inert 和 reduced-motion 已有 focused coverage；contrast 与全键盘矩阵仍待验收。 |
| First-run 使用 App-owned readiness/page-state | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | Native 尚无完整 FirstRun；contract 和 test matrix 不能替代 clean-machine path。 |
| Desktop/WebUI 同 product semantics | `not_claimed` | `source_not_assessed` | `not_applicable` | `candidate_target` | `source_partial` | `pixel_unverified` | Native 共享 renderer/bridge 有基础，但缺当前 Desktop/WebUI route-by-route parity evidence。 |
| Release role | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | AionUI 仍是 active stable shell；Native 是 experimental candidate，package/smoke 不得推导 adoption 或 release-ready。 |

## Exact Remaining Source / Pixel Gaps

41301 core composition 目标已闭合，但 current Shell source 已前进。当前证据边界：

- **Core pixels：** 当前9场景精确绑定 `b2c05a1c...` 的 Home、Runtime unavailable、conversation、
  composer/model、Environment、Files、mobile action sheet与mobile Preview；历史8场景仍只属于
  `0ebc1fdd...`，两份manifest均不通过改SHA升级。
- **Package readiness pixels：** unavailable、activating、blocked、repair/doctor 等新状态尚无
  current route/viewport evidence。
- **Cross-thread coordination：** canonical directory、unarchive、首结果 idempotency replay、same-host
  routing 和 interactive server-request pending flow 保留；普通 rail 不展示独立“线程协调”页面，
  thread-detail context action 与 model host tool 复用同一 adapter。cross-host 是required target，但当前
  Codex Remote Connections/host-handoff owner没有可消费协议面，因此typed unavailable；独立 queue 未实现。
- **Model host tool：** required target；当前 AionUI source missing/protocol blocked。Ordinary ACP链路没有
  dynamic-tool输入/callback；owner route是AionCore同client adapter或codex-acp上游callback。Thread-detail action、
  focused DOM、post-hoc coordination-port handler或delivery audit都不能替代registration与round-trip evidence。
- **Artifact ref adapter：** `b2c05a1c...` 已覆盖用户显式任意绝对本地路径、workspace ref、双 scope
  policy和非法输入拒绝；current package只证明Preview surface，不证明各renderer和ref分流。
- **Codex locality / Review：** `586b88478...` 已实现same-host Home worktree、idle task handoff、durable
  snapshot-before-remove、cleanup rollback与receipt restore；cross-host是owner blocker。Review已实现四 target、
  inline/detached、PR context、stage/commit/push、`gh` unavailable、Last turn与same-review-turn focus steer；
  line-level comments等待typed protocol。
- **Narrow Settings：** `586b88478...` ancestry 将Access摘要卡的双列断点从`md`提高到`xl`，960px窗口保持
  单列；focused DOM锁定不得在`md`提前双列。匹配installed pixel由最终package owner验收。
- **Package/install：** `26.7.13` macOS arm64 directory-only package、packaged E2E与codesign已通过，
  但未安装；clean-user-data、first-run、真实coordination detail与公开release promotion仍是独立证据。
- **Settings pixels：** 14-entry desktop Light manifest 绑定 `fadd91f9...`；不把该历史图提升为
  current Settings pixel evidence。
- **Native contract/source：** candidate contract 与 visual parity 仍绑定 superseded
  `26.707.31123`，permission hidden，purpose/side-panel/Settings/project semantics 不完整。
- **Native pixels：** `out/native-live-smoke.png` 只证明旧 candidate source 非空；不能证明
  41301 alignment、Environment details、permission/access、responsive drawer 或 release readiness。

这些专项 gaps 继续按对应 owner 单独推进；不能用当前 core manifest 外推未覆盖状态或公开
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
