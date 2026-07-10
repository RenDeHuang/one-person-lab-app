# OPL App GUI Shell Conformance Matrix

Owner: `one-person-lab-app`
Purpose: `app_gui_shell_conformance_read_model`
State: `active_read_model`
Snapshot basis: `2026-07-10`
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

- AionUI source snapshot：`opl-aion-shell@fa95c1933c5662c4b1adee34e2faed77475e94ad`；
  已完成 fresh source audit。此前启动断点与截图均未绑定该精确 source snapshot，
  因此视觉路径保守记为 `pixel_unverified`，不沿用旧截图充当当前证据。
- Native source snapshot：`opl-native-workbench@43569d8beb5119d674c6fecae367b2915eacbfb0`；
  `npm test` 与 native live smoke 通过，像素证据为 candidate repo
  `out/native-live-smoke.png`。该证据不改变 `active_shell_adopted=false`、
  `release_ready=false`。
- Source anchors：AionUI 的 rail/Home/inspector 主要读取
  `packages/desktop/src/renderer/components/layout/Layout.tsx`、
  `pages/guid/GuidPage.tsx`、`pages/guid/components/AssistantSelectionArea.tsx`、
  `pages/guid/index.module.css`；Native 的数据和页面主要读取
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

## Matrix

| 功能或交互要求 | AionUI contract | AionUI source | AionUI pixel | Native contract | Native source | Native pixel | 验证入口与当前差距 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| App repo 拥有 GUI product truth | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `A1/A2`, `N1/N2`；两边 adapter 均禁止 authority transfer。 |
| ChatGPT Codex macOS 26.707.31428 是当前交互基线 | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | App contract 已更新；AionUI 未做 31428 source/pixel 验收，Native contract/pixel 仍绑定 superseded `26.707.31123`，现有像素不能证明新基线 parity。 |
| Home 是动态问题标题、最多四个 starter，不是 dashboard/landing | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI 仍由静态 hero + assistant card launcher 开场；Native 像素只证明旧 candidate 画面非空。 |
| 宽桌面 rail 默认展开且 `280-340px` 可调 | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | AionUI profile 当前仍声明 collapsed，source 默认展开但宽度/resize 未按新目标验收；Native rail 可见但 project 切换不完整。 |
| 窄窗口 rail 可收起并以 drawer/overlay 打开 | `aligned_contract` | `source_not_assessed` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | 需要窄 viewport 的 open/close/focus 像素与行为证据；不能把 hidden DOM 当 drawer。 |
| Rail 顶部 New task/Archived/Capabilities，底部 account/help/Settings | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI/Native 均未完整证明该全局骨架；Sites/Chat 禁止项也缺 route-bound pixels。 |
| Project task 与 projectless conversation | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | 无 workspace 文字聊天、文件/project 限制与解释尚无 fresh source/user-path evidence。 |
| 项目选择器切换真实 active project | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | AionUI 有 workspace/project 路径；Native 当前没有真实项目切换闭环。 |
| 项目 Context inputs 可选、可增删 | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | Native `App.tsx` 仍固定生成四个虚构 project inputs；AionUI 已有上下文入口但未按理想 rail 组织完成。 |
| 项目附件可添加、查看、移除 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | Native 缺真实 attachment actions；AionUI 附件能力已存在，但缺绑定当前 source 的像素证据。 |
| 一个项目对应 N 个最近对话 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | Native 有 history/timeline 形态，但 project-scoped persistence 与切换还不完整。 |
| 对话 search/pin/rename/archive/reset 与独立 Archived | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI 已有部分 search/rename/archive，但 pin/reset/独立 Archived 未完成新目标闭环；Native 缺日用管理。 |
| 主区保持单一 conversation timeline | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_implemented` | `pixel_verified` | 两边已有 timeline source；AionUI Home 默认入口仍偏离 chat-first。 |
| Composer 是 context strip + textarea + bottom action row | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | 两边有可输入 composer，但 project/local/branch、active chip、voice、safe inset 和稳定 action row 未整体证明。 |
| 模型与推理策略由 App profile 驱动 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | Native 已显示模型控制并消费默认值，完整动态 catalog/readback 仍需验证；文档不得复制 allowlist。 |
| Permission/access mode 在 composer 可见且不用 backend/provider 术语 | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI generated profile 的 Home/conversation visibility 仍为 false；Native candidate 也声明 false。 |
| Purpose 从 Home/Capabilities 选择，composer 只显示 active capability chip | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI 仍有 assistant selection/purpose switcher；Native purpose 映射不全且像素绑定旧目标。 |
| 可 pin current-task summary bar | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | 两边尚未证明 status/elapsed/progress/next action/stop 共用一条 projection。 |
| Environment popover 与 side panel 分离 | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | 当前 AionUI inspector 信息架构未按 workspace/local/git/subtasks/sources popover 分离。 |
| Side panel 默认关闭、可调，核心 Review/Terminal/Browser/Files | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI 约 188px 且沿用多 tabs；Native 折叠形态仍是旧 refs-only 结构，现有像素不证明四核心工具目标。 |
| Artifacts/Runtime/Actions/Memory 使用 secondary sections | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | 两边均未证明不再使用九个同权 tabs。 |
| Bottom panel/File tree/Terminal/Browser 默认关闭 | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | 缺启动默认值、显式打开/关闭、resize/focus 的 source 与 pixel evidence。 |
| Codex CLI 固定 executor；普通路径隐藏 backend/provider | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | 两边走既有 Codex/App bridge；permission/access 可见不等于暴露 backend/provider。 |
| 普通 state 读取走 fast App state | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `A1/A2`, `N2/N3`；Full/detail 只允许进入明确 diagnostics。 |
| Mutation 走 App action preview/confirm/execute/receipt | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native 已有 preview/action bridge，但完整高风险确认、receipt、rollback UX 尚未覆盖全部动作。 |
| Runtime/Files/Memory/Artifacts 只展示 refs | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native `workbenchModel.ts` 仍保留 `GlycoFold` 等 demo fallback，必须去除后才能算完整真实投影。 |
| Artifact Markdown/PDF/Mermaid/Code/KaTeX preview | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | 两边都有部分 preview surface；缺覆盖各 renderer、错误态和 export 的绑定证据。 |
| Settings 使用 full-window return/search/grouped rows 且 OPL IA 不变 | `aligned_contract` | `source_not_assessed` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | Settings owner contract 已在 main；本 baseline lane 未重审 active shell source/pixels，Native 缺完整 Settings。 |
| 白色 main、灰色 rail/subtle surface、OPL teal | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | 现有 Native pixels 绑定旧 source/基线；AionUI 无当前 route-bound pixels。 |
| Desktop Back/Forward、Previous/Next Task、New Window | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | 缺 menu/titlebar/keyboard source 与 desktop pixels。 |
| OPL 品牌、双语与普通语言一致 | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | 仍需逐 route 检查 carrier branding、混合语言、technical ids 与字号层级。 |
| Keyboard、focus、contrast、reduced motion | `aligned_contract` | `source_not_assessed` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | 视觉相似不能替代 accessibility；需 focused keyboard/focus/contrast/motion evidence。 |
| First-run 使用 App-owned readiness/page-state | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | Native 尚无完整 FirstRun；contract 和 test matrix 不能替代 clean-machine path。 |
| Desktop/WebUI 同 product semantics | `not_claimed` | `source_not_assessed` | `not_applicable` | `candidate_target` | `source_partial` | `pixel_unverified` | Native 共享 renderer/bridge 有基础，但缺当前 Desktop/WebUI route-by-route parity evidence。 |
| Release role | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | AionUI 仍是 active stable shell；Native 是 experimental candidate，package/smoke 不得推导 adoption 或 release-ready。 |

## Exact Remaining Source / Pixel Gaps

合同与人读 target 已更新，不代表 active implementation 完成。当前 exact gaps：

- **Generated profile：** rail 仍为 `collapsed`；Home/conversation permission selector
  仍为 `false`；composer、Home 与 inspector 仍是旧结构。Validator 必须继续报告
  `current_contract_deviation`，不能为了通过设计 gate 修改 generated profile。
- **AionUI source：** 未完成 projectless/no-workspace 限制、rail 全局骨架与 resize、
  purpose 移出 composer、可见 permission/access、完整 composer 三层、pinnable summary
  bar、environment popover/side-panel 分离、四核心工具、advanced surfaces 默认关闭、
  全量 conversation management 与 desktop affordance 的新目标验收。
- **AionUI pixels：** 当前 source snapshot 没有绑定 31428 target 的 route/viewport pixels；
  Home、conversation、rail drawer、side panel、Settings、light/dark 和双语均为
  `pixel_unverified`。
- **Native contract/source：** candidate contract 与 visual parity 仍绑定 superseded
  `26.707.31123`，permission hidden，purpose/side-panel/Settings/project semantics 不完整。
- **Native pixels：** `out/native-live-smoke.png` 只证明旧 candidate source 非空；不能证明
  31428 parity、四核心工具、permission/access、responsive drawer 或 release readiness。

未来收敛必须同步 product profile、candidate contract、active-shell behavior、validators
和 route-bound visual evidence；不能用本合同、本文或 focused tests 提升 source/pixel 状态。

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
