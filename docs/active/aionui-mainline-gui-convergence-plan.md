# AionUI 主线 GUI 完整收敛方案

Owner: `one-person-lab-app`
Purpose: `aionui_mainline_gui_convergence_plan`
State: `active_parity_convergence`
Updated: `2026-07-14`
Machine boundary: 本文是 AionUI 主线 GUI 的执行计划、结果 read model 和终局验收表。
产品功能、交互、视觉和机器验收仍分别归 GUI 三层文档、`contracts/`、validators、Shell
source/tests 与对应 evidence。本文不创建第二套产品 authority，也不把 source、tests 或
截图单独解释为公开 release-ready。

## 结论

`26.707.41301` 核心 GUI composition 与 OPL 专有能力位置继续有效，不需要大规模 GUI
重写，也不得重放 `dbff7370f` 或整体 merge AionUI upstream。AionUI 主线已经在 Home package
readiness、Settings/Personalization、managed update 和 runtime bridge 上继续前进，因此本计划
已重新打开 Codex parity 收敛：此前 `complete` 只覆盖 41301 composition 与一部分 flexible
coordination source。当前 Shell main source cohort
`d5c7581bd3a2c547e20373ca3df716aa129846dd` 已补齐
projectless 文件能力、App Server rail authority、任意绝对本地路径 Preview、首结果幂等 replay、
可见协调入口、unarchive、Home managed worktree、同主机 idle task handoff、Runtime v2 与
Environment Git inspection，并恢复 Runtime cockpit，同时保留 Gateway account/UI；其后还补入
profile-driven feedback、Review `Last turn` 和窄窗 Access 单列断点。历史 full source gates、macOS
arm64 directory-only package、codesign 与9场景 packaged E2E仍精确绑定
`b2c05a1c8dc4ef81094323b49a67b601e3c425f5`，不能改绑到新 source。剩余产品 source gap 是
模型可调用 coordination host tool，以及 Review 的 line-level inline comments；snapshot/restore、cleanup UI
与 cross-host handoff 明确 deferred/unsupported，
不冒充已实现，也不作为本轮 current package 的完成硬门。当前package未安装；旧cohort证据保留，
不外推为当前installed-path证据。

最终维护路线固定为：

1. App repo 继续拥有功能、交互、视觉和 page-state truth；
2. Shell 只消费 product profile、bridge、existing composition/token 与必要最小 fork patch；
3. 只保护 **OPL App 已采纳并对用户开放的功能**，不保护未采纳的 AionUI 产品面；
4. 上游 intake 逐能力分类为 `already_present / accept / adapt / reject / defer`，不做
   广域 history merge；
5. Settings 进入维护模式，不再替代 Home、rail、conversation、composer 主体验；
6. 跨顶层线程协调由 Codex App Server thread/turn + OPL host metadata/advisory/audit 薄适配实现，不复用
   同一 agent tree 的 `send_input`，也不建立第二套 thread store；
7. package、安装、用户路径、push/readback 和 cleanup 必须使用 fresh evidence 独立闭合。
8. Codex parity 采用薄 adapter：Project/workspace 不是权限域；thread/Git truth 继续归 Codex
   Core/App Server 与既有 Git integration，Shell 不复制 store。

## 当前事实快照

本节记录 `2026-07-14` currentness 输入。任何当前完成结论必须以同一 source cohort 的
fresh gate、pixels、package/user path 和远端回读为准。

| Surface | Fresh 状态 | 边界 |
| --- | --- | --- |
| App authority refresh | GUI contract、page-state、runtime bridge、三层文档与validators已形成App main source authority；最终App SHA只由外部main/remote readback记录 | 真实source边界拆分Home new-task、Conversation Environment same-host handoff、metadata/projection transaction、deferred snapshot/cleanup和unsupported cross-host；本文不递归绑定包含自身的App commit。 |
| Shell current main source cohort | `d5c7581bd3a2c547e20373ca3df716aa129846dd` | 叠加feedback profile、Review Last turn与960px Access单列断点。Model-facing host tool仍缺，line-level comments为protocol blocker；尚无匹配package/pixels。 |
| Latest reviewed upstream | `v2.1.33@a819d175683d5a0aada20064888da07bfcecdb6a` | 相比已评估 GUI cohort 无 GUI delta；不整体 merge，release/runtime intake 单独处理。 |
| Product profile | 使用 App 官方生成器和当前 OPL Flow workflow policy 对 Shell generated profile 重建后，`jq -S` canonical diff 为空 | Generated profile 的 compatibility projection 包含由 OPL Flow policy 派生的字段；不要求与 raw App JSON 字节相等，不提交纯格式噪音。 |
| Verified GUI ancestor gates | Shell `a0ce713b65801fd9ca7f46ad168c977c75a187de`：full suite `293 files / 2172 tests` 通过、`1 file / 3 tests` skip；root TypeScript、1514-file format、i18n 通过。App active-shell full 通过；release-boundary `293 pass / 2 platform skip / 0 fail` | 证明最低 GUI ancestor 与 source contract 边界，不单独证明 installed path 或 release-ready。 |
| Current source gate boundary | Shell `d5c7581b...`：full active-shell `301 files pass / 1 file skip`、`2344 tests pass / 9 skip`；独立 Node `168/1539`、DOM `133 files / 805 pass / 6 skip`；TypeScript、1546-file format、i18n与lint `0 errors`通过 | 证明当前 source/tests 与 App active-shell consumer一致；packaged-runtime因该 source worktree没有`out/app.asar`而明确跳过，不提升package/pixels/install状态。 |
| Historical package-bound visual evidence | `docs/product/gui/evidence/aionui-41301-parity-20260714/manifest.json`绑定Shell `b2c05a1c...`、9场景、0 unmatched anchors、0 failed layout checks、0 coverage gaps | macOS arm64 directory-only package、packaged runtime staging与codesign通过；`app.asar` SHA-256=`726200362ed6038211dfb610b7639cb7fe395df54b92bade752c9b8f5a538823`；未安装，`release_ready=false`，不能改绑到`d5c7581b...`。 |
| Framework release source lock | Canonical Framework main仍为 `c56a9599146ba38184ff0ffbc1b031909d786390`；exact-source gate正在独立 final integration，尚未进入remote main | Framework owner回传新的remote main与Verify前，不重建package、不安装、不dispatch，也不声明`release_ready=true`。 |
| Live App Server protocol | Codex CLI `0.144.1` + 临时 `CODEX_HOME`：两条 materialized top-level threads 完成 list/source-hint、target turn/start/result/read、resume、fork 与 archive readback | 证明 production adapter 的本机 protocol wire；未覆盖 `turn/steer` 竞态、Shell packaged two-root UI 或 remote host。 |
| Historical source gates | exact `0ebc1fdd278e8a79602458e15e28cf814dfd917d`：`test:full` 282 files pass / 1 skip、2044 tests pass / 3 skip；TypeScript、1487-file format、i18n 与 lint 0 errors | 只属于历史 cohort。 |
| Historical core visual evidence | `docs/product/gui/evidence/aionui-41301/manifest.json` 绑定 Shell `0ebc1fdd...`、`E2E_PACKAGED=1`、时间 `2026-07-11T21:16:06.183Z` 和 8 个 route/layout 场景 | Manifest与截图保持原字节/原SHA；不替代当前9场景cohort。 |
| Historical Settings evidence | `docs/product/gui/assets/settings-desktop-light-manifest-20260712.json` 绑定 Shell `fadd91f9...` 的 14-entry desktop Light matrix | 精确历史证据，不外推为当前 Settings pixels。 |
| Release version boundary | `/Applications/One Person Lab.app` 的 `26.7.12` closeout 曾完成 asar/AionCore/codesign 与 Home -> Settings -> Home readback；remote `v26.7.13` tag/draft固定绑定旧 App `faeb0d6f...` | `v26.7.13` 与其历史assets不可移动、覆盖或复用于当前source。最终cohort使用`26.7.14`并重建component manifest、source commit、digests与Release Set；正式安装与真实用户路径由release owner独立验收。 |

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
| `opl_adopted_partial` | OPL 已采纳且已有可用子集，但完整目标含明确 deferred gap | 保留已实现子集；逐项标出未实现能力，禁止用部分 source 宣称完整 lifecycle。 |
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
| 功能层 | [`feature-inventory.md`](../product/gui/feature-inventory.md)、App contracts | `authority_aligned_to_current_source_boundary` | Same-host locality、projectless、thread coordination、Runtime/Environment 已进入 machine truth；deferred能力不伪装完成。 |
| 理想交互与视觉层 | [`ideal-interaction-spec.md`](../product/gui/ideal-interaction-spec.md)、[`visual-system.md`](../product/gui/visual-system.md)、[`codex-to-opl-app-delta.md`](../product/gui/codex-to-opl-app-delta.md)、[`element-audit.md`](../product/gui/element-audit.md) | `interaction_boundary_refreshed` | Project 归 rail metadata，权限归 Codex；Home new-task 与 Environment existing-task handoff分层，Review剩余子集明确。 |
| Shell 实现层 | [`shell-implementation-guide.md`](../product/gui/shell-implementation-guide.md)、[`shell-conformance-matrix.md`](../product/gui/shell-conformance-matrix.md) | `current_source_ahead_of_package_evidence_partial_product_gaps` | `d5c7581b...` 新增Last turn与窄窗修复；package/9场景仍绑定`b2c05a1c...`。Model host tool和line comments缺失，Local/Worktree lifecycle仍partial，安装/user path未闭合。 |

## OPL 已采纳能力收敛结果

| Priority | Capability | Adoption | 当前结果 | 剩余边界 |
| --- | --- | --- | --- | --- |
| P0 | Project/conversation rail | `opl_adopted_active` | 宽屏 persistent、窄屏 drawer；active workspace 与 registered directory management 分离；project 可拥有 N conversations。 | 维护回归，不恢复 dashboard/assistant rail。 |
| P0 | Home / New task | `opl_adopted_relocated` | 与 conversation 共用 composer-first canvas；全部用户可见 configured starters 按稳定顺序响应式换行；Local/Worktree 与 starting branch 使用既有 `gitWorkspace` create/reuse。 | 不恢复 launcher/card wall，不在 Worktree失败后 silent Local fallback。 |
| P0 | Composer decisions | `opl_adopted_relocated` | Desktop/mobile 的 attach、permission/access、model/reasoning、active capability 与 send-stop 位于发送决策点；不暴露 backend/provider。 | 上游 intake 只能替换 composition，不能覆盖 App policy。 |
| P0 | Environment | `opl_adopted_active` | 右上 anchored、默认关闭；承载 live Git workspace/locality/branch/changes 与真实 refs/actions，并为同主机 `not_loaded`/`idle` task 提供 Local↔Worktree。 | `running`/`archived`/`system_error` 显示 unavailable；无真实数据不显示。 |
| P0 | Advanced surfaces | `opl_adopted_relocated` | 默认无综合第三列；Files、Preview、Terminal、Browser 按需打开，窄屏 Preview 使用完整 overlay。 | 专项 renderer pixels 不属于 core composition blocker。 |
| P1 | Project context | `opl_adopted_active` | workspace-keyed 单一 source，rail 编辑，send 直接消费；不复制到 route/local/attachments。 | 保持 missing/remove/dedupe 行为。 |
| P1 | Package launch readiness | `opl_adopted_active` | Unavailable starter 显示原因/允许动作；每次 workspace/quest launch 前执行 Framework-owned activation，失败 fail closed。 | 不从 installed flag 推断 ready，不在 shell 复制 package currentness。 |
| P1 | Current task | `opl_adopted_relocated` | timeline 单一 summary；普通任务不默认 sticky，长任务或用户操作才 pin。App Server approval/user-input 是 target context 的 pending state。 | 真实长任务/approval packaged evidence 单独维护。 |
| P1 | Transcript export | `opl_adopted_active` | cursor-safe、递归脱敏、Markdown/JSON、失败可见；`/export` 使用同一安全路径。 | workspace bundle 继续要求逐项选择与确认。 |
| P1 | Desktop navigation | `opl_adopted_active` | 保留 Back/Forward、Previous/Next、New Window 的 OPL 路径，不创建 WebUI 第二 IA。 | 完整快捷键专项验收不阻塞 core GUI。 |
| P1 | Cross-thread coordination | `opl_adopted_internal` | Canonical directory、App Server lifecycle、同key首结果replay、advisory、delivery audit 与 typed interactive request pending flow 保留；普通 rail 的独立“线程协调”入口退出产品目标。 | 能力由 keyboard-reachable thread-detail context action 与 model host tool 按需调用；普通 navigation 不展示独立页面，cross-host 保持 future scope。 |
| P1 | Model-triggered coordination | `opl_adopted_required` | 产品合同要求 model host tool；ordinary ACP -> AionCore -> codex-acp链路没有dynamic-tool输入或`item/tool/call` callback，user rail不能替代实现证据。 | 优先由AionCore同一App Server client承接`thread/start(dynamicTools)`；或由codex-acp补齐input/response/callback。禁止第二runtime、post-hoc port handler或Shell tool store。 |
| P1 | Artifact preview adapter | `opl_adopted_active` | `b2c05a1c...` 将用户显式绝对本地路径或workspace-scoped project ref薄接现有Preview并拒绝非法输入；current package覆盖Preview surface。 | 各renderer与ref分流仍需专项pixels，不复制renderer/store。 |
| P1 | Projectless local input | `opl_adopted_active` | 无 workspace 保留 attachment、file/directory picker、paste/drop、`/open`，只服从 Codex permission/approval/sandbox。 | 补 current pixels/package，禁止恢复 project-required gate。 |
| P1 | Local / Worktree lifecycle | `opl_adopted_partial` | Same-host subset已实现：Home managed create/reuse；existing idle task经 `thread/settings/update` 切换，`opl_workspace_handoff.v1` 投影，projection failure best-effort回滚。 | Snapshot/restore、cleanup UI deferred，cross-host unsupported；完整 lifecycle不宣称完成。 |
| P1 | Review pane | `opl_adopted_partial` | `d5c7581b...` 已实现四类 `review/start` target、inline/detached delivery、PR context、stage/commit/push、`gh` unavailable与Last turn；Last turn复用既有message store，只显示最近用户回合后的completed workspace edits。 | Line-level comments等待Codex App Server typed file/line request与失败语义；禁止本地annotation store或假成功。Current pixels/package另行。 |
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

### 当前 source/evidence 边界

1. App GUI machine contract与三层文档按 final source边界更新；focused authority validators只证明
   产品真相一致，不替代Shell source、packaged evidence或安装readback。
2. Shell `d5c7581b...` 已闭合同主机handoff、Home worktree、canonical user thread coordination、
   interactive App Server requests、projectless local input、absolute-path Preview、Runtime v2与
   Environment Git inspection和Runtime cockpit，并保留Gateway account/UI、feedback、Review Last turn与窄窗
   Access布局。Model host tool仍缺；Review line-level comments为protocol blocker；完整 Local/Worktree
   lifecycle仍缺 snapshot/cleanup，cross-host unsupported。
3. `d5c7581b...` 的full active-shell、独立Node/DOM、TypeScript、format、i18n与lint 0 errors已闭合；
   `b2c05a1c...` 的macOS arm64 package、codesign与packaged E2E只保留历史证据，未来package不得复用
   或改绑旧manifest。
4. 当前9场景只提升明确覆盖的Home/Runtime unavailable/conversation/composer/Environment/Files/mobile
   Preview pixels；package readiness、first-run、Review、真实coordination detail与Settings仍保持unverified。
5. Installed user path、Desktop/WebUI parity与release promotion继续独立关闭。Remote host
   属于 future capability：未实现必须显示 unavailable，但不阻塞本机 current package claim。

## 完成度审计表

| Requirement | 当前状态 | 完成证据 |
| --- | --- | --- |
| 41301 human target 与三层文档一致 | `current_source_boundary_refreshed` | Composition 保留；source已实现项与deferred项在三层分别标注。 |
| App machine authority 与三层文档一致 | `done_current_refresh` | GUI/page-state/runtime bridge、三层文档与 validators 已同步，并通过本 lane focused authority gates。 |
| Shell GUI behavior 与 OPL 非降级边界一致 | `current_source_gates_verified_partial_product_gaps` | `d5c7581b...` 保留OPL已用功能、Gateway/UI与Runtime V2，并新增Last turn/feedback/窄窗修复；full source gates已闭合，新package/pixels仍待闭合。 |
| Projectless local input | `source_implemented_pixel_unverified` | 无workspace输入已进入Codex原生permission路径；current conversation fixture含workspace，因此不外推projectless pixels。 |
| App Server rail authority | `source_implemented` | Rail directory/actions使用 App Server；pin仅 UI metadata，local reset不重写 history。 |
| Cross-thread coordination | `source_implemented_no_ordinary_navigation` | Canonical directory、unarchive、首结果 replay、advisory 与 typed interactive pending requests 保留；普通 rail 不挂载独立页面，delivery audit 不冒充 approval receipt。 |
| Model-facing coordination tool | `source_missing_protocol_blocked_required_target` | Thread-detail context action 不构成 dynamic-tool 证据；ACP ordinary owner 缺 input/callback，owner route 为 AionCore/codex-acp。 |
| Artifact preview path parity | `source_implemented_surface_pixel_verified_adapter_pixel_unverified` | Current package覆盖mobile Preview surface；absolute local path与workspace ref分流、非法输入和各renderer仍靠source/tests。 |
| Local / Worktree lifecycle | `source_partial` | Same-host create/reuse与idle handoff已实现；snapshot/restore、cleanup UI deferred，cross-host unsupported。 |
| Review pane | `source_partial` | 四 targets、inline/detached、PR context、stage/commit/push、`gh` unavailable与Last turn已实现；line-level comments因typed protocol缺失而blocked。 |
| Generated profile current | `done_semantic` | 官方生成器重建后 canonical JSON diff 为空；未提交纯格式差异。 |
| Core visual matrix | `current_exact_cohort_verified_limited_claims` | Current 9-entry manifest精确绑定`b2c05a1c...`并通过全部anchors/layout checks；historical 8-entry manifest保持原字节。 |
| Package/install/user path | `historical_package_verified_current_install_unverified` | `b2c05a1c...` 的本地`26.7.13` directory-only package、runtime staging、codesign与packaged E2E只作历史GUI证据；remote `v26.7.13@faeb0d6f...`保持不可变，最终`26.7.14`必须重建，`26.7.12`安装证据不能提升为current。 |
| Main absorption/push/readback | `operational_receipt_external_to_document` | 交付时以 `git ls-remote` 精确回读；本文不递归绑定包含自身的 App HEAD，该结果也不提升 release readiness。 |
| Lane cleanup | `operational_closeout` | exact/patch-equivalent/superseded 审计后删除本轮辅助与最终 lanes；不把清理状态解释为产品证据。 |

本文状态为 `active_parity_convergence`。本轮current source gates已闭合，历史package/core pixels按原
exact cohort保留；App/Shell main/remote currentness由外部operational receipt证明，`26.7.14`重建、
安装/user path以及明确deferred产品缺口仍按独立owner推进。
Cross-host保持 future/unsupported，只有单独 remote能力开发和证据完成后才能声明
`remote_ready`。当前 `release_ready=false` 与 `parity_1_to_1=false` 保持不变。

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
