# AionUI 主线 GUI 完整收敛方案

Owner: `one-person-lab-app`
Purpose: `aionui_mainline_gui_convergence_plan`
State: `active_parity_convergence`
Updated: `2026-07-13`
Machine boundary: 本文是 AionUI 主线 GUI 的执行计划、结果 read model 和终局验收表。
产品功能、交互、视觉和机器验收仍分别归 GUI 三层文档、`contracts/`、validators、Shell
source/tests 与对应 evidence。本文不创建第二套产品 authority，也不把 source、tests 或
截图单独解释为公开 release-ready。

## 结论

`26.707.41301` 核心 GUI composition 与 OPL 专有能力位置继续有效，不需要大规模 GUI
重写，也不得重放 `dbff7370f` 或整体 merge AionUI upstream。AionUI 主线已经在 Home package
readiness、Settings/Personalization、managed update 和 runtime bridge 上继续前进，因此本计划
已重新打开 Codex parity 收敛：此前 `complete` 只覆盖 41301 composition 与一部分 flexible
coordination source，不能覆盖 projectless 文件能力、App Server rail authority、任意绝对本地路径
Preview、首结果幂等 replay、可见协调入口、unarchive、Local/Worktree lifecycle、cross-host handoff
和完整 Review pane。旧 cohort 证据保留，但不冒充这些新增目标已实现。

最终维护路线固定为：

1. App repo 继续拥有功能、交互、视觉和 page-state truth；
2. Shell 只消费 product profile、bridge、existing composition/token 与必要最小 fork patch；
3. 只保护 **OPL App 已采纳并对用户开放的功能**，不保护未采纳的 AionUI 产品面；
4. 上游 intake 逐能力分类为 `already_present / accept / adapt / reject / defer`，不做
   广域 history merge；
5. Settings 进入维护模式，不再替代 Home、rail、conversation、composer 主体验；
6. 跨顶层线程协调由 Codex App Server thread/turn + OPL host 安全/审计薄适配实现，不复用
   同一 agent tree 的 `send_input`，也不建立第二套 thread store；
7. package、安装、用户路径、push/readback 和 cleanup 必须使用 fresh evidence 独立闭合。
8. Codex parity 采用薄 adapter：Project/workspace 不是权限域；thread/Git truth 继续归 Codex
   Core/App Server 与既有 Git integration，Shell 不复制 store。

## 当前事实快照

本节记录 `2026-07-13` currentness 输入。任何当前完成结论必须以同一 source cohort 的
fresh gate、pixels、package/user path 和远端回读为准。

| Surface | Fresh 状态 | 边界 |
| --- | --- | --- |
| App authority refresh | 本轮隔离 lane 基于 `f9d9c2420fe64d78b44afb6b1186a8fd499a1ebc` | 重新定义 projectless、App Server rail、absolute-path Preview、idempotency replay、visible coordination、unarchive、Local/Worktree/handoff/snapshot 与 Review thin adapter；最终 App main currentness 由集成 owner 回读。 |
| Shell corrected source cohort | `69bce9d565a9fd6460e61273e8905abe0158d2db`（parent `a0ce713b65801fd9ca7f46ad168c977c75a187de`） | Artifact、navigation、thread protocol 与 App profile projection 保持；cross-project/workspace/overlap/loop 改为 advisory，running 直接 steer，archive 直接执行，turn/start 不覆盖目标 sticky settings。 |
| Latest reviewed upstream | `v2.1.33@a819d175683d5a0aada20064888da07bfcecdb6a` | 相比已评估 GUI cohort 无 GUI delta；不整体 merge，release/runtime intake 单独处理。 |
| Product profile | 使用 App 官方生成器和当前 OPL Flow workflow policy 对 Shell generated profile 重建后，`jq -S` canonical diff 为空 | Generated profile 的 compatibility projection 包含由 OPL Flow policy 派生的字段；不要求与 raw App JSON 字节相等，不提交纯格式噪音。 |
| Verified GUI ancestor gates | Shell `a0ce713b...`：full suite `293 files / 2172 tests` 通过、`1 file / 3 tests` skip；root TypeScript、1514-file format、i18n 通过。App active-shell full 通过；release-boundary `293 pass / 2 platform skip / 0 fail` | 证明最低 GUI ancestor 与 source contract 边界，不单独证明 installed path 或 release-ready。 |
| Corrected source gates | Shell `69bce9d...`：target Node `19/19`、DOM `4/4`；full `293 files` pass / `1` skip、`2173 tests` pass / `3` skip；TypeScript、i18n、format、diff-check 通过 | 只证明 flexible advisory、running steer、archive 与无额外 confirmation 基线；不证明本轮 reopened parity 项。 |
| Live App Server protocol | Codex CLI `0.144.1` + 临时 `CODEX_HOME`：两条 materialized top-level threads 完成 list/source-hint、target turn/start/result/read、resume、fork 与 archive readback | 证明 production adapter 的本机 protocol wire；未覆盖 `turn/steer` 竞态、Shell packaged two-root UI 或 remote host。 |
| Historical source gates | exact `0ebc1fdd278e8a79602458e15e28cf814dfd917d`：`test:full` 282 files pass / 1 skip、2044 tests pass / 3 skip；TypeScript、1487-file format、i18n 与 lint 0 errors | 只属于历史 cohort。 |
| Historical core visual evidence | `docs/product/gui/evidence/aionui-41301/manifest.json` 绑定 Shell `0ebc1fdd...`、`E2E_PACKAGED=1`、时间 `2026-07-11T21:16:06.183Z` 和 8 个 route/layout 场景 | Manifest 与截图保持原字节/原 SHA；current `605fd91c...` pixels 为 unverified。 |
| Historical Settings evidence | `docs/product/gui/assets/settings-desktop-light-manifest-20260712.json` 绑定 Shell `fadd91f9...` 的 14-entry desktop Light matrix | 精确历史证据，不外推为当前 Settings pixels。 |
| Latest installed cohort | `/Applications/One Person Lab.app` 的 `26.7.12` closeout 曾完成 asar/AionCore/codesign 与 Home -> Settings -> Home readback | 该证据早于 final Shell，不能证明 `a0ce713b...` 已安装或用户路径 current。 |

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
未进入 OPL 产品面的功能可以隐藏。已被 OPL 采用的 conversation、Runtime、Home capability
starters、project context、Preview、Files、Terminal、Browser、Settings → Agents & Capabilities、
first-run、中英文，以及本轮纳入 authority 的跨顶层线程协调不能因来源是 AionUI 而丢失。

## 三层文档状态

三层入口是 [`docs/product/gui/README.md`](../product/gui/README.md)。本计划只汇总状态，不复制
三层产品规则。

| 层级 | Authority | 当前状态 | 后续规则 |
| --- | --- | --- | --- |
| 功能层 | [`feature-inventory.md`](../product/gui/feature-inventory.md)、App contracts | `parity_target_refreshed` | 七类 parity 能力已进入 machine truth；不代表 Shell source 已实现。 |
| 理想交互与视觉层 | [`ideal-interaction-spec.md`](../product/gui/ideal-interaction-spec.md)、[`visual-system.md`](../product/gui/visual-system.md)、[`codex-to-opl-app-delta.md`](../product/gui/codex-to-opl-app-delta.md)、[`element-audit.md`](../product/gui/element-audit.md) | `parity_target_refreshed` | Project 归 rail metadata，权限归 Codex；协调、Preview、Local/Worktree 与 Review 位置已定义。 |
| Shell 实现层 | [`shell-implementation-guide.md`](../product/gui/shell-implementation-guide.md)、[`shell-conformance-matrix.md`](../product/gui/shell-conformance-matrix.md) | `reopened_source_gaps` | `69bce9d...` 只保留为 flexible coordination 基线；本轮 source/pixel/package 验收尚未闭合。 |

## OPL 已采纳能力收敛结果

| Priority | Capability | Adoption | 当前结果 | 剩余边界 |
| --- | --- | --- | --- | --- |
| P0 | Project/conversation rail | `opl_adopted_active` | 宽屏 persistent、窄屏 drawer；active workspace 与 registered directory management 分离；project 可拥有 N conversations。 | 维护回归，不恢复 dashboard/assistant rail。 |
| P0 | Home / New task | `opl_adopted_relocated` | 与 conversation 共用 composer-first canvas；全部用户可见 configured starters 按稳定顺序响应式换行，不再限制四项。 | 不恢复 launcher/card wall。 |
| P0 | Composer decisions | `opl_adopted_relocated` | Desktop/mobile 的 attach、permission/access、model/reasoning、active capability 与 send-stop 位于发送决策点；不暴露 backend/provider。 | 上游 intake 只能替换 composition，不能覆盖 App policy。 |
| P0 | Environment | `opl_adopted_active` | 右上 anchored、默认关闭；承载 workspace/locality/changes 与真实 refs/actions。 | 无真实数据的字段不显示。 |
| P0 | Advanced surfaces | `opl_adopted_relocated` | 默认无综合第三列；Files、Preview、Terminal、Browser 按需打开，窄屏 Preview 使用完整 overlay。 | 专项 renderer pixels 不属于 core composition blocker。 |
| P1 | Project context | `opl_adopted_active` | workspace-keyed 单一 source，rail 编辑，send 直接消费；不复制到 route/local/attachments。 | 保持 missing/remove/dedupe 行为。 |
| P1 | Package launch readiness | `opl_adopted_active` | Unavailable starter 显示原因/允许动作；每次 workspace/quest launch 前执行 Framework-owned activation，失败 fail closed。 | 不从 installed flag 推断 ready，不在 shell 复制 package currentness。 |
| P1 | Current task | `opl_adopted_relocated` | timeline 单一 summary；普通任务不默认 sticky，长任务或用户操作才 pin。 | 真实长任务/approval evidence 单独维护。 |
| P1 | Transcript export | `opl_adopted_active` | cursor-safe、递归脱敏、Markdown/JSON、失败可见；`/export` 使用同一安全路径。 | workspace bundle 继续要求逐项选择与确认。 |
| P1 | Desktop navigation | `opl_adopted_active` | 保留 Back/Forward、Previous/Next、New Window 的 OPL 路径，不创建 WebUI 第二 IA。 | 完整快捷键专项验收不阻塞 core GUI。 |
| P1 | Cross-thread coordination | `opl_adopted_target_reopened` | Product target要求 rail 可见键盘入口、unarchive、同 key 首结果 replay、cross-host handoff；`69bce9d...` 只覆盖部分基线。 | Source/pixels/package 均未闭合。 |
| P1 | Artifact preview adapter | `opl_adopted_target_reopened` | 用户显式任意绝对本地路径或 workspace-scoped project ref 薄接现有 Preview。 | 需补双 scope、traversal/scheme/silent-read source tests。 |
| P1 | Projectless local input | `opl_adopted_target_reopened` | 无 workspace 保留 attachment、file/directory picker、paste/drop、`/open`，只服从 Codex permission。 | Current Shell 仍有 project-required 限制。 |
| P1 | Local / Worktree lifecycle | `opl_adopted_target` | `$CODEX_HOME/worktrees`、detached selected branch HEAD、selected Local changes、`.worktreeinclude`、same-task reuse、handoff、snapshot/restore 使用 Codex/Git authority。 | Source/pixels/package 未实现；cleanup前恢复证据必须闭合。 |
| P1 | Review pane | `opl_adopted_target` | 复用 Files/Changes，覆盖 uncommitted/base branch/commit/custom、inline/detached、Unstaged/Staged/Commit/Branch/Last turn；PR context依赖 `gh`。 | Existing diff只是基础，完整 source与 unavailable state 未闭合。 |
| P2 | Settings | `opl_adopted_active` | 保留 OPL IA、bounded page-section cards 与 flat rows；不恢复旧 quiet/Codex-style Settings 实验。 | 维护模式，只修回归。 |

## Upstream Selective Intake 结果

| Upstream item | Final disposition |
| --- | --- |
| `#3550 / 756d544c6` 两级模型菜单 | `adapted`；复用 menu composition，保留 App model allowlist/default/resolver 与 Auto/fixed persistence。 |
| `#3554 / 8f16ee708` Mobile `+` sheet | `adapted`；只呈现 OPL 已采纳的 attach、permission、reasoning、model 等 send-local 动作。 |
| `#3547 / 1619d36a` send drafts | `deferred`；功能层未授权，不进入本轮。 |
| `#3553 / 9397d771` mode-control help | `rejected_or_deferred`；不恢复 backend/provider、Team 或任意 skills ordinary UI。 |
| AionCore `0.1.45` | `separate`；runtime intake 不与 GUI 完成声明捆绑。 |
| AionUI `v2.1.33` | `reviewed_no_gui_delta`；只含 release/runtime 变化，不触发 GUI merge。 |

Shell package/version 和 AionCore intake 继续作为独立维护工作。选择性吸收交互不等于 fork 已
整体升级到 upstream `2.1.32` 或 `2.1.33`。

## Evidence 与收口状态

### 历史 exact-cohort 已完成

- App baseline schema v2、page-state、product profile 和三层文档已指向 `26.707.41301`；
- Shell Home/rail/composer/mobile/Environment/advanced surfaces/task/export 已进入历史 closeout main；
- 历史 App profile 与 Shell generated profile 语义一致；
- exact Shell `0ebc1fdd...` 的 full tests、TypeScript、format、lint、i18n 与 packaged visual gate 已 fresh 通过；
- packaged 8-scene core visual manifest 已绑定 exact Shell SHA，并明确限制 claim；
- `26.7.12` macOS arm64 App 已原子安装，签名、AionCore、Home/Settings live path 与 stable CDP error readback 已验证。

### 当前 reopened 边界

1. App GUI machine contract 与三层文档定义本轮 parity target；focused authority validators 只证明
   产品真相一致，不证明 active Shell source。
2. Shell `69bce9d...` 继续证明 flexible advisory/steer/archive 基线；可见协调入口、unarchive、
   same-key 首结果 replay、projectless local input、absolute-path Preview、Local/Worktree/handoff/
   snapshot 与完整 Review 仍需新的 exact source cohort。
3. Source 实现后必须按每项 focused negative/positive tests验收，再运行 full source gate；不能用旧
   full suite 结果覆盖新行为。
4. 当前核心 pixels 仅在真正 final source 后重建，且生成新 manifest，不修改旧 evidence SHA。
5. Package、installed user path、Desktop/WebUI parity、remote host handoff 和 release promotion继续
   独立关闭；任何一项缺失都不得写成 release-ready。

## 完成度审计表

| Requirement | 当前状态 | 完成证据 |
| --- | --- | --- |
| 41301 human target 与三层文档一致 | `reopened_parity_target` | Composition 保留；新 parity 项已补入功能、交互、实现三层。 |
| App machine authority 与三层文档一致 | `authority_lane_in_progress` | GUI/page-state/runtime bridge 与 validators同步后以本 lane focused gates验收。 |
| Shell GUI behavior 与 OPL 非降级边界一致 | `source_rework_required` | 现有 OPL 已用功能必须保留；未采用 AionUI 面无需恢复。七类 parity gap需新 source cohort。 |
| Projectless local input | `source_partial` | 当前 project-required 限制与 App target冲突。 |
| App Server rail authority | `source_partial` | Rail history/actions需收敛到 list/read/resume/name-set/archive/unarchive/delete；pin仅 UI metadata，local reset不重写 history。 |
| Cross-thread coordination | `source_partial` | `69bce9d...` 只覆盖 flexible policy；visible entry、unarchive、首结果 replay、cross-host handoff待实现。 |
| Artifact preview path parity | `source_partial` | Workspace refs已有；任意绝对本地路径与双 scope安全策略待实现。 |
| Local / Worktree lifecycle | `source_missing` | Local/Worktree、starting branch、handoff、snapshot/restore待实现。 |
| Review pane | `source_partial` | Existing diff可复用；PR context、inline comments、stage/commit/push闭环待实现。 |
| Generated profile current | `done_semantic` | 官方生成器重建后 canonical JSON diff 为空；未提交纯格式差异。 |
| Core visual matrix | `historical_only_current_unverified` | 8-entry manifest 继续精确绑定 `0ebc1fdd...`；当前 pixels 不沿用。 |
| Package/install/user path | `source_package_only_current_unverified` | Production source package 通过；`26.7.12` 安装证据早于当前 Shell，不能提升为 current。 |
| Main absorption/push/readback | `operational_closeout` | 交付时以 `git ls-remote` 精确回读；本文不递归绑定包含自身的 App HEAD，该结果也不提升 release readiness。 |
| Lane cleanup | `operational_closeout` | exact/patch-equivalent/superseded 审计后删除本轮辅助与最终 lanes；不把清理状态解释为产品证据。 |

本文状态为 `active_parity_convergence`。只有上述 reopened requirements 的 App authority、Shell
source、focused/full gates、final pixels、package/user path 和必要 remote-host handoff 逐层闭合后，
才允许重新评估完成状态。当前 `release_ready=false` 与 `parity_1_to_1=false` 保持不变。

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
- 本机启动 Native candidate 不改变 AionUI 的 active release-shell 身份或本计划范围；
  GUI 选择命令、共享/隔离矩阵和 candidate adoption 统一由
  `docs/product/gui/gui-shell-candidates.md` 管理。
