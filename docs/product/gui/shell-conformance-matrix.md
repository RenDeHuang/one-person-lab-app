# OPL App GUI Shell Conformance Matrix

Owner: `one-person-lab-app`
Purpose: `app_gui_shell_conformance_read_model`
State: `active_read_model`
Snapshot basis: `2026-07-15`
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
| `source_status` | `source_not_assessed` | 本 snapshot 未完成足以分类的 source audit。 |
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

R1/U1 功能实现程度不得再用 `2/4`、`3/4` 等单一分数表示；这种写法会把 contract、source、
pixel、install 和 release 混成一个不可审计结论。需要功能摘要时仍逐轴报告，不能把
`source_implemented` 外推为 installed 或 released。

## R1 / U1 必要功能实现矩阵

本表只维护 OPL 必须自维护的 12 项。功能定义对 AionUI 与 Native 完全相同，source
状态按 carrier 分开；`P/I/R` 依次为 pixel/install/release。当前 12 项均为
`pixel_unverified / install_unverified / release_unverified`：已有截图、安装包或测试都没有同时
绑定当前 exact feature source、安装 readback 和 release promotion，不能按功能外推完成。

| ID | 功能与为什么必要 | Contract | AionUI 承载方式 | AionUI source | AionUI P/I/R | Native target/current | Native P/I/R | 当前最小缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `R1-01` | Gateway 身份。OPL 必须管理自己的智能体账号，同时保留既有 Codex/API Key。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一身份结果；`source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | Native 补 typed login、refresh、disconnect；WebUI manual-key-only 保持安全边界。 |
| `R1-02` | Gateway 模型 entitlement、余额、Token 和成本。没有真实访问与消耗信息就无法做模型选择。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一 entitlement/usage 结果；`source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | Native 补余额、今日/累计 Token、actual cost、managed key 和 freshness。 |
| `R1-03` | 非阻断 OPL Core setup。OPL 多了环境准备，但首启不能变成长时间 blocker。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一渐进首启结果；`source_missing` | `pixel_unverified` / `install_unverified` / `release_unverified` | Native 实现可恢复、尽量非阻断的 Core setup；只局部 gate 确认的身份/安全/核心执行器失败。 |
| `R1-04` | Agents / Capabilities IA。用户按智能体和能力理解 OPL，而不是理解底层 Plugins/Skills 打包。 | `aligned_contract` | `upstream reuse + L1 profile + L3 composition` | `source_implemented` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一 IA/owner route；`source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | Native 补独立 owner routes/registry；AionUI 底层复用 SkillsHub 不算缺口。 |
| `R1-05` | OPL Control Center owner routes。多 authority 必须有统一、可发现且不复制 truth 的入口。 | `aligned_contract` | `upstream reuse + L1 profile + L2/L3` | `source_implemented` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一 hydrated Settings registry；`source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | Native 消费 registry、redirect 和 anchor，不停留在 shell-local localStorage。 |
| `R1-06` | OPL bundle、update、deep link、feedback/support。安装、唤起、更新和求助必须是同一产品。 | `aligned_contract` | `L1 profile + L2 bridge/adapter` | `source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一分发/协议结果；`source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | AionUI 补 `opl://` parser、协议注册、冷启动/二次实例；Native 补正式 updater/deep-link/support。 |
| `U1-01` | Agent Package 目录与 lifecycle。这是“调用和管理自己的智能体账号/包”的核心。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_implemented` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一 Framework lifecycle/readback；`source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | Native 从 preview/dry-run 补到真实 lifecycle 与 readback。 |
| `U1-02` | Purpose/Starter 与 active context。用户应从目标直接进入专业 Agent。 | `aligned_contract` | `L1 profile + L3 composition` | `source_implemented` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一 package-backed starter；`source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | Native 把 prompt/dry-run 接到 package-backed launch 和 active binding。 |
| `U1-03` | 弹性 Agent 启动/JIT prepare。需要准备 use boundary，但 AI-first 交互不能动辄全局 block。 | `aligned_contract` | `L2 bridge/adapter` | `source_implemented` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一 projected action/三态；`source_missing` | `pixel_unverified` / `install_unverified` / `release_unverified` | AionUI 已消费 owner-projected action 和三态，移除 `operational_ready=false` 二次一刀切与普遍 Workspace 要求；仍需绑定当前 source 的 pixels/install/release 证据。 |
| `U1-04` | App / OPL Base / Packages 三对象 lifecycle。三类 owner 不同，混成一个 updater 会产生假成功。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一三对象 terminal readback；`source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | 补三对象各自 first-install、终态 readback 和中断恢复，不强求同一 mutation API。 |
| `U1-05` | Docker/WebUI 同产品语义。WebUI 是 OPL 的部署入口，不能成为另一个产品。 | `aligned_contract` | `upstream reuse + L2 transport adapter` | `source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一 Web product target；`source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | 补 Web Storage/core route parity 与当前 Docker cohort；Desktop-only 安全差异必须显式。 |
| `U1-06` | OPL 数据、缓存、包体空间与安全清理。长期使用必须可预览、可确认、可恢复。 | `aligned_contract` | `L2 bridge/adapter + L3 composition` | `source_partial` | `pixel_unverified` / `install_unverified` / `release_unverified` | 同一 owner inventory/cleanup；`source_missing` | `pixel_unverified` / `install_unverified` / `release_unverified` | AionUI 增加 Agent Package store 独立 inventory/owner cleanup 和 Web transport；Native 实现完整路径。 |

Source 状态说明：AionUI `R1-01..05`、`U1-01..03` 为 `source_implemented`；
`R1-06`、`U1-04..06` 为 `source_partial`，没有完全 missing。Native 的 `R1-03`、
`U1-03`、`U1-06` 为 `source_missing`，其余为 `source_partial`。这里的 `source_implemented`
只证明主要源码路径和专项测试存在，不等于本轮 fresh test pass，更不等于 pixels、install 或 release。

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

- Current visual reference：本机 ChatGPT Codex macOS `26.707.72221`（bundle build `5307`），
  `2026-07-15` 观察，精度与例外见 [`codex-app-visual-parity.md`](codex-app-visual-parity.md)。
  `26.707.41301` 继续保留为既有交互 observation；`26.707.31428/31123` 只保留为
  superseded observations。
- AionUI GUI conformance ancestor：`opl-aion-shell@a0ce713b65801fd9ca7f46ad168c977c75a187de`。
  该字段绑定最低 verified ancestor；active checkout exact HEAD 由下一项 current source cohort 记录。
- Current Shell source cohort：symbolic `session_workspace_minimal_current_source_cohort`，由 active checkout 的
  `useConversationListSync.ts`、`GroupedHistory/index.tsx`、`GuidPage.tsx`、只读
  `ConversationEnvironmentPopover.tsx`、删除后的 `WorkspaceHandoffControl.tsx`、`ProjectContextSection.tsx` /
  `projectContext.ts` 与对应 DOM/source tests 共同定义。它保留当前 Runtime V2 main、Gateway account/UI、
  Review、单一 App Server adapter、projectless file access、Environment Git inspection、profile-driven
  feedback/avatar/help 与窄窗 Access。Workspace selector 只设置新 session 初始 cwd；既有 session 不提供
  cwd 重绑或 managed Worktree/Handoff。Review 保留四类 target、`Last turn` 与 custom
  `review/start.target.custom`，删除 unsupported focus steer，并在非 custom focus 时启动前 typed fail。
  Exact commit、main/remote currentness 只由 App owner 在 Shell main 语义吸收后从 Git readback 获取，
  不由本矩阵或临时 topic SHA 推断。
- Latest reviewed upstream：`AionUI v2.1.33@a819d175683d5a0aada20064888da07bfcecdb6a`；无 GUI delta，
  只进入 release/runtime selective intake，不触发 GUI history merge。
- Generated profile currentness：使用 App 官方生成器和当前 OPL Flow workflow policy 重建后，
  current Shell generated profile 与生成结果 canonical JSON diff 为空；compatibility projection
  字段是有意派生，不要求与 raw App profile 字节相等。
- Current source gates：symbolic current source cohort 的 focused Node `19/19`、DOM `85/85`、TypeScript、
  format/diff-check 与 i18n通过；lint `0 errors / 946 existing warnings`，i18n保留22个既有 warning。
  同一 product source 的 full suite 为 `2439 pass / 9 skip`；其后仅补 test assertion，并以 targeted DOM
  `3/3` 覆盖该 test-only delta。这些结果证明当前 source cohort，不证明 commit currentness。
  Ancestor `e218d79b7...` 的 full
  active-shell `302 files pass / 1 skip`、`2430 pass / 9 skip` 仅作为祖先证据，不替代 current exact
  source gate。App design-system consistency、focused release tests `89/89`、绑定该 source cohort 的
  active-shell quick 与全量 App release-boundary `370 pass / 2 platform skip` 通过。本轮未运行
  package/build/E2E/install。
- Latest package-bound visual evidence（相对current source为historical）：
  [`evidence/aionui-41301-parity-20260714/manifest.json`](evidence/aionui-41301-parity-20260714/manifest.json)
  精确绑定 Shell `b2c05a1c...`、生成时间 `2026-07-13T17:54:36.964Z` 与 9 个 Home、Runtime、
  conversation/composer/Environment/Files/mobile Preview 场景；unmatched anchors、failed layout checks与
  coverage gaps均为0。Package为 `26.7.13`、bundle id `cn.onepersonlab.opl`，`app.asar` SHA-256为
  `726200362ed6038211dfb610b7639cb7fe395df54b92bade752c9b8f5a538823`，codesign通过但未安装。
  Manifest明确保持 `parity_1_to_1=false` 与 `release_ready=false`，不得改绑到 current source cohort。
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
| P0 | Project hierarchy | Project/directory 只提供 thread 的初始 cwd、可见 metadata 与只读分组，不拥有 session、context 或 artifact；rail canonical history/actions 来自 App Server。 | App Server canonical thread directory/actions 保留；pin 保持 UI metadata，local reset 不冒充 history reset。 | `source_implemented`, `pixel_unverified` | Current pixels只证明 rail composition，未覆盖完整 hierarchy/actions。 |
| P0 | Home / New task | 与 conversation 共用 chat canvas/composer，不是 dashboard；统一 `+` 菜单只设置新任务初始 cwd，未选时无占位，选中后为可移除 chip。 | Composer-first Home、全部用户可见 starters、stable order、responsive wrap 与 package readiness 已实现；Local/Worktree 与 starting branch 控件已删除。 | `source_implemented`, `pixel_verified` | Current desktop/mobile pixels覆盖Home、rail与mobile action sheet。 |
| P0 | Conversation chrome | 只显示 task identity/直接动作；model/access 留在 composer。 | Header 保留 identity/navigation/Environment/Files；model/access 不再重复挂 header/side panel。 | `source_implemented`, `pixel_verified` | Current desktop pixels覆盖timeline、composer、Environment与Files composition；维持compact chrome。 |
| P0 | Composer | 统一 `+`、access、model/reasoning 与 send-stop 位于发送决策点；文件、目录、新 session cwd、allowlisted Skill 与真实连接共用一个菜单。 | Desktop/mobile 共用 App resolver/profile 和菜单内容；legacy intelligence proxy controls 已移除。 | `source_implemented`, `pixel_verified` | Current pixels覆盖desktop controls/model menu与mobile action sheet；不恢复第二 provider/service truth。 |
| P0 | Environment details | 右上 anchored floating summary，默认关闭；只读显示 recorded workspace 与 live Git context。 | Environment 渲染真实 workspace、branch、changes 与 refs，使用 live Git inspection，不提供 cwd、locality 或 Worktree mutation；与 Files/Preview 分离。 | `source_implemented`, `pixel_verified` | Current pixel覆盖Environment popover与Browser入口；只读边界由 focused DOM/source tests 证明。 |
| P0 | Visual grammar | 白 main、浅灰 rail、窄 reading lane、低对比、小圆角、极少页面卡片。 | Current 9场景覆盖light/dark、desktop/mobile与zh-CN/en-US；历史8场景保持原字节。 | `source_implemented`, `pixel_verified` | 只证明指定route/layout非空且无声明溢出，不宣称1:1 parity。 |
| P1 | OPL capabilities | Purpose 从 Home starter 选择，composer 只显示 active capability；管理进入 Settings。 | Home package shortcuts、Settings directory/visibility/lifecycle 已实现；启动消费 owner-projected `ready / degraded / package_unavailable`，只在 action 明确要求时 gate Workspace；generic backend/provider/Team 未回 ordinary UI。 | `source_implemented`, `pixel_unverified` | 补绑定当前 source 的三态 pixels/install 证据。 |
| P1 | Progress / approval / receipt | 进入当前 timeline；沿用 AionUI ACP 的 permission、user-input 与错误状态。 | Current-task summary 保持 timeline 单一实例，不增加跨线程 pending-request 或 delivery-audit 控制面。 | `source_implemented`, `pixel_unverified` | 补真实 approval/user-input packaged route evidence。 |
| P1 | Artifacts / evidence | Environment 次级 refs、Preview、Files 或 turn disclosure。 | Files 与 Preview 按需且窄屏互斥；mobile Preview 使用完整可读 overlay；transcript export 已按 cursor 与脱敏合同加固。 | `source_implemented`, `pixel_verified` | Current pixels覆盖desktop Files与mobile Preview composition；PDF/Mermaid/KaTeX内容渲染另做专项 evidence。 |
| P1 | Artifact preview adapter | 当前 session 显式 attachment、可见 conversation result 或用户选择的合法绝对本地路径薄接现有 Preview；隐式 workspace ref、traversal、非法 scheme、自动静默读取返回明确失败。 | `b2c05a1c...` 已复用既有 renderer/store，覆盖 projectless file access、session ref 与 absolute-path 分流。 | `source_implemented`, `pixel_unverified` | Current Preview pixel未证明session/absolute-path分流与非法输入；保持行为测试边界。 |
| P1 | User-triggered thread operations | Existing directory/actions 复用一个 App Server adapter执行 list/read/start/resume/fork/archive/restore；普通 conversation 继续走现有 ACP。 | 单一 production adapter 与 focused tests 已实现；旧 coordination service/page、dynamic tools、audit/idempotency、pending control plane 和 cross-host 均缺席。 | `source_implemented`, `pixel_unverified` | 安装版覆盖 list/start/resume/fork/archive/restore 的可见路径与错误。 |
| P1 | Session workspace boundary | 新任务选择初始 cwd；既有 session 的 workspace 只读，运行时 `pwd` 不反写 rail metadata。 | Shell 不调用 `thread/settings/update`，不保存 `workspace_handoff`，也不提供 managed Worktree/Handoff。 | `source_implemented`, `pixel_unverified` | 安装版覆盖新任务 workspace 选择和既有 task resume。 |
| P1 | Review pane | 复用 Files/Changes；四类 target、inline/detached、PR context、stage/commit/push；缺失能力显示 unavailable。 | 保留四类 `review/start` target、inline/detached、PR context、stage/commit/push、`gh` unavailable与Last turn；custom instructions只经`review/start.target.custom`。 | `source_partial`, `pixel_unverified` | 不开发local annotation store或伪造行级成功。 |
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
| Rail 顶部 New task/Runtime/Archived，底部 account/help/Settings | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI `SiderToolbar/SiderPrimaryNav/SiderFooter` 承接全局骨架；已连接账户使用绿色圆形 locale-aware initials，帮助/反馈使用标题栏 IconPark 单色 outline 问号；Capabilities 不再是 ordinary rail entry。 |
| Workspace-initialized 与 projectless session | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `b2c05a1c...` 保持无 workspace text/attachment、任意 file/directory picker、paste/drop 与 `/open` 可用；current pixels使用workspace fixture，不证明projectless path。 |
| Existing session workspace 保持只读 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_not_assessed` | `pixel_unverified` | Current source cohort 不提供目录重绑、projection transaction 或 rail 重分组；命令/turn 可使用自己的执行 `pwd`。 |
| 统一 `+` 菜单设置新 session 初始 cwd | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | AionUI 在同一菜单提供 file/folder/cwd/Skill/可用连接；cwd 选择只设置新 session 初始值，不创建 session owner；Native 当前没有真实目录切换闭环。 |
| 当前 session 显式输入可添加、查看、移除 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI 使用当前 composer attachment/file/directory/paste/drop/`/open`；rail 不提供 workspace-keyed context source。Native `App.tsx` 的固定虚构 inputs 违反合同。 |
| Session attachment 可添加、查看、移除 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | Native 缺真实 attachment actions；AionUI attachment 能力已存在，但缺绑定当前 source 的像素证据。 |
| 一个目录组可展示 N 个独立 App Server sessions | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | AionUI 以 `thread/list/read/resume` 为 canonical directory；分组只来自各 session recorded cwd，不建立目录所有权，完整directory/actions仍由source/protocol gates证明。 |
| 对话 search/pin/rename/archive/restore/delete/reset 与独立 Archived | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | `b2c05a1c...` 将rename/archive/restore/delete映射App Server；pin仅UI metadata，current matrix未打开这些actions。 |
| 主区保持单一 conversation timeline | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_implemented` | `pixel_verified` | Current AionUI desktop conversation pixel覆盖单timeline、底部composer与按需secondary surface。 |
| Composer 是当前 session 显式 inputs + textarea + bottom action row | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | Working directory 归 rail，locality/branch 归 Environment；composer 不持久化 workspace context。 |
| 模型与推理策略由 App profile 驱动 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | AionUI desktop/mobile controls 共用 App Auto/fixed resolver；legacy intelligence proxy UI 已移除。 |
| Permission/access mode 在 composer 可见且不用 backend/provider 术语 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | Current desktop composer与mobile action-sheet pixels均绑定access control且不暴露backend/provider。 |
| Purpose 从 Home starter 选择，Home 不重复 capability 标签，管理进入 Settings | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI 使用 `HomeStarters + Settings Capabilities`，Home 由 starter 选中态表达能力，普通 composer 不再持久显示 purpose selector。 |
| Selected package launch uses ready/degraded/package_unavailable without gating ordinary Codex | `aligned_contract` | `source_implemented` | `pixel_unverified` | `not_claimed` | `source_missing` | `pixel_unverified` | AionUI 已精确消费 owner-projected action、支持 JIT/degraded continuation、optional Workspace 和单包故障隔离；仍需绑定当前 source 的三态 pixels/install 证据。 |
| 可 pin current-task summary bar | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `CurrentTaskAwareness` 提供 pin、status、elapsed、progress、next action 和 stop。 |
| Environment popover 与 workspace surfaces 分离 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | Current dark desktop pixel覆盖Environment popover与Browser入口；recorded workspace 与 Git context 保持只读。 |
| Advanced surfaces 默认无第三列；Files/Changes 按需，Preview 独立 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | Current desktop Files与mobile Preview pixels证明按需surface；旧八类equal-weight taxonomy保持退出。 |
| Terminal/Browser 从 Environment 或任务需要按需打开，无 Runtime duplicate | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | Source/DOM 已证明入口与默认关闭；本轮 core manifest 未单独打开 Terminal/Browser。 |
| Codex CLI 固定 executor；普通路径隐藏 backend/provider | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | 两边走既有 Codex/App bridge；permission/access 可见不等于暴露 backend/provider。 |
| 普通 state 读取走 fast App state | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `A1/A2`, `N2/N3`；Full/detail 只允许进入明确 diagnostics。 |
| Mutation 走 App action preview/confirm/execute/receipt | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native 已有 preview/action bridge，但完整高风险确认、receipt、rollback UX 尚未覆盖全部动作。 |
| Runtime/Files/Memory/Artifacts 只展示 refs | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native `workbenchModel.ts` 仍保留 `GlycoFold` 等 demo fallback，必须去除后才能算完整真实投影。 |
| Artifact Markdown/PDF/Mermaid/Code/KaTeX preview | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | `b2c05a1c...` 覆盖当前 session ref、绝对本地路径与非法输入拒绝；current Preview pixel不证明各renderer内容。 |
| Managed Worktree/Handoff 不进入当前 App | `aligned_contract` | `source_implemented` | `not_applicable` | `not_claimed` | `source_missing` | `not_applicable` | 当前版本只保留新任务初始 cwd 选择；未来只有稳定上游能力和明确需求同时成立时才重新评估。 |
| Review 复用 Files/Changes diff surface | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_not_assessed` | `pixel_unverified` | Owner-correct topic `166f63041...` 覆盖四targets、inline/detached、PR context、stage/commit/push、`gh` unavailable、Last turn与custom target instructions；非custom focus和line-level comments为protocol blocker。 |
| Settings 使用 full-window return/search/grouped rows且 OPL IA 不变 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | AionUI 保留 8+2 IA、search/redirect/state/action semantics，并使用 bounded page-section cards + flat rows；Shell `74848adf77360903c5ac7d64c32455a78fb3901a` 的 42 张图只作为历史专项 evidence，不代表当前 cohort pixels。 |
| 白色 main、`#FCFCFC` rail、中性 selected surface | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | 视觉 token 只由 App contract 维护；最终同尺寸light/dark/narrow installed pixels仍待验。 |
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
- **Thread operations：** 单一 App Server adapter 的 source/focused tests 已闭合；安装版仍需覆盖用户触发的
  list/start/resume/fork/archive/restore。模型 dynamic tools、第二 client、audit/idempotency 与 cross-host
  已明确退出本版，不是 pixel 或 release gap。
- **Artifact ref adapter：** `b2c05a1c...` 已覆盖当前 session 显式 attachment、可见 conversation result、
  用户选择的任意绝对本地路径和非法输入拒绝；current package只证明Preview surface，不证明各renderer和ref分流。
- **Session locality / Review：** Current source cohort 只保留 Home 新任务初始 cwd 选择，既有 session 的 recorded
  workspace 与 rail 分组只读，不提供 cwd 重绑、managed Worktree create/reuse 或 handoff。Review owner topic
  `166f63041...` 保留四 target、inline/detached、PR context、stage/commit/push、`gh` unavailable、Last turn与
  custom target instructions，并删除same-review-turn focus fallback；非custom focus与line-level comments等待typed protocol。
- **Narrow Settings：** `e218d79b7...` ancestry 将Access摘要卡的双列断点从`md`提高到`xl`，960px窗口保持
  单列；focused DOM锁定不得在`md`提前双列。匹配installed pixel由最终package owner验收。
- **Package/install：** `26.7.13` macOS arm64 directory-only package、packaged E2E与codesign已通过，
  但未安装；clean-user-data、first-run、用户线程操作与公开release promotion仍是独立证据。
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
