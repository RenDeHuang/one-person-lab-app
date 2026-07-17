# One Person Lab App Architecture

Owner: `one-person-lab-app`
Purpose: `app_architecture_boundary`
State: `active_truth`
Machine boundary: Human-readable architecture note. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.

The App product layer is a consumer of the OPL Framework and domain agents:

```text
One Person Lab App
  -> App product contracts and release wrappers
  -> active shell checkout
  -> OPL Framework CLI JSON / contracts / provider receipts
  -> installed OPL Agent Packages and domain-owned projections from MAS, MAG,
     RCA, OMA, BookForge, and future agents
```

The App owns desktop packaging, update flow, first-run product behavior, release evidence collection, user guides, screenshots, GUI product truth, page-state tests, and stable/nightly release gates. OPL Framework owns stage runtime, provider management, queue/attempt ledger, generated surfaces, action execution, runtime read models, `opl app state`, and `opl app action` producers. Domain agents own their own truth, quality/export verdicts, memory body, artifact body, owner receipts, and typed blockers.

GUI 产品定义刻意分层。`docs/product/gui/ideal-interaction-spec.md` 定义不绑定具体 shell 的目标交互：Codex App 形态、chat-first、次级 context 默认收起。`docs/product/gui/codex-to-opl-app-delta.md` 定义 Codex baseline 之上的 OPL 专用增量：purpose routing、domain skill profiles、runtime bridge refs、installation policy、evidence 和 authority boundaries。`docs/product/gui/feature-inventory.md` 跟踪跨 shell 能力清单和参考模式。机器可读验收再进入 `contracts/`、page-state matrices、source、package manifests、smoke evidence 和 release gates。

`contracts/app-gui-product-contract.json` is the canonical App-owned GUI product contract. It covers the Codex CLI fixed executor experience, hidden home and ordinary-conversation backend/provider selectors, visible App-owned model/reasoning and user-language permission/access controls, purpose-first home entries, assistant-scoped skill/profile metadata for those entries, the required package-shortcut invocation receipt, the home prompt, App-owned ordinary Settings navigation for Overview, Account & Gateway, Models, Workspace & Personalization, Agents, Capabilities, Resources & Connections, Maintenance, Data & Storage, and Preferences, About as the only independent secondary page, the Advanced-to-Maintenance diagnostics redirect, startup snapshot/performance policy, legacy upstream route redirects, first-launch `ready_to_launch` before `/guid`, module path source explanation, release stable/nightly gates, MDS retirement from default display, and the OPL Flow context shown in Settings. Storage owns local data lifecycle inventory, archive/restore proof, runtime pointer prune, updater cache cleanup, and bounded log rotation controls. MAS/MAG/RCA/BookForge/OMA are first-party starter packages and shortcuts, not the upper bound of what OPL App can manage. `contracts/app-install-exposure-policy.json` owns the App-facing install/exposure policy: `skill` is the public semantic ABI, Codex App plugins are distribution/capability bundles, and CLI/App/direct skill paths must converge on the same domain-owned action/stage metadata. `contracts/app-runtime-bridge.json` is the App-owned bridge contract that binds a replaceable shell adapter to OPL-owned CLI state/action/drilldown surfaces. `contracts/app-product-profile.json` carries desktop session defaults, visible companion skills, first-run Core readiness, Full readiness/background maintenance behavior, Settings presentation and startup policy, legacy settings route redirects, install exposure refs, assistant/profile metadata, launch receipt policy, and generated shell profile data. `contracts/app-page-state-matrix.json` and `contracts/app-first-run-test-matrix.json` define page-state and first-run expectations.

Professional agent ownership is deliberately split to keep the App generic. The App should own package management, home shortcut configuration, launch into Codex, invocation receipt display, and refs-only status panels. In Settings, Agents is the installed package directory with integrated Home shortcut management; purpose remains a secondary tag/filter, not the primary row identity. Capabilities separately owns the Skill/Plugin catalog and OPL Flow recommendations. Neither page owns a professional agent's domain workflow, stage model, prompt internals, artifact schema, readiness verdict, quality/export verdict, or owner receipts. There should be no strong App-level `Session Contract` for MAS or any other professional agent. The durable boundary is `Agent Package -> Home Shortcut Metadata -> Codex launch -> Invocation Receipt`. The required invocation receipt records that launch fact; the optional activation `use_receipt_ref` is separate audit evidence and never a universal launch prerequisite.

The Framework built-in Release Set is the only runtime source of canonical
first-party package identities. The default App registry contract at
`contracts/agent-package-registry.json` is an external-discovery-only source,
may be empty, and must not claim a built-in package id, first-party source, or
`first_party` trust tier. Framework keeps the collision defense fail-closed.
Operators may add organization or user registry URLs. External registry entries carry
labels, source/trust hints, and manifest URLs only; they do not define
business behavior, session contracts, artifact schemas, readiness rules, or
owner receipt authority. `contracts/agent-package-surfaces.schema.json` and
`contracts/fixtures/agent-package-manifests/` define the App-side manifest,
shortcut, invocation receipt, and package lock receipt shapes, while
`contracts/app-product-profile.json#gui.agent_package_registry.first_party_release_set_metadata`
provides static product metadata for all seven built-in packages without becoming
directory or install truth. Selecting an external package routes the manifest URL to OPL Framework
validation and package lifecycle execution. The validated manifest plus
Framework package lock, rollback ref, and action receipt is the install
authority for the non-live contract/readback slice. Framework also owns
update, repair, rollback, uninstall, hide/unhide, enable/disable, status, and
their lifecycle receipts. Framework now also materializes manifest-declared
local Codex plugin sources into `CODEX_HOME` plugin cache, OPL state local
marketplace wrappers, Codex config tables, package lock `physical_surface`, and
lifecycle receipt `physical_surface`. Framework also validates local packaged
payloads contain `skills/<required_skill_id>/SKILL.md` before materialization
and owns package Home shortcut preference readback. Active shell reads
Framework-backed Home shortcut preferences from App state, persists
visibility/order changes through the Framework action route with local fallback,
emits launch-only `opl_agent_package_invocation` route smoke, and renders
`physical_surface` in Settings, but non-live first-party distribution payload proof and remote payload manifest fields are landed; installed Codex-surface reload proof and live user-path evidence still need separate runtime or release-owner evidence.

Home entry ownership is split deliberately for GUI replacement. The App contract owns user-facing shortcut targets and labels, while installed Agent Packages provide the Codex plugin/skill surfaces that those shortcuts invoke. Existing MAS/MAG/RCA/BookForge entries are starter shortcuts and migration seeds; future compliant first-party, organization, user, or third-party packages should be able to provide the same shortcut metadata without App source edits. Shells render configured shortcuts, launch Codex with the package's declared plugin/skill surface, and persist an App-owned invocation receipt. They do not decide which packages are installed, which shortcuts are default, whether an agent appears on the home screen, or whether the route is exposed as a backend selector.

Skill ownership is similarly split. `skill` remains the public semantic ABI, and Codex plugin packaging remains the preferred App distribution shell. Package manifests declare required skill packs and optional companion tools; required skill packs may be developed in separate repositories but must be materialized into the package at release time with lock/checksum/receipt evidence. `companion_payloads.default_packaged_codex_skill_ids` is the App-level default package whitelist during the current migration, independent of whether a candidate originated in AionUI builtin assets, Skills Manager, a Codex local skill, or a plugin payload. AionUI-specific internal skills such as `aionui-skills`, `aionui-webui-setup`, and `skill-creator` stay out of ordinary App capability selection. Agent packages remain on Settings/Agents; the Skill/Plugin hub remains on Settings/Capabilities. Neither becomes a normal home input menu.

The App consumes the OPL three-layer capability model without becoming any of
the three layers' owner. `professional_skill` is the package-declared expert
playbook launched through Codex or a package shortcut. `skill_local_deterministic_helper`
is a helper such as `kernel.py` that travels with that skill pack and may be
displayed as packaged payload/readback. `programmatic_substrate` and
`authority_surface` remain Framework or domain-owned producers: package
validation, connector receipts, runtime queues, App state, owner receipts,
typed blockers, quality/export verdicts, and release evidence. The App may
show install status, shortcut state, launch receipts, and refs-only runtime
projection for all three, but it must not turn helper presence, package
materialization, shell rendering, or App validation into a professional-agent
result, domain readiness, release readiness, or owner acceptance claim.

The home executor boundary is intentionally narrower than upstream AionUI. The App is a Codex CLI wrapper with built-in OPL assistants, not a general multi-backend agent launcher. Active shells may retain upstream AionUI agent/backend settings for development or diagnostics, but the App home path and ordinary Codex conversation path must not surface Aion CLI, Claude Code, backend switching, provider lists, or permission-mode choices as normal user controls. The visible model selector is App-owned and bounded by the product profile.

Settings boundary 也遵循同样拆分。普通 Settings navigation 是 Overview、Account & Gateway、Models、Workspace & Personalization、Agents、Capabilities、Resources & Connections、Maintenance、Data & Storage、Preferences，对应 route ids `general`、`gateway`、`access`、`workspace`、`agents`、`capabilities`、`resources`、`environment`、`storage`、`appearance`。About 是唯一独立 secondary page；Advanced 只 redirect 到 `environment#diagnostics`，Update、Theme、Local Services 和 Personalization redirect 到 owner anchors。Account & Gateway 独占账户、用量与凭据 lifecycle；Models 只回答模型来源和偏好；Resources 排除内置 Gateway 及其 count；Workspace & Personalization 单一持有 workspace path、App log directory、user AGENTS.md 与 OPL App context；Storage 只读引用 log path 并持有 usage/cleanup；Preferences 持有 App behavior/display；Maintenance diagnostics 持有 Framework/raw paths。桌面日志目录通过独立动作 `application.setLogDirectory` 更改：先持久化 `hostLogDir`，再切换 live log writer，切换失败必须回滚持久化值并返回明确错误；Shell 只回传 `hostLogDir`，`cacheDir/workDir` 不变。WebUI `/data/logs` 继续投影既有 `OnePersonLab/data -> /data` volume，Settings 不重接卷。首窗从持久化窄快照或 loading shell 渲染，不等待完整 fast JSON 或 drilldown；cold/warm 预算均为 1,500 ms，startup projection 上限 262,144 bytes，完整 fast read 只做共享后台 single-flight，Agents/Capabilities/Storage/About 详情按需加载。Agents 的安装 truth 由 `opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index` 提供，实际运行来源由 `app_state.runtime_source_carriers.items[]` 独立提供；Shell 不得把本地 manifest 安装来源显示成开发运行来源，也不得仅因开发 checkout 存在就声称包已安装。`app_state.modules.items[]` 只用于 older payload 或 partial projection 的兼容回退。无论读取 canonical 还是 fallback，dirty developer checkout、ready-but-update、Codex Surface sync 等信号都必须保留为多轴 package 状态，而不是退回单个 repair badge 或 purpose cards。Overview、runtime、system、model、agent、assistants、skills-hub、tools、display、webui、pet 等 legacy upstream routes redirect 到 App-owned pages。Storage owns local data lifecycle inventory and cleanup controls; Shell 仍可保留 diagnostic 或 redirected sub-content 的实现组件，但这些组件不定义普通 App navigation 或 product authority。

Installation and maintenance expose exactly three software objects:

| Object | Architecture boundary |
| --- | --- |
| OPL Base | The Framework-owned headless CLI/runtime prerequisite. Homebrew Formula `opl` and `opl-install.sh --headless --skip-packages` are carrier adapters for the same Base identity. When Base is missing, the App may offer one-click bootstrap through that installer and show progress/readback, but it does not implement, update, repair, or roll back Base. Runtime dependencies and companion-tool integration appear only as `dependency_status` / `integration_status` details under Base. |
| OPL App | The App-owned GUI/control plane and the only software object the App mutates. Homebrew Cask and signed installer/DMG are carrier adapters for the same App identity. Standard updater and host-route state remain App details through `host_update_route` and `host_executor_required`; carrier choice does not change ownership. |
| OPL Packages | Framework-managed capability packages such as MAS/MAG/RCA/OMA/BookForge/MAS Scholar Skills/OPL Flow. Install, update, repair, and uninstall use the canonical `opl packages` lifecycle. Codex visibility/reload becomes `projection_status`; OPL Flow/profile semantic merge becomes `profile_migration_status`. Neither is a fourth product or updater, and Homebrew must not manage Packages. |

标准 App updater 仍只替换 `opl_app` 二进制。只有新版本通过 post-restart version gate 并进入 `running_version_switched` 后，App 才请求一次独立的 `opl packages update opl-flow --json` Framework transaction；Framework 先把只读 Full bundled source 刷新到 managed package checkout，再按当前 OPL Flow policy 归档冲突 skill、清理声明的配置/服务、由 Codex 语义整理 `AGENTS.md`，并写 backup/rollback receipt。App 不复制冲突名单、不直接删除 skill，也不直接写用户 profile。

`managed_update.components` therefore has exactly `opl_base`, `opl_app`, and `opl_packages`. The ordinary App has no component picker and no legacy component mapping. Full carriers may seed Base or Package payload bytes for first install, but activation and later mutation still route to the owning lifecycle. User data/artifacts remain a separate storage and cleanup boundary, not a software updater object.

The retained X0-01 Runtime route contract is display and routing only. When the
route is enabled, its user view consumes `opl app state --profile fast --json`;
OPL Framework owns the
task/project projection, action execution, provider diagnostics and full
drilldown surfaces. App architecture keeps only the boundary: user-visible
running, active, queued and attention counts come from framework-projected user
task status, while provider activity, module diagnostics, repo/worktree
diagnostics, stale run ids and assistant cards stay diagnostic-only and cannot
become default running-task sources. Progress and artifact-native drilldown
mapping is owned by `contracts/app-runtime-bridge.json`,
`contracts/app-page-state-matrix.json`, `contracts/app-gui-product-contract.json`,
active-shell validation and release-boundary tests. The App displays refs-only
runtime projections and cannot read artifact bodies, own artifact authority, or
turn runtime refs into domain quality, export, readiness, App release or family
production claims.

Domain-owned work-item detail views use the same authority split. Fast App state
may carry only bounded `domain_detail_views[]` descriptors and user-facing
summaries. A selected item may then read one typed view through
`opl app view read --item-id ... --view-id ... [--if-generation ...] --json`.
The Framework resolves only descriptor-declared refs inside the owning workspace;
the App and Shell never submit paths, scan Markdown or Codex sessions, or infer a
domain verdict. Renderers are selected by `view_kind`, not by a first-party agent
id. `scientific_reasoning_map` is the first registered view kind, but it does not
make MAS a hard-coded App dependency.

OPL App is the local-first workbench for One Person Lab. The current required
surfaces are the macOS desktop App and U1-05 Docker/WebUI on Linux, Windows, a
server, or a cloud VM. They keep the same project, task, artifact, progress, and
receipt language. Hosted OPL Workspace is X0-03 and appears only after account,
storage, isolation, backend, and owner policy exist; it is not a current ordinary
App requirement or default release gate.

OPL App and Docker/WebUI present the same chat-first product model and consume
the same Framework state/action contracts. A conditionally retained OPL Workspace may add hosted URL, account,
isolation, storage volume, and managed-resource receipts, and the user still
sees the same App task flow: choose the work, confirm the resource plan when
needed, run the task, review artifacts and receipts, and continue. When a real
X0-04 owner/backend exists, OPL Console may manage organization policy, users, quota, billing, Workspace lifecycle,
connector approval, environment policy, and managed resource packages for
Console-managed resources. User-provided local, SSH, or HPC resources remain
self-managed unless Framework projections explicitly mark them as
Console-managed.

OPL Fabric is an X0-04 retained resource reference, not an ordinary Settings
top-level product or required App layer. When a real owner/backend exists it appears as refs-only
resource context: OPL Gateway for AI access, OPL Connect for connector
readiness, OPL Compute for local/remote/managed execution, Storage refs for
where work lands, and Environment Catalog refs for template, version, source,
and task fit. The user-facing flow is plan, approve, execute, monitor, collect,
and receipt. The App may display those refs and call `opl app action`; it does
not own compute scheduling, storage authority, connector credentials,
environment bodies, billing, or Console policy truth.

The App runtime/resource/task/data-lifecycle split is kept in one owner matrix
instead of a new control layer. `contracts/app-runtime-bridge.json#runtime_surface_owner_matrix`
binds OPL Runtime Payload / Fabric, Environment Materializer, WorkItemProjection v2,
legacy/current-task TaskRunProjection v2, OPL
Fabric resource refs, local data lifecycle, the active shell, and Homebrew into
their owner roles. The matrix is deliberately narrow: App owns product policy
and release gates, OPL Framework owns family projections and runtime receipts,
Aion renders, and Homebrew mirrors release cohorts only. New runtime/resource
surfaces should extend that matrix and the existing projection contracts before
adding any shell-local task store, resource state machine, cleanup authority, or
distribution currentness gate.

The retained X0-01 Runtime route is WorkItemProjection v2 first when explicitly enabled. OPL Framework joins
canonical agent/project/work-item inventory with lifecycle, execution, attention,
telemetry, conditions, freshness, and action facts before the App or Shell sees
them. Agent availability is a separate projection and cannot define project or
work-item status. Scope is a strict Agent -> Project cascade; work items remain
rows, not scope options. The ordinary list has four semantic columns and one row
per canonical work item. Shells may filter and render those records, but cannot
guess identity, derive user status, heuristically deduplicate bindings, estimate
Token usage, or convert missing telemetry into zero.

Work-item detail opens with Stage Map, current/next stage, running/heartbeat,
current-stage and total Token, and action. Artifact/timeline refs are secondary;
raw refs, IDs, logs and provider diagnostics are diagnostic-only. System
attention requires a complete, current responsibility envelope that still
blocks execution. Product contract, Framework producer, Shell consumer, and
live user-path evidence are independent completion dimensions: none may promote
another to complete.

When a selected item advertises `scientific_reasoning_map`, the drawer adds only
a concise research summary and a route-map button. The full graph lives at the
item-scoped `/runtime/item/:itemId/insights/:viewId` route, where the main canvas
shows the research trajectory and the right inspector explains the selected
research object. User copy is written for medical researchers: current primary
hypothesis, validation method, principal finding, evidence assessment, route
adjustment, next research step, and a collapsed Sources and rationale section.
Machine fields such as generation, digest, ref, payload, provider, or attempt are
never user-facing.

The scientific reasoning payload keeps accepted and working research states
separate. Receipt-bound nodes, edges, and summary fields form the accepted
trajectory. Running checkpoints may appear in a distinct "awaiting confirmation"
section, but they cannot alter the accepted graph or be presented as formal
research conclusions until the domain owner accepts them.
For `scientific-reasoning-map.v2`, the current-route mode uses the domain-owned
`active_branch_node_refs` set exactly; only the v1 compatibility reader may fall
back to node branch labels. The App and Shell do not infer v2 route membership.
The accepted map remains the primary content and precedes the separate working
checkpoint section so pending or rejected records cannot visually displace it.

Claude Science-style task awareness lands first in conversation current-task
context and the right inspector rather than as a new dashboard. The optional
X0-01 Runtime route may show the cross-project slice of the same `opl app state`
projection, but core current-task behavior does not depend on it. Artifact provenance, reviewer receipts, reusable
workflow refs, connector readiness, and reproducibility export actions are
Framework/domain refs consumed through App contracts. Temporal workflow,
activity, worker, queue, attempt, and Search Attribute details remain
diagnostic substrate fields and must not become the ordinary user task model.
The active shell's role is a thin renderer over App state/profile and App action
routes, not reviewer logic, artifact-body access, readiness judgment, or a
shell-owned runtime store. The historical landing reference is
`docs/product/gui/claude-science-runtime-task-awareness-plan.md`.

The upstream AionUI Team surface is not an OPL ordinary-user capability. It is
configured around shell-local team leaders and agents, so the active shell keeps
Team mode disabled, hides the Team sidebar entry, rejects Team deep links, and
redirects any compatible `/team/*` route back to the App-owned home path. This is
independent from Codex subagents: delegated execution, metadata intake, and canonical
thread discovery already use the Codex runtime plus the single existing App Server
adapter; ordinary Active/Done/detail/open-thread UI remains partial. No shell may
add a second App Server client, Team store, scheduler, or execution authority.

Active shell upgrades now carry an App-owned upstream intake ledger in
`contracts/app-shell-adapter.json#upstream_intake`. Each upstream feature must be
classified as `accepted`, `rejected`, `redirected`, or `requires_app_contract`
before it can ride a release. AionUI Team is classified `rejected` for ordinary
surfaces. The corresponding `implementation_probes` are required release gates:
Team mode disabled, `/team` route redirect, sidebar gate, Team-created redirect
no-op, ordinary conversation Team MCP snapshot scrub, agent switching without
Team MCP inheritance, Team deep-link rejection, and IPC bridge mutation
rejection before HTTP. Ordinary capability MCP filtering is executable data in
the GUI contract and product profile through `forbidden_mcp_matchers` and
`scrub_extra_keys`, not example text.

Live bridge conformance is intentionally opt-in. `validate-active-shell.ts
--quick` validates the App-owned bridge contract by default. When
`OPL_APP_LIVE_CONFORMANCE=1`, `OPL_APP_LIVE_OPL_ROOT` points at a local OPL
Framework checkout, and `OPL_APP_LIVE_ACTION_FIXTURE` names a safe action id,
the same validation runs `./bin/opl app state --profile fast --json`,
`./bin/opl app state --profile full --json`, and `./bin/opl app action execute
--action <fixture> --dry-run --json`. The live check only asserts JSON
availability, fast output below 500KB, and `opl_app_state.v1` schema/surface; it
does not import Framework runtime state or domain truth into the App repo.

The active shell is an external checkout and an implementation carrier. `contracts/app-shell-adapter.json` requires the shell to implement the App GUI contract and declares that upstream AionUI behavior is implementation material only, never App product authority. Root release and validation scripts prepare App-owned payloads and call shell build/test commands, but shell implementation changes belong in `gaofeng21cn/opl-aion-shell` unless the App contract or wrapper itself changes.

GUI operation has two independent axes. The **active release shell** chooses the
stable/nightly implementation carrier and remains owned by
`contracts/app-shell-adapter.json`. A **local GUI launch target** chooses which
installed or developer GUI client to open for one local run; it does not mutate
the active adapter, release role, updater channel, or adoption state. The canonical
operating policy and landing route live in
`docs/product/gui/gui-shell-candidates.md` and
`contracts/app-shell-candidates.json#interactive_launcher_policy`.

```text
App contracts / product profile
  -> local GUI launcher -> AionUI client
                        -> OPL Native Workbench client
  -> App runtime bridge -> OPL Framework state/action
  -> typed host bridge  -> Codex App Server thread/turn authority
```

The clients share this logical control plane, not a renderer dependency tree or
private data store. GUI frameworks, lockfiles, bundles, window state, local cache,
and updater identity remain isolated. Codex thread history remains App Server
authority; GUI-local SQLite/localStorage may hold preferences, drafts, or
rebuildable cache only and must not become cross-shell thread truth. Physical
Runtime parity also requires both clients to resolve the same OPL/Codex cohort and
emit path/version/cohort readback. The App-root launcher now injects that identity
for Native Candidate launches; active AionUI parity and direct Native bundle
launches remain current deviations. Side-by-side installation and sequential launch selection
therefore do not imply safe simultaneous writes to one workspace or thread.

Shell alternatives are intentionally separated from the default release adapter while still remaining selectable for explicit technical verification builds. `contracts/app-shell-candidates.json` declares `opl-native-workbench` as the foreground alternative, with its adapter under `contracts/shell-adapters/opl-native-workbench.json`. The default `contracts/app-shell-adapter.json` continues to define the stable AionUI release shell. Hermes Desktop / `hermes-codex` is retained as the prior foreground alternative reference with its explicit adapter under `contracts/shell-adapters/hermes-codex.json`; its source/package/smoke evidence remains technical verification evidence until a later App-owned adoption decision changes the active-shell contract. `agui-codex` is now an archived AG-UI/CopilotKit technical proof: it remains replayable through its explicit adapter only when AGUI is requested, but it is not a routine candidate lane and should not receive default polish or feature work. The OPL Native Workbench route is the new shell-agnostic route for direct App state/action consumption, shared desktop/WebUI renderer shape, and K-Dense-style delivery experience without importing external runtime authority. The Hermes route remains upstream-first OPL customization reference material: later Hermes replay should record the upstream ref, compare official Hermes Desktop features, reapply the smallest OPL delta, and only then decide what to hide, rename, replace, or elevate through App-owned gates. Hermes must not inherit AionUI/AGUI stable payload, page-state, Full runtime, or WebUI assumptions until a Hermes-native feature comparison records what should be preserved, replaced, or hidden.

Hermes 的 first-run 是一个例外的最低可用性要求：可以复用 Hermes Desktop 的
onboarding/progress UI module，但行为 owner 必须是 OPL App/OPL CLI，不能默认
下载或执行 Hermes Agent installer。候选包启动路径必须分成四条线：每次 launch
只做轻量检查 marker、One Person Lab CLI、Codex CLI、可用 Codex 模型访问和 Codex
adapter startup；只有 marker 缺失、marker 过旧或核心组件缺失时才进入一次性本机
初始化 checklist；完全没有可用模型访问时进入“OPL Gateway”向导，通过
`opl system configure-codex --api-key-stdin --json` 写入 OPL Gateway 访问密钥。已有
Codex/OpenAI 登录或其它可用 provider 时可跳过首启 Gateway 配置，Settings 保留
OPL Gateway 配置入口用于后续切换；`opl system initialize --json`、
`opl system startup-maintenance --json`、`opl packages update --json`、
MAS/MAG/RCA 状态和 contract diagnostics 在 OPL Codex adapter ready、主界面可见后
后台异步执行，不能阻塞热启动进入主界面。如果 `setup.status` 已显示 Codex 模型访问
配置存在，则直接进入 OPL Codex adapter，不等待 `setup.runtime_check`，也不把
runtime 超时作为普通用户首启主错误。Hermes candidate 的 macOS 图标也属于最低可用性边界：
Dock 中必须使用 OPL/AionUI 官方图标族，并保留安全边距，当前 contract 要求 alpha
bounds 不超过 900px，目标资源为 `840x840+92+92`。

A candidate enters App product truth only through App-owned contract updates and validation gates; implementation roadmaps and candidate package evidence remain technical verification until an explicit active-shell adoption decision changes `contracts/app-shell-adapter.json`. A candidate becomes the default release shell only when `contracts/app-shell-adapter.json` is updated deliberately and the runtime bridge remains satisfied, App product profile syncs into its configured target, App page-state and first-run matrices pass, shared desktop/WebUI evidence passes when claimed, App-root active-shell validation passes, GUI package compile succeeds through the App wrapper, and the external checkout history policy is preserved.

WebUI is a delivery surface for the same chat-first App UI, not a second product
authority. A candidate that claims WebUI support must use the same App-owned
product semantics as its desktop shell, preserve the App-owned
`window.oplCandidate` API shape or an explicitly equivalent browser bridge, and
route browser actions/events through a local transport bridge to Codex app-server
and `opl app state/action`. Renderer technology is candidate-specific: AGUI's
React/CopilotKit shared renderer belongs only to explicit AGUI archived-proof
replay, while Hermes WebUI support must be claimed and validated through the
Hermes candidate route before it can count as foreground-alternative evidence.
Electron may use native preload/IPC and native directory picking; browser WebUI
may use HTTP actions and SSE event streams. Neither path may introduce a
separate product profile, runtime truth source, provider selector, memory body
store, artifact authority, release channel, or full workbench first screen;
ordinary WebUI home uses the same default-collapsed chat canvas as desktop.

External agent UI projects can also be recorded as design references without
becoming shell candidates or first-screen product templates. OpenBMB PilotDeck is
currently in that class: its workspace/project rail, chat-first main pane,
grouped files, memory, routing, and always-on context are useful
information-organization references for OPL. OPL maps that reference into a
Codex App-style chat-first surface whose workspace/session rail and right-side
contextual tabs are available only as optional expanded context. Its AGPL-3.0 source, gateway, agent
runtime, memory store, router, always-on store, provider selection, and
WorkSpace state model do not enter App authority. Any future use beyond
reference requires a separate license decision and a normal
`shells/<candidate>` external checkout plus adapter contract, App-owned
state/action bridge, page-state/first-run gates, `.app` package verification,
and release isolation.
