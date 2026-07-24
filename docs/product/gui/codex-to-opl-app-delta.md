# Codex App 到 OPL App 的产品增量

Owner: `one-person-lab-app`
Purpose: `codex_to_opl_app_delta`
State: `active_design_target`
Machine boundary: 本文是人读 baseline + delta 定义。机器可读产品要求、默认值、
page-state、state/action、release 与 evidence 仍归现有 contracts、source/tests 和 owner
surfaces。

设计体系入口见 [`README.md`](README.md)。

## 文档职责

本文只回答两个问题：

1. OPL App 从当前 Codex desktop interaction reference 借鉴什么？
2. 为服务 OPL 工作，增加、隐藏或改名什么？

功能全集见 [`feature-inventory.md`](feature-inventory.md)，完整交互见
[`ideal-interaction-spec.md`](ideal-interaction-spec.md)，视觉细则见
[`visual-system.md`](visual-system.md)。本文不描述具体 shell 实现或候选路线。

## Literal Observation Boundary

当前人读 baseline 固定为 **ChatGPT macOS 26.707.41301**，本机 bundle build `5103`，
观察于 `2026-07-11`。`26.707.31428` 与 `26.707.31123` 都降级为历史 observation。
本次观察来自标准宽桌面 conversation 状态，不把未实际展开的菜单、空状态、Settings、
移动端或隐藏功能写成 literal fact。

| Area | 26.707.41301 直接观察 | OPL disposition |
| --- | --- | --- |
| App frame | 左 rail、中央单列 conversation、底部 composer 与右上按需环境浮层构成主工作面。 | `adopt_composition_pattern` |
| Rail global entry | 顶部有 New task、Archived、Plugins、Sites、Pull requests、Chat；主体按 project 分组 conversations；底部是 account/help。 | `inherit_structure_adapt_labels` |
| Project hierarchy | Project 是 conversation 的认知父级；同一 project 下可见多条 task/conversation。 | `inherit_and_extend_context_refs` |
| Main canvas | 中央正文保持窄 reading lane，大量宽屏空间用于留白，不转成 dashboard。 | `adopt_composition_pattern` |
| Conversation chrome | 左上只显示当前 task identity 和轻量动作，不放常驻模型配置栏。 | `adopt_composition_pattern` |
| Timeline | Assistant 正文大多 unframed；用户输入、系统提示和可展开细节使用轻量 bounded surface。 | `adopt_composition_pattern` |
| Composer | 固定在底部中央；左侧为 add/access，右侧为 model/reasoning、voice 与 send/stop。 | `inherit_and_bind_app_policy` |
| Environment details | 右上浮层按需显示 changes、local、branch、commit/push、compare、subagents 与 sources。 | `inherit_and_extend_opl_refs` |
| Visual grammar | 白色主画布、浅灰 rail、细边界、低对比选中态、小圆角和紧凑字号；几乎没有页面级卡片。 | `adopt_composition_pattern` |

其中 `subagents` 指 Codex runtime 的真实 delegated execution 与 activity，不是 AionUI Team。
OPL 继承 read-only Active/Done lists、parent/child identity、completed detail/result、open subagent
thread，以及既有 App Server/ACP owner-supported controls，但只通过现有 App Server adapter 做薄
metadata/display 映射。当前 adapter 已能消费 `subAgent*` source
kinds，并投影 `parentThreadId`、`agentRole` 与 `agentNickname`；完整 Codex App 式 activity/detail/
open-thread 仍是 source gap，pixel/install/release 均未验证。关闭 Team 不能被写成缺失 subagent，
也不能借 B0-11 新建第二 App Server client、Team store、scheduler、shell-owned execution 或 bespoke
direct-control buttons。

以下项目不是 26.707.41301 的 literal observation，必须明确标为 OPL-owned delta：

- 当前 session composer 的显式 attachment/paste/drop/`/open` 边界与 OPL workspace state，不存在 project context preload；
- canonical session 身份独立于 project/workspace，目录组不拥有或级联删除 session；workspace 设置新 session 初始 cwd，projectless session 可经 `thread/settings/update.cwd` 与 exact `thread/read` 一次性 adoption，已有 recorded cwd 不任意换组，运行时 `pwd` 不反写 rail 分组；
- Research、Grant、Presentation、Book 等 capability/package 语义；
- OPL task progress、evidence、artifact、action confirmation 与 receipt；
- OPL Settings IA、first-run、双语、runtime 和 release authority。

因此，Codex baseline 定义主 composition、空间关系、交互位置和视觉质量；OPL 只在这些
位置增加专业能力，不复制 ChatGPT 品牌、账户、服务端产品或 authority。

## OPL Target Translation

OPL App 采用下列翻译规则；没有明确 delta 的区域默认复用 reference 的 composition pattern。
视觉质量按 [`codex-app-visual-parity.md`](codex-app-visual-parity.md) 做 1:1 对齐；产品行为、
数据、品牌与 authority 仍只来自 OPL contracts，不能从像素反推：

1. **Session-first grouped rail。** 保留 Codex 按工作目录组织 conversations 的认知分组，但 canonical
   thread/session 是身份单位，project/workspace 是零或一个 affinity，用于初始 cwd、projectless 一次性
   adoption、分组和可见 metadata。目录组不拥有 session，也不提供目录级输入、附件管理或级联删除。
2. **Chat-first canvas。** Home/New task 和已有 conversation 使用同一 canvas、timeline
   与 composer。认证后的普通启动直接进入 `/guid`，不等待 fast App state 或 visible
   `StartupGate`；状态与 managed-agent discovery 在后台刷新，失败只影响依赖它们的局部能力。
   `<=1500 ms` 是 OS launch request 到 Guid composer visible/enabled/focusable 的 installed target，
   不是源码测试结果或 SLA。Starter 只帮助选择 purpose，不形成长期 dashboard。
3. **Composer owns execution controls。** Model/reasoning、access、attachment、active
   capability 与 send/stop 都在 composer 附近；header 不重复这些配置。
4. **Timeline owns task interaction。** Streaming、tool/process、approval、progress、result
   和 receipt 在当前 conversation 中完成；跨项目 Runtime 是条件保留的 X0-01 route，不是核心替代面。
   `opl_app.domain_detail_views.v2` 只是 item-scoped typed detail 的可选增强；缺失时保留 Runtime
   list/core detail，只隐藏依赖入口或在直达链接显示局部 unavailable。
5. **Environment owns secondary context。** 先继承右上按需浮层，再把 OPL refs、artifact
   与 evidence 作为次级 section/preview 扩展；默认不打开全高 inspector。
6. **Settings stays secondary。** Settings 只负责持久配置和控制面，不决定主工作流。

### Carrier-neutral 产品模型

功能来源固定为 `B0 Codex 必要 Baseline`、`R1 等价功能替换`、`U1 OPL 独有` 和
`X0 条件保留/当前非目标`。其中 `B0 + R1 + U1` 是唯一产品定义：

- AionUI active 是 reuse-first、薄适配的当前 carrier；上游已有能力优先复用，不为目录完整度重写核心。
- Native candidate 是同一产品定义的候选实现；将来从头实现时必须自行补齐 B0，并实现同一 R1/U1 用户结果。
- carrier、功能来源、`P0/P1/P2` 优先级、source 完成度和视觉 1:1 是彼此独立的轴。
- X0 可以条件保留，但不得扩大或阻断当前 `B0 + R1 + U1` 薄壳基线。

完整 B0 目录、R1/U1 两张必要功能 List 与“为什么必要”见
[`feature-inventory.md#功能来源分类`](feature-inventory.md#功能来源分类)；当前 AionUI/Native
source、pixel、install、release 证据见
[`shell-conformance-matrix.md#r1--u1-必要功能实现矩阵`](shell-conformance-matrix.md#r1--u1-必要功能实现矩阵)。

### AI-first failure semantics

OPL 系列交互默认 fail-open：先消费 owner-projected action 自修复，再 JIT prepare，再降级或
使用安全 fallback；只有仍无法真实执行时才保留 draft 并给 owner route。不得预先因为 stale、
`verification_deferred`、update available、可选依赖、可选 receipt/binding，或 owner action
并未要求的 Workspace 而 block。

Fail-open 不等于吞错或伪造成功。以下边界仍局部 fail-closed：所选 Package identity
不存在或不可调用、入口不存在、不安全 managed target/path traversal、权限/sandbox/账户授权拒绝、
未确认的不可逆外部 mutation，以及任何无法得到真实证据的成功/authority 声明。破坏兼容的变化
发布新的 capability identity 或 owner adapter，不在 ordinary launch 增加跨 Package 版本 gate。
故障范围只允许落到所选 Agent；普通 Codex、其他 Agent、draft 和既有 session 必须继续可用。

Launch runtime state 固定为 `ready / degraded / package_unavailable`，不增加 `strict` 第四状态。
若受监管或可复现 package 需要精确 closure、binding、receipt 或其它前置证据，应由 owner policy
投影为 action required fields 和 typed reason；不满足时仍归入上述三态，并只限制该 package。
Workspace/managed target 同样只看 exact owner-projected action 的 `required_payload_fields`，Shell
不得自行解析 manifest 后增加启动条件。

Receipt 必须区分用途：activation result 的 `use_receipt_ref` 是可选审计证据，缺失不构成普通启动
前提；package shortcut 的 invocation receipt 仍必须记录实际 launch fact，但它不证明 binding、
closure、domain readiness 或 release readiness。不得用前者的可选性删除后者，也不得用后者反向
制造 readiness gate。

### OPL Feature Preservation Gate

Codex baseline 只能帮助确定信息放在哪里、怎样交互，不能决定 OPL 有哪些功能。“不降级”
保护 B0/R1/U1 用户结果，并默认继承 AionUI/AionCore 官方基础能力。Team 是明确拒绝的
上游产品面；fixed Codex executor 可隐藏 provider/backend marketplace；普通 Skill 入口由 App
packaged-skill allowlist 策展。MCP 不使用该 allowlist：所有已配置的用户/第三方 MCP 默认端到端
保留，只排除命中明确 Team/internal negative filter 的 server、tool 与 metadata。缺少 App 条目
本身不能成为禁用其它上游能力的授权。
对 Home capability starters、Settings → Agents / Capabilities、first-run、domain package entry 和
双语等 B0/R1/U1 capability：

- 可以在用户认知更清晰时调整位置，但不得因 Codex 没有同名入口而删除；
- 旧入口只能在同一变更已经提供可见、键盘可达的替代入口后移除；
- contract、shell source、navigation tests 和需要的 visual evidence 必须一起更新；
- 跨项目 Runtime cockpit 归 X0-01，可保留但不是核心 preservation gate、默认 release blocker 或
  Native phase-1 parity；会话级 current-task status 继续由 timeline/context 承担。

### Inherit / Adapt / Add / Reject

| Class | 内容 | 设计约束 |
| --- | --- | --- |
| `adopt_composition_pattern` | App frame、directory/session rail、单列 timeline、底部 composer、environment floating details、quiet visual grammar。 | 保持参考产品验证过的认知位置；稳定视觉 chrome 逐像素对齐，功能、数据、文案和可见状态仍由 OPL contracts 决定。 |
| `adapt` | Global rail labels、model/access policy、working-directory metadata、Settings IA、desktop/WebUI affordance。 | 保持 Codex 认知位置，只替换数据和用户语言；不能借适配删除 OPL-owned capability。 |
| `add` | OPL capability selection、Work Item status，以及 Inspector / Settings 中的 evidence、artifacts、safe actions、receipts。 | 按 owner surface 渐进披露；当前 session 输入只由 composer 显式加入，不建立 workspace/project context preload，也不得抢占主 timeline、塞入 Runtime 或制造 card wall。 |
| `reject` | Home dashboard、状态卡片墙、常驻 provider/backend selector、多套 inspector、普通路径 raw runtime/protocol。 | 不以“OPL 专业性”为理由恢复。 |

## 增量摘要

| Baseline area | OPL 增量 | Authority owner |
| --- | --- | --- |
| Product identity | 使用 One Person Lab App 名称、icon、窗口与 release identity。 | App GUI/release contracts 与 assets。 |
| Workspace/chat | 支持 project task 与 projectless conversation，并增加 OPL purpose、package 和 refs context。 | App product profile、GUI contract。 |
| Model control | 保持 Codex-like model/reasoning control；App profile 定义 UI 与 fallback，已安装 Flow 提供 recommendation，Codex live catalog 提供当前默认。 | `contracts/app-product-profile.json`、OPL Flow policy。 |
| Agents / Capabilities | Agents 消费公共 Agent Package directory 并管理 lifecycle/Home visibility；Capabilities 管理 Skills、Plugins、OPL Flow、MCP、图像和语音能力。 | Framework package directory、App package metadata overlay 与 capability registries。 |
| Current-task context | 在 timeline/context 中增加 Framework-backed current Work Item status、running state、next action/owner 与必要 refs；跨项目 Runtime route 仅为 X0-01 retained source。 | Framework WorkItemProjection 与 App current-task slice；Runtime hard gate 待清理。 |
| Settings | 作为次级配置面保留 OPL Control Center IA，不反向定义主工作流。 | App GUI contract、Settings Control Plane。 |
| First-run | 增加 Core readiness、guided setup 和 background maintenance。 | App first-run/install contracts。 |
| Delivery | 增加 desktop/WebUI 的同产品语义；Hosted Workspace 与远程资源只在 X0 owner/backend 存在时给 refs/owner route。 | App adapters、Framework/Gateway refs；X0-03/X0-04 条件启用。 |
| Evidence | 增加 route/action/release/visual evidence 边界。 | App/domain/runtime/release owner surfaces。 |

## OPL 品牌增量

- Bundle identity、App icon、About、manifest 和 release assets 使用完整 One Person Lab App
  产品身份；ordinary chrome 只显示 `One Person Lab`，不重复显示 carrier 或 executor 名称。
- macOS 使用 Codex-like full-size content titlebar：保留交通灯、窗口拖动和系统可访问性，隐藏
  独立标题栏背景与标题文字，内容为交通灯预留安全区。
- 标题栏右侧保留一个全局问题反馈图标，打开 OPL App GitHub Issue 新建页，并预填当前页面与
  App 版本；用户在外部浏览器审阅后提交，不再调用 AionUI 自有的反馈投递。
- ChatGPT/Codex 只作为 executor/interaction reference，不作为 OPL App visible brand。
- OPL accent 与 purpose language 可以偏离 Codex 品牌，但主 composition 仍保持
  Codex-based chat-first。
- Carrier/upstream 名称只进入 About、provenance 或 diagnostics，不进入 ordinary chrome。

## Executor 与模型增量

Codex App 的模型控制在 OPL App 中进一步收敛：

- Codex CLI 是 ordinary conversation 的固定 executor。
- Backend、provider 不作为普通 Home/composer controls。
- Permission/access mode 在 Home 与 conversation 可见，以自动化和文件权限的用户语言
  表达；不暴露 backend/provider，但保留安全透明度。
- Home 与 conversation 使用同一个紧凑 App-owned model/reasoning menu。
- 模型 UI 与 fallback 只引用 `contracts/app-product-profile.json`，Flow recommendation 通过
  Framework 投影消费；本文不复制 model/reasoning 值、allowlist、排序或退休列表。
- Profile 缺失或不兼容时显示明确 blocker，不静默采用 shell/upstream default。

## Purpose 与 Agent Package 增量

OPL App 在普通 Codex conversation 上增加工作目的和 package shortcuts。Purpose 从
composer 常驻 selector 移出，主要从 Home starter 选择；Home/new-session `+` palette 可在首次发送前
选择同一 allowlist package，两条入口共享 active capability、route receipt 与 readiness gate；package 安装、Home visibility 与
lifecycle 进入 Settings → Agents，Skills/Plugins/Flow 管理进入 Settings → Capabilities。
Home 只用 starter 选中态表达 active capability；conversation 可显示低权重 capability chip：

| 用户目的 | 用户结果 | Domain owner |
| --- | --- | --- |
| 科研 / Research | 开始研究、论文、审稿与投稿相关工作。 | MAS |
| 基金 / Grant | 开始基金选题、申请书和评审回应工作。 | MAG |
| 演示 / Presentation | 开始 PPT、汇报、图表和视觉交付工作。 | RCA |
| 写书 / Book | 开始书稿故事线、章节与出版交付工作。 | BookForge |

这些入口：

- 只改变 route context、package shortcut 和 assistant-scoped capability profile；
- 不改变 executor/backend；
- active capability 可按上下文更换，但不表现为 backend/provider；
- 不把 domain workflow、stage、artifact schema 或 verdict 写进 GUI；
- 产生 launch/route refs，供用户按需审计；
- 是否显示由 App product profile、安装状态和用户 shortcut preference 决定。
- Starter 始终可选择；send 时消费 directory entry 投影的 exact action，并由 action 的
  `required_payload_fields` 决定是否需要 Workspace。
- `ready` 直接启动；`degraded` 先做 owner-projected JIT prepare/repair/fallback 并明确降级；
  `package_unavailable` 只局部阻止所选 Agent、保留 draft，并提供普通 Codex、其他 Agent 或 owner route。
- receipt、binding 和 closure 是可审计结果或 diagnostics，不是普通启动必须全部齐备的硬门槛。

## Capability 增量

- Settings 提供 installed Agent Package directory、Home exposure 和 lifecycle actions。
- Required/optional skills 来自 App packaged profile，不来自 shell-local discovery dump。
- Ordinary Home/conversation 的 Skill 入口只显示当前 purpose/package allowlist 接受的 Skills。
- 已配置的用户/第三方 MCP 经 Team/internal negative filter 后端到端继承，并在对应连接/状态
  surface 使用产品化标签；不能因为 unknown 或不在 Skill allowlist 中而删除。
- Helper Skills、provider marketplace 和 implementation plugins 不自动进入 ordinary UI。
- Install/update/repair/hide/disable/uninstall 通过 App state/action、preview、confirmation
  和 receipt 完成。
- GUI 展示 package status 与 refs，不拥有 package execution、runtime 或 domain truth。

Legacy `codexcont-intelligence-enhancement` 代理属于 OPL Flow 明确退休的冲突项，不恢复为
App-owned toggle 或后台服务。若 Codex executor 原生提供且 App profile 明确允许相关能力，
可以继续由 composer 的 App-owned model/intelligence menu 投影；这是 authority migration，
不是删除用户可用的 Codex 原生功能，也不能重新引入第二 provider/service truth。

## 用户触发的线程操作

- Thread list/read/start/resume/fork/archive/restore 直接复用一个 Codex App Server adapter；普通
  conversation 发送继续走 AionUI 现有 ACP。
- 普通用户入口复用 project/conversation directory 与 row actions；不增加独立协调页面、常驻
  dashboard、主 composer 控件或模型 dynamic tool。
- Shell 不维护第二 JSON-RPC client、JSONL audit/idempotency ledger、write-set advisory、
  pending-request 控制面、model delivery 或 cross-host handoff。

## Current-task 与条件 Runtime 增量

普通 Codex timeline 主要关心当前 turn，并承载核心 current-task context。跨项目 Runtime cockpit
统一按 X0-01 `retained_x0_route` 读取；已有 AionUI route/source 可保留，Source 按五轴单独记录，
core-gate pruning 是 maintenance debt。它不属于 B0/R1/U1、默认 release gate 或 Native phase-1 parity。

- 条件启用的 Runtime overview 只展示 owner projection 提供的真实 running、project lines、queued 和 attention。
- Current-turn artifact 与 OPL current-task projection 共用可 pin summary bar，展示
  status、elapsed、progress、next action、stop。
- Environment 浮层采用 workspace/locality/branch/changes/subtasks/sources 的紧凑结构；
  commit/push/compare 等只有在真实 action/ref 存在时才按需出现。
- Artifacts、Evidence、Runtime 与 Actions 作为浮层次级 section、preview 或 conversation
  disclosure 按需出现；不默认形成全高第三列。
- Mutation 统一走 App action route，并保留 dry-run、confirmation 与 receipt。
- Progress 区分 deliverable progress、platform repair、human gate 和 typed blocker。
- UI 不从 active id、module dirt、provider completion、docs 或 test pass 推断 domain、
  production、artifact 或 release readiness。

Route receipt、action receipt、artifact ref、owner handoff 和 release evidence 必须使用
用户能理解的 summary；raw id、JSON、path 和 protocol detail 按需展开。

## Settings Control Center 增量

OPL App 把通用 Agent App settings 收敛为用户任务导向的 Control Center：

- Settings 是 secondary route；可以借鉴 Codex 的返回、搜索和 grouped-row 交互，但
  OPL IA 不变，且 Settings 视觉不得成为 Home/Conversation 的设计来源。

- Overview：概览，包括一个常驻 Background tasks 汇总；Temporal 组件明细不在此展开。
- Account & Models：账户与访问；模型。前者拥有 Gateway/Key/用量，后者只拥有模型来源与偏好。
- Connections & Deployment：资源与连接。真实本机/WebUI/外部连接 refs 在这里；Hosted
  Workspace、Fabric/HPC、Console 仅在 X0 owner/backend 存在时出现，不维护占位状态。
- Workspace：工作目录；数据与存储。Desktop workspace root 可走 owner action；WebUI
  `/projects` 只读。Docker 只读展示 `/projects`、`/data` 两个必需宿主 bind，`/recovery`
  是可选 deployment-managed 恢复面。
- Agents & Capabilities：智能体；能力；指令与上下文。用户 `AGENTS.md` 和
  new-conversation additions 复用 Workspace carrier，但不再属于 Workspace 导航。
- Runtime & Maintenance：服务状态；更新与修复；日志与诊断。三者在 Environment carrier
  上互斥呈现；Desktop 日志目录可改，standalone WebUI 只读显示 systemInfo 日志投影，
  Docker WebUI 只读显示 `/data/logs`。
- Preferences：语言、主题、通知、启动、密度、字体和 motion。

About 是底部唯一辅助页；Advanced、Update、Theme、Local Services 和 Personalization
只 redirect 到 owner destination/anchor。具体 registry、labels、redirects、actions 和
page-state 只由 contracts/Control Plane 提供，本文不复制。

## First-run、安装与更新增量

OPL App 在 Codex baseline 上增加可解释的本机准备：

- Core readiness 判断 workspace、Codex CLI 和可用模型访问是否足以 launch。
- 缺失项显示 blocker、next action 和按需 technical details。
- Initialization 显示 phase、elapsed、result 和 recovery path。
- Full readiness、package reconcile、runtime provider 与 ecosystem maintenance 在普通
  launch 后继续，除非 contract 明确阻塞。
- Standard updater、Full first-install 和 candidate package 保持不同 release/evidence
  边界。
- Docs、contract 或 source smoke 不替代 clean-machine、same-cohort 或 release evidence。

## Local-first 与条件 Cloud/Remote 增量

- macOS desktop 使用 native window、directory picker 和 packaged App。
- Desktop 在新任务创建时选择初始工作目录，也允许 projectless session 用户触发一次性 Project adoption；
  adoption 只允许 `custom_workspace=false` 或无 canonical recorded cwd，且 exact readback 成功后才提交本地 projection。
  不自建 managed Worktree/Handoff，也不提供已绑定 session 的持久 cwd 重绑。命令或 turn 的实际 `pwd`
  仍由 Codex 执行上下文决定，不扩展 Project affinity。
- Docker/WebUI 在受控 workspace/volume 中提供同一产品语义。
- Hosted Workspace 属 X0-03；只有稳定账户、计费、存储与隔离 backend/owner 存在时才启用，普通
  Settings 不维护占位状态。
- Fabric/HPC/Console 属 X0-04；只有真实 owner projection 存在时才以 refs/owner route 进入
  Resources 或任务上下文，不把 plan/approve/run/collect/receipt 字面合同当成 App 核心能力。
- Desktop/WebUI 可以使用不同 transport/native affordance，但不能分叉 product profile、
  Settings IA、runtime truth 或 release channel。

## 命名与语言增量

- 普通 labels 描述工作目的，不优先显示 package short name、route id 或 protocol。
- 简体中文和英文同屏保持单一语言；OPL、Codex 可作为品牌保留。
- Commands、paths、receipt ids、schema names 和用户原文在 details/diagnostics 中保留原样。
- Status copy 先说明结论、影响和 next action，再提供 technical refs。
- Language switch 不改变 workspace、thread、route、runtime 或 owner truth。

## 从通用 Agent UI 隐藏或重构

普通路径不展示：

- executor/backend/provider marketplace；
- provider/backend 术语化的 permission selector；
- raw AG-UI/ACP/app-server/protocol event names；
- upstream Team、多 agent launcher 或 shell-local agent hierarchy；
- 默认打开的 Environment/details、bottom panel、file tree、Terminal 或 Browser；
- Home activity dashboard、continue-work grid 或 full evidence ledger；
- 未经 App packaged-skill allowlist 接受的 helper Skills，以及命中明确 Team/internal negative
  filter 的 MCP server/tool/metadata；其它已配置用户/第三方 MCP 必须端到端保留；
- 由 module dirt、cache 或 local UI state 推断的 readiness。

这些内容若仍有诊断价值，应进入 Advanced/details，不成为 ordinary product concept。

## Non-goals

- 复制 ChatGPT/Codex 的专有实现、品牌或服务端产品；交互与视觉基线本身应尽量直接继承。
- 让 OPL branding 覆盖 Codex-based interaction quality。
- 让 MAS/MAG/RCA/BookForge 成为独立 backend choices。
- 把 runtime、domain、artifact、memory、owner receipt 或 release truth 移入 App GUI。
- 为 desktop 与 WebUI 维护两套产品信息架构。
- 把 carrier、外部 GUI 或一次设计稿提升成 product authority。

## 验收

OPL App 应让用户在 Codex-like 低摩擦工作流中：

- 从 persistent project/conversation rail 进入 workspace conversation；
- 不依赖 workspace 进入 projectless text conversation，并理解文件/project 能力限制；
- 使用 single timeline 和 bottom composer 发送任务；
- 从 Home starter 或 new-session `+` palette 选择同一 OPL purpose/package，在 Settings 管理 package/Home visibility；
  Home 不在 composer 重复能力标签，conversation 仅显示低权重 active capability chip；
- 使用 App-profile model/reasoning control，并动态呈现当前默认值；
- 以用户语言查看 permission/access mode，而不是 provider/backend；
- 在 turn 中理解进度、prompt、error、result 和 receipt；
- 只在需要时打开 environment floating details、preview 或 advanced work surfaces；
- 理解 first-run、maintenance、resource 和 release 边界；
- 不把任何 GUI projection 误读为 runtime/domain/artifact/release authority。
