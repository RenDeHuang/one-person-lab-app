# AionUI 主线 GUI 完整收敛方案

Owner: `one-person-lab-app`
Purpose: `aionui_mainline_gui_convergence_plan`
State: `release_closeout_in_progress`
Updated: `2026-07-12`
Machine boundary: 本文是 AionUI 主线 GUI 的执行计划、结果 read model 和终局验收表。
产品功能、交互、视觉和机器验收仍分别归 GUI 三层文档、`contracts/`、validators、Shell
source/tests 与对应 evidence。本文不创建第二套产品 authority，也不把 source、tests 或
截图单独解释为公开 release-ready。

## 结论

`26.707.41301` 核心 GUI composition 已完成，不再需要大规模 GUI 重写，也不得重放
`dbff7370f` 或整体 merge AionUI upstream。当前只剩同一 final source cohort 的 App authority
提交、Shell main 吸收、最终 package/install/user-path、远端精确回读和 lane cleanup。

最终维护路线固定为：

1. App repo 继续拥有功能、交互、视觉和 page-state truth；
2. Shell 只消费 product profile、bridge、existing composition/token 与必要最小 fork patch；
3. 只保护 **OPL App 已采纳并对用户开放的功能**，不保护未采纳的 AionUI 产品面；
4. 上游 intake 逐能力分类为 `already_present / accept / adapt / reject / defer`，不做
   广域 history merge；
5. Settings 进入维护模式，不再替代 Home、rail、conversation、composer 主体验；
6. package、安装、用户路径、push/readback 和 cleanup 必须使用 fresh evidence 独立闭合。

## 当前事实快照

本节记录 `2026-07-12` closeout 输入。最终完成结论必须以 absorption、安装和远端回读后的
fresh SHA 为准。

| Surface | Fresh 状态 | 边界 |
| --- | --- | --- |
| App local main | `9634e9b600ce0baf8429d2178f467dd5f4fda547`，包含 `fbab0fafc9214fe90f3e836268426c29f6d73c7f` 的 41301 authority；GUI evidence/docs/validator closeout 尚待本轮提交 | `origin/main` 仍为 `6be9eba1561e26d87a51579f743ebd61be6716e3`，不能据本地状态宣称远端 current。 |
| Shell final integration | `codex/gui-convergence-integration-20260712@30f5457d1adde4c4535fbe216d4aacd8a180a868`，clean；`70ad78eb...` 是其祖先 | Shell main/remote 尚未吸收该 final integration candidate。 |
| Product profile | App `fbab0faf...:contracts/app-product-profile.json` 与 Shell generated profile 的 `jq -S` SHA-256 均为 `0c9c75eb0c22e90ee42f5405f36d829e2a68f908553e6149c8b15d0e77624d4e` | 当前无需空提交或纯格式同步。 |
| Shell full source gates | exact `30f5457d...`：Node `154/154 files, 1360/1360 tests`；DOM `127/127 files, 682/682 tests`；TypeScript、1486-file format、i18n 通过；lint `0 errors / 854 warnings` | warnings 是既有债务，不把 0 errors 扩大为视觉或 runtime 证明。 |
| App authority gates | GUI design-system consistent；active-shell quick/full 通过；release-boundary `205 pass / 2 platform skip` | 证明当前 contract/docs/validator 与 final Shell source cohort 一致，不证明安装或发布。 |
| Core visual evidence | `docs/product/gui/evidence/aionui-41301/manifest.json` 绑定 Shell `30f5457d...`、`E2E_PACKAGED=1` 和 8 个 route/layout 场景 | 只证明声明的非空像素、anchor 与 layout check；不证明 1:1 parity 或公开 release-ready。 |
| Final package/install | 尚未从最终 App/Shell main cohort 重建并原子安装 | 是 completion blocker。 |
| Git closeout | 双仓 main absorption、push、`git ls-remote` 与 lane cleanup 尚未完成 | 是 completion blocker。 |

## Authority 与非降级边界

“现有功能不降级”只保护 OPL App 主线已采纳的产品能力。判定顺序固定为：

1. [`feature-inventory.md`](../product/gui/feature-inventory.md)；
2. App GUI、page-state、Settings、first-run、adapter 与 product-profile contracts；
3. 当前 OPL ordinary / secondary 用户路径及其 App-owned action/state source；
4. Shell source/tests 只证明实现存在，不能自动把 AionUI 功能升级为 OPL 产品功能。

| Classification | 含义 | 处理规则 |
| --- | --- | --- |
| `opl_adopted_active` | OPL 主线已开放且位于目标位置 | 保留功能、数据和可达性；只做必要视觉与维护收敛。 |
| `opl_adopted_relocated` | OPL 已采纳，但目标认知位置改变 | 新入口、state/action owner 和验证同一变更落地后，才移除旧入口。 |
| `aionui_retained_unused` | Shell 代码存在，但 OPL 未采纳 | 可以隐藏，不进入 ordinary IA；隐藏不删除用户数据。 |
| `opl_explicitly_rejected` | App contracts 明确拒绝的上游产品面 | 隐藏或保持 diagnostics/development-only，不建立兼容产品入口。 |
| `diagnostic_only` | raw path、ref、receipt、enum、payload 或 log | 只进入 Advanced/Diagnostics，不算普通功能。 |

AionUI generic custom assistants、Team、普通 backend/provider switching、French locale 和其它
未进入 OPL 产品面的功能可以隐藏。已被 OPL 采用的 conversation、Runtime、Capabilities、
project context、Preview、Files、Terminal、Browser、Settings、first-run 与中英文不能因来源是
AionUI 而丢失。

## 三层文档状态

三层入口是 [`docs/product/gui/README.md`](../product/gui/README.md)。本计划只汇总状态，不复制
三层产品规则。

| 层级 | Authority | 当前状态 | 后续规则 |
| --- | --- | --- | --- |
| 功能层 | [`feature-inventory.md`](../product/gui/feature-inventory.md)、App contracts | `aligned` | OPL adopted capability baseline、transcript export、desktop navigation 和 Settings 边界已存在；send drafts/queue 未获产品授权，继续 defer。 |
| 理想交互与视觉层 | [`ideal-interaction-spec.md`](../product/gui/ideal-interaction-spec.md)、[`visual-system.md`](../product/gui/visual-system.md)、[`codex-to-opl-app-delta.md`](../product/gui/codex-to-opl-app-delta.md)、[`element-audit.md`](../product/gui/element-audit.md) | `aligned` | Project 归 rail，branch/locality 归 Environment；composer 只保留 send-local 决策；Home 不截断用户可见 starter。 |
| Shell 实现层 | [`shell-implementation-guide.md`](../product/gui/shell-implementation-guide.md)、[`shell-conformance-matrix.md`](../product/gui/shell-conformance-matrix.md) | `implementation_complete_release_closeout_pending` | 已绑定 final Shell source/profile/tests/core pixels；package/install/push/cleanup 仍独立闭合。 |

## OPL 已采纳能力收敛结果

| Priority | Capability | Adoption | 当前结果 | 剩余边界 |
| --- | --- | --- | --- | --- |
| P0 | Project/conversation rail | `opl_adopted_active` | 宽屏 persistent、窄屏 drawer；active workspace 与 registered directory management 分离；project 可拥有 N conversations。 | 维护回归，不恢复 dashboard/assistant rail。 |
| P0 | Home / New task | `opl_adopted_relocated` | 与 conversation 共用 composer-first canvas；全部用户可见 configured starters 按稳定顺序响应式换行，不再限制四项。 | 不恢复 launcher/card wall。 |
| P0 | Composer decisions | `opl_adopted_relocated` | Desktop/mobile 的 attach、permission/access、model/reasoning、active capability 与 send-stop 位于发送决策点；不暴露 backend/provider。 | 上游 intake 只能替换 composition，不能覆盖 App policy。 |
| P0 | Environment | `opl_adopted_active` | 右上 anchored、默认关闭；承载 workspace/locality/changes 与真实 refs/actions。 | 无真实数据的字段不显示。 |
| P0 | Advanced surfaces | `opl_adopted_relocated` | 默认无综合第三列；Files、Preview、Terminal、Browser 按需打开，窄屏 Preview 使用完整 overlay。 | 专项 renderer pixels 不属于 core composition blocker。 |
| P1 | Project context | `opl_adopted_active` | workspace-keyed 单一 source，rail 编辑，send 直接消费；不复制到 route/local/attachments。 | 保持 missing/remove/dedupe 行为。 |
| P1 | Current task | `opl_adopted_relocated` | timeline 单一 summary；普通任务不默认 sticky，长任务或用户操作才 pin。 | 真实长任务/approval evidence 单独维护。 |
| P1 | Transcript export | `opl_adopted_active` | cursor-safe、递归脱敏、Markdown/JSON、失败可见；`/export` 使用同一安全路径。 | workspace bundle 继续要求逐项选择与确认。 |
| P1 | Desktop navigation | `opl_adopted_active` | 保留 Back/Forward、Previous/Next、New Window 的 OPL 路径，不创建 WebUI 第二 IA。 | 完整快捷键专项验收不阻塞 core GUI。 |
| P2 | Settings | `opl_adopted_active` | 保留 OPL IA、bounded page-section cards 与 flat rows；不恢复旧 quiet/Codex-style Settings 实验。 | 维护模式，只修回归。 |

## Upstream Selective Intake 结果

| Upstream item | Final disposition |
| --- | --- |
| `#3550 / 756d544c6` 两级模型菜单 | `adapted`；复用 menu composition，保留 App model allowlist/default/resolver 与 Auto/fixed persistence。 |
| `#3554 / 8f16ee708` Mobile `+` sheet | `adapted`；只呈现 OPL 已采纳的 attach、permission、reasoning、model 等 send-local 动作。 |
| `#3547 / 1619d36a` send drafts | `deferred`；功能层未授权，不进入本轮。 |
| `#3553 / 9397d771` mode-control help | `rejected_or_deferred`；不恢复 backend/provider、Team 或任意 skills ordinary UI。 |
| AionCore `0.1.45` | `separate`；runtime intake 不与 GUI 完成声明捆绑。 |

Shell package/version 和 AionCore intake 继续作为独立维护工作。选择性吸收交互不等于 fork 已
整体升级到 upstream `2.1.32`。

## Evidence 与剩余收口

### 已完成

- App baseline schema v2、page-state、product profile 和三层文档已指向 `26.707.41301`；
- Shell Home/rail/composer/mobile/Environment/advanced surfaces/task/export 已进入 final integration；
- App `fbab0faf...` 与 Shell generated profile 语义一致；
- exact Shell `30f5457d...` 的 Node/DOM/TypeScript/format/lint/i18n 与 packaged visual gates 已 fresh 通过；
- packaged 8-scene core visual manifest 已绑定 exact Shell SHA，并明确限制 claim。

### Completion blockers

1. 提交当前 App authority/docs/evidence/validator closeout，并在绑定 final Shell checkout 后跑
   GUI design-system、active-shell quick/full 与 release-boundary；
2. ff-only 吸收 Shell final integration 到 Shell main；
3. 从最终双仓 main cohort 重建 macOS arm64 App，重跑 packaged core visual E2E；
4. 原子替换 `/Applications/One Person Lab.app`，验证 bundle id、版本、`app.asar` hash、
   AionCore 架构/版本、签名、启动无 fatal、Home/conversation/composer/Settings/Preview 关键路径；
5. 推送双仓 main，并通过 `git ls-remote` 精确回读；
6. 对所有相关 lanes 做 absorption/supersession audit，只删除 exact/tree/patch-equivalent 或
   owner 明确授权 superseded 的 lane；保护任何 dirty/needs-owner-review 写集。

## 完成度审计表

| Requirement | 当前状态 | 完成证据 |
| --- | --- | --- |
| 41301 App machine authority 与三层文档一致 | `done_pending_commit` | Contracts/docs/validator diff；App gate 待本轮提交前 fresh 复跑。 |
| Shell GUI behavior 与 OPL 非降级边界一致 | `done_candidate` | Shell `30f5457d...` source、focused/full tests、TypeScript/format/lint/i18n 与 packaged visual evidence。 |
| Final generated profile 一致 | `done` | 规范化 SHA-256 `0c9c75eb...24d4e`，profile tests `19/19`。 |
| Core visual matrix | `done_candidate` | 8-entry packaged manifest，0 coverage gaps；不宣称 1:1 parity。 |
| Final package/install/user path | `not_started_on_final_cohort` | 必须由最终 build、安装与 live readback 证明。 |
| Main absorption/push/readback | `not_started_on_final_cohort` | 必须由 main ancestry、push 与 `git ls-remote` 证明。 |
| Lane cleanup | `pending_audit` | 必须逐 lane 机械分类并保护 dirty owner 写集。 |

只有所有 `completion blockers` 关闭后，本文状态才可改为 `complete`。

## 维护边界

- 不整体 merge AionUI upstream；
- 不重放或整体回退 `dbff7370f`；
- 不因 AionUI source/tests 存在而保留未采纳功能；
- 不创建 integration package、插件框架、第二状态模型或第二 product profile；
- 不在本文复制模型 allowlist/default、Settings registry 或 runtime/domain truth；
- 不新增 unscoped `.arco-*` override；触及组件时才渐进迁移 legacy CSS；
- 不用 Settings 完成度替代 P0/P1 主体验；
- 不把 Native candidate、Team、French locale、AionCore intake 或 release promotion 混入
  core GUI 收敛。
