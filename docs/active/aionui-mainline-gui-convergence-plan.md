# AionUI 主线 GUI 薄壳收敛方案

Owner: `one-person-lab-app`
Purpose: `aionui_mainline_gui_convergence_support`
State: `active_currentness_refresh`
Machine boundary: 本文只组织 AionUI 主线薄壳的实施与验收边界。产品真相归 App
contracts，当前实现归 Shell source/tests，pixel/install/release 结论归 exact-cohort
evidence 与 owner readback；本文不创建第二套 authority。
Updated: `2026-07-17`

本文只记录 AionUI active shell 的薄壳执行边界和终态验收。产品行为归 App machine
contract，Shell 只负责实现；本文不复制第二套 machine authority，也不把 source、focused tests
或历史截图解释为 release-ready。

## 结论

OPL App 是 AionUI 上的可信本机薄壳，目标是在不长期维护上游私有 fork 的前提下，尽可能
1:1 对齐 Codex App 的桌面交互和视觉。当前产品模型固定为：

1. session/thread 是唯一会话身份；
2. project/directory 只是新会话初始 cwd、recorded 分组和新会话快捷入口，不拥有会话或上下文；
3. workspace 只记录新任务初始 cwd 与只读分组；命令或 turn 的实际 `pwd` 不持久反写 session；
4. OPL Agent Package 是受管的官方插件，提供更强安装和状态管理，但不改变 Codex 的会话模型；
5. AionUI 基础 ACP 和一个 Codex App Server adapter 承载普通会话与用户触发的线程操作；
6. App 定义产品和验收，Shell 不建立第二状态源，AionCore 保持 no-write。

功能来源与实现优先级不混用：`B0 / R1 / U1 / X0` 及两张必要功能 List 只在
[`../product/gui/feature-inventory.md`](../product/gui/feature-inventory.md) 定义；AionUI/Native
当前 source、pixel、install、release 状态只在
[`../product/gui/shell-conformance-matrix.md`](../product/gui/shell-conformance-matrix.md) 维护。

因此项目下不显示“上下文 / 添加上下文”，也不把会话描述成归属于某个项目。Workspace selector
只设置新 session 初始 cwd；既有 session 不提供目录重绑。

## 当前产品与维护边界

| Surface | 当前目标 | 不进入 active shell boundary |
| --- | --- | --- |
| ACP 与会话 | 普通 create/send/stop/resume、模型与权限、slash command、warmup | OPL 私有 ACP 扩展、AionCore deep host gate |
| Thread 操作 | 一个 App Server adapter；用户触发 list/read/start/resume/fork/archive 和必要 turn 操作 | 第二 JSON-RPC client、独立 coordination 页面、model delivery |
| Codex subagents | 复用 Codex delegated execution 与现有 App Server adapter；先用真实 fixture 证明 read-only Active/Done、completed detail/result、open thread 与 owner-supported control 缺口 | AionUI Team、第二 App Server client、Team store/scheduler、Shell 自有执行 authority、bespoke direct-control buttons |
| X0 retained routes | Runtime cockpit 可作为条件 owner route 保留；Hosted Workspace/Fabric/HPC/Console 只在真实 owner/backend 存在时给 refs | 把 Runtime 当 P0/default release gate/Native phase-1 parity，或为 Cloud/Remote 维护占位状态和 literal control plane |
| Session / cwd | 新任务选择初始 cwd；projectless session 可直接开始；Environment 只读 | project 拥有 session/context、既有 session cwd 重绑或 rail 重分组 |
| Worktree | 当前版本不提供 managed Worktree/Handoff | Local/Worktree launch mode、starting branch、create/reuse、snapshot、cleanup、restore |
| Agent Package | exact owner-projected action、`required_payload_fields`、`ready / degraded / package_unavailable`、最小 package identity/version/entrypoint/safe-target 校验与 typed error | Shell 预解析 manifest、普遍 Workspace 前提、完整 receipt/binding/closure 硬门槛、owner ledger、anti-replay |
| Review | 复用普通 diff/files；上游无 typed 能力时 truthful unavailable | 私有行级 annotation、伪造成功、cross-host/model-delivery 依赖 |
| Settings | 单一 Settings IA、System/Light/Dark、账户行复用现有 updater | 主题预设画廊、侧栏重复返回、第二 updater |
| Visual | Codex App 的字体、颜色、图标、间距、排版和阴影作为 human target | 用合同或 source gate 代替 installed pixels |

动态跨顶层线程 tools、cross-host handoff、request replay ledger、write-set advisory、pending-server-request
控制面和私有 delivery audit 均已撤销，不是 source、build、install 或 Stable blocker。

当前 Runtime cockpit 与 Hosted Workspace/Fabric/HPC/Console 的部分 contract、page-state 和 validator
仍保留 core hard gate/literal vocabulary。它们的产品分类是 `retained_x0_route`，Source 状态只在
五轴账本读取，core-gate pruning 是独立 maintenance debt。这些 validator pass 只证明既有 machine
contract 与 source 一致；后续 machine cleanup 要把它们移出
B0/R1/U1、默认 release gate 和 Native phase-1 parity，本 docs-only lane 不改机器文件。

## 单一 Authority

人工维护边界保持最小：

1. `contracts/app-gui-product-contract.json` 记录用户可见产品行为；
2. `contracts/app-runtime-bridge.json` 只记录 App 与 Shell 的必要运行时 ABI；
3. page state、fixtures 和文档只做单向派生或示例，不得重新发明 required target；
4. Shell focused behavior/DOM tests证明实现，不以大段 source-string 断言替代行为验证；
5. release profile 将 local install 与 explicit public Stable 分开。

Agent Package 默认 fail-open：先执行 owner-projected 自修复/JIT action，再降级或 fallback；
`package_unavailable` 只阻止所选 Agent 并保留 draft。只有 package 身份/不兼容版本、入口、
不安全 managed target、权限/授权或不可逆 mutation 等真实性与安全边界局部 fail closed。
普通 Codex、其他 Agent 和既有 session 不受单包路径误伤。

## 视觉收敛

当前 Codex App 参考值固定为：

- navigation rail `#FCFCFC`；
- main surface `#FFFFFF`；
- selected row `#F0F0F0`；
- hover `rgba(0, 0, 0, 0.045)`；
- neutral 16px icons 与 13px rail labels；
- composer 使用可见但克制的边框阴影，输入为 `14px/20px`；
- 历史搜索位于“对话历史”标题右侧；
- Settings 内容宽度、三态外观预览和窄窗层次对齐 Codex App。

这些数值属于 App human target。只有同一 final cohort 的 light、dark、narrow installed screenshots
和像素检查通过，才能声明视觉完成；历史截图、DOM 或 source check 只能证明局部实现。

## Currentness and evidence

本文不保存 transient Framework/App/Shell SHA、版本号、未 build/未安装/未发布断言或下一次 Stable
操作步骤。Current source 必须从各 canonical checkout 读取；package、Install 和 Release 必须从 exact-cohort
artifact、installed readback 与 release-owner record 读取。历史 source/pixel/install 事实只留在对应
evidence/history owner，不回填当前五轴。

当前开放项、顺序和 Contract/Source/Pixel/Install/Release 状态只读
[`app-ideal-state-gap-plan.md`](app-ideal-state-gap-plan.md) 与
[`../product/gui/shell-conformance-matrix.md`](../product/gui/shell-conformance-matrix.md)。本文件只保护薄壳
产品边界与 no-resurrection 规则，不是发布 worklist，也不证明 runtime、installed currentness、owner
acceptance 或 production readiness。

Historical evidence routing only: `a0ce713b65801fd9ca7f46ad168c977c75a187de` is the verified GUI
ancestor and `0ebc1fdd278e8a79602458e15e28cf814dfd917d` binds the historical 41301 pixel
cohort. Neither hash is a current Shell HEAD, current pixel, Install, or Release claim.

## 维护规则

- 不整体 merge AionUI upstream，只按能力选择性 intake；
- 不为理论本机攻击增加 ledger、token、数据库迁移或长期私有 fork；
- 不把 project/workspace 变成权限域或 session 所有者；
- 不以 Settings 完成度替代 Home、conversation 和 composer 主体验；
- 不以 docs、focused tests、dry-run、candidate package 或历史 evidence 宣称完成；
- 新能力若需要跨两个以上外部仓、第二 writer 或新的持久化状态，必须由用户重新立项。
