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

- AionUI source snapshot：`opl-aion-shell@5fc28058b56d46861b47ff2968e94bfcadb6d6e6`；
  已完成 Home、rail、conversation/context、Settings、startup、projectless 和模型策略的
  fresh source/test audit。该精确 snapshot 的 production package 和 Settings visual E2E
  已通过，`tests/e2e/screenshots/settings-control-center-manifest.json` 的 28 个
  desktop/mobile 条目全部绑定同一 commit；该证据只提升 Settings 路径，不外推为
  Home、rail、conversation 或全局视觉 parity。
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

## Matrix

| 功能或交互要求 | AionUI contract | AionUI source | AionUI pixel | Native contract | Native source | Native pixel | 验证入口与当前差距 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| App repo 拥有 GUI product truth | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `A1/A2`, `N1/N2`；两边 adapter 均禁止 authority transfer。 |
| ChatGPT Codex macOS 26.707.31428 是当前交互基线 | `aligned_contract` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI contract 和主要交互已转向 31428；像素 parity 仍待最终 snapshot。Native 仍绑定 superseded `26.707.31123`。 |
| Home 是动态问题标题、最多四个 starter，不是 dashboard/landing | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI `GuidPage + HomeStarters` 已实现动态标题、四个以内 starter 和 composer-first Home。 |
| 宽桌面 rail 默认展开且 `280-340px` 可调 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | AionUI `Layout` 固定 `280/300/340` min/default/max，并提供 resize handle；最终像素待绑定。 |
| 窄窗口 rail 可收起并以 drawer/overlay 打开 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | AionUI mobile rail 使用实际 overlay/drawer，并保留 selection；窄 viewport 像素待绑定。 |
| Rail 顶部 New task/Archived/Capabilities，底部 account/help/Settings | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI `SiderToolbar/SiderPrimaryNav/SiderFooter` 已闭合全局骨架和路由。 |
| Project task 与 projectless conversation | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | AionUI 支持无 workspace 文字聊天，并对 attach/paste/drop/`/open` 给出 project-required 限制。 |
| 项目选择器切换真实 active project | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | AionUI 有 workspace/project 路径；Native 当前没有真实项目切换闭环。 |
| 项目 Context inputs 可选、可增删 | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | Native `App.tsx` 仍固定生成四个虚构 project inputs；AionUI 已有上下文入口但未按理想 rail 组织完成。 |
| 项目附件可添加、查看、移除 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | Native 缺真实 attachment actions；AionUI 附件能力已存在，但缺绑定当前 source 的像素证据。 |
| 一个项目对应 N 个最近对话 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | Native 有 history/timeline 形态，但 project-scoped persistence 与切换还不完整。 |
| 对话 search/pin/rename/archive/reset 与独立 Archived | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI 已实现独立 Archived、pin/rename/archive/reset、分页 search 和 workspace expansion 隔离。 |
| 主区保持单一 conversation timeline | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_implemented` | `pixel_verified` | 两边已有 timeline source；AionUI Home 默认入口仍偏离 chat-first。 |
| Composer 是 context strip + textarea + bottom action row | `aligned_contract` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI 已有稳定 action row、voice、attach/context、model/access/send；完整 project/local/branch strip 仍需收敛。 |
| 模型与推理策略由 App profile 驱动 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | Native 已显示模型控制并消费默认值，完整动态 catalog/readback 仍需验证；文档不得复制 allowlist。 |
| Permission/access mode 在 composer 可见且不用 backend/provider 术语 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_missing` | `pixel_unverified` | AionUI Home 与 conversation 共用 App profile visibility，并呈现用户语言 access mode。 |
| Purpose 从 Home/Capabilities 选择，composer 只显示 active capability chip | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI 使用 `HomeStarters + CapabilitiesPage`，普通 composer 不再持久显示 purpose selector。 |
| 可 pin current-task summary bar | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `CurrentTaskAwareness` 提供 pin、status、elapsed、progress、next action 和 stop。 |
| Environment popover 与 side panel 分离 | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | `ConversationEnvironmentPopover` 与工具 side panel 分离。 |
| Side panel 默认关闭、可调，核心 Review/Terminal/Browser/Files | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI side panel 默认关闭，wide split、compact overlay，并保留四个核心工具。 |
| Artifacts/Runtime/Actions/Memory 使用 secondary sections | `aligned_contract` | `source_implemented` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI `ChatSlider` 将四项放入默认折叠的 secondary disclosure。 |
| Bottom panel/File tree/Terminal/Browser 默认关闭 | `aligned_contract` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | 主要工具按需打开；bottom panel/file tree 的完整默认值与 keyboard 路径仍需系统验收。 |
| Codex CLI 固定 executor；普通路径隐藏 backend/provider | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | 两边走既有 Codex/App bridge；permission/access 可见不等于暴露 backend/provider。 |
| 普通 state 读取走 fast App state | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | `A1/A2`, `N2/N3`；Full/detail 只允许进入明确 diagnostics。 |
| Mutation 走 App action preview/confirm/execute/receipt | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native 已有 preview/action bridge，但完整高风险确认、receipt、rollback UX 尚未覆盖全部动作。 |
| Runtime/Files/Memory/Artifacts 只展示 refs | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_partial` | `not_applicable` | Native `workbenchModel.ts` 仍保留 `GlycoFold` 等 demo fallback，必须去除后才能算完整真实投影。 |
| Artifact Markdown/PDF/Mermaid/Code/KaTeX preview | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | 两边都有部分 preview surface；缺覆盖各 renderer、错误态和 export 的绑定证据。 |
| Settings 使用 full-window return/search/grouped rows且 OPL IA 不变 | `aligned_contract` | `source_implemented` | `pixel_verified` | `current_contract_deviation` | `source_partial` | `pixel_unverified` | AionUI 保留 8+2 IA、search/redirect/state/action semantics，并使用 bounded page-section cards + flat rows；Shell `5fc28058b56d46861b47ff2968e94bfcadb6d6e6` 的 manifest 绑定 28 张 desktop/mobile Settings 截图。 |
| 白色 main、灰色 rail/subtle surface、OPL teal | `aligned_contract` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_partial` | `pixel_verified` | AionUI token/layout 已对齐目标方向；最终 route-bound pixels 尚未绑定。 |
| Desktop Back/Forward、Previous/Next Task、New Window | `aligned_contract` | `source_partial` | `pixel_unverified` | `current_contract_deviation` | `source_not_assessed` | `pixel_unverified` | titlebar/menu 有现有桌面入口，但完整快捷键和 task navigation 验收未闭合。 |
| OPL 品牌、双语与普通语言一致 | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_verified` | 仍需逐 route 检查 carrier branding、混合语言、technical ids 与字号层级。 |
| Keyboard、focus、contrast、reduced motion | `aligned_contract` | `source_partial` | `pixel_unverified` | `candidate_target` | `source_partial` | `pixel_unverified` | rail/context focus、Escape、inert 和 reduced-motion 已有 focused coverage；contrast 与全键盘矩阵仍待验收。 |
| First-run 使用 App-owned readiness/page-state | `aligned_contract` | `source_implemented` | `pixel_unverified` | `candidate_target` | `source_missing` | `pixel_unverified` | Native 尚无完整 FirstRun；contract 和 test matrix 不能替代 clean-machine path。 |
| Desktop/WebUI 同 product semantics | `not_claimed` | `source_not_assessed` | `not_applicable` | `candidate_target` | `source_partial` | `pixel_unverified` | Native 共享 renderer/bridge 有基础，但缺当前 Desktop/WebUI route-by-route parity evidence。 |
| Release role | `aligned_contract` | `source_implemented` | `not_applicable` | `candidate_target` | `source_implemented` | `not_applicable` | AionUI 仍是 active stable shell；Native 是 experimental candidate，package/smoke 不得推导 adoption 或 release-ready。 |

## Exact Remaining Source / Pixel Gaps

合同与人读 target 已更新，不代表 active implementation 完成。当前 exact gaps：

- **AionUI source：** 主要结构已落地；剩余 source gap 是完整 project/local/branch
  composer context strip、rail 内可编辑 project inputs、bottom panel/file-tree 默认值、
  artifact renderer/export breadth、desktop menu/task navigation、contrast 和全键盘矩阵。
- **AionUI pixels：** Settings 已绑定当前最终 source snapshot 的 28 张 desktop/mobile
  route/interaction 截图；这证明 Settings 路径非空且符合已声明的 OPL 卡片基线，不证明
  全局 31428 parity。Home、conversation、rail drawer、side panel、light/dark 和完整双语
  视觉矩阵仍为 `pixel_unverified`。
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
