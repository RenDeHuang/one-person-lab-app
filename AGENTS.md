# One Person Lab App

本仓持有桌面 App 的产品定义、GUI contracts、页面状态、打包、更新、文档与发布 truth。

## Authority

- OPL Framework runtime、通用 installed discovery / status aggregation 和薄平台 adapter 归 `one-person-lab`；领域判断、task inventory/lifecycle、artifact 与交付 authority 归对应 domain agent。本仓只消费其机器合同、CLI JSON 和 projections。
- `contracts/app-gui-product-contract.json`、`contracts/app-page-state-matrix.json`、`contracts/app-shell-adapter.json`、`contracts/app-release-channel.json` 是 App 侧核心机器边界。
- `shells/aionui/` 是外部 shell checkout。App 定义产品行为和验收，`opl-aion-shell` 承载 renderer、process、package、测试与 upstream intake；不得把 AionUI Git 历史 vendoring 到 App `main`。
- GUI 角色固定为 `gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex`。Hermes 只按显式需求手工验证；AGUI 只保留技术证明。
- 用户可见行为、页面状态、模型/引导策略或 release-ready 边界变化时，先更新 App contract、docs 和 tests，再实现 Shell；Shell 与上游默认值不得反向成为产品 authority。
- 上游 fork body 默认只读。App 工作只触碰 App contracts、adapters、OPL overlays、packaging/readback hooks 与这些表面的验证。
- 默认继承 AionUI/AionCore 官方基础能力；OPL 只做合同授权的薄适配和明确裁剪（例如 Team）。不得因 OPL 没有专门白名单就禁用其它上游能力；上游没有且产品并不必要的复杂能力默认不私有实现。只存在于已 reject、已退休或私有 legacy 功能中的问题不进入产品修复主线。
- OPL 生态的目标模型固定为 `OPL Base ~= R`、`OPL App ~= RStudio / 可替换 GUI 与部署载体`、`OPL Package ~= R Package`。OPL 标准智能体只是 `kind=agent` 的 OPL Package；新增、替换或组合 Package 不得要求 App source 增加 Package id 分支。
- Package 组合遵循 presence-only：声明 required/optional package 或 capability identity，required 缺失时只补齐或局部阻止依赖它的 root，不以版本范围、ABI、lock、payload、digest、Release Set 或固定 cohort 作为组合/readiness 门禁。精确 ref/digest 只属于一次实际 build/release artifact 的可复现记录。
- Standard 与 Full 消费同一个 App Official Profile。该 Profile 只声明首次安装和用户显式“恢复官方组合”时的 desired roots，不是生态上限或永久强制器；用户卸载 Package 后，普通启动和静默更新不得偷偷重装。Full 只增加离线 seed，不拥有第二份 Package 清单。
- Package、carrier 和 executor 是三个独立角色。Package identity、capability、依赖、用户偏好和业务 task/view 必须 executor-neutral；Codex Plugin Manager 只是当前首个 carrier adapter，Codex plugin id、marketplace、home/path 和 manifest shape 只能存在于 Codex adapter 内，不得成为 OPL Package identity、installed truth 或生态 authority。
- 当前实施遵循 `Codex-first, OPL-owned boundaries`：只维护一条正式 Codex 主路径，不并行自研 Claude/Hermes 产品；OPL 长期拥有 Package/capability identity、Official Profile、用户偏好、Work Item、Temporal refs、typed views 与领域交付语义。第一阶段只用一个最小 Git/local 中性 proof 防止公共合同被 Codex 私有字段锁死。
- 一方 OPL Package 的完整官方 bytes 发布到各自独立 GHCR repository，owner 只推进自己的 `latest-stable`。`one-person-lab-manifest:latest-stable` 不得定义普通更新，只保留 Full/offline/integration-test/QA snapshot。Base 只保留薄 OCI 下载与校验，Package 声明完整 runtime adapter，配置的 carrier 执行，Codex 负责 Plugin/config/cache；Plugin-only 不能证明完整 Package installed。
- Package 生命周期优先委托 Codex Plugin Manager、Git 或其他平台原生能力；Framework 只在平台缺口处提供薄 adapter、installed discovery、依赖 presence 检查、executor route readiness 和状态聚合。App/Shell 保留统一安装、独立静默更新、启停/显隐/卸载、Home shortcut 与局部故障体验，但不得复制 resolver、lock、payload、LKG、receipt、materialization 或 rollback 状态机。

## Runtime And GUI

- 普通读取使用 `opl app state --profile fast --json`。`full` 与 operator drilldown 只用于 Settings > Advanced 和 release tooling。
- Mutation 统一走 `opl app action execute --action <id> [--payload <json>] [--dry-run] --json`；Runtime 页面只允许 task archive/restore。
- 普通 App 路径当前固定 Codex CLI 是产品策略，不是 OPL Package 生态边界。未来切换到 Claude Code、Hermes Agent 或其他 executor 时，只刷新对应 executor route readiness；不得重装或重命名 Package，也不得丢失 Settings/Home preference、业务 Work Item、ScholarSkills presence 或 MAS 科研路线等 owner view。
- Runtime 是 App 核心产品面：Agent 提供业务 task inventory/lifecycle，Temporal 提供 queued/running/attempt/heartbeat/terminal execution，Framework 负责聚合与协议校验，App/Shell 只按通用字段和 `view_kind` 渲染。App 不按 Agent id 分支，不复制 MAS 科研路线或其他领域 schema；未知 `view_kind` 只局部降级。
- GUI 工作从 `docs/product/gui/README.md` 开始，遵循 `gui_definition_stack: product_definition > visual_system > shell_implementation_conformance`；`gui_shell_authority: implementation_only`。
- 外部产品只作交互参考。入口迁移必须由 App contract 授权，并在同一变更中保留可见、键盘可达的替代入口和导航测试。

## Working Rules

- `docs/active/opl-package-platform-composition-migration.md` 对本迁移采用显式两阶段：
  Phase 1 只允许只读审计与文档 SSOT/冻结实施计划；Phase 2 只有在 Phase 1 文档进入
  canonical `main`、完成远端 readback，且用户再次明确批准后才允许修改本迁移写集内的
  contracts、source、tests、workflows、Package/publication state 或运行状态。候选、
  测试通过、owner handoff 和内部 ACK 均不构成 Phase 2 授权；该阶段边界不冻结无关任务，
  也不是 Stable、Package publication 或 Foundry 的发布前置。
- 开发环境默认 `progress-first`：先交付最小可运行、可审阅、可验证的开发产物，不把流程、工具、test harness、CI 编排、文档或自动化的非致命缺陷自动升级为产品交付阻断。只处理当前真实断点；在产物身份和验收语义不变时，优先使用局部补丁、手工验证、已验证字节、受保护的最窄入口或替代路径完成当前交付，永久流程修复独立并行或随后收尾，不得反向成为当前交付前置。
- `progress-first` 不降低真实性、写入安全或上述阶段授权：产物本身错误或不可验证、可能损坏数据或越过安全/权限边界、目标 namespace 同名异 digest、外部 mutation 结果 unknown、缺少必要人类授权或不可替代 authority 时必须停止；除此之外不得用预防性审计、通用化或重构无限扩大关键路径预算。
- App 写入任务默认使用任务自有 worktree；根仓 `main` 只用于短时集成、最终验证和发布，不作为普通开发工作区。
- Release 的唯一状态权威是 Framework `opl release` 管理的不可变 Release Bundle、portable checkpoint 和 receipt；App 只保留产品合同、资产策略及薄 local/GitHub executor，不得复制 checkpoint schema、状态机、skip/idempotency 或 reconciliation 语义。本地与 GitHub 必须 build once、按 digest 暂存并 verify/publish many，切换 executor 只传 checkpoint、资产和原始 receipt，completed stage 由 Framework 判定并保持 `rebuild_performed=false`。Bundle 绑定 App/Shell/Framework exact SHA、prepared AI notes、资产 bytes 与 qualification receipts；只有本次实际选择并包含的可选 Package/Full 输入才记录其 ref 与 digest，不得要求全部 first-party Package 或 Flow 进入 App Bundle。
- Stable 只有 `standard`、`resume_standard`、`append_full` 三种 operation，`.github/workflows/release-stable.yml` 是唯一 Stable `workflow_dispatch`。在 `production_release` 中，Desktop Standard Latest 成功后，WebUI 只能由 `.github/workflows/release-webui-follower.yml` 的 `workflow_run` 按 exact handoff 独立构建、晋升和 readback；WebUI 失败不得改写 Desktop Stable 终态。在 `development_validation` 中，`.github/workflows/release-webui-development.yml` 可在 Desktop Latest 前独立验证并公开交付 WebUI，必要时由 `.github/workflows/release-webui-development-promote.yml` 只晋升此前首轮已构建和验收的精确字节；开发 receipt 不得冒充 production Latest 或 follower handoff。Nightly 保留 Standard 密度自动预发布的产品语义，但当前公开发布实现已退休，只保留历史分发读取兼容；每日调度统一进入 Canary。所有低层 release/build/qualification workflow 只保留 `workflow_call` 或只读事件。Canary 必须以 validation-only 模式真实启动上层及低层 reusable topology，不继承发布 secrets，也不得执行 build、VM、外部写入或 Stable mutation。
- 旧 broker、session、operator 仅允许读取和解释历史 receipt；它们不得提供新 admission、dispatch、cancel、promote、resume、reconcile 或 mutation CLI，也不得成为 planner、closeout、workflow 或文档生成的新动作。API 或 executor 结果未知时只能 fresh inspect 后调用 Framework reconcile；禁止 redispatch、rerun、cancel 或猜测成功。
- 除绑定受保护 `release-stable` environment 的精确 publish jobs 外，全链路权限只读；日常 Codex credential 不得获得 release mutation authority，发布 secret 只能在受保护 mutation job 中按需可达。Publisher 必须幂等：远端缺失才上传，同名同 digest 视为完成，同名异 digest fail closed，未知结果只做有界只读 reconcile。
- Standard 六资产和已校验的 prepared AI notes 齐全即可成为 Latest；Full 可在同一 frozen Bundle/cohort 后续只追加 DMG 与 manifest，失败不得改变 Standard、notes、Latest 或 updater metadata。所有构建与验收使用 release 自有只读 checkout/Bundle store，不得锁住 canonical `main` 或无关开发 worktree；compiled expectation、qualification harness 或本次实际包含的 payload 字节变化必须冻结新 Bundle，不允许 changed-path 复用。
- 修改前确认 canonical `main`、远端 currentness、当前 integration owner 与本任务精确写集；重叠写集和 `main` 吸收窗口必须串行协调。
- 吸收前基于最新 canonical `main` 按 App contracts 和当前产品 truth 解决冲突；禁止用旧分支、旧生成物或上游默认值覆盖新主线。
- 跨仓吸收必须保持各 canonical `main` 组合可运行；消费者不得依赖尚未进入 authority `main` 的候选。不兼容变更按“兼容桥 -> authority -> 收紧”分段吸收。
- Release freeze 只接受远端 `main` 可达的实际构建输入 ref；昂贵构建前必须完成所选载体输入的 cold preflight 与 prepared AI notes，并把结果写入 Bundle identity。未选择的 Package、Flow 或可选 Skill 不得成为 App release 前置。
- App 产品、合同、release、测试和用户文档改在本仓根；AionUI 实现改在 Shell 仓。
- 修改 App contracts 或 wrappers 后运行 `bun run validate:active-shell`。本地缺少 `shells/aionui/` 时先运行 `npm run ensure:shell`。
- OPL Flow 是 Official Profile 可选中的默认 workflow Package，不是 App、Base、Standard、Full 或无关 Package 的 readiness 前置。Flow owner 声明自身能力意图，配置的 carrier 执行生命周期，Framework 只做 presence/callability 和 fresh 聚合；App/Shell 不读取 Flow manifest 或 companion Skill 清单，也不保存第二份依赖表。

<!-- CODEGRAPH_START -->
## CodeGraph

- 本仓库使用本地 `.codegraph/` 索引；该目录不得纳入 Git。
- 定义、调用、影响范围和代码路径等结构检索优先使用 CodeGraph；字面文本检索使用 `rg`。
- 索引缺失或过期时运行 `codegraph init .` 或 `codegraph sync .`。
<!-- CODEGRAPH_END -->
