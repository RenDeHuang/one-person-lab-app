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

以下项目不是 26.707.41301 的 literal observation，必须明确标为 OPL-owned delta：

- 当前 session composer 的显式 attachment/paste/drop/`/open` 边界与 OPL workspace state，不存在 project context preload；
- canonical session 身份独立于 project/workspace，目录组不拥有或级联删除 session，既有 session 可原位切换 cwd 并重新分组；
- Research、Grant、Presentation、Book 等 capability/package 语义；
- OPL task progress、evidence、artifact、action confirmation 与 receipt；
- OPL Settings IA、first-run、双语、runtime 和 release authority。

因此，Codex baseline 定义主 composition、空间关系、交互位置和视觉质量；OPL 只在这些
位置增加专业能力，不复制 ChatGPT 品牌、账户、服务端产品或 authority。

## OPL Target Translation

OPL App 采用下列翻译规则；没有明确 delta 的区域默认复用 reference 的 composition pattern，
不把外部产品行为或像素解释为 1:1 authority：

1. **Session-first grouped rail。** 保留 Codex 按工作目录组织 conversations 的认知分组，但 canonical
   thread/session 是身份单位，project/workspace 只是初始 cwd、可变分组和可见 metadata。目录组只提供
   “使用此工作目录新建对话”，不拥有 session，也不提供目录级输入、附件管理或级联删除。
2. **Chat-first canvas。** Home/New task 和已有 conversation 使用同一 canvas、timeline
   与 composer。Starter 只帮助选择 purpose，不形成长期 dashboard。
3. **Composer owns execution controls。** Model/reasoning、access、attachment、active
   capability 与 send/stop 都在 composer 附近；header 不重复这些配置。
4. **Timeline owns task interaction。** Streaming、tool/process、approval、progress、result
   和 receipt 在当前 conversation 中完成；Runtime 只做跨项目管理。
5. **Environment owns secondary context。** 先继承右上按需浮层，再把 OPL refs、artifact
   与 evidence 作为次级 section/preview 扩展；默认不打开全高 inspector。
6. **Settings stays secondary。** Settings 只负责持久配置和控制面，不决定主工作流。

### OPL Feature Preservation Gate

Codex baseline 只能帮助确定信息放在哪里、怎样交互，不能决定 OPL 有哪些功能。“不降级”
只保护已经进入 OPL App contracts、ordinary routes 或正式用户路径的能力；AionUI 自带但未被
OPL 采纳的 Team、provider/backend、任意 skills/MCP、Sites/Chat 等入口可以隐藏或拒绝。
对 Runtime、Home capability starters、Settings → Agents & Capabilities、first-run、domain
package entry 和双语等 OPL-owned capability：

- 可以在用户认知更清晰时调整位置，但不得因 Codex 没有同名入口而删除；
- 旧入口只能在同一变更已经提供可见、键盘可达的替代入口后移除；
- contract、shell source、navigation tests 和需要的 visual evidence 必须一起更新；
- 跨项目 Runtime cockpit 与会话级 Runtime details 是两个不同职责，后者不能替代前者。

### Inherit / Adapt / Add / Reject

| Class | 内容 | 设计约束 |
| --- | --- | --- |
| `adopt_composition_pattern` | App frame、directory/session rail、单列 timeline、底部 composer、environment floating details、quiet visual grammar。 | 保持参考产品验证过的认知位置，再由 OPL contracts 决定功能、数据、文案和可见状态；不宣称逐像素或逐行为复制。 |
| `adapt` | Global rail labels、model/access policy、working-directory metadata、Settings IA、desktop/WebUI affordance。 | 保持 Codex 认知位置，只替换数据和用户语言；不能借适配删除 OPL-owned capability。 |
| `add` | OPL capability selection、Work Item status，以及 Inspector / Settings 中的 evidence、artifacts、safe actions、receipts。 | 按 owner surface 渐进披露；当前 session 输入只由 composer 显式加入，不建立 workspace/project context preload，也不得抢占主 timeline、塞入 Runtime 或制造 card wall。 |
| `reject` | Home dashboard、状态卡片墙、常驻 provider/backend selector、多套 inspector、普通路径 raw runtime/protocol。 | 不以“OPL 专业性”为理由恢复。 |

## 增量摘要

| Baseline area | OPL 增量 | Authority owner |
| --- | --- | --- |
| Product identity | 使用 One Person Lab App 名称、icon、窗口与 release identity。 | App GUI/release contracts 与 assets。 |
| Workspace/chat | 支持 project task 与 projectless conversation，并增加 OPL purpose、package 和 refs context。 | App product profile、GUI contract。 |
| Model control | 保持 Codex-like model/reasoning control，但策略只由 App product profile 提供。 | `contracts/app-product-profile.json`。 |
| Capabilities | 把普通 agent/tool 入口收敛为 installed OPL Agent Packages 与 assistant-scoped skills。 | App package registry/profile。 |
| Runtime context | 增加 Framework-backed Work Item status、running state、Stage/Attempt、Token、next action/owner 和 archive/restore；receipt、artifact、safe action 与 raw diagnostics 分别留在 Inspector、Settings 或 release tooling。 | Framework WorkItemProjection 与 App Runtime contract。 |
| Settings | 作为次级配置面保留 OPL Control Center IA，不反向定义主工作流。 | App GUI contract、Settings Control Plane。 |
| First-run | 增加 Core readiness、guided setup 和 background maintenance。 | App first-run/install contracts。 |
| Delivery | 增加 desktop/WebUI/Workspace 的同产品语义与受控资源入口。 | App adapters、Framework/Gateway/Fabric refs。 |
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
- 模型策略与当前默认值只引用 `contracts/app-product-profile.json`；本文不复制
  model/reasoning 值、allowlist、排序、退休列表或 fallback 逻辑。
- Profile 缺失或不兼容时显示明确 blocker，不静默采用 shell/upstream default。

## Purpose 与 Agent Package 增量

OPL App 在普通 Codex conversation 上增加工作目的和 package shortcuts。Purpose 从
composer 常驻 selector 移出，只从 Home starter 选择；package 安装、Home visibility 与
lifecycle 进入 Settings → Agents & Capabilities，composer/context strip 只显示 active
capability chip：

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
- 不可用 starter 显示可理解原因和 contract 允许动作；launch 前由 Framework 在
  use boundary reconcile current compatible package closure，App 只在 `launch_allowed` 和
  use receipt/binding 完整时继续。

## Capability 增量

- Settings 提供 installed Agent Package directory、Home exposure 和 lifecycle actions。
- Required/optional skills 来自 App packaged profile，不来自 shell-local discovery dump。
- Ordinary Home/conversation 只显示当前 purpose/package allowlist 接受的 capabilities。
- Helper skills、unknown MCP、provider marketplace 和 implementation plugins 不自动进入
  ordinary UI。
- Install/update/repair/hide/disable/uninstall 通过 App state/action、preview、confirmation
  和 receipt 完成。
- GUI 展示 package status 与 refs，不拥有 package execution、runtime 或 domain truth。

Legacy `codexcont-intelligence-enhancement` 代理属于 OPL Flow 明确退休的冲突项，不恢复为
App-owned toggle 或后台服务。若 Codex executor 原生提供且 App profile 明确允许相关能力，
可以继续由 composer 的 App-owned model/intelligence menu 投影；这是 authority migration，
不是删除用户可用的 Codex 原生功能，也不能重新引入第二 provider/service truth。

## 跨线程会话增量

- 跨顶层线程 list/read/resume/fork/archive/start/steer、advisory、幂等和可见 delivery audit 是
  OPL-owned capability，不能因对齐 Codex composition 而删除。
- 普通用户入口位于每条对话的详情/更多菜单，属于当前 thread context action；不增加 rail
  页面、常驻 dashboard 或主 composer 的“协调”控件。
- 协调 dialog 默认关闭。模型仍可通过 App host tool 发起相同能力，并与用户入口复用同一
  typed host adapter、Codex policy inheritance、write-set/route advisory 和 audit projection。
- Approval、permission、user-input 与 MCP elicitation 是 selected target thread 的 pending state，
  不是 dispatch failure；delivery audit 不冒充独立 approval receipt。独立非紧急 queue 与双边
  timeline event 只有真实实现后才可声明。
- 入口位置可以极简，能力、失败可见性和审计语义不得降级。

## Runtime 与 Evidence 增量

普通 Codex timeline 主要关心当前 turn；OPL App 额外提供跨项目 runtime context：

- Runtime overview 展示真实 running、仍在推进的 project lines、queued 和 attention。
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

- Overview：App 是否可用、下一步是什么。
- Access：模型访问、Codex CLI 和远程访问。
- Workspace：工作目录与权限。
- Capabilities：packages、skills 与 Home shortcuts。
- Resources & Connections：本机、远程、托管资源和连接 refs。
- Maintenance & Updates：App/runtime/packages/local services 的维护。
- Data & Storage：空间、数据分类、preview 和安全 cleanup。
- Preferences：语言、主题、通知、启动、密度、字体和 motion。

Advanced/About/Update 等保持 secondary。具体 route registry、labels、redirects、actions
和 page-state 只由 contracts/Control Plane 提供，本文不复制。

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

## Local-first / Cloud-continuous 增量

- macOS desktop 使用 native window、directory picker 和 packaged App。
- Local/Worktree只决定任务当前运行位置，不形成目录权限域。Managed worktree默认保留；显式
  cleanup必须先生成durable Git snapshot receipt，恢复时还原HEAD、branch或detached HEAD、
  index、tracked、untracked与ignored user files，冲突typed fail且不覆盖用户现有内容。
- Docker/WebUI 在受控 workspace/volume 中提供同一产品语义。
- Hosted WebUI 加账号、存储、隔离和资源策略后可以成为 OPL Workspace delivery。
- Gateway、Fabric、Console、SSH/HPC 和其它资源通过 refs、plan/approve/run/collect/
  receipt 进入任务上下文；GUI 不拥有资源、计费或 provider truth。
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
- 未经 App allowlist 接受的 skills/MCP/tools；
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
- 从 Home starter 选择 OPL purpose/package，在 Settings 管理 package/Home visibility，
  composer 只显示 active capability chip；
- 使用 App-profile model/reasoning control，并动态呈现当前默认值；
- 以用户语言查看 permission/access mode，而不是 provider/backend；
- 在 turn 中理解进度、prompt、error、result 和 receipt；
- 只在需要时打开 environment floating details、preview 或 advanced work surfaces；
- 理解 first-run、maintenance、resource 和 release 边界；
- 不把任何 GUI projection 误读为 runtime/domain/artifact/release authority。
