# OPL App GUI Shell 实现指南

Owner: `one-person-lab-app`
Purpose: `app_gui_shell_implementation_guidance`
State: `active`
Machine boundary: 本文是 shell adapter 的人读实现指南。产品行为、page-state、模型
策略、Settings registry、state/action surface 和 release gate 仍由现有 contracts、
validators、source/tests 与 evidence 拥有。

设计体系入口见 [`README.md`](README.md)。

## 定位

本指南提炼 active AionUI 路线中可复用的方法，不是 AionUI 代码复制指南。未来 shell
应实现同一套 App-owned contracts，而不是继承 AionUI 的目录、组件名、状态模型或
fork-local 产品逻辑。

正确目标是：

- App repo 定义产品、profile、page-state 和验收边界；
- shell 负责 renderer、platform integration、bridge、i18n/CSS 和 focused tests；
- Framework/domain/release owners 继续拥有各自 truth；
- carrier 可以替换，产品语义和 action/state contract 不随 carrier 分叉。

## Contract-first 顺序

实现任何用户可见变化前，按以下顺序定位 owner：

1. 功能要求：[`feature-inventory.md`](feature-inventory.md) 与
   `contracts/app-gui-product-contract.json`。
2. 默认值和 generated config：`contracts/app-product-profile.json`。
3. 页面状态与显示边界：`contracts/app-page-state-matrix.json`。
4. Settings registry/route/action：`contracts/app-settings-control-plane.json`。
5. Shell selection 和 adapter：active/candidate adapter contract。
6. 理想交互与视觉：[`ideal-interaction-spec.md`](ideal-interaction-spec.md)、
   [`visual-system.md`](visual-system.md)。
7. 当前差距与验证入口：
   [`shell-conformance-matrix.md`](shell-conformance-matrix.md)。

若现有 shell 行为与目标不同，先分类差异，不在 renderer 中偷偷建立新默认。当前
Codex-based ideal target 是宽桌面 persistent project/conversation rail；active
AionUI 读取动态 state source，native candidate contract 记录 ideal target。两者是否
收敛由 validator readback 动态计算，不在人读实现指引复制当前 profile 值；应由产品
contract/实现收敛 lane 处理。

## Thin Adapter 结构

一个合格 shell delta 通常只需要以下边界：

| Adapter surface | 职责 | 禁止事项 |
| --- | --- | --- |
| Product profile consumer | 读取 generated App profile，提供品牌、默认模型、purpose、locale 和 feature flags。 | 硬编码模型 allowlist、provider policy 或 shell-local default。 |
| State bridge | 把 App state readback 规范化为 renderer 可消费 envelope。 | 从本地组件状态推断 runtime/domain readiness。 |
| Action bridge | 执行 App-owned action，并返回 dry-run/result/receipt。 | 直接调用 domain CLI、绕过 confirmation 或自建 mutation kernel。 |
| Route adapter | 把 legacy/upstream route 映射到 App-owned page。 | 让 compatibility route 重新成为 ordinary navigation。 |
| Settings slot | 从 Control Plane registry 渲染 ordinary/secondary pages。 | 复制一套 shell-owned Settings IA。 |
| Presentation adapter | 复用 shell primitives 实现 App layout、tokens、i18n 和 accessibility。 | 复制外部源码或把视觉 token变成产品 truth。 |
| Platform adapter | Electron/Web/native file picker、window、notification、secure storage。 | 把平台能力提升成 runtime/domain authority。 |

只有在现有 primitive 无法表达 App contract 时才新增 shell-local component。新增组件
应围绕一个明确 slot 或 page-state，而不是创建未来可能使用的 framework。

## AionUI 最小定制阶梯

AionUI 主线定制必须从维护成本最低的层开始，前一层能完成就不得进入后一层：

| Level | 优先手段 | 适用内容 | Closeout 要求 |
| --- | --- | --- | --- |
| `L1 profile/data` | Generated profile、registry、已有配置 | 品牌、labels、默认值、可见入口、capability exposure。 | 不修改 upstream component tree。 |
| `L2 bridge/adapter` | 既有 IPC/API adapter、App state/action bridge | Codex/OPL data、actions、receipts、platform capability。 | 单一 truth、typed failure、focused bridge coverage。 |
| `L3 composition/token` | Existing layout primitive、slot、wrapper、CSS variable、i18n | Rail section、composer strip、timeline event、Environment secondary content、视觉 token。 | 不复制状态模型，不整页重写，不用广域 CSS selector 接管 upstream DOM。 |
| `L4 fork-body patch` | 对 upstream component 的最小直接修改 | 只有稳定边界无法表达且属于 P0/P1 的交互。 | 记录 upstream file、必要性、冲突热点、focused regression 和下一次 intake 处理。 |

以下情况不是进入 `L4` 的理由：现有组件样式不完全一致、测试更容易写、短期绕过
profile hydration、或 Settings 页面已有类似布局。视觉对齐优先复用 composition/token，
不能通过重写大组件把 AionUI 变成第二套私有 shell。

每次主线 GUI 工作都应输出 delta inventory：修改的 upstream fork-body 文件、OPL-owned
overlay/adapter 文件、tests/evidence 文件分别计数。文件数不是机械 gate，但 fork-body
范围持续扩大时必须先重新检查是否能退回 `L1-L3`。

## Profile-driven

Generated product profile 是 shell 的默认值入口：

- Home/conversation 的模型、推理、purpose 和 capability exposure 从 profile 读取。
- 当前默认值、具体模型列表、顺序、退休策略和持久化规则只引用
  `contracts/app-product-profile.json`，不在 shell 或人读实现文档复制。
- Branding、locale、ordinary capability allowlist 和 optional modes 使用同一 profile。
- Profile 缺失、schema 不兼容或字段无效时 fail closed，显示可理解 blocker；不要
  回退到 upstream provider/model defaults 后假装一致。
- Shell-local cache 只能作为加载优化，必须保留 profile version/source，不能成为
  独立配置 authority。

## State / Action Bridge

普通读取：

```text
opl app state --profile fast --json
```

显式刷新通常仍使用 fast profile。Full state 和 Operator full drilldown 只用于
contract 明确的 detail/diagnostic path。Renderer 只展示返回的 status、conditions、
refs、recommended action 和 timestamps；不得从 `active_run_id`、module dirt、DOM
presence 或缓存推断 running、ready、synced、domain-ready 或 release-ready。

Mutation 统一使用：

```text
opl app action execute --action <id> [--payload <json>] [--dry-run] --json
```

实现要求：

- 先从 App state/action catalog 取得可用 action 和 disabled reason。
- 高风险或状态改变动作先 dry-run/preview，再 confirmation，再 execute。
- UI 明确显示 what changes、what does not change、receipt/recovery ref 和 refresh 行为。
- Result receipt 是动作事实，不代表 runtime、domain、artifact 或 release readiness。
- 网络、CLI、schema 和 permission failure 保留 typed reason，不转换成模糊 `unknown`。

## Settings Control Plane

Settings 是 App-owned OPL Control Center。Shell 应通过 Control Plane registry 和
adapter slot 承接，而不是遍历 upstream settings pages 后临时隐藏。

实现边界：

- `SettingsHost` 负责页面 frame、search、navigation、deep-link 和 shared protocols。
- `SettingsShellAdapterSlot` 把 App registry entry 映射到当前 shell component。
- Ordinary routes、secondary routes、legacy redirects 和 extension anchor remap 由
  contract hydration 提供。
- 概览先显示结论、影响范围和下一步；raw path、id、receipt、JSON 与 diagnostics
  默认折叠。
- Toggle、menu、segmented control、input、confirmation drawer 和 post-action notice
  使用统一 interaction protocol，不为每页另造 action semantics。
- Upstream 新增 Settings 页面必须先经过下面的 intake classification，不能自动进入
  ordinary navigation。

## Settings Upstream Intake 分类

Broad AionUI intake 先使用 adapter contract 的 `absorbed / rejected / deferred`。只有
Settings route、registry、slot 与 compatibility 变化再使用以下四类判定：

| Class | 何时使用 | 实现动作 |
| --- | --- | --- |
| `accepted` | 行为、copy、authority 和视觉均符合 App contract。 | 原样复用或只做品牌/i18n token 映射。 |
| `adapt` | Primitive 有价值，但信息架构、默认值、copy 或 bridge owner 不同。 | 保留 primitive，改为 profile/state/action driven 的薄适配。 |
| `redirect` | 旧 route/deep link 仍需兼容，但不应出现在普通产品层。 | 在 route adapter 中映射到最近 App-owned page，不渲染旧 ordinary tab。 |
| `reject` | 会引入第二 truth、暴露 forbidden surface、复制不兼容源码或破坏 chat-first。 | 不吸收；必要时在 validator 中加入 forbidden probe。 |

分类记录应说明 App source ref、用户影响、authority owner 和验证入口。不要用
`accepted` 代表“upstream 已有所以直接拿来”，也不要用 `adapt` 合法化深 fork rewrite。

## 视觉实现边界

- ChatGPT macOS 26.707.41301 是当前布局、密度、composer、timeline、project rail 和
  Environment floating details 基准；`26.707.31428` 与 `26.707.31123` 仅保留为历史
  observation。OPL branding 与 product contracts 是例外。
- AionUI 是 active implementation carrier 和 native candidate 的 regression floor，
  不是理想视觉 authority。
- 优先通过 tokens、CSS、existing layout primitives、composition 和 i18n 对齐。
- 不复制 ChatGPT/Codex、AionUI upstream 或外部 demo 源码来建立产品层。
- DOM presence 不能证明视觉可用。Rail、drawer、Environment/details 和 canvas 必须在
  目标 viewport 中有可见像素、正确尺寸、可操作 controls 和无重叠布局。
- Visual change 不得以恢复旧 UI 的方式满足 stale validator；先判断 contract/gate
  是否已经落后于产品目标。

## Visual QA 与证据层级

| Level | 能证明什么 | 不能证明什么 |
| --- | --- | --- |
| Contract/profile validation | 字段、引用、route 和 adapter shape 一致。 | 页面真实渲染、交互和视觉对齐。 |
| Focused unit/DOM test | 指定 state、action、route 和可见行为存在。 | 像素布局、packaged behavior、完整用户路径。 |
| Source browser screenshot | 当前 source renderer 在指定 viewport 可见。 | Packaged App、clean VM、release currentness。 |
| Packaged screenshot/smoke | 某一 package cohort 可启动并渲染目标路径。 | Stable promotion、owner acceptance、domain readiness。 |
| Same-cohort user-path/VM evidence | 指定构建在目标环境完成验收路径。 | 未经 release authority 的发布或 currentness claim。 |

视觉 QA 先覆盖 P0/P1：宽桌面、窄桌面、rail、Home、conversation、composer、
Environment open、light/dark、简体中文/英文和 composer running/error。Settings 属于
P2 独立矩阵，不能替代主工作流证据。截图必须绑定 route、viewport、source/package ref、
command 和可见状态 anchor。

## 实现步骤

1. 读 App contracts、三层文档和当前 adapter；先确认精确 Codex observation、OPL delta
   与 current deviation。
2. 按 `P0 Codex Core -> P1 OPL Professional -> P2 Administration` 排序，不用 Settings
   完成度替代主体验。
3. 先用 `absorbed / rejected / deferred` 分类 broad AionUI intake；Settings 变化再追加
   `accepted / adapt / redirect / reject`，然后从 `L1-L4` 定制阶梯选择第一个可行层级。
4. 只实现 profile consumer、bridge、slot、route、presentation 所需最小 delta。
5. 为用户可见行为增加 focused existing-test coverage；视觉变化增加截图/pixel evidence。
6. 运行 adapter 对应 validation，不用 candidate evidence 替代 active-shell evidence。
7. 更新 conformance matrix 的 source refs 和状态；未取得的 evidence 保持
   `not evidenced` 或 current deviation。

## 反模式

- 在 shell 中复制模型 allowlist、Settings IA、purpose list 或 page-state rules。
- 让 upstream route、Team、多 backend/provider controls 或 raw permission-mode terminology 回到 ordinary UI；App-owned user-language permission/access control 必须保留在 composer。
- 从 module health、Git dirt、active id、缓存或 DOM 推断 runtime/domain readiness。
- 直接执行 domain CLI、写 artifact body、memory body、owner receipt 或 release truth。
- 为兼容一个 carrier 新建 App-wide wrapper/factory 或第二 bridge protocol。
- 把 Home 做成 dashboard、launcher、activity grid 或三列 scientific workbench。
- 宽桌面隐藏 project rail，却把该实现现状写成理想目标。
- 默认打开右侧 inspector，或在窄屏只切换按钮状态而不显示 panel。
- Card inside card、双层 composer surface、随机 radius、混合语言和技术 id first。
- 用 docs、contract-only、focused test 或 source screenshot 宣称 packaged/release-ready。

## 最小验收

一个 shell adapter 至少需要证明：

- App product profile 被读取，模型策略没有 shell-local 分叉；
- ordinary state/action 只通过 App bridge；
- Home/chat-first、timeline、composer、rail 和 Environment/details 行为符合对应 target 或被明确
  标成 current deviation；
- Settings 从 Control Plane registry/slots 渲染，legacy routes 只 redirect；
- 普通 UI 不拥有 runtime/domain/artifact/release truth；
- focused behavior、visual pixels 和 package/release claim 使用匹配层级的证据。
