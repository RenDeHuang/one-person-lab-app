# Settings Control Center

Owner: `one-person-lab-app`
Purpose: `settings_control_center_product_authority`
State: `active_product_authority`
Machine boundary: 本文解释 Settings 的产品职责与信息架构。机器真相归
`contracts/app-settings-control-plane.json`、App GUI/page-state contracts、validators、
Shell source/tests 与 installed evidence；本文不拥有 Framework runtime 或 domain truth。
Machine contract: `contracts/app-settings-control-plane.json`
GUI product contract: `contracts/app-gui-product-contract.json#settings_navigation`
Page-state contract: `contracts/app-page-state-matrix.json#pages`

## Product Boundary

Settings is the App-owned OPL Control Center. The active shell is an
implementation carrier. It must not infer navigation, page ownership, search,
readiness, or update behavior from upstream AionUI defaults.

The root design rule is **one user question, one owner page**:

- Overview summarizes overall usability and links to the owner page. It does
  not become a second account, model, workspace, or diagnostics page.
- A non-owner page may show a compact status needed for its own decision and a
  link to the owner. It may not repeat the owner's details or controls.
- Configuration, status, one-time actions, and diagnostics remain distinct.
  Moving a control into a technical-details disclosure does not change its
  surface type.
- Fast state is for immediate rendering. Expensive checks run at startup, in
  the background, or after an explicit user action; navigating to a page does
  not silently start them.

These contracts own seven user-visible primary groups over ten stable carrier
routes, About as the bottom auxiliary page, compatibility redirects, Settings
search, page experience and DOM requirements, and the Codex quiet visual grammar.
They do not own runtime truth, provider implementation, domain truth, release
readiness, installed App currentness, or owner acceptance.

## Startup Performance Boundary

The first interactive Settings window renders from a persisted narrow snapshot
or a stable loading shell. It never waits for the complete
`opl app state --profile fast --json` payload or for page drilldowns. The full
fast projection refreshes once in the background and is shared across routes;
opening another Settings page does not restart the global read.

The contract budgets both cold and warm first-window readiness at 1,500 ms and
the startup projection at 262,144 bytes. Agents, Capabilities, Storage, and
About drilldowns load only when their owner page needs them. These are source
and test budgets, not installed-App evidence: after owner absorption and
packaging, release acceptance still requires real launch-to-first-window and
Settings-readiness timing against the exact installed cohort.

## Configuration Catalog

Settings projects one catalog from three owner classes; it does not create a
second state database.

| Owner class | Truth and persistence owner | Examples | App responsibility |
| --- | --- | --- | --- |
| `framework` | OPL Framework | workspace root, update channel, developer supervisor, Home visibility | Place the item and call the Framework action. Never copy its current value or redefine action metadata. |
| `app_local` | Desktop App or shell adapter | model and reasoning preference, App log directory, window behavior, notifications, fonts, scale, theme | Reuse the existing App store or bridge and provide local readback. |
| `credential_connection` | Gateway, credential, remote-access, or OPL Connect owner | Gateway account, manual API Key, external connections | Display redacted readiness or handles and delegate writes. Secret bodies never enter contracts, App state, logs, or generic action JSON. |

Every item has one stable id, page, anchor, truth owner, write route,
persistence target, and verification route. Framework values come from
`app_state.settings_control_center.configuration_catalog.items` and typed
host-owned metadata comes from
`app_state.settings_control_center.configuration_catalog.host_owned_configuration_surfaces`;
user-managed
connections come from
`app_state.settings_control_center.connection_registry`.

AionUI custom assistants remain outside the OPL product catalog. Hiding their
entry does not authorize deletion of AionUI-owned data.

## Canonical Information Architecture

`settings_navigation.settings_ia` owns the visible hierarchy. Product groups express
user intent; carrier route ids remain stable adapter identities.

| Primary group | Second-level destinations | Carrier route / anchor |
| --- | --- | --- |
| 概览 | 概览 | `general` |
| 账户与模型 | 账户与访问；模型 | `gateway`; `access` |
| 连接与部署 | 资源与连接 | `resources` |
| 工作区 | 工作目录；数据与存储 | `workspace#current-workspace`; `storage` |
| 智能体与能力 | 智能体；能力；指令与上下文 | `agents`; `capabilities`; `workspace#personalization` |
| 运行与维护 | 服务状态；更新与修复；日志与诊断 | `environment#services`; `environment#updates`; `environment#diagnostics` |
| 偏好 | 偏好 | `appearance` |

“关于”是七组之外唯一的侧栏底部辅助入口。Advanced 退役并重定向到维护诊断。桌面端展开
当前一级组后显示二级目的地；移动端先显示纵向分类列表，再进入带可见返回控件的二级列表，
禁止把十个 carrier route 平铺成横向 tab strip。

工作区只组织工作目录、权限、项目/任务产物位置和数据存储。用户级 `AGENTS.md` 与新对话附加说明
归“智能体与能力 > 指令与上下文”；App 日志目录、服务证据和技术诊断归“运行与维护 > 日志与诊断”。
资源、外部连接与部署入口只归“连接与部署”，不再借用“账户与模型”的语义。现有 route、anchor
和 typed host action 继续作为兼容 transport，但不得反向定义可见归属。

## Redirects

Compatibility routes resolve before rendering and focus the owner anchor:

| Source | Owner target | Anchor |
| --- | --- | --- |
| `/settings/update` | `/settings/environment` | `updates` |
| `/settings/theme` | `/settings/appearance` | `themes` |
| `/settings/local-services` | `/settings/environment` | `services` |
| `/settings/personalization` | `/settings/workspace` | `personalization` |

The hash-router adapter transports the anchor as `section=<anchor>` and then
focuses the programmatically focusable section. It must not append a second URL
fragment.

Legacy `/settings/advanced` and `system` resolve to
`/settings/environment?section=diagnostics`. They never mount or select an
Advanced sidebar item. About is never redirected through Advanced.

## Surface Model

Every page declares all four inventories, including empty arrays:

1. **Configuration** is a persisted preference. A one-time command is never a
   configuration item.
2. **Status** is read-only evidence inside its owner group. Pure readiness,
   path, count, or permission state is not a standalone card.
3. **Action** is an explicit command such as open, check, update, repair,
   cleanup, archive, or restore. It remains adjacent to its object and keeps
   confirmation, progress, and receipt boundaries.
4. **Diagnostic** contains raw paths, refs, ids, receipts, payloads, or logs.
   It is read-only and opens through an explicit modal or drawer.

The four surfaces may not be mixed to make the layout look simpler. In
particular, repair is not a setting, an update check is not status persistence,
and a path shown in diagnostics is not a second path configuration.

## Ownership Map

| Question | Owner | Allowed summaries elsewhere | Forbidden duplication |
| --- | --- | --- | --- |
| Who is connected to OPL Gateway and what account, usage, Key, or credential state applies? | Account & Access | Overview: signed-in identity, connection and availability, plus compact today token, cost, and balance summary. Models: access-source summary and owner link. | Full account card, total historical usage or cost, login, Key lifecycle, refresh, or disconnect outside Gateway. |
| Which model source, default model, and reasoning preference apply? | Models | Overview: overall model-access readiness. | Gateway account and credential controls on Models. |
| Which workspace is active and writable, and where are project artifacts stored? | Workspace > Working Directory | Overview may count an actionable exception. | User instructions, App logs, Framework/raw paths, or four separate normal-state cards. |
| What global instructions and new-conversation context apply? | Agents & Capabilities > Instructions & Context | The existing Workspace personalization route remains a carrier transport only. | Presenting either editor as a Workspace or Preferences child. |
| Where are App logs and diagnostics, and what needs maintenance? | Runtime & Maintenance > Logs & Diagnostics | Storage may link to the resolved log path read-only. | Presenting logs under Workspace or duplicating the log-directory setting in Storage. |
| Which Agents are installed and which source is active? | Agents | Home may show an active Agent shortcut. | Skills/Plugins or a separate Developer Profile page. |
| Which Skills and Plugins are available? | Capabilities | Agent dependency readiness may link here. | A hardcoded Flow list or AionUI-native assistants presented as OPL capabilities. |
| Which external resources, connections, and deployment entry points are available? | Connections & Deployment > Resources & Connections | Other pages may link to a resource. | Built-in OPL Gateway connection or Gateway count; selected local workspace controls. |
| Are Codex and background services available? | Runtime & Maintenance > Service Status | Overview shows one compact Background tasks summary. | Update controls, log configuration, raw paths, or receipts. |
| Which managed dependencies need updates or repair? | Runtime & Maintenance > Updates & Repair | Models may show the active Codex CLI version. | Service topology, log controls, raw paths on Workspace, or a separate Advanced page. |
| How much local and Docker data is used, where are deployment locations, and what can be cleaned safely? | Data & Storage | Updates & Repair may link to cleanup attention; the Logs & Diagnostics-owned log path may be referenced read-only. | Log-directory configuration, mount rewiring, or generic Docker prune. |
| How should the App behave and look? | Preferences | Theme legacy routes redirect here. | Workspace paths, user instructions, or new-conversation additions. |

## Visual Contract

Settings keeps the OPL information architecture while using the Codex quiet
control-center visual grammar: a single reading lane, white bounded groups,
flat internal rows, monochrome utility icons, and color reserved for typed
status or brand actions. It does not turn complex OPL controls into a page-wide
list wall or nested cards.

- the compact footer always shows the connected Gateway display name, otherwise
  Settings; it opens Account & Access or Overview;
- only a confirmed newer App version adds a subtle trailing update action on
  that same account row; on desktop this reads the same main-process updater
  store as About and Maintenance, while WebUI falls back to the managed
  `opl_app` projection only because no desktop updater exists there; the footer
  has no theme, return, or help shortcut;
- Preferences exposes System, Light, and Dark only; the CSS theme gallery and
  custom editor are hidden, while legacy theme data is preserved but inactive;
- the governed OPL visual baseline remains active in all three appearance modes;
- maximum radius is 8 px, spacing follows 12 / 16 / 24 px, and letter spacing is
  0;
- raw diagnostics stay out of ordinary pages and open only through an explicit
  Diagnostics action.
- Settings 侧栏第一行在搜索框上方提供“返回应用 / Back to app”；展开态显示图标与文字，
  折叠态保留 tooltip 和 accessible name，窄窗口复用标题栏返回并使用同一个非 Settings
  destination resolver。桌面标题栏不得再渲染第二个重复返回按钮。

The App product profile and active Shell generated profile must project the
complete visual-system object. A stale generated profile must not restore the
retired theme gallery, footer toggle, or old account destination.

## Page Contracts

### Overview

Overview answers whether the App is usable, what needs attention, and what the
next useful action is. Its normal first viewport contains:

- one overall usability summary led by Codex CLI and model-access readiness;
- signed-in Gateway identity, connection and availability, plus compact today
  token, cost, and balance summary;
- one persistent **Background tasks** summary derived from explicit Temporal
  server, worker, and scheduler readiness;
- an impact-ordered exception queue;
- one next useful action.

When all required background components are ready, Overview shows one quiet
available row. An unready, unknown, or stale component contributes one item to
the attention queue and links to Service Status. Server, worker, scheduler, and
supervisor details never expand on Overview.

It does not show the full Gateway account card, total historical usage or cost,
managed Key detail, login or connection-management controls, workspace path, a
copy of every Settings page, or a second technical summary. Necessary direct
Codex and Gateway technical rows appear once; raw paths, receipts, payloads, and
owner-page diagnostics stay on their owner pages.

### Account & Access

Account & Access is the single owner for:

- account login and the manual API-key path;
- full public account identity and localized connection state;
- balance, compact token usage, actual cost, managed Key name/status, and local
  freshness time;
- refresh, connection completion or repair when required, and disconnect.

The account card appears only for an account connection. Manual-Key-only and
disconnected states do not render account balance or usage. Passwords use the
typed `loginGatewayAccount` IPC bridge and
`opl connect gateway login --credentials-stdin --json`; they never enter a
generic action payload, App state, logs, errors, receipts, diagnostics, or
renderer persistence.

The renderer may keep only the declared public projection as a derived
last-known-good cache. It shows that cache immediately, refreshes in the
background, preserves it on refresh failure with a stale marker, and replaces
it only after authoritative readback.

### Models

Models owns model-access readiness, the real
`app_state.core.codex.model_access_source`, selected and default model,
reasoning preference for new conversations, and the active Codex CLI version
as an execution prerequisite.

When credentials need attention it exposes one route to Account & Access. It
does not show the Gateway account card, balance, usage, login form, manual Key
form, managed Key lifecycle, raw provider paths, or Codex CLI update controls.

### Workspace

Working Directory shows the active logical workspace identity, resolved path,
and writability once in one normal-state summary. Permission or trust detail
appears only when attention is required. Filesystem health and writability
override executor permission mode when deciding usability.

On Desktop, the Framework-projected workspace action may change the logical
root and must return a fresh readback. Standalone WebUI shows the actual
owner-projected logical root read-only and never executes `workspace_root_set`.
Only after the carrier confirms Docker deployment identity does
`OPL_WORKSPACE_ROOT=/projects` make Settings show `/projects` read-only. Neither
WebUI form changes the host projects bind mount. Changing the standalone root or
Docker host source directory is a host/deployment action outside the browser,
not an in-App workspace setting.

The Workspace carrier route may continue to host the user-level
`$CODEX_HOME/AGENTS.md` editor and OPL App new-conversation context for
compatibility, but visible navigation owns them under Instructions & Context.
It no longer owns or renders the App log-directory control.

### Agents

Agents is the runnable public Agent Package directory. Its collection is
exactly `app_state.agent_packages.directory.entries`: every projected entry is
shown, including uninstalled packages, OPL Meta Agent, all first-party
packages, Framework capability packages, and workflow profiles. The complete
`agent_package_registry.starter_package_metadata` projection is an optional
`package_id`-keyed localized name and description overlay for current first-party
rows only. It cannot seed or filter the collection and cannot own
installation, activation, readiness, status, source, or actions.

The page has its own package-catalog search, separate from Settings global
search, across display name, package id, description, tags, and publisher. The
ordinary filters are package role, availability status, and source.
Registry refresh is a visible ordinary action; direct manifest URL installation
stays in the Agents page's advanced install entry. Loading, refreshing, empty, stale, and failed catalog states
remain explicit instead of falling back to the static profile.

The ordinary catalog is grouped to reduce cognitive load. Professional Agents
follow the App product-metadata order; workflow profiles render in their own
section; role labels are localized product language rather than raw internal
enums. Capability-package hierarchy comes only from
`status_index.packages[].dependent_guard.required_by_package_ids`: a package
with one visible parent nests once under that parent, while multi-parent or
parent-not-visible packages render once under Shared dependencies. The Shell
must not hardcode MAS relationships or duplicate a package row. Runtime-source
and authorized-repository maintenance controls remain available in one
advanced disclosure that is collapsed by default.

Each row renders identity, role, publisher, source explanation, versions,
trust, installability, readiness, and the Framework-projected recommended
action. Install, update, repair, enable, disable, hide, unhide, and uninstall
execute only the projected `available_actions[]` or object
`recommended_action_ref`. Every action object has exactly `action_id`,
`action_ref`, `payload`, `required_payload_fields`, and
`confirmation_required`; the scalar `recommended_action` is descriptive and is
never an action-payload source. The shell does not synthesize enabled state,
reason codes, action ids, payload fields, or ready/synced/available labels.

Settings executes only exact owner-projected non-activation lifecycle actions.
It never shows or executes `agent_package_activate`; new conversation and
ordinary composer send follow the same rule. A selected project directory sets
session cwd and future domain workspace identity only. It is never substituted
for a Stage workspace locator, and a global workspace root is never an
activation target. Framework performs scope activation immediately before a
real domain StageRun or StageAttempt from that stage's `workspace_locator`.
After a successful Settings lifecycle action, the page refreshes fast App state
and renders the next projected action.

Fast state may report an installed package as
`readiness.status=verification_deferred`,
`verification_deferred=true`, `operational_ready=false`,
`launch_allowed=false`, and `reason=live_verification_deferred`; only a full
verified read may present verified `ready`. Manifest, receipt, physical
surface, conditions, and failure diagnostics stay in the detail panel rather
than becoming invented top-level fast-directory fields. Skills and Plugins do
not appear here. Ordinary conversation create/send remains available and never
executes Shell activation; the raw fast flags must not create a second hard
block. Only a genuine installation, enablement, integrity, permission, or owner
failure may locally block the selected package.
普通行不直接显示 `待验证`、`需关注`、`不可使用`、`需要操作` 或 raw readiness flags。
已安装且已暴露的 `verification_deferred` 与 `scope_materialization_missing` 都显示为“可用”，
并说明“已安装，可直接发起对话，无需提前设置”。确实需要用户动作时，必须按 exact owner
action/reason 显示具体状态，例如
“需要安装”“需要启用”“需要更新”“需要修复”或“需要重新连接”，每行最多一个最相关
动作；无法安全本地化时显示“暂时无法使用”并引导打开详情，不使用“完成设置”一类抽象
文案。聚合计数不能覆盖逐项状态，raw status/reason 只进入详情。

五个专业智能体在中文和英文界面都保留品牌名 Med Auto Science、Med Auto Grant、
RedCube AI、OPL Book Forge 与 OPL Meta Agent；中文用途放在 description，不把品牌名改成
泛化角色名。MAS Scholar Skills 是 Med Auto Science 的依赖能力，不冒充第二个科研智能体。

Developer Mode appears here as **允许维护已授权的开发仓库**. The control is
`auto|off`, defaults to `auto`, and is independent from source selection. A
matching developer identity plus successful full repository-authority
inspection automatically activates `developer_apply_safe` for authorized
repositories. Fast state says inspection is pending; it must not invent an
identity mismatch or render empty authority placeholders.

The visible readback includes effective state, configuration source, GitHub
login, authorized repository scope, dirty-worktree and branch protection, and
the inactive reason. Shared runtime mutation still requires
`enabled=on + mode=developer_apply_safe + source=user_config`.

Agent display verification covers localized names and descriptions for every
current first-party row, including OPL Meta Agent, MAS Scholar Skills, and OPL
Flow, plus developer-source state and the product-profile default visibility of
OPL Meta Agent. These values come from the generated product profile and
Framework projection, not shell-local hardcoding. The Chinese OPL Meta Agent
description explicitly explains that it creates, takes over, inspects, and
improves OPL professional Agents.

### Capabilities

Capabilities groups Skills and Plugins by ownership:

- the Flow-managed group is derived from the typed OPL Flow dependency closure
  and must not be empty when that projection contains managed entries;
- third-party groups use product-profile names and never present raw provider
  ids as the main label;
- AionUI-native Skills, tools, assistants, MCP helpers, and image controls stay
  in their declared local/third-party ownership group and do not become
  Flow-managed OPL truth;
- MCP, image generation, and voice input configuration live in the local
  capabilities group; Preferences does not duplicate voice configuration;
- mutations require explicit user action and never write capability truth from
  the renderer.

OPL Meta Agent remains an explicit managed package row with its Home shortcut
visible by default. It does not become a legacy default assistant. AionUI
custom assistants remain outside the OPL surface; legacy `assistants` routes
to the capability directory without deleting AionUI data.

### Connections & Deployment > Resources & Connections

Resources shows current local browser access and WebUI plus user-managed external
connections when projected. Hosted OPL Workspace/cloud is X0-03; SSH/HPC, Fabric,
and Console-managed refs are X0-04. Those conditional rows appear only when a real
backend and owner projection exist, and ordinary Settings must not maintain
placeholder status, scheduling, billing, credential, or execution truth. The
built-in OPL Gateway connection and its count are always filtered out because
Gateway owns them.

Read-only Open navigates to the exact `browser_url`; Diagnose executes the
projected diagnose action and displays its result. Mutations require a
successful precheck, explicit confirmation, execution, and visible result or
receipt. Dry-run success proves only precheck success.

### Runtime & Maintenance

Runtime & Maintenance is one primary group with three independent second-level
destinations. The shared `environment` carrier route uses the destination anchor
to render exactly one ordinary purpose at a time; it must not concatenate the
three destinations into one long “Services & Maintenance” page.

1. **Service Status** (`environment#services`) answers whether Codex and the
   required background services are available now. It starts with one
   availability summary, followed by flat Codex and Temporal server, worker, and
   scheduler rows. Healthy rows stay quiet; only unavailable, stale, or unknown
   components expand their impact and projected start/restart/check action.
   Overview consumes these same component fields but renders only one persistent
   **Background tasks** summary. It never duplicates Temporal topology.
2. **Updates & Repair** (`environment#updates`) answers what is outdated or
   damaged and what the safest next action is. It owns the update channel,
   managed dependency currentness, Desktop App update state, Check, Apply,
   Repair, Rollback, package maintenance, progressive confirmation, progress,
   and fresh readback. Healthy components collapse into a compact summary; at
   most one recommended action is emphasized.
3. **Logs & Diagnostics** (`environment#diagnostics`) answers where App logs are
   stored and which technical evidence can be inspected or copied. On Desktop,
   it reuses `application.setLogDirectory` to open or change the App log root,
   then verifies `application.systemInfo.logDir`. Standalone WebUI shows its
   `application.systemInfo.logDir` projection read-only; Docker WebUI shows
   `/data/logs` only after deployment identity is confirmed. Neither executes
   the Desktop action or rewires the host `/data` bind. Raw component paths,
   shadowed installs, receipts, and diagnostic payloads stay collapsed by
   default and contain no mutation controls.

The active dependency summary includes Codex CLI, the OPL-managed Temporal
JavaScript Runtime, and the optional system Temporal CLI with version,
source/owner, currentness, and applicable update guidance. OPL-managed roots may
update through their owner. Reliably identified external installs require an
explicitly confirmed delegated update; unknown or unsupported owners receive
detection and guidance only. OPL never silently overwrites Homebrew, npm, PATH,
or system installs. The managed Temporal runtime moves with OPL Base; the system
Temporal CLI remains external unless its owner explicitly manages it.

Desktop App currentness comes from the same main-process updater store consumed
by About and the Settings footer. WebUI alone falls back to the Framework-managed
`opl_app` component. `not_checked`, `checking`, `not-available`, `available`,
`downloading`, `downloaded`, `error`, and `cancelled` stay distinct. Service
attention and App-update attention are calculated independently. A historical
receipt may appear only in Logs & Diagnostics and never enables a current Repair
action; without a live repair signal, the primary operation remains Check.

Dependency identity and de-duplication use normalized optional `real_path` first
and fall back to `binary_path`; shadowed paths remain diagnostic detail. Retired
Advanced routes to Logs & Diagnostics. No destination opens a second large
management modal or overlaps it with diagnostics.

### Data & Storage

Storage renders the last persisted inventory snapshot immediately. If no
snapshot exists it shows a loading placeholder, never synthetic `0 B`. Each
snapshot exposes `observed_at`, `scan_duration_ms`, and `stale`.

A delayed startup scan, TTL refresh, and manual force refresh run in the
background. Completion publishes
`local-data-lifecycle.inventory-updated`; the page updates without requiring
re-entry. Large roots do not use recursive long-lived filesystem watches.

Storage may show the resolved Logs & Diagnostics-owned log path only as a
read-only reference. Cleanup uses preview then confirmation; zero-byte
categories show nothing to clean and no action. Archive requires a receipt
before delete, and restore never overwrites an existing conversation without an
explicit collision decision.

For Docker WebUI, and only after Docker deployment identity is confirmed,
Storage adds one read-only deployment-location summary:

- the required host **projects** directory binds to `/projects`; it contains
  project and task artifacts. `OPL_PROJECTS_DIR=/projects` and
  `OPL_WORKSPACE_ROOT=/projects` make this the deployment-managed logical
  workspace root. Working Directory shows `/projects` read-only and cannot
  change the host source path;
- the required host **data** directory binds to `/data`; it contains App data,
  Framework state, Codex Home and session records, and logs including
  `/data/logs`. Settings cannot change or split this bind;
- `/recovery`, selected by `OPL_WEBUI_RECOVERY_DIR=/recovery`, is the container
  recovery/archive staging surface. Host persistence is optional and
  deployment-managed; it is explicitly not a third required host bind.

Changing either host source directory belongs to `compose.yaml` or the
installer. Settings exposes no mount editor, environment mutation, generic
Docker prune, or volume-rewire control.

### Preferences

Preferences owns application behavior, notifications, performance and waiting,
display, fonts, and themes. Theme remains an anchor rather than an independent
page. User instructions and new-conversation additions reuse the Workspace carrier
route but appear only under Instructions & Context in the visible hierarchy.

### About

About shows App version, Stable or Nightly channel, cached update status, and
one Check for updates action. The App performs one update check after startup
and publishes it to a shared main-process updater state store. Mounting or
navigating to About only reads that state and never starts a check. The manual
button refreshes the same shared state.

Maintenance and the compact Settings footer subscribe to that same store rather
than reading a second desktop App-update truth. WebUI uses the managed `opl_app`
projection only as its no-desktop-updater fallback. Mounting any of these
consumer surfaces never starts another automatic check.

Shell version, Framework revision, build ids, and raw update refs stay in
technical details. Repair, rollback, package maintenance, and storage cleanup
remain on their owner pages.

## Search, Visual, And DOM Contract

Settings exposes exactly one bilingual item-level search input,
`settings-search-input`. Results use `{page_label} > {entry_label}`, navigate to
the owner carrier route, and focus the declared anchor. Duplicate Settings
search inputs are forbidden.

Settings preserves OPL IA inside the Codex quiet visual baseline:

- one quiet bounded section answers one user question and contains flat rows;
- no nested cards, page-wide list wall, or floating dashboard sections;
- two to four first-viewport groups where the page density supports them;
- a single desktop reading lane and mobile stack;
- 20 px monochrome icon slots, compact type, 8 px maximum radius, 12/16/24 spacing, and 0
  letter spacing;
- normal, warning, error, and action use muted, orange, red, and brand
  semantics;
- one selected sidebar item and at most one page primary action;
- the compact footer opens Account & Access when an account is connected, or
  Overview/Settings otherwise, without duplicate Settings, theme, return, or
  help shortcuts;
- technical details open explicitly and never hide interactive persistent
  controls.

Every product page renders `settings-page-<product_page_id>` and
`settings-<product_page_id>-primary`. Conditional exception, primary-action,
and technical-details test ids follow the machine contract. Every declared
anchor is a stable, focusable section id.

## State And Action Boundary

Default reads use `opl app state --profile fast --json`. Explicit detail reads
use `opl app state --profile full --json`. Mutations use
`opl app action execute --action <action_id> [--payload <json>] [--dry-run]
--json`.

Mutation-capable surfaces are single-flight. Competing actions and pending
confirmations remain disabled while a read, precheck, mutation, doctor, or
recovery operation is active. Results stay bound to the operation that produced
them.

## AionUI Adapter Boundary

OPL Settings is an App-owned overlay, not an AionUI fork-body redesign.

- App contracts own routes, placement, labels, surface classification, and
  acceptance; Framework catalogs own Framework values and actions.
- Shell integration stays concentrated in Settings host, adapter slot,
  registry, generated profile, locale, and OPL overlay files.
- New upstream Settings or extension entries remain hidden until App intake
  classifies them as accepted, adapted, redirected, or rejected.
- Hiding an entry never deletes extension-owned data.
- Generated profile and locale checks prove they project App truth; they do not
  become a second authority.

## Verification Boundary

Cross-page details are not duplicated here. The shared
`contracts/app-gui-product-contract.json#ui_experience_contract` owns truthful startup
stages, the single-action First Run completion, composer-first Home, and the context
action sheet. The latter keeps every action scroll-reachable at `400x600` using
`100dvh`, safe-area, and virtual-keyboard constraints.

Contract and focused tests prove only their App-owned slices. Shell acceptance
also requires:

- seven primary groups, all ten carrier routes reachable through their declared
  second-level destinations, About as the only secondary page, and every redirect;
- Gateway single ownership and Resources filtering;
- Agents Chinese/source/OMA defaults and Developer Mode effective-state
  readback;
- non-empty Flow-managed capability projection, third-party naming, and
  AionUI-native ownership routing;
- visible managed Codex/Temporal currentness and external-install guidance;
- persisted Storage snapshot, freshness, background event, manual refresh, and
  unknown-not-zero behavior;
- one startup update check, one shared desktop updater state across About,
  Maintenance, and footer, WebUI managed fallback, and no consumer mount check;
- complete App updater states, independent runtime/App-update attention,
  current-only Repair availability, and `real_path`-first dependency identity;
- all required DOM, anchors, search behavior, responsive layout, and fresh
  desktop/mobile screenshots without overlap.

These checks do not prove package installation, runtime currentness, release
promotion, or owner acceptance. Those remain separate release-owner gates.
