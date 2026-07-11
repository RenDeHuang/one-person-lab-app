# AionUI 主线 GUI 完整收敛方案

Owner: `one-person-lab-app`
Purpose: `aionui_mainline_gui_convergence_plan`
State: `active_plan`
Updated: `2026-07-11`
Machine boundary: 本文是 AionUI 主线 GUI 的执行计划与当前差距 read model。产品功能、
交互、视觉和机器验收仍分别归 GUI 三层文档、`contracts/`、validators、Shell source/tests
与对应 evidence。本文不创建第二套产品 authority，也不把计划状态解释为实现或发布完成。

## 结论

当前不应重写 GUI，也不能继续沿用“`dbff7370f` 尚未吸收”的旧计划。正确路线是：

1. 从当前 App / Shell 主线继续，不整体回退已经进入主线的能力；
2. 只保护 **OPL App 已采纳并对用户开放的功能**，不保护 AionUI fork 中未被 OPL
   采纳的上游功能；
3. 把当前主线逐项分类为 `keep / adapt / hide / reject / defer`；
4. 先同步 ChatGPT Codex `26.707.41301` 的 App authority，再做最小 Shell composition
   调整；
5. 继续采用 profile、bridge、existing composition/token 和必要最小 fork patch，避免
   新建 integration package、第二状态模型或广域 CSS；
6. Settings 四类表面当前是独立前置写集，完成后进入维护模式，不能替代 Home、rail、
   conversation、composer 的 P0 收敛。

## 当前事实快照

本节记录 `2026-07-11` 的规划输入。实施开始、吸收、发布或 cleanup 前必须 fresh readback，
不能把这些 SHA 当作永久 currentness。

| Surface | 当前事实 | 规划含义 |
| --- | --- | --- |
| App pre-plan authority base | `ed72e6644fd2f9453b959653d59be500b8338400`；当时相对 `origin/main@3681950d1866334dac04b973cdb03fd43c9cdb20` ahead 2 | 本文自身落地会继续推进 App main；Settings lane 仍以该 authority base 开始，最终 integration 必须重基到届时 main。 |
| Shell local main | `5204a68d41d799287a4567e61897df3c25345dc4`；相对 `gh-https/main@d981101b31c2534fe23c439fd0be0c0be2fb22b2` ahead 1 | Settings 仍有并行未提交写集，不是最终 core-GUI integration base。 |
| AionUI upstream | `0a903d835948fea6d2717a2cb93f85ed82f95245`，upstream `2.1.32` | 只做逐能力 intake，不整体 merge。 |
| Shell package/runtime | package `2.1.17`，AionCore pin `v0.1.44` | 版本号和 runtime intake 独立于 GUI 对齐。 |
| `dbff7370f` | 已通过 Shell merge `1752ba496377a0534ae88e6343f8051d961f79a5` 进入 main ancestry | 禁止重放，也不整体回退；从当前 tree 做功能级纠偏。 |
| Human interaction target | ChatGPT macOS `26.707.41301`，观察于 `2026-07-11` | 只作为布局与交互参考。 |
| Machine interaction target | 仍有 `26.707.31428` legacy markers | P0 authority sync 未完成。 |
| Settings | 正在从 `configuration / status / diagnostic` 升级为 `configuration / status / action / diagnostic` | 等最终 App/Shell/Framework SHA 后再冻结 ordinary IA。 |

## Authority 与非降级边界

### 什么必须保留

“现有功能不降级”只保护 OPL App 主线已采纳的产品能力。判定顺序固定为：

1. [`feature-inventory.md`](../product/gui/feature-inventory.md)；
2. App GUI、page-state、Settings、first-run、adapter 与 product-profile contracts；
3. 当前 OPL ordinary / secondary 用户路径及其 App-owned action/state source；
4. Shell source/tests 只证明实现存在，不能自动把 AionUI 功能升级为 OPL 产品功能。

| Classification | 含义 | 处理规则 |
| --- | --- | --- |
| `opl_adopted_active` | OPL 主线已开放且仍位于目标位置 | 保留功能、数据和可达性；只做必要视觉/实现收敛。 |
| `opl_adopted_relocated` | OPL 已采纳，但目标认知位置发生变化 | 新入口、state/action owner 和验证在同一变更落地后，才移除旧入口。 |
| `aionui_retained_unused` | Shell 代码存在，但 OPL 未采纳 | 可以隐藏，不进入 ordinary IA；不因隐藏而主动删除用户数据。 |
| `opl_explicitly_rejected` | App contracts 明确拒绝的上游产品面 | 隐藏或保持 diagnostics/development-only，不建立兼容产品入口。 |
| `diagnostic_only` | 仅供排障的 raw path、ref、receipt、enum、payload 或 log | 只进入 Advanced/Diagnostics，不算普通功能。 |

因此，AionUI generic custom assistants、Team、普通 backend/provider switching、French locale
和其它未进入 OPL 产品面的功能可以隐藏。已被 OPL 采用的 conversation、Runtime、
Capabilities、project context、preview、Files、Terminal、Browser、Settings、first-run 与双语
等能力，不因来源是 AionUI 而失去保护。

隐藏入口与删除持久数据是两个动作。未获得独立迁移/删除合同和用户确认时，不因 GUI
收敛主动删除上游遗留数据。

## GUI 三层文档同步

三层入口是 [`docs/product/gui/README.md`](../product/gui/README.md)。本计划只安排同步，
不在此复制三层产品规则。

| 层级 | Authority | 本轮必须更新 |
| --- | --- | --- |
| 功能层 | [`feature-inventory.md`](../product/gui/feature-inventory.md) | 明确 OPL adopted capability baseline；补齐已确认的 transcript export、desktop navigation；send drafts/queue 只有在产品语义获批后才进入。Settings 增加四类 surface 能力边界。 |
| 理想交互与视觉层 | [`ideal-interaction-spec.md`](../product/gui/ideal-interaction-spec.md)、[`visual-system.md`](../product/gui/visual-system.md)、[`codex-to-opl-app-delta.md`](../product/gui/codex-to-opl-app-delta.md)、[`element-audit.md`](../product/gui/element-audit.md) | 消除 composer context、Runtime rail、attachments ownership 的内部矛盾；补充 mobile action sheet、advanced-surface 替代位置、draft/queue 与四类 Settings 交互。 |
| Shell 实现层 | [`shell-implementation-guide.md`](../product/gui/shell-implementation-guide.md)、[`shell-conformance-matrix.md`](../product/gui/shell-conformance-matrix.md) | 绑定最终 Settings 后的 App/Shell SHA；记录 `dbff` 已吸收；按 contract/source/pixel 三轴更新当前 main，而不是继续使用旧 branch 假设。 |

机器行为变化还必须同步 `contracts/app-gui-product-contract.json`、
`contracts/app-page-state-matrix.json`、`contracts/app-product-profile.json`、对应 validators 与
最终 Shell generated profile。只改三层人读文档不能宣称 source 已对齐。

## 当前主线差距

| Priority | Surface | 当前状态 | Disposition | 目标 |
| --- | --- | --- | --- | --- |
| P0 | Interaction authority | 人读 target 为 `41301`，machine markers 仍为 `31428` | `adapt` | 先完成 App contract/page-state/profile v2 sync。 |
| P0 | Rail / conversation hierarchy | Persistent/drawer rail、project grouping、history 与 Runtime entry 已存在 | `keep` | 保持 project -> N conversations；只补统一 context consumer 和最终像素。 |
| P0 | Desktop model/reasoning | 仍通过 `ChatConversation -> ChatSlider.actionsSlot` 显示 | `adapt` | 挂回 composer action row，保留 App resolver、Auto/fixed persistence 和当前 default policy。 |
| P0 | Permission/access | Home/conversation 已有基础可见性，desktop/mobile 位置仍需统一 | `keep + adapt` | 与 model、attach、send/stop 处于同一发送决策点，不暴露 backend/provider。 |
| P0 | Composer context | 已合入 project/local/branch strip，与 `41301` human target 重复 | `adapt` | Project 归 rail，branch/locality 归 Environment；composer 只保留本次发送相关 refs、attachments、active capability。 |
| P0 | Side panel taxonomy | `Review/Terminal/Browser/Files + Artifacts/Runtime/Actions/Memory` 八类 taxonomy 仍在 ordinary path | `adapt/hide` | 保留 OPL 已采用的 Preview/Files/Terminal/Browser 底层能力，按需打开；未采纳 taxonomy 和重复面可隐藏。 |
| P0 | Environment | Anchored popover 已存在，字段和 OPL refs 不完整 | `keep + adapt` | 只渲染真实 workspace/locality/branch/changes/commit-push/compare/subtasks/sources 与次级 OPL refs。 |
| P1 | Project Context | workspace-keyed refs、rail 编辑和 send plumbing 已进入 main | `keep + adapt` | 保留单一数据源；移除 route/local/attachment duplication；缺失 ref 可见且可移除。 |
| P1 | Current task | timeline compact summary 与 side-panel Runtime 重复，默认 compact 近似 pinned | `adapt` | 单一 inline summary；长任务或用户操作才 pin；保留 status/elapsed/progress/next/stop。 |
| P1 | Transcript export | 已进入 main | `keep + harden` | 默认脱敏 Markdown/JSON；显式文件名/目录；分页完整；失败可见；workspace bundle 必须逐项选择和二次确认。 |
| P1 | Desktop navigation | Back/Forward、Previous/Next、New Window 已进入 main | `keep + harden` | 按 focused window 隔离状态；不为 WebUI 创建第二 IA。 |
| Candidate | Send drafts/queue | 上游有实现材料，App 功能层尚未正式冻结 | `defer pending product decision` | 先定义用户语义、持久化和 running-turn 行为，再决定 intake。 |
| P2 | Settings | 普通 IA 已形成，四类 surface/Framework configuration catalog 正在并行收敛 | `active prerequisite` | 当前 lane 完成后冻结 IA；随后只修回归，不驱动 P0/P1。 |
| P2 | Visual evidence | 已有旧 harness 与 Settings evidence，尚无最终 `41301` core matrix | `rebuild evidence` | 在最终 clean source 上覆盖 rail/Home/conversation/composer/Environment/model/mobile。 |
| Separate | AionCore `0.1.45` | 未 intake | `defer/separate` | 独立验证 recovery、managed-agent、ACP、startup 和 package 后再决定。 |

## Upstream Selective Intake

任何上游提交先与当前 source 做功能级 diff，分类为 `already_present / accept / adapt / reject`，
不能按旧计划顺序盲目 cherry-pick：

| Upstream item | 当前计划 |
| --- | --- |
| `#3550 / 756d544c6` 两级模型菜单 | `adapt candidate`；复用 menu composition，不复制 model allowlist/default/resolver。 |
| `#3554 / 8f16ee708` Mobile `+` sheet | `current-source preflight`；当前 Shell 已有部分 mobile model sheet 行为，先判重再补齐。 |
| `#3547 / 1619d36a` send drafts | `product decision first`；未进入功能层前不吸收。 |
| `#3553 / 9397d771` mode-control help | `adapt or defer`；不得恢复 backend/provider 或任意 skills。 |
| AionCore `0.1.45` | 独立 intake lane；不与 GUI commit 或完成声明捆绑。 |

Shell package version 只有完成独立 upstream/runtime intake 后才能更新；选择性复用某几个交互
不等于 fork 已升级到 upstream `2.1.32`。

## 实施顺序

### 0. 收敛当前前置写集

- 完成 Settings 四类 surface 的 App/Shell/Framework lanes；
- 以用户纠正后的边界隐藏未采纳的 AionUI custom assistants，不建立 OPL compatibility
  产品入口，也不主动删除底层数据；
- 回读最终三仓 SHA、clean 状态、功能迁移清单与 focused gate；
- core GUI lane 必须从最终 Settings 后的 App/Shell main 开始，不覆盖其 contracts/profile。

### 1. 同步 App Authority

- interaction baseline 升到 `opl_app_codex_interaction_baseline.v2`；
- `26.707.41301` 成为 current human/machine reference，`31428/31123` 进入历史；
- Project 归 rail，branch/locality 归 Environment；
- composer context 固定为 send-local refs/attachments/active capability；
- advanced surface host 取代八类固定 inspector taxonomy；
- Environment、transcript export、desktop navigation、核心视觉矩阵进入合同；
- Model policy 保持只读，只从最终 App authority 做一次完整 generated sync。

### 2. Composer 与 Mobile

- 先做 `#3550/#3554` current-source disposition；
- Desktop model/reasoning 进入 sendbox action row，删除 `ChatSlider.actionsSlot` model mount；
- Home/conversation 共用 resolver、formatter、persistence 和 error state；
- Mobile sheet 只显示 OPL 已采用的 attach、project refs、permission、model/reasoning、active
  capability；send/stop 保持主动作；
- 不显示 backend、provider、Team、raw MCP 或任意 skills。

### 3. Environment 与 Advanced Surfaces

- 保留 anchored Environment，并补真实字段和次级 OPL refs；
- ordinary conversation 停止默认挂载综合 inspector；
- Preview 由 artifact/file/result 打开；Files、Terminal、Browser 仅在用户或任务需要时打开；
- 任何已被 OPL 采纳的能力在旧入口移除前，必须已有可见、键盘可达且状态保持的新入口；
- 未被 OPL 采纳的 AionUI taxonomy 可直接隐藏。

### 4. Project Context 与 Task Summary

- 保留已有 workspace-keyed context source，统一 normalize/dedupe/add/remove/missing；
- rail 负责 project context 编辑，composer 只显示本次发送实际消费的 refs；
- project defaults 不写入 attachment、route 或 Guid local duplicate state；
- task summary 只保留 timeline 单一实例，删除 side-panel Runtime duplicate；
- 跨项目 Runtime cockpit 保持 rail 独立入口。

### 5. 已落地能力加固

- Transcript export：审计当前实现，不从头复制旧 lane；补分页、脱敏、显式路径、错误与
  workspace bundle 确认边界；
- Desktop navigation：审计 focused-window state、边界行为、window close cleanup 和 WebUI
  non-expansion；
- Send drafts：只有功能层和交互层先冻结后才进入实现，不以 upstream 存在作为产品授权。

### 6. CSS 与维护边界

- 本轮触及的 rail/composer/Environment/model/mobile/task 样式迁到稳定 component class、
  CSS module 或 token；
- 不新增 unscoped `.arco-*` override；
- 其它 legacy selectors 仅在触及对应组件时删除，不做独立广域重写；
- Settings 除共享组件回归外不进入 core GUI 写集。

### 7. Evidence 与收口

- App：model-policy check、GUI design-system、active-shell quick/full、release-boundary 与
  negative contract tests；
- Shell focused：composer/model、mobile sheet、Environment、advanced host、task summary、
  project context、export、desktop navigation；
- Shell full：Node、DOM、TypeScript、format、lint 0 errors、i18n、production package；
- 核心视觉矩阵至少覆盖 zh-CN desktop Home/conversation/Environment/model menu 与 mobile
  Home/rail-context/`+` sheet/model submenu，并增加 en-US DOM/no-overflow；
- 每张 evidence 绑定最终 Shell SHA、route、viewport、theme、locale 和状态 anchor；
- package/install/user-path/push/readback 必须属于同一 final source cohort；
- 文档、合同、focused tests 或 source screenshot 均不能单独证明 release-ready。

## 功能迁移清单格式

每个 `adapt` 或 `relocate` 项落地前必须填写：

| Field | Required content |
| --- | --- |
| `capability_id` | 来自 App 功能目录或 machine contract 的稳定功能标识。 |
| `adoption_class` | `opl_adopted_active`、`opl_adopted_relocated`、`aionui_retained_unused`、`opl_explicitly_rejected` 或 `diagnostic_only`。 |
| `current_entry` | 当前 OPL 用户可见入口；未采纳功能写 `none`。 |
| `target_entry` | 目标入口或 `hidden`。 |
| `state_owner` | App/Framework/domain/profile/bridge 的权威状态来源。 |
| `action_owner` | App action、platform adapter 或 user-local preference owner。 |
| `data_policy` | 保留、迁移、兼容读取或经确认删除；隐藏 UI 不自动等于删除。 |
| `evidence` | contract/source/behavior/pixel/package 中实际需要的最小证据。 |

## 写集与协调

| Lane | Allowed write set | Forbidden overlap |
| --- | --- | --- |
| Settings four surfaces | Settings Control Plane、Settings product doc、相关 validators/tests、Shell Settings、Framework configuration catalog | Home、conversation、composer、Environment 与 core rail layout。 |
| Core App authority | GUI baseline、page-state、GUI projection、三层文档与本计划 | Settings object 在其 lane 完成前只读；model-policy 值只读。 |
| Core Shell integration | Home/composer/rail-context/Environment/task/advanced host 及 focused tests | Settings pages、generated profile 手工编辑、AionCore intake。 |
| Runtime intake | AionCore pin、compatibility、startup/package tests | GUI composition 与产品 IA。 |

## 完成标准

只有以下条件全部有 fresh evidence 时，才可把本计划标为 `complete`：

- `41301` App machine authority、三层文档和 Shell behavior 一致；
- OPL adopted capability migration matrix 无未解释丢失；
- model/access/attachments/send-stop 与 active capability 处于 composer 正确认知位置；
- project/locality/branch 不再在 composer 重复；
- Environment 和按需 advanced surfaces 可见、可关闭、可聚焦且不形成默认第三列；
- project context、task summary、export、desktop navigation 达到对应 behavior gate；
- 未采纳 AionUI 功能可以隐藏，且没有被误写成 OPL 产品要求；
- final clean source 的 core visual matrix、package 和用户路径属于同一 cohort；
- 双仓 main 吸收、远端 readback 和 lane cleanup 有独立 Git evidence。

## Non-goals

- 不整体 merge AionUI upstream；
- 不重放或整体回退 `dbff7370f`；
- 不因 AionUI source/tests 存在而保留未采纳功能；
- 不创建 integration package、插件框架、第二状态模型或第二 product profile；
- 不在本计划复制模型 allowlist/default、Settings registry 或 runtime/domain truth；
- 不用 Settings 完成度替代 P0/P1 主体验；
- 不把 Native candidate、Team、French locale 或 release promotion 混入 core GUI 收敛。
