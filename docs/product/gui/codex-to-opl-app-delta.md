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

1. OPL App 从当前 Codex desktop interaction baseline 继承什么？
2. 为服务 OPL 工作，增加、隐藏或改名什么？

功能全集见 [`feature-inventory.md`](feature-inventory.md)，完整交互见
[`ideal-interaction-spec.md`](ideal-interaction-spec.md)，视觉细则见
[`visual-system.md`](visual-system.md)。本文不描述具体 shell 实现或候选路线。

## Codex Baseline

当前 baseline 固定为 **ChatGPT Codex macOS 26.707.31428 (2026-07-10)**；同日 build
`26.707.31123` 只保留为 superseded observation。
OPL App 继承其工作模型，而不复制源码、品牌资产、账户权限或产品 authority：

- 宽桌面默认展开、可调宽度的 project/conversation rail；窄窗口使用 drawer。
- Rail 顶部 New task、Archived、Capabilities，底部 account/help/Settings。
- 单一 conversation timeline。
- 动态问题标题、最多四个轻量 starter 的 Home，而非 landing/dashboard。
- Project task 与 projectless conversation；无 workspace 时文字聊天可用、文件能力受限。
- 带 project/local/branch context strip、textarea、bottom action row 的浮动/安全距 composer。
- 单一紧凑 model/reasoning menu、可选 voice、send/stop 和可见 permission/access mode。
- 可 pin current-task summary bar，含 status/elapsed/progress/next action/stop。
- Environment popover 与默认关闭、可调 split 的 side panel 分离。
- Side panel 核心工具为 Review/Terminal/Browser/Files；其它 OPL surfaces 次级展开。
- Settings 是有 return/search/grouped rows 的 full-window surface。
- Workspace-first、keyboard-centric、summary-first 的连续工作体验。

这组 baseline 定义 composition 和 interaction quality，不定义 OPL runtime、domain、
package、Settings IA、release 或 evidence truth。

## 增量摘要

| Baseline area | OPL 增量 | Authority owner |
| --- | --- | --- |
| Product identity | 使用 One Person Lab App 名称、icon、窗口与 release identity。 | App GUI/release contracts 与 assets。 |
| Workspace/chat | 支持 project task 与 projectless conversation，并增加 OPL purpose、package 和 refs context。 | App product profile、GUI contract。 |
| Model control | 保持 Codex-like model/reasoning control，但策略只由 App product profile 提供。 | `contracts/app-product-profile.json`。 |
| Capabilities | 把普通 agent/tool 入口收敛为 installed OPL Agent Packages 与 assistant-scoped skills。 | App package registry/profile。 |
| Runtime context | 增加 Framework-backed current-task summary、progress、blocker、owner、receipt 与 safe action refs。 | Framework state/action 与 domain refs。 |
| Settings | 采用 Codex full-window shell，同时保留 OPL Control Center IA。 | App GUI contract、Settings Control Plane。 |
| First-run | 增加 Core readiness、guided setup 和 background maintenance。 | App first-run/install contracts。 |
| Delivery | 增加 desktop/WebUI/Workspace 的同产品语义与受控资源入口。 | App adapters、Framework/Gateway/Fabric refs。 |
| Evidence | 增加 route/action/release/visual evidence 边界。 | App/domain/runtime/release owner surfaces。 |

## OPL 品牌增量

- Visible product name、App icon、window title、About、manifest 和 release assets 使用
  One Person Lab App。
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
composer 常驻 selector 移出，只能从 Home starter 或 Capabilities 选择；composer/context
strip 只显示 active capability chip：

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

## Capability 增量

- Settings 提供 installed Agent Package directory、Home exposure 和 lifecycle actions。
- Required/optional skills 来自 App packaged profile，不来自 shell-local discovery dump。
- Ordinary Home/conversation 只显示当前 purpose/package allowlist 接受的 capabilities。
- Helper skills、unknown MCP、provider marketplace 和 implementation plugins 不自动进入
  ordinary UI。
- Install/update/repair/hide/disable/uninstall 通过 App state/action、preview、confirmation
  和 receipt 完成。
- GUI 展示 package status 与 refs，不拥有 package execution、runtime 或 domain truth。

## Runtime 与 Evidence 增量

普通 Codex timeline 主要关心当前 turn；OPL App 额外提供跨项目 runtime context：

- Runtime overview 展示真实 running、仍在推进的 project lines、queued 和 attention。
- Current-turn artifact 与 OPL current-task projection 共用可 pin summary bar，展示
  status、elapsed、progress、next action、stop。
- Environment popover 汇总 workspace/local/git/subtasks/sources。
- Side panel 以 Review、Terminal、Browser、Files 为核心工具；Artifacts、Runtime、
  Actions、Memory 通过 secondary sections/disclosures 扩展。
- Mutation 统一走 App action route，并保留 dry-run、confirmation 与 receipt。
- Progress 区分 deliverable progress、platform repair、human gate 和 typed blocker。
- UI 不从 active id、module dirt、provider completion、docs 或 test pass 推断 domain、
  production、artifact 或 release readiness。

Route receipt、action receipt、artifact ref、owner handoff 和 release evidence 必须使用
用户能理解的 summary；raw id、JSON、path 和 protocol detail 按需展开。

## Settings Control Center 增量

OPL App 把通用 Agent App settings 收敛为用户任务导向的 Control Center：

- Shell 采用 Codex full-window return/search/grouped-row 结构；OPL IA 不变。

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
- 默认打开的 side panel、bottom panel、file tree、Terminal 或 Browser；
- Home activity dashboard、continue-work grid 或 full evidence ledger；
- 未经 App allowlist 接受的 skills/MCP/tools；
- 由 module dirt、cache 或 local UI state 推断的 readiness。

这些内容若仍有诊断价值，应进入 Advanced/details，不成为 ordinary product concept。

## Non-goals

- 重建或复制 Codex App。
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
- 从 Home/Capabilities 选择 OPL purpose/package，composer 只显示 active capability chip；
- 使用 App-profile model/reasoning control，并动态呈现当前默认值；
- 以用户语言查看 permission/access mode，而不是 provider/backend；
- 在 turn 中理解进度、prompt、error、result 和 receipt；
- 只在需要时打开 environment popover、side panel 或 advanced work surfaces；
- 理解 first-run、maintenance、resource 和 release 边界；
- 不把任何 GUI projection 误读为 runtime/domain/artifact/release authority。
