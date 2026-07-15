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
- GUI 工作从 `docs/product/gui/README.md` 开始，遵循 `product_definition > visual_system > shell_implementation_conformance`；shell authority 始终是 `implementation_only`。
- 外部产品只作交互参考。入口迁移必须由 App contract 授权，并在同一变更中保留可见、键盘可达的替代入口和导航测试。

## Working Rules

- 修改前确认 canonical `main`、远端 currentness、当前唯一 owner 与写集；不得并发覆盖活跃 integration lane。
- App 产品、合同、release、测试和用户文档改在本仓根；AionUI 实现改在 Shell 仓。
- 修改 App contracts 或 wrappers 后运行 `bun run validate:active-shell`。本地缺少 `shells/aionui/` 时先运行 `npm run ensure:shell`。
- OPL Flow 只定义推荐 workflow profile 与冲突策略；实际安装、迁移、回滚由 Framework package transaction 执行。

<!-- CODEGRAPH_START -->
## CodeGraph

- 本仓库使用本地 `.codegraph/` 索引；该目录不得纳入 Git。
- 定义、调用、影响范围和代码路径等结构检索优先使用 CodeGraph；字面文本检索使用 `rg`。
- 索引缺失或过期时运行 `codegraph init .` 或 `codegraph sync .`。
<!-- CODEGRAPH_END -->
