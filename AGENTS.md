# One Person Lab App

本仓持有桌面 App 的产品定义、GUI contracts、页面状态、打包、更新、文档与发布 truth。

## Authority

- OPL Framework runtime、package lifecycle 和 generic reconciliation 归 `one-person-lab`；领域判断、artifact 与交付 authority 归对应 domain agent。本仓只消费其机器合同、CLI JSON、receipts 和 projections。
- `contracts/app-gui-product-contract.json`、`contracts/app-page-state-matrix.json`、`contracts/app-shell-adapter.json`、`contracts/app-release-channel.json` 是 App 侧核心机器边界。
- `shells/aionui/` 是外部 shell checkout。App 定义产品行为和验收，`opl-aion-shell` 承载 renderer、process、package、测试与 upstream intake；不得把 AionUI Git 历史 vendoring 到 App `main`。
- GUI 角色固定为 `gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex`。Hermes 只按显式需求手工验证；AGUI 只保留技术证明。
- 用户可见行为、页面状态、模型/引导策略或 release-ready 边界变化时，先更新 App contract、docs 和 tests，再实现 Shell；Shell 与上游默认值不得反向成为产品 authority。
- 上游 fork body 默认只读。App 工作只触碰 App contracts、adapters、OPL overlays、packaging/readback hooks 与这些表面的验证。
- 默认继承 AionUI/AionCore 官方基础能力；OPL 只做合同授权的薄适配和明确裁剪（例如 Team）。不得因 OPL 没有专门白名单就禁用其它上游能力；上游没有且产品并不必要的复杂能力默认不私有实现。只存在于已 reject、已退休或私有 legacy 功能中的问题不进入产品修复主线。
- OPL Packages 是独立于 GUI 的 Framework-owned 生态，不是可随 Shell 简化的页面功能。App/Shell 必须完整保留其安装、更新、修复、启停、显隐、卸载、lock、receipt、`rollback_ref`、Home shortcut 与 Codex materialization 投影，只删除 App/Shell 对这些权威的重复实现。

## Runtime And GUI

- 普通读取使用 `opl app state --profile fast --json`。`full` 与 operator drilldown 只用于 Settings > Advanced 和 release tooling。
- Mutation 统一走 `opl app action execute --action <id> [--payload <json>] [--dry-run] --json`；Runtime 页面只允许 task archive/restore。
- GUI 工作从 `docs/product/gui/README.md` 开始，遵循 `gui_definition_stack: product_definition > visual_system > shell_implementation_conformance`；`gui_shell_authority: implementation_only`。
- 外部产品只作交互参考。入口迁移必须由 App contract 授权，并在同一变更中保留可见、键盘可达的替代入口和导航测试。

## Working Rules

- App 写入任务默认使用任务自有 worktree；根仓 `main` 只用于短时集成、最终验证和发布，不作为普通开发工作区。
- Release 的唯一状态权威是 Framework `opl release` 管理的不可变 Release Bundle、portable checkpoint 和 receipt；App 只保留产品合同、资产策略及薄 local/GitHub executor，不得复制 checkpoint schema、状态机、skip/idempotency 或 reconciliation 语义。本地与 GitHub 必须 build once、按 digest 暂存并 verify/publish many，切换 executor 只传 checkpoint、资产和原始 receipt，completed stage 由 Framework 判定并保持 `rebuild_performed=false`。Bundle 绑定 App/Shell/Framework exact SHA、prepared AI notes、资产 bytes 与 qualification receipts；只有本次实际选择并包含的可选 Package/Full 输入才记录其 ref 与 digest，不得要求全部 first-party Package 或 Flow 进入 App Bundle。
- Stable 只有 `standard`、`resume_standard`、`append_full` 三种 operation，`.github/workflows/release-stable.yml` 是唯一 Stable `workflow_dispatch`。Desktop Standard Latest 成功后，WebUI 只能由 `.github/workflows/release-webui-follower.yml` 的 `workflow_run` 按 exact handoff 独立构建、晋升和 readback；WebUI 失败不得改写 Desktop Stable 终态。公开 Nightly 发布已退休，只保留历史分发读取兼容；每日调度统一进入 Canary。所有低层 release/build/qualification workflow 只保留 `workflow_call` 或只读事件。Canary 必须以 validation-only 模式真实启动上层及低层 reusable topology，不继承发布 secrets，也不得执行 build、VM、外部写入或 Stable mutation。
- 旧 broker、session、operator 仅允许读取和解释历史 receipt；它们不得提供新 admission、dispatch、cancel、promote、resume、reconcile 或 mutation CLI，也不得成为 planner、closeout、workflow 或文档生成的新动作。API 或 executor 结果未知时只能 fresh inspect 后调用 Framework reconcile；禁止 redispatch、rerun、cancel 或猜测成功。
- 除绑定受保护 `release-stable` environment 的精确 publish jobs 外，全链路权限只读；日常 Codex credential 不得获得 release mutation authority，发布 secret 只能在受保护 mutation job 中按需可达。Publisher 必须幂等：远端缺失才上传，同名同 digest 视为完成，同名异 digest fail closed，未知结果只做有界只读 reconcile。
- Standard 六资产和已校验的 prepared AI notes 齐全即可成为 Latest；Full 可在同一 frozen Bundle/cohort 后续只追加 DMG 与 manifest，失败不得改变 Standard、notes、Latest 或 updater metadata。所有构建与验收使用 release 自有只读 checkout/Bundle store，不得锁住 canonical `main` 或无关开发 worktree；compiled expectation、qualification harness 或本次实际包含的 payload 字节变化必须冻结新 Bundle，不允许 changed-path 复用。
- 修改前确认 canonical `main`、远端 currentness、当前 integration owner 与本任务精确写集；重叠写集和 `main` 吸收窗口必须串行协调。
- 吸收前基于最新 canonical `main` 按 App contracts 和当前产品 truth 解决冲突；禁止用旧分支、旧生成物或上游默认值覆盖新主线。
- 跨仓吸收必须保持各 canonical `main` 组合可运行；消费者不得依赖尚未进入 authority `main` 的候选。不兼容变更按“兼容桥 -> authority -> 收紧”分段吸收。
- Release freeze 只接受远端 `main` 可达的实际构建输入 ref；昂贵构建前必须完成所选载体输入的 cold preflight 与 prepared AI notes，并把结果写入 Bundle identity。未选择的 Package、Flow 或可选 Skill 不得成为 App release 前置。
- App 产品、合同、release、测试和用户文档改在本仓根；AionUI 实现改在 Shell 仓。
- 修改 App contracts 或 wrappers 后运行 `bun run validate:active-shell`。本地缺少 `shells/aionui/` 时先运行 `npm run ensure:shell`。
- OPL Flow 只定义 workflow profile、required/recommended 能力意图与冲突策略；实际解析、安装、迁移、回滚和投影由 Framework package transaction 执行。App/Shell 不读取 Flow manifest，不保存第二份依赖清单，也不把 lock 或 payload 作为 readiness 前置。

<!-- CODEGRAPH_START -->
## CodeGraph

- 本仓库使用本地 `.codegraph/` 索引；该目录不得纳入 Git。
- 定义、调用、影响范围和代码路径等结构检索优先使用 CodeGraph；字面文本检索使用 `rg`。
- 索引缺失或过期时运行 `codegraph init .` 或 `codegraph sync .`。
<!-- CODEGRAPH_END -->
