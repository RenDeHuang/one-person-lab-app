# One Person Lab App

本仓持有桌面 App 的产品定义、GUI contracts、页面状态、打包、更新、文档与发布 truth。

## Authority

- OPL Framework runtime、package lifecycle 和 generic reconciliation 归 `one-person-lab`；领域判断、artifact 与交付 authority 归对应 domain agent。本仓只消费其机器合同、CLI JSON、receipts 和 projections。
- `contracts/app-gui-product-contract.json`、`contracts/app-page-state-matrix.json`、`contracts/app-shell-adapter.json`、`contracts/app-release-channel.json` 是 App 侧核心机器边界。
- `shells/aionui/` 是外部 shell checkout。App 定义产品行为和验收，`opl-aion-shell` 承载 renderer、process、package、测试与 upstream intake；不得把 AionUI Git 历史 vendoring 到 App `main`。
- GUI 角色固定为 `gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex`。Hermes 只按显式需求手工验证；AGUI 只保留技术证明。
- 用户可见行为、页面状态、模型/引导策略或 release-ready 边界变化时，先更新 App contract、docs 和 tests，再实现 Shell；Shell 与上游默认值不得反向成为产品 authority。
- 上游 fork body 默认只读。App 工作只触碰 App contracts、adapters、OPL overlays、packaging/readback hooks 与这些表面的验证。

## Runtime And GUI

- 普通读取使用 `opl app state --profile fast --json`。`full` 与 operator drilldown 只用于 Settings > Advanced 和 release tooling。
- Mutation 统一走 `opl app action execute --action <id> [--payload <json>] [--dry-run] --json`；Runtime 页面只允许 task archive/restore。
- GUI 工作从 `docs/product/gui/README.md` 开始，遵循 `gui_definition_stack: product_definition > visual_system > shell_implementation_conformance`；`gui_shell_authority: implementation_only`。
- 外部产品只作交互参考。入口迁移必须由 App contract 授权，并在同一变更中保留可见、键盘可达的替代入口和导航测试。

## Working Rules

- App 写入任务默认使用任务自有 worktree；根仓 `main` 只用于短时集成、最终验证和发布，不作为普通开发工作区。
- Release 低层 `desktop-release*` 与 `opl-first-run-vm` workflow 禁止手工 mutation 和 rerun。当前 Stable critical path 仅允许唯一 executor 通过 canonical `release:stable` controller 对 `desktop-release.yml` 与 `desktop-release-promote.yml` 各提交至多一次 scoped administrator one-shot dispatch；每次提交前必须在唯一 session 中 durable记录 planned 与 dispatching，绑定 frozen cohort、canonical `main` controller SHA、exact payload digest 与 attempt id。未知提交结果或 run 暂不可见时只能 read-only reconcile，禁止 redispatch；admin one-shot attempt 禁止 cancel。Full/add-on、cleanup及其他 mutation仍只允许隔离 broker。未部署 broker是发布后 hardening debt，不是当前 Standard admission硬门。Monitor 只允许 GET/readback。失败必须先 reconcile 并记录 failure taxonomy；没有 durable receipt 不得手工续跑。Compiled expectation 或 verification harness SHA 变化必须冻结新 cohort，不允许仅凭 changed-path allowlist 复用 artifact。发布对话或代理树不得作为 scheduler、watcher 或 state store：禁止递归监控/审计子树和重复 polling，所有接管只读 canonical session 并执行一次 typed reconcile；已有 owner 时其他 task 必须停止路由和等待。除上述 scoped one-shot外，日常 Codex credential保持 Actions read-only，不能绕过受保护的 canonical `main` / release-control path直接改写 verifier。
- 修改前确认 canonical `main`、远端 currentness、当前 integration owner 与本任务精确写集。仓库级单一 writer 不是默认门禁；同仓非重叠任务应在独立 worktree 并行，只有重叠写集和 `main` 吸收窗口需要串行协调。
- 吸收前基于最新 canonical `main` 按 App contracts 和当前产品 truth 解决冲突；禁止用旧分支、旧生成物或上游默认值覆盖新主线。
- 跨仓吸收必须保持各 canonical `main` 组合可运行；消费者不得依赖尚未进入 authority `main` 的候选。不兼容变更按“兼容桥 -> authority -> 收紧”分段吸收。
- Release freeze 只接受远端 `main` 可达的 exact refs；dispatch 前必须按 frozen cohort 重建跨仓投影，并通过 validator 与冷启动。
- App 产品、合同、release、测试和用户文档改在本仓根；AionUI 实现改在 Shell 仓。
- 修改 App contracts 或 wrappers 后运行 `bun run validate:active-shell`。本地缺少 `shells/aionui/` 时先运行 `npm run ensure:shell`。
- OPL Flow 只定义推荐 workflow profile 与冲突策略；实际安装、迁移、回滚由 Framework package transaction 执行。

<!-- CODEGRAPH_START -->
## CodeGraph

- 本仓库使用本地 `.codegraph/` 索引；该目录不得纳入 Git。
- 定义、调用、影响范围和代码路径等结构检索优先使用 CodeGraph；字面文本检索使用 `rg`。
- 索引缺失或过期时运行 `codegraph init .` 或 `codegraph sync .`。
<!-- CODEGRAPH_END -->
