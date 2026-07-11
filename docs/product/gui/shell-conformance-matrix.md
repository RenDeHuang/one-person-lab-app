# OPL App GUI Shell Conformance Matrix

Owner: `one-person-lab-app`
Purpose: `app_gui_shell_conformance_read_model`
State: `active_read_model`
Snapshot basis: `2026-07-12`
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
- AionUI source snapshot：`opl-aion-shell@bbf94f2e44ef806e33451da568a3814658484619`（final integration candidate）。
  该 cohort 位于 integration branch，基于 local Shell main 但尚未吸收进 Shell main/remote；包含 Home/project controls、composer model/reasoning/
  access、mobile action sheet、Environment、按需 Files/Preview/Terminal/Browser、timeline task
  summary、cursor-safe transcript export 与 generated profile v2 reader。
- Fresh source gates：Shell Node `154 files / 1360 tests`、DOM `127 files / 682 tests`、
  TypeScript、1486-file format、i18n 与 lint `0 errors / 854 warnings`；App active-shell
  quick/full 和 release-boundary `205 pass / 2 platform skip`。这些结果证明对应 source/test
  surface，不是 runtime 或公开发布证明。
- Packaged visual evidence：[`evidence/aionui-41301/manifest.json`](evidence/aionui-41301/manifest.json)
  绑定同一 Shell SHA、真实 `E2E_PACKAGED=1` 命令和 8 个 desktop/mobile、light/dark、zh-CN/en-US
  Home/conversation 状态；所有 required anchors 与 layout checks 通过、coverage gaps 为 0。
  该证据只证明 route state 非空和布局边界，不宣称 1:1 parity 或 release-ready。
- Settings 的 42 张历史截图仍绑定较早 `74848adf77360903c5ac7d64c32455a78fb3901a`；
  它们继续作为 Settings 专项历史证据，不外推为当前 core matrix 或当前 Settings pixels。
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

| Priority | Product surface | OPL-owned target translated from 26.707.41301 | AionUI `30f5457d` | Status | Next decision |
| --- | --- | --- | --- | --- | --- |
| P0 | App frame | 左 project/conversation rail + 中央单列 timeline + 底部 composer + 右上按需 Environment details。 | Rail/timeline/composer/Environment 已按目标组合；默认无综合第三列。 | `source_implemented`, `pixel_verified` | 进入维护模式，只在上游 intake 时防回归。 |
| P0 | Project hierarchy | Project 是 N conversations 的父级；selected project 下可增加可选 context refs。 | Project/conversation history、active workspace selector、registered-directory management 与 context refs 共用单一 source。 | `source_implemented`, `pixel_verified` | 后续只补真实数据覆盖，不再复制状态。 |
| P0 | Home / New task | 与 conversation 共用 chat canvas/composer，不是 dashboard。 | Composer-first Home、全部用户可见 starters、stable order 与 responsive wrap 已实现。 | `source_implemented`, `pixel_verified` | 防止恢复 launcher/card wall 或静默四项截断。 |
| P0 | Conversation chrome | 只显示 task identity/直接动作；model/access 留在 composer。 | Header 保留 identity/navigation/Environment/Files；model/access 不再重复挂 header/side panel。 | `source_implemented`, `pixel_verified` | 维持 compact chrome。 |
| P0 | Composer | Add/access、model/reasoning 与 send-stop 位于发送决策点；不重复 rail/Environment context。 | Desktop/mobile 共用 App resolver/profile；mobile `+` sheet 收纳次级动作。 | `source_implemented`, `pixel_verified` | 后续上游 intake 只能替换 composition，不能覆盖 App policy。 |
| P0 | Environment details | 右上 anchored floating summary，默认关闭。 | 仅渲染真实 workspace/locality/changes 与可用 refs/actions；与 Files/Preview 分离。 | `source_implemented`, `pixel_verified` | 无真实数据的字段继续不显示。 |
| P0 | Visual grammar | 白 main、浅灰 rail、窄 reading lane、低对比、小圆角、极少页面卡片。 | Core desktop/mobile、light/dark、双语 8 场景已绑定当前 packaged pixels。 | `source_implemented`, `pixel_verified` | Pixel evidence 不升级为 1:1 parity；按回归维护。 |
| P1 | OPL capabilities | Plugins 认知位置映射到专业 capability；composer 只显示 active capability。 | Home/Capabilities 与 package shortcuts 已实现，未恢复 generic backend/provider/Team 普通入口。 | `source_implemented`, `pixel_verified` | 保持渐进披露。 |
| P1 | Progress / approval / receipt | 进入当前 timeline 与 task summary。 | Current-task summary 保持 timeline 单一实例；普通任务不默认 sticky。 | `source_implemented`, `pixel_unverified` | 后续补真实长任务/approval route evidence。 |
| P1 | Artifacts / evidence | Environment 次级 refs、Preview、Files 或 turn disclosure。 | Files 与 Preview 按需且窄屏互斥；mobile Preview 使用完整可读 overlay；transcript export 已按 cursor 与脱敏合同加固。 | `source_implemented`, `pixel_verified` | PDF/Mermaid/KaTeX 等 renderer 另做专项 evidence，不阻塞 core GUI。 |
| P2 | Settings | Secondary configuration/control surface，保持 OPL IA。 | 四类 surface 与 bounded cards 已进入 source；本次 core matrix 不复用旧 Settings pixels。 | `source_implemented`, `pixel_unverified` | 冻结 IA，只修回归；按需要重建当前 Settings evidence。 |

## Cross-shell Detail Appendix

以下明细保留 active/candidate 的历史审计价值，但不作为 AionUI 主线工作的优先级入口；
Native candidate 不得与 active-shell P0 差距竞争实施资源。

| 功能或交互要求 | AionUI contract | AionUI source | AionUI pixel | Native contract | Native source | Native pixel | 验证入口与当前差距 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| App repo 拥有 GUI product truth | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `A1/A2`, `N1/N2`；两边 adapter 均禁止 authority transfer。 |
| ChatGPT macOS 26.707.41301 是当前人读交互基线 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | App v2 authority、AionUI source 与 packaged 8-scene core evidence 已绑定；Native 仍是 superseded-reference deviation。 |
| Home 是动态问题标题、全部用户可见 configured starters，不是 dashboard/landing | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | AionUI `GuidPage + HomeStarters` 不再 `slice(0,4)`，按稳定配置顺序响应式换行且不静默截断。 |
| 宽桌面 rail 默认展开且 `280-340px` 可调 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_verified` | AionUI `Layout` 保留 min/default/max 与 resize；当前 Home desktop evidence 绑定展开态。 |
| 窄窗口 rail 可收起并以 drawer/overlay 打开 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | AionUI mobile rail 使用实际 overlay/drawer，并保留 selection；窄 viewport 像素待绑定。 |
| Rail 顶部 New task/Archived/Capabilities，底部 account/help/Settings | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI `SiderToolbar/SiderPrimaryNav/SiderFooter` 已闭合全局骨架和路由。 |
| Project task 与 projectless conversation | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | AionUI 支持无 workspace 文字聊天，并对 attach/paste/drop/`/open` 给出 project-required 限制。 |
| 项目选择器切换真实 active project | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | AionUI 有 workspace/project 路径；Native 当前没有真实项目切换闭环。 |
| 项目 Context inputs 可选、可增删 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_verified` | AionUI 使用 workspace-keyed 单一 context source；Home evidence 显示 project/context 认知位置。Native `App.tsx` 仍固定生成四个虚构 inputs。 |
| 项目附件可添加、查看、移除 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | Native 缺真实 attachment actions；AionUI 附件能力已存在，但缺绑定当前 source 的像素证据。 |
| 一个项目对应 N 个最近对话 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | Native 有 history/timeline 形态，但 project-scoped persistence 与切换还不完整。 |
| 对话 search/pin/rename/archive/reset 与独立 Archived | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI 已实现独立 Archived、pin/rename/archive/reset、分页 search 和 workspace expansion 隔离。 |
| 主区保持单一 conversation timeline | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_implemented` | `pixel_verified` | AionUI conversation evidence 绑定单 timeline、底部 composer 和按需 secondary surface。 |
| Composer 是 send-local refs/attachments + textarea + bottom action row | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | Project 归 rail，locality/branch 归 Environment；composer 不再重复持久 context。 |
| 模型与推理策略由 App profile 驱动 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_verified` | AionUI desktop/mobile controls 共用 App Auto/fixed resolver、5.6 Sol + max 与 persistence。 |
| Permission/access mode 在 composer 可见且不用 backend/provider 术语 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | Home/conversation 与 mobile sheet 均呈现用户语言 access mode，不暴露 backend/provider。 |
| Purpose 从 Home/Capabilities 选择，composer 只显示 active capability chip | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI 使用 `HomeStarters + CapabilitiesPage`，普通 composer 不再持久显示 purpose selector。 |
| 可 pin current-task summary bar | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `CurrentTaskAwareness` 提供 pin、status、elapsed、progress、next action 和 stop。 |
| Environment popover 与 workspace surfaces 分离 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | Environment 使用右上浮层；Files/Preview 只在用户或任务需要时出现。 |
| Advanced surfaces 默认无第三列；Files/Changes 按需，Preview 独立 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | 旧八类 equal-weight taxonomy 已退出 ordinary path；desktop Files 与 mobile Preview 均有当前像素。 |
| Terminal/Browser 从 Environment 或任务需要按需打开，无 Runtime duplicate | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | Source/DOM 已证明入口与默认关闭；本轮 core manifest 未单独打开 Terminal/Browser。 |
| Codex CLI 固定 executor；普通路径隐藏 backend/provider | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | 两边走既有 Codex/App bridge；permission/access 可见不等于暴露 backend/provider。 |
| 普通 state 读取走 fast App state | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `A1/A2`, `N2/N3`；Full/detail 只允许进入明确 diagnostics。 |
| Mutation 走 App action preview/confirm/execute/receipt | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native 已有 preview/action bridge，但完整高风险确认、receipt、rollback UX 尚未覆盖全部动作。 |
| Runtime/Files/Memory/Artifacts 只展示 refs | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native `workbenchModel.ts` 仍保留 `GlycoFold` 等 demo fallback，必须去除后才能算完整真实投影。 |
| Artifact Markdown/PDF/Mermaid/Code/KaTeX preview | `aligned_contract` | `source_partial` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_unverified` | Markdown mobile Preview 已绑定；PDF/Mermaid/Code/KaTeX 与错误态仍是专项 evidence gap。 |
| Settings 使用 full-window return/search/grouped rows且 OPL IA 不变 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | AionUI 保留 8+2 IA、search/redirect/state/action semantics，并使用 bounded page-section cards + flat rows；Shell `74848adf77360903c5ac7d64c32455a78fb3901a` 的 42 张图只作为历史专项 evidence，不代表当前 cohort pixels。 |
| 白色 main、灰色 rail/subtle surface、OPL teal | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | 当前 8 场景覆盖 light/dark、desktop/mobile 与双语；不外推为 1:1 parity。 |
| Desktop Back/Forward、Previous/Next Task、New Window | `aligned_contract` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | titlebar/menu 有现有桌面入口，但完整快捷键和 task navigation 验收未闭合。 |
| OPL 品牌、双语与普通语言一致 | `aligned_contract` | `source_implemented` | `pixel_verified` | `candidate_target` | `source_partial` | `pixel_verified` | Core evidence 覆盖 OPL brand、zh-CN/en-US Home/conversation；专项 route 继续按需检查。 |
| Keyboard、focus、contrast、reduced motion | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | rail/context focus、Escape、inert 和 reduced-motion 已有 focused coverage；contrast 与全键盘矩阵仍待验收。 |
| First-run 使用 App-owned readiness/page-state | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | Native 尚无完整 FirstRun；contract 和 test matrix 不能替代 clean-machine path。 |
| Desktop/WebUI 同 product semantics | `not_claimed` | `source_not_assessed` | `not_applicable` | `candidate_target` | `source_partial` | `pixel_unverified` | Native 共享 renderer/bridge 有基础，但缺当前 Desktop/WebUI route-by-route parity evidence。 |
| Release role | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | AionUI 仍是 active stable shell；Native 是 experimental candidate，package/smoke 不得推导 adoption 或 release-ready。 |

## Exact Remaining Source / Pixel Gaps

41301 core composition 已闭合。仍保留、但不属于本轮 core completion blocker 的证据边界：

- **专项 pixels：** 当前 8 场景覆盖 Home、conversation、composer/model、Environment、Files、
  mobile action sheet 与 mobile Preview；未单独覆盖 rail drawer 打开态、task-summary 长任务、
  approval/receipt、Terminal/Browser 和各 artifact renderer。
- **Settings pixels：** 42 张 Settings screenshot 仍绑定旧 cohort；本轮只确认 source/tests，
  不把旧图提升为当前 pixel evidence。
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
