# AionUI 41301 Delta Audit

Owner: `one-person-lab-app`
Purpose: `aionui_41301_keep_adapt_drop_read_model`
State: `historical_branch_audit`
Machine boundary: 本文是 App-owned historical implementation read model。产品目标来自
[`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md) 与
[`ideal-interaction-spec.md`](ideal-interaction-spec.md)；实际行为仍以 current Shell source/tests
为准。本文不吸收分支、不改变 contracts、active shell 或 release readiness。

Currentness note: 本文是 `dbff7370f` 与最初 41301 convergence 的历史 disposition 记录，
不描述 current Shell 或 current product requirement。当时的 New task / Runtime / Archived
rail 只证明该历史 cohort；当前固定入口为 New task / Archived，Runtime 仅在 X0-01 route
显式启用时出现。current source/pixel 状态只读取
[`shell-conformance-matrix.md`](shell-conformance-matrix.md)。
Date: `2026-07-11`

Historical boundary: 本文记录 `dbff7370f` 尚未进入 Shell main 时的逐提交判断。后续
Shell merge `1752ba496377a0534ae88e6343f8051d961f79a5` 已把该 lineage 纳入 main，
因此“禁止整分支吸收”不再是可执行的前置动作。不要重放或整体回退该分支；当前主线的
功能级 `keep / adapt / hide / reject / defer`、OPL adopted-capability 非降级边界与实施顺序
改由 [`../../active/aionui-mainline-gui-convergence-plan.md`](../../active/aionui-mainline-gui-convergence-plan.md)
维护。

## 结论

`codex/gui-final-integration-20260711@dbff7370fa956541ace3378296c5a000eb64399d`
不能整体吸收，也不应按原提交顺序重放。

- Branch 相对 Shell main `5e46f49ab33fea3734db9a6fb6db79f73507bf07`
  有 14 commits、56 files、`+2767/-204`。
- 37 个实现文件中约 20 个属于 `L4 fork-body patch`；27 个实现路径已经与当前
  upstream change surface 重叠。
- 19 个测试文件贡献 1824 行新增，约占全部新增行的 66%。视觉 harness 与
  mock-heavy tests 占比过高，并
  反向要求 product DOM 保持旧结构。
- 有价值的能力包括 artifact export、desktop navigation、rail alignment、Settings anchor
  focus 与 evidence hardening；旧目录级上下文能力已被当前 session-first authority 废弃，且没有一个完整提交同时满足
  41301 交互位置、OPL authority 和最小 upstream delta。

因此，final disposition 是：**保留行为意图，拆分实现；废弃旧视觉目标与分支级
absorption。** 新 integration 必须从当前 Shell main 与 App authority 重新建立，不能以
`dbff7370f` 为 merge base。

## 分类词汇

| Status | 含义 | 后续动作 |
| --- | --- | --- |
| `keep` | 行为、位置、authority 与维护边界均符合新目标。 | 可在新 integration 中复用现有实现或最小 patch。 |
| `adapt` | 用户能力有价值，但位置、状态链、authority 或 fork delta 不符合。 | 重新实现最小边界，不整提交 cherry-pick。 |
| `drop` | 属于 superseded 31428 target、重复状态面、危险默认或无对应产品目标。 | 不进入新 integration；必要时保留历史 commit。 |
| `evidence_only` | 只保留验证意图或算法，不保留旧 target/selector/fixture。 | 在 41301 source 完成后重建证据。 |

## 未吸收分支逐提交审计

| Commit | Scope | Disposition | 保留内容 | 必须重做或删除 | Absorption |
| --- | --- | --- | --- | --- | --- |
| `96cb196c9` | Single/batch ZIP export、filename、preview tests | `adapt` | Transcript export、显式 filename/folder、失败可见、existing export platform bridge。 | 默认递归打包整个 workspace、10k message silent boundary、renderer 内存聚合、artifact authority 混写；拆成 transcript export 与显式确认的 local file bundle。 | 禁止整提交吸收。 |
| `36a021d62` | Workspace-keyed refs、rail section、Home/conversation plumbing、composer strip | `drop` | 路径 normalization/dedupe 算法可在当前 session 显式 picker 中独立复用。 | 删除 rail section、workspace-keyed store、route-state copy、Guid duplicate state 与 composer 持久 strip；不得把历史实现改名后继续作为目录级输入源。 | 不吸收产品面；只允许独立复用通用路径算法。 |
| `2f668449c` | Native menu、New Window、Back/Forward、Previous/Next Task、menu state IPC | `adapt` | Native menu affordance、localized labels、Back/Forward 与 adjacent task semantics。 | 拆开无关 language-startup change；menu state 必须绑定 focused window，不能使用 process-global stale state；减少 ChatLayout/i18n 冲突面。 | 禁止整提交吸收。 |
| `5262d9112` | Route-bound Playwright GUI evidence 与 manifest writer | `evidence_only` | Clean exact HEAD、route/viewport/theme/locale/anchor/layout bounds、claim boundary。 | 删除 Home/side-panel 旧 target；HEAD/manifest binding 归 App evidence owner；不为测试新增 fork-body DOM shape。 | 只提取证据协议。 |
| `68b45b367` | Generated workspace-keyed input profile | `drop` | 无当前产品 schema。 | 当前 App authority 只允许 session composer 显式输入；不得从旧 blob 或旧字段再生目录级输入。 | 不重放、不再生成。 |
| `0920b87b1` | Context-strip mocks | `drop` | 无独立产品价值。 | Composer strip 不原样保留；测试随新 context consumer 重写。 | 不吸收。 |
| `5b7e5de01` | Evidence backend readiness | `evidence_only` | 要求真实可用 test backend port，避免 about:blank/fake page。 | 不外推为 live runtime、packaged App 或 release evidence。 | 合并进新 harness。 |
| `4760b7044` | Deterministic rail state | `evidence_only` | 每个场景显式设置 rail state。 | 不依赖残留 localStorage；场景改为 41301。 | 合并进新 harness。 |
| `33bd30698` | Rendered-DOM rail selector | `evidence_only` | 减少生产 test-only attributes 的意图。 | 避免 `:has()` 和 Arco incidental DOM；优先 role/aria/composition root。 | 重写 selector。 |
| `1a5876a4a` | Overflow diagnostics | `evidence_only` | 失败时输出元素、文字和 bounds。 | 不保留中间实现。 | 与后两项 squash。 |
| `c4f2dae3c` | Range text measurement | `evidence_only` | 测量 rendered text bounds。 | 控制换行与 nested text 误报。 | 与前后项 squash。 |
| `d46ab4827` | Hidden-text filtering | `evidence_only` | 最终 visible text-node overflow 检查。 | 控制 DOM traversal 成本，不绑定旧 side-panel。 | 作为单一 helper 重写。 |
| `d4c9e0916` | Rail icon/label alignment | `adapt` | Icon 与 label 同行、稳定尺寸、无错位的视觉结果。 | 不锁死“禁止 Arco icon slot”或直属 span 数量；优先 token/CSS，再做最小 JSX patch。 | 禁止整提交吸收。 |
| `dbff7370f` | Mobile Settings anchor focus | `adapt` | Compatibility redirect 后只调整横向 nav，不把页面拉回顶部。 | 使用明确 nav-container ref，避免假设 `parentElement`；保持 P2 scoped。 | 禁止整提交吸收。 |

## 已进入 Shell Main 的 31428 残留

只审计 `dbff7370f` 不足以完成 41301 对齐。以下行为已经在 Shell main，必须进入新
integration 的 keep/adapt/drop 决策。

| Surface | Current source / behavior | Disposition | Required target |
| --- | --- | --- | --- |
| Directory/session rail | `Layout.tsx`、`SiderPrimaryNav.tsx`、`GroupedHistory/index.tsx`、`SiderFooter.tsx` 已提供 wide rail、narrow drawer、New task/Archived/Capabilities、workspace grouping 和 account/help/Settings。 | `keep + adapt` | 不重写 rail；分组使用 canonical thread ID 关联的显式 Project affinity 和单一 directory identity，不挂载目录级输入、组级删除或级联删除；Git-origin collapse 已从 source 移除。 |
| Environment summary | `ConversationEnvironmentPopover.tsx` 已是右上 anchored、default-closed summary，显示 workspace/locality/branch/subtasks/sources。 | `keep + adapt` | 增加 changes、commit/push、compare 与 OPL artifact/evidence secondary refs；首层不显示完整 Runtime。 |
| Multi-tool side panel taxonomy | `ChatSlider.tsx` 把 Review/Terminal/Browser/Files 设为一级 tabs，再把 Artifacts/Runtime/Actions/Memory 设为二级入口。 | `drop taxonomy` | 删除八类综合 inspector 与 More Context；保留底层 Files/Terminal/Browser/Preview 能力，按任务或显式动作打开。 |
| Side-panel infrastructure | `ChatLayout/index.tsx` 提供 resize、overlay、focus/backdrop 与 preview layout。 | `adapt` | 作为单一 advanced surface/preview 基础设施，不与 Environment 并列成常驻第三列；preview 不自动打开综合 inspector。 |
| Desktop model/reasoning location | `ChatConversation.tsx` 将 model control 作为 `actionsSlot` 放入 `ChatSlider -> Actions`；desktop `AcpSendBox` 没有模型控件。 | `adapt P0` | 保留 resolver/data flow，把 model/reasoning 放回 composer right tools；Home/conversation 共用 policy。 |
| Permission/access | Composer 已显示 permission，mobile sheet 还有 model。 | `keep + adapt` | Desktop/mobile 都在 composer，不能由 side panel 或 Settings 代替。 |
| Home layout | `GuidPage.tsx` 使用独立居中 hero、按当前可见数量排布的紧凑 starters 和 bottom-docked composer。 | `adapt` | Home 是 empty conversation canvas；starter 固定单项尺寸但不固定列数，按设置中的 visibility/order 居中换行。默认顺序为科研、演示、基金、元智能体，写书可重新开启；此为 OPL 产品例外，不伪装为 Codex 原生能力。 |
| CurrentTaskAwareness | Timeline 顶部 compact summary 默认 pinned，同时在 `ChatSlider -> Runtime` 重复挂载。 | `adapt + drop duplicate` | 保留 status/elapsed/progress/next action/stop；默认 inline/unpinned，长任务或用户动作才 pin；删除 side-panel Runtime duplicate。 |
| Settings scoped UI | `.settings-page-wrapper` / `.opl-settings-*` 卡片规则主要限定在 Settings。 | `keep P2` | 进入维护模式，不再驱动 P0/P1。 |
| Global OPL visual baseline | 旧 `opl-codex.css` 依赖广域 selector 与大量 `!important`，随 upstream DOM 漂移。 | `adapt` | 取消可选 Codex preset，改为始终启用的 token-first `opl-product-baseline.css`；组件空间关系留在 scoped CSS，旧用户主题数据保留但不应用。 |

## 最小维护边界

新 integration 按以下顺序执行，避免继续扩大 fork：

1. **Authority sync。** 当前裁决固定为 session/thread 是身份与工作单位；working directory
   作为新 session 初始 cwd、projectless 一次性 adoption 与 Project-affinity rail 分组 metadata，
   仅 `custom_workspace=false` 或无 canonical recorded cwd 可经 `thread/settings/update.cwd` 与 exact
   `thread/read` 完成一次 adoption；已有 cwd 不任意换组，命令或 turn 的实际 `pwd` 变化不反写该记录。Branch/locality 归
   Environment、active capability 留在 composer；当前 composer 只消费用户显式加入的 send-scoped
   输入。最终 Shell profile 必须从包含该 authority 的 App commit 生成，不重放旧 JSON。
2. **P0 composer。** 把 desktop model/reasoning 移到 composer，保持 access/send/stop
   同一决策点；删除 `ChatSlider.actionsSlot` 的模型控制。
3. **P0 Environment。** 保留并扩展 anchored Environment；删除综合 side-panel taxonomy，
   将 preview/files/terminal/browser 作为按需 advanced surface。
4. **P0/P1 session directory 与 inputs。** Rail 按 canonical thread ID 单行投影，并按显式 Project affinity
   分组；持续验证 Project identity 只使用单一 directory，不按 Git origin 合并。overview 可用时排除 stale Codex ACP cache row。Attachment、file/directory picker、paste/drop
   与 `/open` 只由当前 session composer 显式消费，不预载、不按 workspace 持久化。
5. **P1 task awareness。** 单一 inline summary，删除 Runtime duplicate，expanded refs
   进入 Environment/preview/turn disclosure。
6. **P1 export 与 desktop menu。** 分别用最小 platform adapter 重做，不与 rail/context
   大提交捆绑。
7. **Evidence。** Shell 保留 route-state Playwright 与最小 behavior tests；App evidence
   owner 绑定 clean HEAD/manifest。先覆盖 rail/conversation/composer/Environment，再覆盖
   Home、P1 和 Settings。

## Forbidden Absorption

- 不 merge、rebase 或 cherry-pick 整个 `dbff7370f` branch。
- 不把旧 side-panel screenshots、DOM tests 或 manifest 作为 41301 pixels。
- 不重放 `68b45b367` generated JSON；最终 profile 必须来自 App authority。
- 不恢复 workspace-keyed input store、rail 添加入口、route/Guid duplicate state 或持久 composer strip；
  working directory 不拥有 input、artifact 或 session。
- 不为了 visual harness 修改生产 DOM shape 或锁死 Arco 内部结构。
- 不用 Settings 完成度、旧 focused tests 或 docs-only target 声称 P0/P1 已完成。

## Evidence Boundary

本审计由 commit diff、current Shell source、App product docs 与静态 file/delta inventory
支持。它足以决定 lane disposition 和下一次 integration 边界；它不证明重做后的行为、
像素、package 或 installed App 已完成。后续每个 `adapt` 项必须取得对应 source/behavior
evidence，41301 alignment 还需要基于最终 clean source 的 fresh pixels。
