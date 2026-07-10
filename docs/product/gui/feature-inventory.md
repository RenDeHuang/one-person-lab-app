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

## 产品框架

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| Workspace-aware App frame | 用户始终知道当前工作目录和 conversation context。 | GUI contract、product profile、workspace state/action refs。 |
| Project/conversation navigation | 用户可按 workspace/project 新建、恢复、切换和重置 conversation。 | GUI contract、page-state matrix；具体呈现由理想交互层定义。 |
| Chat-first main canvas | 打开 App 后可以直接开始或继续工作，不先经过 dashboard/landing。 | GUI contract、page-state matrix。 |
| Secondary context surfaces | Files、Runtime、artifacts、Capabilities、Memory、Automations 和 Settings 可按需查看。 | GUI contract、runtime bridge、domain/runtime refs。 |
| Product identity | 所有可见产品面使用 One Person Lab App 品牌，而不是 carrier/upstream 品牌。 | GUI contract、release assets、shell branding validation。 |

## Home 与 Conversation

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| New conversation | 在已选 workspace 中开始新的 Codex thread。 | GUI contract、conversation page state、Codex bridge。 |
| Resume conversation | 找回 recent conversation，并保留关联 workspace。 | Conversation state/bridge；shell 只持有实现所需 session refs。 |
| Text instruction | 向固定 Codex executor 发送多行任务说明。 | Product profile、ordinary conversation contract。 |
| Streaming assistant output | 持续看到 assistant response，不需要查看 raw protocol。 | Codex/App bridge 与 conversation page state。 |
| Pending/running feedback | 看到当前 turn 正在处理、elapsed time、stop 和失败状态。 | Page-state matrix、bridge events。 |
| Tool/process event summary | 在当前 turn 中理解 command、tool、diff、file、permission 和 receipt 发生了什么。 | Codex/App bridge；raw details 保持 diagnostics。 |
| File/folder attachment | 发送前加入本地材料，并可预览或移除。 | Workspace/file platform adapter 与 App workspace policy。 |
| Workspace selection | 发送前选择或确认任务执行目录。 | App workspace state/action。 |
| Model/reasoning control | 在 Home 与普通 conversation 使用同一 App-owned 模型控制。 | `contracts/app-product-profile.json`；文档不复制 allowlist。 |
| Purpose selection | 在不切换 executor/backend 的情况下选择科研、基金、演示、写书等工作目的。 | Product profile、GUI contract、route receipt policy。 |
| Assistant-scoped capabilities | 只显示当前 package/purpose 允许的 required/optional skills。 | App packaged skill profiles 与 ordinary capability policy。 |
| User-input and permission prompt | Codex 需要选择、补充信息或授权时，在 conversation 中完成。 | Bridge event/action contract。 |
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

Purpose shortcut 只改变 route context 和 capability profile，不定义 domain workflow、
artifact schema、quality verdict 或 readiness。普通用户标签描述工作目的；package id、
short name 和 technical refs 进入 details/receipt。

## Runtime、Progress 与 Evidence

| 功能 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| Runtime overview | 看到任务/项目主状态、阶段、进度、下一步和责任方。 | `opl app state --profile fast --json` 的 App projection。 |
| Scope switching | 在全局、workspace 或选中任务范围查看状态。 | App runtime view model。 |
| Active/queued/attention separation | 区分真实 running、仍在推进的 project line、排队和需要关注。 | Framework-owned projection；UI 保留原始 status。 |
| Current-turn run artifact | 在 conversation 内查看本轮最近事件和恢复动作。 | Current task slice / bridge refs。 |
| Task/project drilldown | 按需查看 evidence、blocker、owner、resource 和 next-action refs。 | Runtime bridge / domain-owned refs。 |
| Safe action | 对允许的运行或维护动作先 preview，再 confirm/execute。 | `opl app action execute ... --json`。 |
| Files and artifact refs | 从 conversation 或 inspector 打开输入、输出和交付引用。 | Workspace/domain artifact refs；App 不拥有 artifact body。 |
| Provenance and receipts | 查看来源、owner handoff、action result 和 lineage refs。 | Domain/runtime/release owner refs。 |

Home 不承担跨项目 Runtime、continue-work、needs-attention、activity grid 或 evidence
dashboard；这些能力进入 Runtime 或按需 context surface。

## Settings / OPL Control Center

Settings 功能按用户问题组织，具体 ordinary/secondary route、label 和 registry 由
GUI contract 与 Settings Control Plane 拥有。

| 功能组 | 用户结果 | Authority / machine owner |
| --- | --- | --- |
| Overview | 判断 App 当前是否可用，以及最重要的下一步。 | Settings Control Plane、fast App state。 |
| Access | 配置或检查模型访问、Codex CLI 和远程访问。 | App state/action、access contracts。 |
| Workspace | 查看、切换、验证工作目录和权限。 | Workspace state/action。 |
| Capabilities | 管理 packages、Home shortcuts 和 capability exposure。 | Agent package state/action 与 product profile。 |
| Resources & Connections | 查看本机、远程、托管资源与连接 refs。 | Framework/Gateway/Fabric/Console refs；App 只展示。 |
| Maintenance & Updates | 查看 App、runtime、packages、Codex Surface 和本机服务维护动作。 | Managed update/status/action contracts。 |
| Data & Storage | 查看空间、数据分类、preview 和安全 cleanup action。 | App-owned storage lifecycle state/action。 |
| Preferences | 配置语言、主题、通知、启动、密度、字体和 motion。 | App settings/profile；不承载 runtime diagnostics。 |
| Advanced / About / Update details | 按需查看 raw refs、logs、版本、链接和 release/update details。 | Secondary routes、release/settings contracts。 |

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
| Responsive context | 窄窗口仍能打开 rail、inspector、popover 和 Settings navigation。 | Ideal interaction/visual system、shell visual evidence。 |

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
- 不把普通 Home 变成 dashboard、multi-agent launcher、provider marketplace 或
  protocol monitor。
