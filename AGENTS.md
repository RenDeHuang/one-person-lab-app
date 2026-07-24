# One Person Lab App

本仓持有桌面 App 的产品定义、GUI contracts、页面状态、打包、更新、用户文档与发布产品 truth。

- App 侧核心机器边界是 `contracts/app-gui-product-contract.json`、`contracts/app-page-state-matrix.json`、`contracts/app-shell-adapter.json` 和 `contracts/app-release-channel.json`。
- OPL Framework 持有通用 runtime、installed discovery/status aggregation 与平台 adapter；领域 task、artifact 和交付 authority 归对应 domain owner。App 只消费其 contracts、CLI JSON 和 projections。
- `opl-aion-shell` 承载 AionUI renderer、process、package、测试和 upstream intake；App 定义产品行为与验收。不得把 Shell/upstream 默认值或 Git 历史变成 App authority。
- 用户可见行为、页面状态、模型/引导策略或 release-ready 边界变化时，先更新 App contract、docs 和 tests，再实现 Shell；上游 fork body 默认只读。
- Package、carrier 与 executor 是独立角色。App/Shell 从动态 projection 渲染，不维护固定 Package/Agent 清单、依赖图、版本解析、lock、payload、receipt 或 currentness 镜像。
- 普通读取使用 `opl app state --profile fast --json`；写入统一走 `opl app action execute ... --json`。未知外部 mutation 只做 owner-authoritative inspect/reconcile，不重发或猜测。
- GUI 工作从 `docs/product/gui/README.md` 开始；App contracts 或 wrappers 变更后运行 `bun run validate:active-shell`，本地缺 Shell 时先运行 `npm run ensure:shell`。测试通过不等于发布完成。

<!-- CODEGRAPH_START -->
## CodeGraph

- 本仓库使用本地 `.codegraph/` 索引；该目录不得纳入 Git。
- 定义、调用、影响范围和代码路径等结构检索优先使用 CodeGraph；字面文本检索使用 `rg`。
- 索引缺失或过期时运行 `codegraph init .` 或 `codegraph sync .`。
<!-- CODEGRAPH_END -->
