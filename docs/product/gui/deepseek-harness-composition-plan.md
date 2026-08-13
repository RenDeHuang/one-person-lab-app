# DeepSeek Harness GUI Reuse And OPL Composition Plan

Owner: `one-person-lab-app`
Purpose: `deepseek_harness_gui_reuse_and_opl_spatiotemporal_composition_plan`
State: `approved_direction_prototype_required_before_cutover`
Machine boundary: 本文是 App-owned 架构决策与迁移方案。当前候选角色、产品行为和运行
接口仍以 `contracts/app-shell-candidates.json`、GUI contracts、Framework contracts、真实
Shell source/tests 和 fresh runtime readback 为准。本文不把 DeepSeek Harness、Cordis、
Native Workbench 或任何 prototype 提升为 active shell、runtime authority 或 release-ready。

## 结论

OPL 应吸收 DeepSeek Harness（DSH）的组合理念，也可以复用其一部分 GUI 源码，但不应
整体采用 DSH runtime，也不应把 DSH 新增为第二个 foreground shell。

推荐目标是：

1. `opl-native-workbench` 继续作为唯一 GUI successor 试验线；AionUI 仍是当前 active
   release shell，直到 successor 通过真实垂直链路和 adoption gate。
2. 第一优先复用 DSH 的 `client-ui-slots`、React renderer contract 和纯 UI primitives；
   OPL 自己实现 App bridge、session/workspace projection 和产品布局。
3. OPL Package descriptor 增加可选的 typed UI contribution；Framework 只聚合 installed
   contribution，App 定义 slot vocabulary 和组合规则，Shell 只渲染。
4. Framework 已有模块化单体、动态 Package discovery、`opl app state/action` 和领域 owner
   边界不重写成 Cordis。没有真实收益的全生态重构明确拒绝。
5. successor 路径通过后只保留一个发布 GUI：要么 Native adoption 后退役 AionUI fork，
   要么把已证明的 contribution ABI 回植 AionUI 后终止 Native；不长期双主线。

总原则是：**一切可组合，但不是一切同权。** 功能和 GUI 可以动态装配；产品真值、线程、
权限、安全、领域判断、artifact 和 release authority 仍由明确 owner 持有。

## 生态落点

这不是一次全仓同时重写。每个 owner 只承担一层，未到对应 wave 不改源码：

| Owner / repo | 目标责任 | 当前动作 | 明确不拥有 |
| --- | --- | --- | --- |
| `one-person-lab-app` | contribution schema、slot vocabulary、trust/冲突/降级策略、产品验收 | 本方案和 pinned reference；Wave 2 才新增 machine contract | Package 清单、domain schema、runtime state |
| `one-person-lab` Framework | 从 installed Package 动态发现、校验并聚合 contribution；复用现有 App state/action ABI | Wave 1 只提供 fixture；Wave 2 才实现 producer | GUI layout、renderer、Package-specific 分支 |
| 各 OPL Package / domain repo | 声明自身 descriptor，继续拥有 projection、action 和 domain truth | Wave 2 只选一个已有 typed view 的 pilot | App route、slot 冲突规则、跨 Package registry |
| `opl-native-workbench` | 唯一 DSH-derived renderer/slot host 试验线，Desktop/WebUI 同 renderer | Wave 1 pinned vertical spike | session/thread store、credentials、provider/runtime authority |
| `opl-aion-shell` | 继续承载当前 active release；只有 Wave 4 选择 `retain_aionui` 才接收已证明的 ABI | 当前不改 | 第二套 contribution schema 或 DSH runtime |
| OPL Flow / Fleet | 沿用现有 Package 安装、更新、currentness 和 worktree/release lifecycle | 当前不因本方案新增控制面 | GUI contribution 内容和布局决策 |
| OPL Cloud / Console / mobile carriers | 将来可消费同一 contribution projection；不能先定义另一套协议 | Wave 5 前不改 | App/kernel authority 和独立插件 registry |

因此真正可能跨仓的破坏性重构只有 Wave 2 以后的一条窄链：Package descriptor -> Framework
aggregation -> App contract -> Native renderer。它先由一个真实 Package 证明，再扩大；不会先把
整个 OPL 系列改造成插件容器。

## 取证快照

本次评估固定 DeepSeek Harness source ref
`47f943859bef60e4160492346772ded9b24f765a`（2026-08-13，source version
`0.1.0-rc.5`）。2026-08-14 观察到 npm 可安装入口已是 `0.1.0-rc.6`，而部分拆分 GUI
包的 `latest` 仍指向 `0.0.1-rc.1`、`next` 才指向 `0.1.0-rc.6`。上游 README 和首次
启动声明都明确称其为 developer preview，并预告兼容性破坏。

真实无凭据 WebUI 观察确认：

- 首屏是安静的 chat-first 布局：左侧 Workspace/Session rail、中心 conversation、底部
  composer，没有 dashboard 或 card wall。
- Settings 将 General、Models、Plugins、Agent Presets 作为一等面；Plugin 页面从当前
  deployment 枚举配置和 inventory，而不是维护静态演示列表。
- UI 由 package-discovered client plugins 贡献。`client-ui-slots` 提供 `single / list /
  keyed / chain` 四类 slot，注册和卸载沿同一 lifecycle 回收；React renderer 从 host
  observable、session/workspace projection 和 store seat 组合 props。
- DSH profile 是 bundle 的有序组合，上层 patch 可替换下层配置。Capability seam 明确
  区分 service definition、provider 和 consumer。

根仓 LICENSE 为 MIT，固定 source ref 内相关 GUI package manifest 也为 MIT；但是代码
复用仍需按所选 package、实际 npm tarball、第三方 notices 和 shipped closure 单独复核，
不能只引用根仓许可证。

## 采用分级

| Candidate | 分类 | 判断 | OPL owner / 落点 |
| --- | --- | --- | --- |
| Chat-first 视觉与 Workspace/Session rail | `adopt` / Strong | 与现有 OPL GUI 目标高度一致，真实 UI 已验证 | App GUI contract；Native renderer |
| Typed slot registry 与可逆注册 | `adapt` / Strong | 直接解决 Package 能力动态发现后 GUI 仍需固定接线的问题 | App slot contract；Native renderer |
| Package-discovered client plugin graph | `adapt` / Strong | 可让功能、设置、typed view 随 installed Package 出现/消失 | Package descriptor；Framework projection |
| `single/list/keyed/chain` composition kinds | `adopt` / Strong | 足以表达单 owner、追加列表、kind renderer 和条件 takeover | App slot vocabulary |
| App/session/workspace/task 的时间作用域 | `adapt` / Strong | OPL 需要比 DSH 更明确的 owner/permission boundary | App composition scope contract |
| DSH pure primitives / slot / React renderer packages | `worth_exploring` | 可能显著减少 Native GUI 自研量；需要 pinned source/API spike | Native Workbench only |
| DSH 完整 Web client | `watch_only` | UI 合适，但与 DSH runtime/connection/session graph 耦合较深 | 不进入 App dependency |
| Cordis profile/bundle runtime | `no_code_needed` | OPL 已有 Package/Framework composition owner；只吸收分层和可逆性 | 现有 Framework/Package contracts |
| DSH agent loop/session log/provider/credentials/plugin manager | `reject` | 会形成第二 runtime、第二状态与第二权限面 | 保持 Codex/Framework/domain owner |
| 任意第三方 HTML/JS/React/Electron 插件 | `reject` | 不可信代码、权限、更新和 UI 完整性成本不成比例 | 初始版本只允许可信 typed contribution |
| 全量重写 OPL Framework 为 Cordis | `reject` | 当前没有能偿付迁移成本的 caller 或故障证据 | 保留模块化单体 |

## 目标模型

### 1. Stable kernel

以下内容不可因“一切皆插件”而变成可替换的普通 contribution：

- App product contract、slot vocabulary、navigation 和 visual policy；
- Codex App Server 的 canonical thread/history/turn authority；
- Framework `opl app state --profile fast --json` 与
  `opl app action execute ... --json` ABI；
- Package identity、carrier、executor、installed/currentness owner boundary；
- permissions、credential handles、workspace/write scope 和 destructive action policy；
- domain truth、quality verdict、artifact body/provenance 和 release readiness。

Kernel 只定义边界和组合规则，不固定 Package、Agent、Skill、Tool、Plugin、MCP 或领域 view
清单。

### 2. Contribution descriptor

Installed Package 可以声明零到多个 contribution，但 descriptor 只能引用 versioned、typed
能力，不携带任意文件路径、URL、HTML、JavaScript、Electron code 或未经准入的 React body。

最小字段建议：

```json
{
  "contribution_id": "mas.research-roadmap",
  "kind": "runtime.typed_view",
  "slot": "runtime.detail",
  "scope": "work_item",
  "view_kind": "mas.research_roadmap.v1",
  "projection_ref": "app_state.operator.workbench.work_item_projection_v2",
  "action_refs": [],
  "priority": 100,
  "availability": {
    "required_capability_ids": ["mas.research_roadmap.v1"]
  }
}
```

Package owns semantic identity and domain projection. App owns whether `runtime.detail` exists、允许哪种
`kind`、同槽冲突如何处理和普通用户看到什么。Framework 只验证 descriptor、连接 owner
projection/action refs 并输出聚合结果。Shell 不推断 schema，也不维护 Package id 分支。

### 3. Spatial composition

初始 slot vocabulary 只覆盖已有真实需求：

| Slot | Kind | 用途 |
| --- | --- | --- |
| `navigation.primary` | `list` | App-owned route contribution，按可用能力出现 |
| `composer.palette` | `list` | Package/Skill/Tool/Plugin/MCP 的动态启动入口 |
| `conversation.node` | `keyed` | 按 versioned event/view kind 选择 renderer |
| `conversation.composer` | `chain` | approval/question/plan 等临时接管，fallback 保留 draft |
| `inspector.tab` | `list` | files、artifacts、runtime refs、memory refs 等按需面板 |
| `runtime.detail` | `keyed` | Agent Package typed views |
| `settings.section` | `list` | owner-projected 设置与 lifecycle 入口 |
| `artifact.preview` | `keyed` | 已准入 artifact MIME/view kind 的只读预览 |

不要先建立通用 canvas、任意嵌套 slot、布局 DSL 或用户拖拽编排器。新 slot 必须由第二个真实
contributor 或一个无法用现有 slot 表达的当前产品需求支付复杂度。

### 4. Temporal composition

每个 contribution 必须绑定一个生命周期作用域：

`app -> installed_package -> workspace? -> session? -> work_item? -> operation?`

- Package uninstall/disable：对应 contribution 从下一次 authoritative projection 起消失；不留
  空 tab、placeholder route 或 stale action。
- Workspace/session 切换：只重算受影响 scope，不重启 runtime，不迁移 canonical thread。
- Work Item selection：只挂载选中 item 的 typed view；未识别 `view_kind` 局部降级为通用摘要。
- Operation/approval：临时 chain entry 完成、取消或失败即卸载，fallback composer draft 保留。
- Projection 暂不可用：保留最后一个有效只读 snapshot 或局部隐藏；不得猜测 availability、
  重发 mutation 或清空其他 owner 的有效 contribution。

### 5. Trust tiers

第一阶段只实现两级：

- `declarative`：任意 installed Package 可声明 route、label、icon id、projection/view kind 和
  owner-authoritative action ref；renderer 来自 App/Shell 已知 catalog。
- `trusted_first_party_renderer`：与 Native shell 同 cohort 编译、签名和测试的 OPL renderer
  package，可为 versioned view kind 提供 React component。

第三方任意代码、远程 URL、运行时 npm install、Electron 主进程插件和动态 filesystem import
全部 deferred。真实需求出现后再决定 sandboxed iframe/Web Component 或 signed module，不为
想象中的 marketplace 预建供应链。

## GUI 源码复用路线

按成本从低到高推进：

1. **Pinned package spike：** 在 Native Workbench 的独立 checkout 中，以精确版本或 source
   commit 引入 `client-ui-slots`、`client-web-react` 和少量 pure primitives，禁止 floating
   `latest`。用 OPL fake projection 驱动一个 rail、一个 composer contribution 和一个 typed
   view。
2. **Thin OPL host：** 实现 DSH renderer contract 所需的最小 observable/slot host，但数据只
   来自 OPL bridge；不引入 DSH connection、session、agent、settings、credentials 或 profile
   home。
3. **Selective source adoption：** 若 package public API 不足但源码边界清晰，把选定 package
   以保留 LICENSE/notices 的方式 vendoring 或 fork；记录 exact upstream ref 和 OPL delta。
4. **Stop before full client fork：** 如果必须引入 DSH client runtime 才能渲染普通 conversation，
   则停止直接复用，保留其 slot API/视觉模式并在 Native 内重写。完整 client fork 不是默认降级。

## 迁移波次

### Wave 0: role cleanup

- Hermes 进入 `archived_technical_proof`，与 AGUI 一样只保留用户明确要求的历史 replay。
- DSH 不登记为新 shell；它是 Native successor 的 design/source reuse candidate。

完成条件：默认 registry 和 GUI design validator 只输出 active、foreground、archived；Hermes
不再出现在 retained、adoption 或 routine validation 语义中。

### Wave 1: Native vertical spike

在 `opl-native-workbench` 完成一条最小真实链路：Framework fixture projection -> OPL bridge ->
slot host -> DSH-derived React renderer -> visible UI -> App action dry-run -> authoritative readback。

必须同时证明：

- Desktop WKWebView 与 Node WebUI 使用同一 renderer；
- install/disable fixture 可添加和移除 contribution，无 reload crash 或 placeholder；
- unknown kind 局部降级；一个坏 contribution 不使 conversation/composer 不可用；
- 不产生 DSH home、session store、credential store 或第二 action bus；
- build size、cold start 和 steady render 没有不可接受回归。

### Wave 2: OPL contribution ABI

只有 Wave 1 通过才新增 App/Framework machine schema。先支持
`runtime.typed_view`、`settings.section`、`composer.palette` 三种当前付费 surface；由一个真实
Package 作为 pilot，建议使用已存在 typed view 的 MAS，而不是编造 demo Package。

完成条件：Package owner 只改自己的 descriptor/projection，App/Shell 无 Package id allowlist 或
领域 schema mirror，即可出现、执行、卸载并 read back。

### Wave 3: Native renderer cutover

逐页把 Native 固定接线迁到 slot composition。先 conversation/runtime/settings，后 navigation、
artifact preview；每批删除被替代的固定 registry 和 adapter，不长期双写。

完成条件：当前 B0/R1/U1 surface 行为保持，App-owned visual baseline 通过，Native source、pixel、
package、installed user path 五条证据独立完成。

### Wave 4: single-shell decision

Native 达到 adoption gate 后做一次明确选择：

- `adopt_native`：切换 `contracts/app-shell-adapter.json`，完成 release/readback，然后退役 AionUI
  fork 和其专有 runtime/UI glue；或
- `retain_aionui`：把已证明的 contribution ABI 以最小 delta 移入 AionUI，随后归档 Native。

禁止结果：AionUI、Native 和 DSH fork 三条长期产品线并行维护。

### Wave 5: ecosystem expansion

仅在至少两个独立 Package 和三个真实 slot 证明重复收益后，才考虑：

- Package-owned trusted renderer 独立发布；
- user profile 的组合/排序偏好；
- isolated third-party UI；
- headless、mobile 或 hosted shell 复用同一 contribution ABI。

## 收益与止损

预期收益：

- 新 Package 不再要求 App/Shell 添加 route、tab、settings 和 renderer 分支；
- GUI 与功能可随 installed state、workspace、session、work item 动态组合；
- Desktop/WebUI 共用 renderer，减少 AionUI fork 和候选 shell 双写；
- contribution 卸载沿作用域回收，减少 stale UI、重启和跨页面状态同步；
- OPL 保留 owner authority，同时把可扩展上限从“固定产品页面”提升到“受控组合平台”。

任一条件成立即停止扩大：

- 需要复制 DSH runtime/session/credentials/plugin manager 才能完成普通 UI；
- 新 abstraction 没有第二个真实 contributor；
- contribution ABI 迫使 Framework 复制 domain schema 或 App 推断 runtime truth；
- Desktop/WebUI 需要两套 renderer 或 bridge shape；
- install/uninstall 不能局部失败，或任一第三方 contribution 可遮蔽 core composer/navigation；
- Native 不能在一个明确评估周期内形成 adoption 决策，反而成为长期第三产品线。

## 验收口径

方案本身完成不等于重构完成。各阶段只能按对应证据声明：

- `Contract`：App/Framework schema 与 owner boundary；
- `Source`：Native/Framework/Package 真实 caller 路径和删除后的零旧 caller；
- `Pixel`：App-owned desktop/narrow、light/dark、zh/en baseline；
- `Install`：真实 packaged Desktop/WebUI 安装后 contribution add/remove/readback；
- `Release`：active adapter、artifact、updater 和 public owner promotion。

只有 Wave 4 的 active adapter 切换及 owner-authoritative release/readback 才能称为 OPL 原生 GUI
替换完成。
