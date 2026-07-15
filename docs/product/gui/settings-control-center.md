# Settings Control Center

State: active product authority
Owner: one-person-lab-app
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

These contracts own the ten ordinary product pages, About as the only
secondary page, compatibility redirects, Settings search, page experience and
DOM requirements, and the bounded-card visual grammar. They do not own runtime
truth, provider implementation, domain truth, release readiness, installed App
currentness, or owner acceptance.

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

Product page ids express product semantics. Carrier route ids remain stable
adapter ids.

| Product page | Chinese label | Carrier route | Path | Scope |
| --- | --- | --- | --- | --- |
| `overview` | 概览 | `general` | `/settings/general` | ordinary |
| `gateway` | 账户与 Gateway | `gateway` | `/settings/gateway` | ordinary |
| `models` | 模型 | `access` | `/settings/access` | ordinary |
| `workspace` | 工作区与个性化 | `workspace` | `/settings/workspace` | ordinary |
| `agents` | 智能体 | `agents` | `/settings/agents` | ordinary |
| `capabilities` | 能力 | `capabilities` | `/settings/capabilities` | ordinary |
| `resources` | 资源与连接 | `resources` | `/settings/resources` | ordinary |
| `maintenance` | 维护 | `environment` | `/settings/environment` | ordinary |
| `storage` | 数据与存储 | `storage` | `/settings/storage` | ordinary |
| `preferences` | 偏好 | `appearance` | `/settings/appearance` | ordinary |
| `about` | 关于 | `about` | `/settings/about` | secondary |

About is the only independent secondary page. Advanced is retired as a product
page and remains only as a compatibility route to Maintenance diagnostics.

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
| Who is connected to OPL Gateway and what account, usage, Key, or credential state applies? | Account & Gateway | Overview: signed-in identity, connection and availability, plus compact today token, cost, and balance summary. Models: access-source summary and owner link. | Full account card, total historical usage or cost, login, Key lifecycle, refresh, or disconnect outside Gateway. |
| Which model source, default model, and reasoning preference apply? | Models | Overview: overall model-access readiness. | Gateway account and credential controls on Models. |
| Which workspace is active and writable, where are App logs stored, and what user instructions apply? | Workspace & Personalization | Overview may count an actionable exception. Storage may link to the resolved log path read-only. | Framework/raw paths, Storage-owned log configuration, Preferences-owned personalization, or four separate normal-state cards. |
| Which Agents are installed and which source is active? | Agents | Home may show an active Agent shortcut. | Skills/Plugins or a separate Developer Profile page. |
| Which Skills and Plugins are available? | Capabilities | Agent dependency readiness may link here. | A hardcoded Flow list or AionUI-native assistants presented as OPL capabilities. |
| Which external resources and connections are available? | Resources & Connections | Other pages may link to a resource. | Built-in OPL Gateway connection or Gateway count; selected local workspace controls. |
| Which managed dependencies, updates, and raw Framework paths need attention? | Maintenance | Models may show the active Codex CLI version. | Update controls on Models, raw paths on Workspace, or a separate Advanced page. |
| How much local and Docker data is used, and what can be cleaned safely? | Data & Storage | Maintenance may link to cleanup attention; the Workspace-owned log path may be referenced read-only. | Log-directory configuration or generic Docker prune. |
| How should the App behave and look? | Preferences | Theme legacy routes redirect here. | Workspace paths, user instructions, or OPL App context. |

## Visual Contract

Settings keeps the OPL bounded-card control-center structure while using the
shared Codex-aligned typography, color, radius, spacing, icon, and interaction
baseline. Quiet and scannable describe the tone; they do not turn complex OPL
controls into a page-wide list wall or nested cards.

- the compact footer always shows the connected Gateway display name, otherwise
  Settings; it opens Account & Gateway or Overview;
- only a confirmed newer App version adds a subtle trailing update action on
  that same account row; the footer has no theme, return, or help shortcut;
- Preferences exposes System, Light, and Dark only; the CSS theme gallery and
  custom editor are hidden, while legacy theme data is preserved but inactive;
- the governed OPL visual baseline remains active in all three appearance modes;
- maximum radius is 8 px, spacing follows 12 / 16 / 24 px, and letter spacing is
  0;
- raw diagnostics stay out of ordinary pages and open only through an explicit
  Diagnostics action.

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
- an impact-ordered exception queue;
- one next useful action.

It does not show the full Gateway account card, total historical usage or cost,
managed Key detail, login or connection-management controls, workspace path, a
copy of every Settings page, or a second technical summary. Necessary direct
Codex and Gateway technical rows appear once; raw paths, receipts, payloads, and
owner-page diagnostics stay on their owner pages.

### Account & Gateway

Account & Gateway is the single owner for:

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

When credentials need attention it exposes one route to Account & Gateway. It
does not show the Gateway account card, balance, usage, login form, manual Key
form, managed Key lifecycle, raw provider paths, or Codex CLI update controls.

### Workspace & Personalization

Workspace & Personalization shows the active workspace identity, resolved path,
and writability once in one normal-state summary. Permission or trust detail
appears only when attention is required. Filesystem health and writability
override executor permission mode when deciding usability.

The same page owns the desktop App log directory, the user-level
`$CODEX_HOME/AGENTS.md` editor, and the OPL App new-conversation context. Log
changes use the dedicated typed `application.setLogDirectory { path }` action.
The host persists `hostLogDir` before switching the live writer; if the switch
fails it rolls the persisted value back and returns a typed failure. The success
directory value is only `hostLogDir`, `cacheDir` and `workDir` remain unchanged,
and `application.systemInfo.logDir` provides readback. In WebUI, `/data/logs` is a read-only
projection of the existing host `OnePersonLab/data -> /data` mount; Settings
never rewires that Docker volume. Framework and raw working paths remain in
Maintenance diagnostics.

### Agents

Agents is the runnable public Agent Package directory. Its collection is
exactly `app_state.agent_packages.directory.entries`: every projected entry is
shown, including uninstalled packages, OPL Meta Agent, all first-party
packages, Framework capability packages, and workflow profiles. The static
`professional_agent_packages` profile is an optional `package_id`-keyed UI
metadata overlay only. It cannot seed or filter the collection and cannot own
installation, activation, readiness, status, source, or actions.

The page has its own package-catalog search, separate from Settings global
search, across display name, package id, description, tags, and publisher. The
ordinary filters are package role, install or activation status, and source.
Registry refresh is a visible ordinary action; direct manifest URL installation
stays in the Agents page's advanced install entry. Loading, refreshing, empty, stale, and failed catalog states
remain explicit instead of falling back to the static profile.

Each row renders identity, role, publisher, source explanation, versions,
trust, installability, readiness, and the Framework-projected recommended
action. Install, activate, update, repair, enable, disable, hide, unhide, and
uninstall execute only the projected `available_actions[]` or object
`recommended_action_ref`. Every action object has exactly `action_id`,
`action_ref`, `payload`, `required_payload_fields`, and
`confirmation_required`; the scalar `recommended_action` is descriptive and is
never an action-payload source. The shell does not synthesize enabled state,
reason codes, action ids, payload fields, or ready/synced/available labels.

Workspace activation uses `{ package_id, scope: "workspace",
target_workspace }`, with `target_workspace` read from
`app_state.paths.workspace_root_path`. When no Workspace is configured, the
action is disabled with `workspace_root_not_configured` and routes to
`/settings/workspace#workspace`. After a successful install or activation, the
page refreshes fast App state and renders the next projected action.

Fast state deliberately reports an activated package as
`readiness.status=verification_deferred`,
`verification_deferred=true`, `operational_ready=false`,
`launch_allowed=false`, and `reason=live_verification_deferred`; only a full
verified read may present verified `ready`. Manifest, receipt, physical
surface, conditions, and failure diagnostics stay in the detail panel rather
than becoming invented top-level fast-directory fields. Skills and Plugins do
not appear here.

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

Agent display verification also covers Chinese names, developer-source state,
and the product-profile default visibility of OPL Meta Agent. Those values come
from the generated product profile and Framework projection, not shell-local
hardcoding.

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

### Resources & Connections

Resources shows local browser access, WebUI, OPL Workspace, SSH/HPC, cloud,
Fabric, Console-managed refs, and user-managed external connections when
projected. The built-in OPL Gateway connection and its count are always
filtered out because Gateway owns them.

Read-only Open navigates to the exact `browser_url`; Diagnose executes the
projected diagnose action and displays its result. Mutations require a
successful precheck, explicit confirmation, execution, and visible result or
receipt. Dry-run success proves only precheck success.

### Maintenance

Maintenance leads with health, managed dependencies, updates, services,
packages, and one recommended action. The primary surface always includes:

- active Codex CLI;
- OPL-managed Temporal JavaScript Runtime;
- optional system Temporal CLI;
- version, source/owner, currentness, and applicable update guidance for each.

OPL-managed roots may update silently through their owner. Reliably identified
external installs may offer an explicitly confirmed delegated update. Unknown
or unsupported owners receive detection and guidance only. OPL never silently
overwrites Homebrew, npm, PATH, or system installs. The Temporal JavaScript
runtime moves with the OPL Base generation; the optional Temporal CLI remains
external unless explicitly managed by its owner.

Update channel is the one inline persistent control. Apply, repair, rollback,
package sync, and other commands live in an explicit management modal.
Framework paths, raw working directories, ids, command mappings, receipts, and
payloads live only in read-only Maintenance diagnostics. Retired Advanced
routes here.

### Data & Storage

Storage renders the last persisted inventory snapshot immediately. If no
snapshot exists it shows a loading placeholder, never synthetic `0 B`. Each
snapshot exposes `observed_at`, `scan_duration_ms`, and `stale`.

A delayed startup scan, TTL refresh, and manual force refresh run in the
background. Completion publishes
`local-data-lifecycle.inventory-updated`; the page updates without requiring
re-entry. Large roots do not use recursive long-lived filesystem watches.

Storage may show the resolved Workspace-owned log path only as a read-only
reference. Cleanup uses preview then confirmation; zero-byte categories show
nothing to clean and no action. Archive requires a receipt before delete, and
restore never overwrites an existing conversation without an explicit collision
decision. Docker usage follows the existing `OnePersonLab/data -> /data` mount
and does not expose generic prune or volume-rewire controls.

### Preferences

Preferences owns application behavior, notifications, performance and waiting,
display, fonts, and themes. Theme remains an anchor rather than an independent
page. User instructions and OPL App context stay on Workspace & Personalization
so paths and personalization are not duplicated across pages.

### About

About shows App version, Stable or Nightly channel, cached update status, and
one Check for updates action. The App performs one update check after startup
and publishes it to a shared main-process updater state store. Mounting or
navigating to About only reads that state and never starts a check. The manual
button refreshes the same shared state.

Shell version, Framework revision, build ids, and raw update refs stay in
technical details. Repair, rollback, package maintenance, and storage cleanup
remain on their owner pages.

## Search, Visual, And DOM Contract

Settings exposes exactly one bilingual item-level search input,
`settings-search-input`. Results use `{page_label} > {entry_label}`, navigate to
the owner carrier route, and focus the declared anchor. Duplicate Settings
search inputs are forbidden.

Settings preserves the OPL bounded-card baseline:

- one card answers one user question and contains flat rows;
- no nested cards, page-wide list wall, or floating dashboard sections;
- two to four first-viewport groups where the page density supports them;
- responsive desktop grid and mobile stack;
- 28 px icon slots, compact type, 8 px maximum radius, 12/16/24 spacing, and 0
  letter spacing;
- normal, warning, error, and action use muted, orange, red, and brand
  semantics;
- one selected sidebar item and at most one page primary action;
- the compact footer opens Account & Gateway when an account is connected, or
  Overview/Settings otherwise, and keeps the theme switcher after it;
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

Contract and focused tests prove only their App-owned slices. Shell acceptance
also requires:

- ten ordinary routes, About as the only secondary page, and every redirect;
- Gateway single ownership and Resources filtering;
- Agents Chinese/source/OMA defaults and Developer Mode effective-state
  readback;
- non-empty Flow-managed capability projection, third-party naming, and
  AionUI-native ownership routing;
- visible managed Codex/Temporal currentness and external-install guidance;
- persisted Storage snapshot, freshness, background event, manual refresh, and
  unknown-not-zero behavior;
- one startup update check, shared updater state, and no About mount check;
- all required DOM, anchors, search behavior, responsive layout, and fresh
  desktop/mobile screenshots without overlap.

These checks do not prove package installation, runtime currentness, release
promotion, or owner acceptance. Those remain separate release-owner gates.
