# OPL App GUI 功能目录

Owner: `one-person-lab-app`
Purpose: `product_level_gui_feature_inventory`
State: `active`
Machine boundary: 本文是人读功能目录。机器可读 GUI truth 仍归
`contracts/app-gui-product-contract.json`、
`contracts/app-product-profile.json`、
`contracts/app-page-state-matrix.json`、Settings/adapter/release contracts、source、
tests 与 evidence。

设计体系入口见 [`README.md`](README.md)。

## 文档职责

本文只回答“OPL App GUI 必须提供哪些用户能力”，不定义视觉 token、不记录某个 shell
的实现历史，也不维护完成度。交互顺序见
[`ideal-interaction-spec.md`](ideal-interaction-spec.md)，视觉见
[`visual-system.md`](visual-system.md)，carrier 承接见
[`shell-conformance-matrix.md`](shell-conformance-matrix.md)。

功能项是产品目录，不是独立 machine schema。功能的字段、默认值、状态来源和验收条件
必须回到现有 contracts；本文不复制模型 allowlist、route registry 或 page-state 列表。

## 产品优先级

功能不能按页面数量平均分配设计和实现资源：

| Priority | Product layer | 包含 | 完成定义 |
| --- | --- | --- | --- |
| `P0 Codex Core` | 日常主工作流 | App frame、project/conversation rail、New task、conversation timeline、composer、streaming、history、model/reasoning、access/permission。 | 用户不离开 chat canvas 即可开始、继续和完成普通任务。 |
| `P1 OPL Professional` | OPL 专业增量 | Capability selection、用户触发的线程操作、task progress、approval、evidence/artifact preview、safe action 与 receipt。 | 增量嵌入 P0 稳定位置；输入由用户在当前 session 显式加入，不引入 workspace preload、dashboard、第二套导航或第二套 thread store。 |
| `P2 Administration` | 配置和运维 | Settings、Runtime 跨项目总览、first-run、安装、更新、诊断。 | 可发现、可恢复，但不反向决定 P0/P1 的布局和视觉。 |

任何工作若只改善 `P2`，不能据此声称 GUI 主体验已对齐 Codex。设计评审和视觉证据
默认先覆盖 `P0`，再覆盖 `P1`，最后覆盖 `P2`。

## 功能来源分类

`B0 / R1 / U1 / X0` 回答“功能从哪里来、OPL 是否必须自维护”；`P0 / P1 / P2`
回答“先做什么”。两条轴不得互相替代。AionUI active 与 Native candidate 是同一
`B0 + R1 + U1` 产品定义的两种 carrier，不是两层产品：AionUI 能复用就复用并保持薄适配，
Native 将来需要独立实现同一用户结果。视觉 1:1 是独立的 pixel 目标，不改变功能来源分类。

### B0 Codex 必要 Baseline

| ID | 必要基线 | 为什么必要 | 当前产品边界 |
| --- | --- | --- | --- |
| `B0-01` | App shell、窗口、rail、响应式导航、键盘历史 | 没有稳定的桌面骨架就不是可持续使用的 Codex 工作台。 | AionUI 优先复用；Native 自行实现。视觉参考不复制 Codex 品牌或 authority。 |
| `B0-02` | Home/New task、session/thread 目录与历史管理 | 新建、恢复、搜索、pin、rename、archive/restore 是日常入口。 | Session 是身份单位；workspace/project 只提供初始 cwd、记录与分组。 |
| `B0-03` | Conversation timeline、streaming、stop/retry、tool/process 与错误 | 这是 AI 工作闭环，不应被 OPL 管理面取代。 | 复用 Codex/AionUI conversation adapter；错误保持真实且可恢复。 |
| `B0-04` | Composer、文本、附件、paste/drop、显式 file/directory input | 用户必须能直接把本地上下文交给 Agent。 | 输入只进入当前 send，不做隐式 workspace preload。 |
| `B0-05` | Model/reasoning 与 Auto/fixed 偏好 | 用户需要在发送点控制质量、速度和成本。 | 交互属于 B0；模型 entitlement、余额和默认目录 owner 归 `R1-02`。 |
| `B0-06` | Access/permission、sandbox、approval、补充输入 | 本地 Agent 必须让权限与不可逆动作透明。 | 安全边界 fail closed；单个 OPL package 故障不得改变普通 Codex 权限流。 |
| `B0-07` | Files、Changes、artifact preview 与常用 renderer | 用户需要查看代码、文件和交付物，而不是只读聊天文本。 | Preview/renderer 属 B0；完整 OPL evidence 平台归 `X0-02`。 |
| `B0-08` | Git、branch、diff、review、commit/push、PR context | 编码任务需要可审查、可交付的版本控制闭环。 | 协议缺口显示 unavailable，不建立本地伪成功 store。 |
| `B0-09` | Terminal、Browser、Environment details | Agent 工作经常需要按需查看运行与环境。 | 作为次级工具按需打开，不做默认第三栏或 OPL dashboard。 |
| `B0-10` | Workspace 初始 cwd 与本地 Worktree 工作模式 | 本地任务需要隔离目录和执行上下文。 | 当前 AionUI 不自造既有 session cwd 重绑或 managed handoff；未来复用稳定 upstream 或由 Native 实现。 |
| `B0-11` | Subagents / 并行子任务 | 复杂任务需要并行探索、验证与汇总。 | 展示真实状态和结果，不为 OPL 再造第二套编排 authority。 |
| `B0-12` | Scheduled tasks/Cron、后台继续与通知 | 长任务和周期任务需要离开前台后继续。 | 属 Codex 基线候选；未 fresh 验证的 carrier 不得宣称已实现。 |
| `B0-13` | Memory、personalization、instructions | 稳定偏好和项目指令决定长期易用性。 | 复用 owner-correct profile/refs，不新建独立 memory 平台。 |
| `B0-14` | 通用 Settings 容器、search/back/redirect、a11y、theme、i18n | 所有配置与长期使用能力需要一致容器。 | 容器行为属于 B0；OPL 栏目、owner route 与数据语义归 `R1-05`。 |

B0 保护的是 Codex 必要用户结果，不是把上游所有同名入口自动纳入 OPL。Skill/Plugin/MCP
的执行、权限与 elicitation 底座可复用 B0，但面向用户的管理 IA 归 `R1-04`；未经 App
profile 接受的任意上游 Skill/MCP 不构成功能回归。Local Git、Terminal、Browser 与显式选择的
本地 checkout 属 B0；SSH/HPC 可作为 Resources refs 接入，但托管远程 Workspace、资源调度和
跨主机 handoff 仍归 `X0-04/X0-05`。`B0-10` 也不授权 Shell 自建 managed Worktree/Handoff。

B0 不进入 OPL 自维护的 R1/U1 12 项实现矩阵。AionUI 已有的基线不为追求理论完整度重写；Native
候选最终必须自行补齐。当前 carrier 实现程度见
[`shell-conformance-matrix.md`](shell-conformance-matrix.md)，未 fresh 核对的能力一律
`source_not_assessed`。

### List 1：等价功能替换类（R1）

| ID | 功能 | Codex 对应 | OPL 定义 | 为什么必要 | 优先级 | 最小验收边界 |
| --- | --- | --- | --- | --- | --- | --- |
| `R1-01` | Gateway 身份 | OpenAI/ChatGPT 身份登录。 | 以 OPL Gateway 身份替换产品账号入口，同时兼容既有 Codex/API Key。 | OPL 必须能管理自己的智能体账号，又不能破坏用户已有 Codex 路径。 | `P1` | 登录、刷新、退出、脱敏身份和 secret boundary 由 Gateway owner 提供；失败不清除可用的兼容凭据。 |
| `R1-02` | 模型 entitlement 与用量 | OpenAI 模型访问资格和账户用量。 | 由 Gateway 投影模型访问、余额、Token、成本、managed key 与 freshness。 | 账号管理若看不到可用模型和消耗，就无法做真实选择。 | `P1` | 访问来源、余额、今日/累计 Token、实际成本、managed key 与 freshness 有 owner projection；UI 不推算。 |
| `R1-03` | OPL 首启 | Codex 登录和首次项目初始化。 | 首屏可用 Codex 核心，Gateway、Framework 与 package 环境渐进/JIT 准备。 | OPL 多了运行依赖，但首启不能成为长时间阻断页。 | `P2` | 可自修复项后台/JIT 处理；只有确认的身份、安全或核心执行器失败才局部 gate。 |
| `R1-04` | Agents/Capabilities IA | Codex Plugins/Skills 管理入口。 | Agents 管 Agent Packages；Capabilities 管 Skills、Plugins 与 Flow，底层可复用 carrier registry。 | 用户要按“智能体”和“能力”理解 OPL，而不是理解底层打包机制。 | `P1` | 两类入口、目录、状态和动作 owner 清晰；不得复制第二份 package/skill truth。 |
| `R1-05` | OPL Control Center | Codex Settings。 | 在同一 Settings 容器中按 App、Gateway、Framework、Packages 的唯一 owner routes 组织设置。 | 多个 authority 必须有统一可发现入口。 | `P2` | 每个设置项路由到唯一 owner state/action；Shell 不复制 runtime truth 或自造 mutation。 |
| `R1-06` | OPL 产品分发与支持 | Codex bundle、update、deep link、feedback/support。 | 使用 OPL bundle id、更新通道、`opl://`、反馈与 support 入口。 | 用户安装、唤起、更新和求助时必须看到同一个 OPL 产品身份。 | `P2` | 冷/热启动、更新、反馈/support 与 readback 闭环；源码、安装和 release 证据分开。 |

### List 2：OPL 独有功能类（U1）

| ID | 功能 | Codex 对应 | OPL 定义 | 为什么必要 | 优先级 | 最小验收边界 |
| --- | --- | --- | --- | --- | --- | --- |
| `U1-01` | Agent Package 目录与 lifecycle | 无直接对应；Codex 仅有通用 Plugins/Skills。 | 统一查看、安装、更新、启停、隐藏、卸载、修复和配置 OPL Agent Packages。 | OPL App 的核心定位是方便调用和管理自己的智能体账号/包。 | `P1` | 全部消费 Framework directory/actions/readback；Shell 不直接修改 package truth。 |
| `U1-02` | Purpose/Starter 与 active context | 无直接对应；最接近 Codex New task/prompt 入口。 | 从用户目标直接选择专业 Agent，并以低权重 active context 表达当前能力。 | 用户不应先配置技术组件才能调用专业 Agent。 | `P1` | Starter 可选择、active context 可见、管理入口可达，并绑定真实 package identity。 |
| `U1-03` | 弹性 Agent 启动与 JIT prepare | 无直接对应。 | 以 `ready / degraded / package_unavailable` 消费 owner-projected action，局部准备或降级继续。 | 既要防止错包执行，也不能因 stale/deferred/可选证据缺失动辄全局 block。 | `P1` | Workspace 仅按 action 需要；单包不可用不影响普通 Codex、其他 Agent、draft 或既有 session。 |
| `U1-04` | App / OPL Base / Packages 三对象 lifecycle | 无直接对应；Codex 只有自身 App 更新。 | 三对象分别安装、更新、修复、恢复并由各自 owner 给出终态 readback。 | 三类生命周期、重启和回滚 owner 不同，混成一个 updater 会产生假成功。 | `P2` | 三对象均可见，各走 owner route；有中断恢复和 terminal readback，不强求共用 mutation API。 |
| `U1-05` | Docker/WebUI 同产品语义 | 无直接对应。 | Desktop 与 Docker/WebUI 共享核心 route、状态、action、错误和 authority 语义。 | WebUI 是 OPL 的部署与远程使用入口，不能成为另一个产品。 | `P2` | 核心语义一致；transport 和 Desktop-only 安全能力可明确不同。 |
| `U1-06` | OPL 数据与安全清理 | 无直接对应。 | 对 Agent packages、runtime、本地缓存和 WebUI volume 提供 owner inventory 与受管清理。 | 长期使用会持续增长数据，普通用户需要可预览、可确认、可恢复的清理。 | `P2` | 独立 inventory、owner dry-run、managed path/hash guard、确认、receipt；不得泛化删除 workspace 或 domain artifact。 |

R1 与 U1 的当前实现程度按 carrier 分开维护在
[`shell-conformance-matrix.md#r1--u1-必要功能实现矩阵`](shell-conformance-matrix.md#r1--u1-必要功能实现矩阵)。
`implemented / partial / missing` 只描述 source；pixel、install 和 release 是独立证据轴。

### X0 条件保留 / 当前非目标

| ID | 条件能力 | 当前处理 |
| --- | --- | --- |
| `X0-01` | 全局跨项目 Runtime cockpit / Work Item 总览 | AionUI 已有 route 可维护，Native 可延后；不阻断 B0/R1/U1。 |
| `X0-02` | 完整 Evidence/Provenance/receipt/route-ref 平台 | 只保留 owner-required refs、confirmation 与 receipt；完整 cockpit 条件推进。 |
| `X0-03` | Hosted Workspace / cloud-continuous execution | 等稳定后端、账户和计费 owner 出现后再启用，不用占位 UI 宣称可用。 |
| `X0-04` | Fabric/HPC/远程资源控制面 | Settings 最多提供连接 refs/owner route；完整调度归 domain/runtime 产品。 |
| `X0-05` | 跨主机 handoff、carrier 自建 managed remote Worktree 或第二协调面 | 当前明确不自造；只有稳定 upstream 能力与真实需求同时成立才重评。 |
| `X0-06` | Raw runtime/operator diagnostics 与完整 repair cockpit | 仅留 Settings > Advanced 和 release tooling，ordinary UI 不展示 raw protocol。 |

本文的“现有功能不降级”只保护已经进入 OPL App contracts、ordinary routes 或正式用户路径的
能力。AionUI 上游自带但未被 OPL App 采纳的 Team、provider/backend、任意 skills/MCP、
Sites/Chat 等入口可以隐藏或拒绝；它们不构成 OPL 功能回归。

## 产品框架

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| Session-first workspace-aware App frame | Session/thread 是主单位；project/workspace/directory 只提供新 session 初始 cwd 和只读 recorded workspace rail 分组，不拥有 session、context 或 artifact，也不构成授权域。命令或 turn 的实际 `pwd` 变化不反写该记录。 | GUI contract、product profile、Codex permission/approval/sandbox。 |
| Directory/conversation navigation | 宽桌面 rail 默认展开，窄窗口变 drawer；App Server overview 可用时是 Codex session directory authority，未返回的 stale Codex ACP cache rows 不进入 ordinary rail，overview unavailable 才 fallback cache，非 Codex local rows 保留。每个 canonical thread ID 最多一行，不按标题/workspace 去重；目录组不提供组级删除或 session 级联删除。 | GUI contract、page-state matrix、runtime bridge。 |
| Chat-first main canvas | 打开 App 后可以直接开始或继续工作，不先经过 dashboard/landing；Home root、composer shell、footer account/Settings entry 各只有一个实例。 | GUI contract、page-state matrix。 |
| Workspace-optional conversation | 不建立 workspace 也能使用 attachment、任意本地文件/目录选择、paste/drop 与 `/open`；workspace readiness 不 gate 这些输入，真实访问只受 Codex permission/approval/sandbox 约束。 | GUI contract、conversation state/bridge。 |
| Secondary context surfaces | 右上 Environment floating details 汇总当前 workspace/git/subagents/sources；artifact/evidence preview 与 advanced tools 按需展开。 | GUI contract、runtime bridge、domain/runtime refs。 |
| Product identity | 所有可见产品面使用 One Person Lab App 品牌，而不是 carrier/upstream 品牌。 | GUI contract、release assets、shell branding validation。 |
| Global issue feedback | 标题栏右侧可随时打开预填页面与版本信息的 OPL App GitHub Issue；用户在外部浏览器确认并提交。 | GUI contract、product profile、active shell adapter。 |

## Home 与 Conversation

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| New conversation | 在所选目录初始化 cwd，或不选 workspace 直接开始 Codex session；目录只提供初始 cwd 与分组，不拥有 session。 | GUI contract、conversation page state、Codex bridge。 |
| Resume conversation | 按 canonical thread ID 找回 recent conversation，保留 transcript/turn history/title/task state 和 recorded workspace 展示。 | Conversation state/bridge；shell 只持有实现所需 session refs。 |
| Conversation management | Search、pin、rename、archive、reset conversation，并在独立 Archived surface 管理归档。 | GUI contract、conversation state/bridge。 |
| User-triggered thread operations | 从现有 conversation directory/actions 读取、创建、恢复、fork、归档或恢复归档线程；普通对话继续走 AionUI ACP，不增加独立 coordination 页面或模型工具。 | 一个 Codex App Server adapter；Shell 只持有 UI metadata 与可重建 cache。 |
| Session working directory | Composer 统一 `+` 菜单只设置新任务初始 cwd；未选时无占位行，选中后显示可移除 chip。Conversation Environment 只读显示 recorded workspace 和可用的 live Git context。既有 session 不提供 cwd 重绑、Local/Worktree 切换或 managed Worktree。 | Codex Core/App Server；workspace 只是初始 cwd、展示与分组 metadata。 |
| Text instruction | 向固定 Codex executor 发送多行任务说明。 | Product profile、ordinary conversation contract。 |
| Streaming assistant output | 持续看到 assistant response，不需要查看 raw protocol。 | Codex/App bridge 与 conversation page state。 |
| Pending/running feedback | 看到当前 turn 正在处理、elapsed time、stop 和失败状态。 | Page-state matrix、bridge events。 |
| Tool/process event summary | 在当前 turn 中理解 command、tool、diff、file、permission 和 receipt 发生了什么。 | Codex/App bridge；raw details 保持 diagnostics。 |
| File/folder attachment | 无论是否选择 project，发送前都可加入任意用户显式选择的本地文件/目录，并可预览或移除。 | File platform adapter 与 Codex permission/approval/sandbox。 |
| Explicit session inputs | 仅通过当前 composer 的 attachment、file/directory picker、paste/drop 或 `/open` 显式加入当前 send；不从 workspace 预载、不按目录持久化、不隐式注入。 | App GUI contract、Codex permission/approval/sandbox。 |
| Current execution context | Working directory 在 rail，branch/locality 在 Environment；文件、文件夹、新会话 cwd、allowlisted Skill 与真实可用连接从 composer `+` 菜单选择并以紧凑 chip 展示。缺 workspace 或 workspace readiness 未完成都不禁用普通本地对话与显式文件输入。 | GUI contract、workspace/App state refs。 |
| Model/reasoning control | Home 与普通 conversation 共用一个紧凑 App-owned model/reasoning menu。 | `contracts/app-product-profile.json`；文档不复制 allowlist。 |
| Permission/access mode | 在 Home 与 conversation composer 以自动化和文件权限的用户语言显示，保留安全透明度但不暴露 provider/backend。 | GUI contract、workspace/access policy。 |
| Purpose selection | 从 Home starter 选择当前启用的工作目的；默认显示科研、基金、演示和元智能体，写书保留为可开启入口。Home 只用 starter 选中态表达 active capability，不在 composer 重复标签；conversation 可显示低权重 chip。Package 安装、Home 显示、顺序和 lifecycle 管理进入 Settings → Agents，Skills/Plugins/Flow 管理进入 Settings → Capabilities。 | Product profile、GUI contract、route receipt policy。 |
| Assistant-scoped capabilities | 只显示当前 package/purpose 允许的 required/optional skills。 | App packaged skill profiles 与 ordinary capability policy。 |
| Package launch readiness | 所有可见 starter 始终可选择；发送时按 owner projection 进入 `ready / degraded / package_unavailable`。优先 JIT prepare、自修复或安全 fallback；只有明确身份/版本/入口/安全目标/权限失败时局部阻止所选 Agent。 | Agent package activation policy、Framework state/action projection。 |
| User-input and permission prompt | 当前 conversation 需要 command/file/permission approval、补充信息或 MCP elicitation 时，沿用 AionUI ACP 的现有可见流程；拒绝、取消或协议错误保持真实失败。 | AionUI ACP 与 Codex permission/request flow。 |
| Turn receipt | 用户可查看本轮 route、action、result 和恢复 refs，不默认暴露 raw JSON。 | App/domain/runtime receipt refs；GUI 不拥有 receipt authority。 |

## OPL Purpose 与 Agent Packages

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| Research shortcut | 从普通入口开始科研和论文相关工作。 | Product profile/package registry；domain owner 为 MAS。 |
| Grant shortcut | 从普通入口开始基金工作。 | Product profile/package registry；domain owner 为 MAG。 |
| Presentation shortcut | 从普通入口开始演示、汇报和视觉交付工作。 | Product profile/package registry；domain owner 为 RCA。 |
| Book shortcut | 从普通入口开始书稿工作。 | Product profile/package registry；domain owner 为 BookForge。 |
| Optional package shortcuts | 用户可按安装状态和个人选择显示其它 compliant packages。 | Agent package registry、App shortcut preference。 |
| Package directory | 查看已安装 package、exposure、状态轴、来源和推荐动作。 | `app_state.agent_packages`、App action catalog。 |
| Package lifecycle actions | 通过统一 preview/confirm/receipt flow 安装、更新、修复、隐藏、禁用或卸载。 | App state/action；shell 不直接修改 package/runtime truth。 |
| Package use-boundary activation | 只在所选 directory entry 投影 activation action 或需要 degraded JIT prepare 时消费该 exact action；`required_payload_fields` 决定是否需要 Workspace。receipt、binding 和 closure 是可审计结果或 diagnostics，不是普通启动必须齐备的硬门槛。 | Framework package lifecycle owner；App 只消费 projected action、最小身份/版本/入口/安全目标 readback 并隔离单包失败。 |

Purpose shortcut 只改变 route context 和 capability profile，不定义 domain workflow、
artifact schema、quality verdict 或 readiness。普通用户标签描述工作目的；package id、
short name 和 technical refs 进入 details/receipt。

## Runtime、Progress 与 Evidence

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| Runtime overview | 看到任务/项目主状态、阶段、进度、下一步和责任方。 | `opl app state --profile fast --json` 的 App projection。 |
| Scope switching | 在全局、workspace 或选中任务范围查看状态。 | App runtime view model。 |
| Active/queued/attention separation | 区分真实 running、仍在推进的 project line、排队和需要关注。 | Framework-owned projection；UI 保留原始 status。 |
| Pinnable current-task summary | 长任务与 OPL current-task projection 共用 status、elapsed、progress、next action、stop summary bar，并允许 pin。 | Current task slice / bridge refs。 |
| Current-turn run artifact | 在 conversation 内查看本轮最近事件和恢复动作。 | Current task slice / bridge refs。 |
| Task/project drilldown | 按需查看 evidence、blocker、owner、resource 和 next-action refs。 | Runtime bridge / domain-owned refs。 |
| Safe action | 对允许的运行或维护动作先 preview，再 confirm/execute。 | `opl app action execute ... --json`。 |
| Files and artifact refs | 从 conversation、Environment details 或 preview 打开输入、输出和交付引用。 | Workspace/domain artifact refs；App 不拥有 artifact body。 |
| Artifact preview adapter | 用户显式打开时，当前 session attachment、可见 conversation result 或合法任意绝对本地路径进入现有 Preview。Traversal、非法 scheme、隐式 workspace ref、自动静默读取及 unsafe/unsupported ref fail closed。 | App GUI contract定义 ref policy；外部 owner 继续拥有 artifact body。 |
| Review pane | 复用 Files/Changes diff surface；target 支持 uncommitted/base branch/commit/custom，交付支持 inline/detached，默认 Unstaged 并有 Staged/Commit/Branch/Last turn；Last turn 读取最近用户回合之后已完成的 workspace edits。Custom instructions 只通过 `review/start.target.custom` 发送；公开 App Server 尚无非 custom `Review Focus` input，因此该输入不展示并在调用边界返回 `protocol_unavailable`，不得回退到 `turn/steer`、创建 Review、写成功 audit 或产生其它副作用。PR context 依赖 `gh`，缺失时明确 unavailable。行级评论只有在 Codex App Server 提供 typed file/line request与失败语义后才可提交。 | 既有 message store、Codex `review/start` 与 Git integration；Shell 不复制 Git store，也不建立本地 annotation store。 |
| Provenance and receipts | 查看来源、owner handoff、action result 和 lineage refs。 | Domain/runtime/release owner refs。 |

Home 不承担跨项目 Runtime、continue-work、needs-attention、activity grid 或 evidence
dashboard；这些能力进入 Runtime 或按需 context surface。

## Settings / OPL Control Center

Settings 功能按用户问题组织，具体 ordinary/secondary route、label 和 registry 由
GUI contract 与 Settings Control Plane 拥有。

| 功能组 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| Overview | 判断 App 当前是否可用，以及最重要的下一步。 | Settings Control Plane、fast App state。 |
| Account & Access | 登录 OPL Gateway 或配置手工 API Key；账户连接时查看脱敏身份、余额、Token/实际成本、专用 Key 状态和数据新鲜度。 | Framework Gateway account projection/secret bridge；密码不进入 App state 或 generic action。 |
| Models | 查看模型访问来源、默认模型、推理偏好与 Codex CLI 版本，不复制 Gateway 账户和凭据控制。 | Framework model access projection、App model/reasoning preference。 |
| Workspace | 查看、切换、验证工作目录，配置 App 日志目录、用户 AGENTS.md 与 new-conversation additions。 | Workspace state/action、App host configuration。 |
| Agents | 管理可运行 Agent packages、依赖就绪、Home shortcuts 与 launch/lifecycle。 | Agent package state/action 与 product profile。 |
| Capabilities | 分组管理 OPL Flow dependency closure 内的推荐 Skill/Plugin，以及手工或第三方 Skill/Plugin；Flow 不拥有第二套 updater。 | Settings control plane、OPL Packages closure 与 Codex/shell registries。 |
| Resources & Connections | 查看本机、远程、托管资源与外部连接 refs；内置 OPL Gateway 不在这里重复。 | Framework/Connect/Fabric/Console refs；App 只展示。 |
| Maintenance & Updates | 查看 App、runtime、packages、Codex Surface 和本机服务维护动作。 | Managed update/status/action contracts。 |
| Data & Storage | 查看空间、数据分类、preview 和安全 cleanup action。 | App-owned storage lifecycle state/action。 |
| Preferences | 配置语言、主题、通知、启动、密度、字体和 motion。 | App settings/profile；不承载 runtime diagnostics。 |
| Maintenance diagnostics / About | 在 Maintenance 按需查看 raw Framework refs 与日志；About 查看版本、链接和 update summary。 | Maintenance owner surface、About secondary route、release/settings contracts。 |

Legacy/upstream routes 只作为 compatibility redirects，不构成功能目录中的新 ordinary
页面。Settings 详细设计见
[`settings-control-center.md`](settings-control-center.md)。

## First-run 与安装

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| Core readiness check | 知道 workspace、Codex CLI 和模型访问是否足以进入 App。 | First-run contracts/page-state。 |
| Guided blocker resolution | 看到当前 blocker、下一步和可执行配置/修复动作。 | App state/action；技术命令按需展开。 |
| Initialization progress | 看到阶段、elapsed time、完成/失败和恢复路径。 | OPL initialization event/readback。 |
| Background maintenance | 进入 App 后继续处理 Full readiness 和非阻塞维护。 | Framework/managed update refs。 |
| Release/update separation | 区分普通 updater、Full first-install 和 candidate package。 | App release/install contracts。 |

## Delivery Surface

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| macOS desktop | 使用 native window、directory picker、notifications 和 packaged App。 | Active/candidate adapter、release packaging。 |
| WebUI | 在受控 workspace/volume 中使用同一产品语义。 | App product profile、bridge contract、Web delivery adapter。 |
| Shared semantics | Desktop/WebUI 使用相同功能、状态、action 和 authority boundary。 | App contracts；transport 可以不同。 |
| Responsive context | 窄窗口仍能打开 rail drawer、Environment/details drawer 和 Settings navigation。 | Ideal interaction/visual system、shell visual evidence。 |
| Desktop affordances | Back/Forward、Previous/Next Task、New Window 在 desktop 可达，不改变 WebUI 产品语义。 | GUI contract、desktop shell adapter。 |
| Advanced work surfaces | Bottom panel、file tree、Terminal、Browser 保留给需要的工作流，但启动默认关闭。 | GUI contract、shell adapter/source evidence。 |

## 双语、可访问性与状态

- 普通 UI 支持简体中文和英文，同屏保持单一语言。
- 所有主要流程可 keyboard-only 完成，并提供 visible focus、accessible names、
  contrast 和 reduced-motion support。
- Interactive controls 定义 default、hover、focus、selected、disabled、loading、
  success、warning、error 和 empty/unavailable states。
- Disabled、failed、blocked 和 stale 必须给出可理解原因和下一步，不能只显示 raw id。
- Shell 可以使用不同组件库，但必须保持相同用户结果和 authority boundary。

## 功能层 Non-goals

- 不定义 AionUI、native workbench、Hermes 或 AGUI 的组件/目录结构。
- 不记录 candidate/release 完成度、截图 proof、commit 或 run id。
- 不复制模型 allowlist、Settings route registry、action catalog 或 page-state payload。
- 不把 runtime、domain、artifact、memory、owner receipt 或 release truth 移入 App GUI。
- 不把同一 agent tree 的 `spawn_agent/send_input/wait_agent` 扩展成跨顶层线程消息总线，也不在 Shell 建第二套 thread store、权限模型或 Codex JSONL parser。
- 不把普通 Home 变成 dashboard、multi-agent launcher、provider marketplace 或
  protocol monitor。
