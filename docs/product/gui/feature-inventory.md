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

本文的“现有功能不降级”只保护已经进入 OPL App contracts、ordinary routes 或正式用户路径的
能力。AionUI 上游自带但未被 OPL App 采纳的 Team、provider/backend、任意 skills/MCP、
Sites/Chat 等入口可以隐藏或拒绝；它们不构成 OPL 功能回归。

## 产品框架

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| Session-first workspace-aware App frame | Session/thread 是主单位；project/workspace/directory 只提供新 session 初始 cwd、可变 cwd 和 rail 分组，不拥有 session、context 或 artifact，也不构成授权域。 | GUI contract、product profile、Codex permission/approval/sandbox。 |
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
| Resume conversation | 按 canonical thread ID 找回 recent conversation，保留 transcript/turn history/title/task state；cwd 与 rail 分组可在同一 session 上更新。 | Conversation state/bridge；shell 只持有实现所需 session refs。 |
| Conversation management | Search、pin、rename、archive、reset conversation，并在独立 Archived surface 管理归档。 | GUI contract、conversation state/bridge。 |
| User-triggered thread operations | 从现有 conversation directory/actions 读取、创建、恢复、fork、归档或恢复归档线程；普通对话继续走 AionUI ACP，不增加独立 coordination 页面或模型工具。 | 一个 Codex App Server adapter；Shell 只持有 UI metadata 与可重建 cache。 |
| Session working directory / Local / Worktree | Home 新任务可选任意 Local 目录或 managed Worktree 与 starting branch。既有空闲 canonical session 可原位切换目录并保持同一 thread/history；Worktree只做简单create/reuse并默认保留。 | Codex Core/App Server 与既有 Git integration；workspace 只是可变 cwd/projection/grouping metadata。 |
| Text instruction | 向固定 Codex executor 发送多行任务说明。 | Product profile、ordinary conversation contract。 |
| Streaming assistant output | 持续看到 assistant response，不需要查看 raw protocol。 | Codex/App bridge 与 conversation page state。 |
| Pending/running feedback | 看到当前 turn 正在处理、elapsed time、stop 和失败状态。 | Page-state matrix、bridge events。 |
| Tool/process event summary | 在当前 turn 中理解 command、tool、diff、file、permission 和 receipt 发生了什么。 | Codex/App bridge；raw details 保持 diagnostics。 |
| File/folder attachment | 无论是否选择 project，发送前都可加入任意用户显式选择的本地文件/目录，并可预览或移除。 | File platform adapter 与 Codex permission/approval/sandbox。 |
| Explicit session inputs | 仅通过当前 composer 的 attachment、file/directory picker、paste/drop 或 `/open` 显式加入当前 send；不从 workspace 预载、不按目录持久化、不隐式注入。 | App GUI contract、Codex permission/approval/sandbox。 |
| Current execution context | Working directory 在 rail、branch/locality 在 Environment、active capability 与 attachment 在 composer 附近；缺 workspace 或 workspace readiness 未完成都不禁用普通本地对话与显式文件输入。 | GUI contract、workspace/App state refs。 |
| Model/reasoning control | Home 与普通 conversation 共用一个紧凑 App-owned model/reasoning menu。 | `contracts/app-product-profile.json`；文档不复制 allowlist。 |
| Permission/access mode | 在 Home 与 conversation composer 以自动化和文件权限的用户语言显示，保留安全透明度但不暴露 provider/backend。 | GUI contract、workspace/access policy。 |
| Purpose selection | 从 Home starter 选择当前启用的工作目的；默认显示科研、基金、演示和元智能体，写书保留为可开启入口。composer 只保留 active capability chip；Package 安装、Home 显示、顺序和 lifecycle 管理进入 Settings → Agents，Skills/Plugins/Flow 管理进入 Settings → Capabilities。 | Product profile、GUI contract、route receipt policy。 |
| Assistant-scoped capabilities | 只显示当前 package/purpose 允许的 required/optional skills。 | App packaged skill profiles 与 ordinary capability policy。 |
| Package launch readiness | 不可用 starter 保持可识别但 disabled，显示用户可理解的原因和允许动作；发送或启动前必须通过 Framework-owned use-boundary activation，失败时 fail closed。 | Agent package activation policy、Framework state/action receipt。 |
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
| Package use-boundary activation | 每次已安装 package 的 workspace/quest launch 前请求 Framework reconcile compatible closure，并只在 `launch_allowed` 与 use receipt/binding 完整时进入 Codex conversation。 | Framework package lifecycle owner；App 只 prepare、投影 readback 并 launch。 |

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
| Account & Gateway | 登录 OPL Gateway 或配置手工 API Key；账户连接时查看脱敏身份、余额、Token/实际成本、专用 Key 状态和数据新鲜度。 | Framework Gateway account projection/secret bridge；密码不进入 App state 或 generic action。 |
| Models | 查看模型访问来源、默认模型、推理偏好与 Codex CLI 版本，不复制 Gateway 账户和凭据控制。 | Framework model access projection、App model/reasoning preference。 |
| Workspace & Personalization | 查看、切换、验证工作目录，配置 App 日志目录、用户 AGENTS.md 与 OPL App context。 | Workspace state/action、App host configuration。 |
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
