# Settings Control Center

State: active product authority
Owner: one-person-lab-app
Machine contract: `contracts/app-settings-control-plane.json`
GUI product contract: `contracts/app-gui-product-contract.json#settings_navigation`
Page-state contract: `contracts/app-page-state-matrix.json#pages`

## Product Boundary

Settings is the App-owned OPL Control Center. The active shell is an
implementation carrier and must not derive product navigation, page meaning,
search behavior, or readiness claims from upstream AionUI defaults.

These contracts own:

- the ten ordinary product pages;
- the two secondary product pages;
- compatibility redirect targets and anchors;
- the single Settings search index;
- each page's primary information, primary action, exception state, technical
  detail boundary, required DOM, anchors, and search entries;
- the established OPL bounded-card visual grammar for Settings.

They do not own runtime truth, provider implementation, domain truth, release
readiness, installed App currentness, or owner acceptance.

## Configuration Catalog

Settings presents one product catalog assembled from three owner classes. This
is a projection protocol, not a second runtime database:

| Owner class | Truth and persistence owner | Examples | App responsibility |
| --- | --- | --- | --- |
| `framework` | OPL Framework | workspace root, update channel, developer supervisor, capability Home visibility | Place the Framework item on the correct page and invoke the action exposed by the Framework catalog. Do not copy its current value or redefine its action metadata. |
| `app_local` | Desktop App or active-shell adapter | model and reasoning preference, startup/window behavior, keep-awake, notifications, upload/Office behavior, fonts, scale and theme | Use the existing App store or bridge and provide local readback. Do not create a second Settings store. |
| `credential_connection` | Credential, Gateway, remote-access or OPL Connect owner | Codex/Gateway access, remote access and external connections | Display redacted readiness or a credential handle and delegate writes to the owner. Secret bodies never enter the App contract, App state, logs or generic action JSON. |

Every item has one stable id, one page and anchor, one truth owner, one write
route, one persistence target and one verification route. Framework items are
read from
`app_state.settings_control_center.configuration_catalog.items`; managed
connections are read from
`app_state.settings_control_center.connection_registry`. The App contract owns
placement and user meaning only.

The catalog closes the current product gaps without broad AionUI fork-body
rewrites:

- model and reasoning selections use the existing Codex client setting;
- update checks consume the Framework `stable|preview` preference through one
  updater-channel mapping;
- the existing keep-awake bridge becomes reachable from Preferences;
- a valid conversation archive receipt can be restored after reopening the
  Storage page without weakening archive-before-delete;
- OPL Connect gains a handle-only connection registry with create, edit, test,
  default and delete actions;
- Resources & Connections renders that registry through the existing OPL App
  state/action bridge.

AionUI custom assistants remain outside this catalog because they are not an
adopted OPL App product capability. Hiding their entry does not authorize
deleting the underlying AionUI data.

## Canonical Information Architecture

Product page ids are stable product semantics. Carrier route ids remain stable
implementation ids so the shell can migrate without changing user-facing IA.

| Product page   | Chinese label | Carrier route  | Path                     | Scope     |
| -------------- | ------------- | -------------- | ------------------------ | --------- |
| `overview`     | 概览          | `general`      | `/settings/general`      | ordinary  |
| `access`       | 模型与访问    | `access`       | `/settings/access`       | ordinary  |
| `workspace`    | 工作区        | `workspace`    | `/settings/workspace`    | ordinary  |
| `agents`       | 智能体        | `agents`       | `/settings/agents`       | ordinary  |
| `capabilities` | 能力          | `capabilities` | `/settings/capabilities` | ordinary  |
| `resources`    | 资源与连接    | `resources`    | `/settings/resources`    | ordinary  |
| `maintenance`  | 本机环境      | `environment`  | `/settings/environment`  | ordinary  |
| `storage`      | 数据与存储    | `storage`      | `/settings/storage`      | ordinary  |
| `preferences`  | 偏好          | `appearance`   | `/settings/appearance`   | ordinary  |
| `personalization` | 个性化      | `personalization` | `/settings/personalization` | ordinary |
| `advanced`     | 高级          | `advanced`     | `/settings/advanced`     | secondary |
| `about`        | 关于          | `about`        | `/settings/about`        | secondary |

`secondary_pages` contains only `advanced` and `about`. About is an independent
page and must never be redirected to Advanced.

AionUI custom assistants are not an OPL App product surface or ordinary tab.
Their entry may be hidden, and legacy `assistants` may redirect to
`capabilities?tab=skills`. Hiding or redirecting an entry does not authorize
deletion of underlying AionUI user data. Such deletion requires an explicit App
contract plus migration or deletion evidence.

## Compatibility Redirects

`update`, `theme`, and `local-services` are not product pages. They are
machine-readable compatibility redirects:

| Source route               | Target route  | Anchor     | Hash-router transport                    |
| -------------------------- | ------------- | ---------- | ---------------------------------------- |
| `/settings/update`         | `environment` | `updates`  | `/settings/environment?section=updates`  |
| `/settings/theme`          | `appearance`  | `themes`   | `/settings/appearance?section=themes`    |
| `/settings/local-services` | `environment` | `services` | `/settings/environment?section=services` |

The contract stores `target_route_id` and `anchor` separately. The current shell
uses a hash router, so it must not append a second URL fragment. It should parse
the compatibility record, navigate to the target route, preserve
`section=<anchor>` in the route query, then focus or scroll to the element whose
`id` equals the anchor. Anchor targets must be programmatically focusable so
route and search navigation leave both the viewport and keyboard focus at the
same owning section.

Compatibility routes must resolve before page rendering. They must not mount
their historical slot as an independent ordinary or secondary page.

## Global Search

Settings exposes exactly one global search input:

- test id: `settings-search-input`;
- index granularity: item, not page;
- languages: Chinese and English;
- result label: `{page_label} > {entry_label}`;
- result selection: navigate to the owner carrier route and focus its anchor;
- compatibility terms: Update, Theme, and Local Services resolve to
  `maintenance.updates`, `preferences.themes`, and `maintenance.services`;
- duplicate global inputs such as `settings-sider-search-input` and
  `settings-route-search` are forbidden.

Every search entry declares:

- `id`;
- `page_id`;
- `anchor`;
- Chinese and English labels;
- Chinese and English keyword arrays.

Search does not create a second state source. It only indexes the product
contract and routes the user to the owning item.

## Visual Contract

Settings uses the established OPL bounded-card control-center baseline, not a
Codex quiet-list layout. `quiet`, `dense`, and `scannable` describe visual tone;
they do not permit a page-wide list wall.

- a bounded card is used only for a configuration group with at least two related persistent controls, one consequential persistent setting, an exception/recovery workflow, or an independent decision boundary;
- pure readiness, path, count, or permission state stays as a muted row inside its owning configuration group and never becomes a standalone card;
- each first viewport contains one to four independent spatial groups; columns are used only when sibling groups have comparable density and independent decisions;
- rows, controls, and disclosures stay flat inside the owning card;
- no nested cards;
- cards remain in the normal document flow and do not become floating dashboard tiles;
- page-wide list walls, a sparse stack of bare horizontal dividers, and a
  decorative card wall that fragments one user question are forbidden;
- the compact footer contains only return-to-chat and theme-switcher controls;
  it is not a second account/help navigation group;
- the theme gallery uses recognizable preview tiles, never a flat swatch list;
- maximum border radius is 8 px;
- spacing uses 12 / 16 / 24 px;
- desktop groups use a responsive two-column grid where space allows and mobile groups stack;
- visual anchors use 28 px; page titles use `20/28/600`, card titles
  `14-16/20-24/600`, descriptions `13/20`, and supporting copy `12/18`;
- normal, warning, error, and action states use muted, orange, red, and brand semantics;
- access, workspace, capabilities, maintenance, and storage use restrained multi-hue navigation icons and card-edge accents so long pages remain distinguishable without tinting whole surfaces;
- the Settings sidebar has exactly one selected item after route resolution;
- repeated entities use one shared column-header row instead of repeating field
  labels in every row;
- the primary action stays adjacent to the object or section it acts on;
- each page shows at most one primary action;
- normal states are visually muted;
- only attention or failure states receive accent emphasis;
- raw diagnostics are absent from the ordinary page and open only through an explicit Diagnostics action into a summary-first modal or drawer;
- full-page routes let the page wrapper own scrolling, while modal content keeps
  its own reachable scroll area;
- when an inline confirmation is rendered away from the triggering control, it
  is scrolled into view and receives keyboard focus;
- letter spacing is 0.

`contracts/app-product-profile.json` and the active Shell generated product
profile must project the complete `visual_system` object from
`contracts/app-settings-control-plane.json`; a stale profile may not silently
restore the superseded quiet-list style. The Shell generated profile is updated
by the Shell/main integration lane, not by this App authority lane.

Visual verification asserts the real card grouping, footer structure, and theme
preview structure. Radius and spacing checks are supplementary and cannot by
themselves establish visual conformance. Fresh same-route screenshots must
preserve or improve hierarchy against Shell baseline
`409dd0c3b693f1c7c93551654dfac8fb9420843d`.

The ordinary first screen must describe user impact and the next decision. Raw
ids, raw statuses, command mappings, paths, payloads, and receipts belong in the
page's diagnostic modal or drawer.

### Surface Ownership

Settings has exactly four surface types. Every surface belongs to one type and
one page owner; every page contract declares all four inventory arrays, including
empty arrays. An item cannot appear in more than one array.

1. **Configuration**: persisted user, workspace, or App preferences. Related
   controls may use one bounded card when they satisfy the existing card
   eligibility rule. A one-time command can never be modeled as configuration.
2. **Status**: read-only evidence and readiness. It is a muted row inside its
   owning page section or configuration group; it never becomes a standalone
   status card. Attention remains inline and may route to an owning action.
3. **Action**: an explicit one-time command such as check, open, diagnose,
   repair, update, cleanup, archive, restore, or deploy. It stays adjacent to
   the object or section it operates on and exposes confirmation, progress, and
   receipt when required. It is visually a command, never a persistent setting.
4. **Diagnostic**: paths, refs, action ids, receipts, runtime enums, payloads,
   and logs. Ordinary pages open these through an explicit Diagnostics action
   into a summary-first modal or drawer. Advanced is itself a diagnostic page;
   it is not a Settings/configuration page.

Workspace therefore uses one owner card containing location, writability, and
actions. Preferences uses four full-width groups rather than a 2+1 grid:
application behavior, performance and background activity, instructions and
session context, and display/themes. The
instructions group edits the user-owned `$CODEX_HOME/AGENTS.md` through the
Framework action boundary and manages the App-owned new-conversation context.
OPL Flow installs and semantically merges the user profile; it does not own the
per-session App prompt. Agents
and Capabilities keeps catalog, conversation, and Home counts as one compact
status row inside the catalog card, exposes Home visibility and Manage on each
item row, and keeps package refs diagnostic. Resources and Storage keep
configuration and user-safe status on the page, show total storage use as a
header status rather than a standalone card, and move control-plane details into
one diagnostic surface.
About combines version, channel, update state, and update action in one card;
help links are full-width rows with their trailing icon on the container edge.
Maintenance and Data & Storage may contain status, actions, and diagnostics,
but their repair/update/cleanup/archive operations are actions, not settings.
Neither page owns persistent configuration in this contract. Storage restore
probe evidence belongs to diagnostics and does not require a duplicate ordinary
Restore button.

The OPL App session context is generated from
`gui.professional_agent_packages[].session_routing_summary_i18n`, so MAS, MAG,
RCA, OBF, OMA, and future adopted packages update through the product profile
instead of a second handwritten prompt. The generated base is read-only; users
may append local instructions, and Restore Default clears only that appendix.
The effective result takes effect only for newly created Codex conversations.
User and repository `AGENTS.md` remain independent Codex-owned instruction
layers. The system-level editor separately offers Restore OPL Flow Default,
which reads the canonical `templates/AGENTS.md` from the selected current OPL
Flow package and applies it through the same SHA-guarded Framework write path.

Capability package sync is a single-click Local Environment action. The Shell must
call `settings_sync_capabilities` through `opl app action execute` immediately,
keep progress and the result on the original maintenance item, and must not
insert a second confirmation card. The generic managed-update `check` read is
not an implementation substitute for sync. Capability status separates
installed count from maintenance state: a dirty checkout remains installed and
usable while automatic sync protects and skips it, so it must not reduce the
installed count or appear as a missing package.

## Page Contracts

### Overview

Primary information:

- one overall usability summary derived from model access, workspace,
  background services, capabilities, and updates;
- an impact-ordered issue queue, one next useful action, and at most two
  contextual entries selected from recent or currently relevant tasks.

Primary action: open the highest-priority attention item, only when one exists.

Exception state: emphasize one actionable issue, not every status.

Technical details: raw state keys, timestamps, paths, and receipts open in one
read-only diagnostic modal.

Required anchors: `status`, `attention`, `next-action`, `common-actions`.

Overview must not copy the Settings sidebar into page cards or render a
directory wall for the other pages.

### Agents, Capabilities, and Local Environment

`Agents` is the runnable Agent package directory. It owns Agent install, update,
repair, enable, disable, uninstall, Home visibility/order, dependency readiness,
and launch. Skills and Plugins do not appear there.

`Capabilities` groups Skills and Plugins by ownership. `OPL Flow managed` prefers
the typed Flow dependency catalog projected by OPL Base. Older installed Flow
locks temporarily fall back to their package policy and dependency-sync receipt;
membership is never hardcoded by the App. OPL Packages reconciles the result on
startup, daily maintenance, and explicit package updates. `Manual
and third-party` preserves the detected source and requires explicit user action.
The App does not hardcode Flow membership, Flow does not implement a second
updater, and CLI currentness remains an OPL Base responsibility.

`Local Environment` manages OPL Base, OPL App, and OPL Packages. Codex and
Temporal currentness uses three visible modes: OPL-managed installs may update
silently; external installs with a reliably identified original owner may offer
an explicitly confirmed delegated update; unknown or unsupported owners receive
detection and guidance only. OPL never silently overwrites Homebrew, npm, PATH,
or system installs. Temporal JavaScript dependencies move with the OPL Base
generation and do not have an independent OPL updater.

### Models & Access / 模型与访问

Primary information:

- model access readiness;
- the real source from `app_state.core.codex.model_access_source`;
- selected and default model;
- persisted Auto or fixed-model selection and reasoning effort;
- OPL Gateway, Codex CLI, and account or API-key state.

Primary action: configure model access when missing or when the user explicitly
requests a change.

Codex CLI installation or model-readback attention must not promote the Gateway
key button. The primary-action emphasis follows model-access readiness only.

Exception state: missing, expired, or unreachable access with one corrective
action.

Technical details: no separate disclosure in the ordinary page. The previous
modal repeated the same Codex executable, provider source, and access result
without enabling a decision or action. Raw paths and provider ids remain in
the maintenance diagnostic surface when troubleshooting actually requires
them.

Required anchors: `provider-source`, `model`, `codex-cli`, `authentication`.

Local browser access, Docker WebUI, OPL Workspace, SSH/HPC, cloud, Fabric, and
Console-managed resources belong to Resources & Connections.

### Workspace

Primary information:

- current workspace identity, path, and writability in one normal-state summary;
- permission or trust detail only when attention is required.

Primary action: change workspace.

Exception state: inaccessible, read-only, or untrusted workspace.

Technical details: raw path JSON, trust refs, and repair commands.

Required anchors: `current-workspace`, `permissions`.

Normal path, writability, trust, and permission must not become four separate
cards.

Filesystem evidence owns workspace usability. `workspace_root.writable=false`
or an unhealthy workspace state must render as attention even when the App
executor permission mode is `full_auto`; executor scope cannot make an
inaccessible or read-only directory usable.

### Agents & Capabilities / 智能体与能力

Primary information is split into:

- availability;
- source;
- Home visibility;
- OPL skills and external tools as supporting configuration.

Primary action: add a capability.

Exception state: failed or blocked capabilities are emphasized; normal packages
remain quiet.

Technical details: package ids, receipts, paths, manifests, physical surfaces,
and raw status axes.

Required anchors: `availability`, `source`, `home-visibility`.

The page has `skills` and `tools` supporting tabs. AionUI `AssistantSettings`,
custom assistant catalogs, and shell-specific assistants are not OPL product
surfaces. Legacy `assistants` resolves to `capabilities?tab=skills`. Removing or
hiding that upstream entry must not delete its underlying user data without an
explicit App contract and migration or deletion evidence.

### Resources & Connections

Primary information:

- resource readiness;
- whether the related operation is executable;
- owner or management mode.

Primary action: open an available resource action only when the action is
projected as executable.

An action that requires input must provide a legal App input flow or remain
disabled with a plain-language blocked reason. The WebUI seed action collects
both the image-manifest path and local seed directory before precheck. A
model-access action routes to Access because that page owns the credential
flow.

OPL connections use the Framework-owned `connection_create`,
`connection_update`, `connection_test`, `connection_set_default`, and
`connection_delete` actions. The ordinary form accepts only HTTP(S) endpoints
and credential references, never secret bodies. New connections start enabled;
the compact enabled switch appears only when editing an existing connection,
where disabling means preserving the configuration while excluding it from
use and tests.

Read-only actions must complete their declared behavior:

- `Open` navigates the shell to the exact projected `browser_url`;
- `Diagnose` executes the projected diagnose action and renders its result or
  action receipt.

Mutating resource actions require a successful precheck, explicit user
confirmation, execution, and a visible result or receipt. A successful
`--dry-run` proves only that the precheck passed; it must never be presented as
the resource having opened, diagnosis having run, deployment having completed,
or mutation having completed.

Exception state: distinguish resource unavailable from action blocked and name
the responsible next step.

Technical details: connector refs, quota, billing, credentials, and deployment
payloads.

Required anchors: `resource-readiness`, `action-readiness`,
`external-resources`.

The page may list OPL Workspace as a managed or remote resource, but it must not
duplicate the selected local workspace path, change-workspace control, or local
permission summary.

### Maintenance

Primary information:

- health;
- OPL Base status and one-click setup when it is missing;
- OPL App version and the available standard or host update route;
- one Stable / Preview update-channel setting backed by the Framework
  configuration catalog;
- OPL Packages status and the relevant install, update, repair, or uninstall action;
- carrier-neutral reconciliation status after first launch or any supported App carrier change;
- local services;
- one recommended action.

Primary action: run the recommended maintenance action when attention is
required.

Exception state: emphasize only OPL Base, OPL App, or the individual OPL
Packages that need action, and explain user impact before action. Runtime and
companion dependency status stays nested under OPL Base. Codex Surface sync and
Workflow Profile migration status stays nested under OPL Packages.

The maintenance surface consumes Framework plan and receipt fields rather than
maintaining a second dependency or package catalog. It may show background
apply only when `auto_apply.eligible` and `app_background_safe` are true and it
uses `command_ref` as the executable route. Dirty, developer, user-managed, and
global tool sources remain unchanged and appear as attention. Package receipts
normally lead to a refresh-Codex hint; staged Base runtime and App carrier
changes lead to restart-to-finish guidance with rollback evidence.

Management details: component Apply, Repair, Rollback, package sync, and other
one-time commands open in an explicit management modal with confirmation,
progress, and result binding.

Technical details: raw action ids, software-object ids, dependency and
integration status, package projection and profile migration status, command
mappings, paths, and receipts open in a separate read-only diagnostic modal.
Package projection status is read from
`managed_update.components[opl_packages].projection_status`.

Required anchors: `health`, `updates`, `services`, `packages`.

Update and Local Services are anchors on this page. Maintenance must not show a
second navigation directory, a runtime task board, or three equal action buttons
sharing one loading state. It must not expose runtime substrate, companion
tools, Codex Surface, or Workflow Profile as peer update products, and it must
not expose a component picker or a public `--component` action.

### Data & Storage

Primary information:

- one merged category list;
- size, safety, and next action for each category;
- cleanup preview;
- cleanup history.

Primary action: preview cleanup when reclaimable items exist.

Cleanup execution confirmations must be immediately reachable from every
category row. If the confirmation is rendered at the page summary rather than
beside the triggering row, the App scrolls it into view and moves keyboard focus
to it.

Exception state: unsafe or unprotected candidates are emphasized and execution
is disabled.

Technical details: `dry-run`, plans, receipt refs, lifecycle ids, SQLite details,
and raw paths.

Required anchors: `storage-categories`, `cleanup-preview`, `cleanup-history`.

Ordinary copy uses "preview cleanup", "items that will be removed", "archive",
"restore", and "cleanup record" rather than raw lifecycle terminology.
The restore probe is diagnostic evidence only. A verified archive exposes one
ordinary Restore action that recreates the archived conversation without
overwriting an existing conversation unless the user resolves the collision.

### Preferences

Primary information:

- reply waiting time in human units;
- performance and agent-idle waiting controls as persistent settings;
- tray and close-window behavior;
- hardware acceleration;
- themes and appearance.

Primary action: none. Preferences use inline controls.

Exception state: restart-required or unsupported hardware states appear next to
the affected setting only.

Technical details: Preferences has no dedicated diagnostic disclosure. Raw
millisecond values, Electron flags, and theme implementation ids are not
rendered; interactive timeout, idle-assistant, and hardware controls remain in
the named configuration group.

Required anchors: `behavior`, `notifications`, `models-performance`,
`display-fonts`, and `themes`.

Theme is an anchor on Preferences, not an independent page.

### Personalization

Primary information:

- the user-owned system `AGENTS.md`, with backup and stale-write protection;
- the currently installed OPL Flow default and an explicit restore action;
- the read-only OPL App generated base context for new conversations;
- editable additional instructions that apply only to new OPL App conversations.

Primary action: none. Save and restore actions stay beside the content they own.

Exception state: oversized or externally changed `AGENTS.md`, or an unavailable
OPL Flow default, appears beside the affected editor only.

Technical details: no separate diagnostic disclosure. The user file path and
installed OPL Flow version are supporting context, not a second status panel.

Required anchors: `system-agents` and `opl-app-context`.

Workspace remains independent because it owns project paths, file permissions,
and artifact roots. Personalization owns user-level instructions and defaults
for future conversations; merging them would mix workspace scope with user
scope and make both pages harder to reason about.

### Advanced

Surface type: diagnostic page, not Settings/configuration.

Primary information: read-only working directories with user-facing labels.

Primary action: none.

Exception state: missing or inaccessible directories without shell-owned repair
controls.

Technical details: the resolved workspace and log paths are shown directly in
two rows with an open-folder action. There is no second summary and no collapsed
duplicate.

Required anchor: `working-directories`.

Advanced must not contain Developer Mode, Developer Profile, OPL Flow editing,
source-channel mutation, provider controls, or runtime/domain mutation.

Developer source selection belongs to **Agents & Capabilities**, beside the
packages it affects. The page exposes one Managed / Automatic / Developer
segmented control, one safe-maintenance switch, and a compact readback of the
selected developer workspace and, after full inspection, the GitHub identity
and repository authority. Fast state must hide deferred identity/authority
placeholders instead of rendering `Not reported` or a misleading zero count. Each
package detail exposes Auto / Managed / Developer source selection and shows
the actual checkout, managed fallback, developer checkout, and any fallback
reason. The five Developer Profile capability axes remain supporting status;
they must not become five peer cards or hide the source controls.

The source selector and safe-maintenance switch are independent. Changing
maintenance permission must not change the selected Framework or package
checkout, and changing source must not silently grant repository or runtime
mutation permission.

### About

Primary information:

- One Person Lab App version;
- Stable or Nightly channel;
- update status.

Primary action: Check for updates.

Exception state: update available or update check failed, without raw error
codes on the main surface.

Technical details: GUI shell version, OPL Framework revision, build ids, and raw
update refs.

Required anchors: `version`, `channel`, `updates`.

About stays at `/settings/about`. Repair, rollback, package maintenance, and
storage cleanup remain on their owner pages.

## DOM Contract

Every product page always renders:

- `settings-page-<product_page_id>`;
- `settings-<product_page_id>-primary`;

Pages render `settings-<product_page_id>-technical-details` only while an
explicit read-only diagnostic modal or drawer is open. Advanced intentionally
omits a second disclosure because paths are the page's direct expert content.

Attention states render:

- `settings-<product_page_id>-exception`.

Pages with a visible primary action render:

- `settings-<product_page_id>-primary-action`.

Each page also renders its declared anchor values as stable section `id`
attributes. Conditional actions may be absent when their availability condition
is false; the page-level limit remains one.

## State And Action Boundary

Default reads use:

```text
opl app state --profile fast --json
```

Explicit detail refreshes use:

```text
opl app state --profile full --json
```

Mutations use:

```text
opl app action execute --action <action_id> [--payload <json>] [--dry-run] --json
```

The shell may render state, confirmations, progress, and receipts. It must not
write runtime truth, provider implementation, domain truth, owner receipts, or
release readiness.

Mutation-capable Settings surfaces are single-flight. While a read, precheck,
mutation, doctor, or recovery operation is pending, every competing action and
pending confirmation on that surface is disabled. A second interaction must not
issue another bridge call, and the visible result remains bound to the operation
that produced it.

## AionUI Fork Maintenance Contract

OPL Settings is an App-owned overlay carried by AionUI, not a permanent rewrite
of every upstream Settings page.

- App contracts own routes, placement, surface classification, labels, and
  acceptance. Framework catalogs own Framework values and actions.
- The Shell should add OPL pages as overlay files and keep upstream integration
  concentrated in `SettingsModal/index.tsx`, `SettingsHost.tsx`,
  `SettingsShellAdapterSlot.tsx`, and `settingsRegistry.tsx`.
- A new upstream Settings, Assistant, Skills, Tools, Update, WebUI, language, or
  extension surface is hidden until App intake records classify it as
  `accepted`, `adapt`, `redirect`, or `reject`.
- Unclassified extension tabs never become ordinary OPL navigation merely
  because an AionUI extension registered them. Hiding an entry never deletes
  extension-owned data.
- A change that directly modifies more than four new upstream fork-body choke
  points requires an App-owner rationale, upstream delta classification,
  focused merge-conflict tests, and a retirement or upstreaming plan.
- Generated product profiles and locale files remain expected merge hotspots;
  sync checks must prove that they project App truth without becoming a second
  authority.

The intake review runs against every newly fetched AionUI release before merge,
not only when a conflict appears. This keeps upstream upgrades a bounded adapter
exercise instead of a later full Settings reimplementation.

## Verification Boundary

Contract and focused validation prove the App-owned product requirement and
matrix consistency. They do not prove that the running shell implements the DOM,
that every anchor scrolls correctly, that visual screenshots pass, that an
installed App is current, or that a release is ready.

Shell acceptance requires:

- the single search input and bilingual item results;
- route plus `section` parsing for all compatibility redirects;
- screenshot preflight matches requested and resolved routes and matches the
  expected and visible page titles before capture; mismatches fail closed;
- all required page roots, primary regions, actions, exception regions,
  non-duplicative diagnostic surfaces, and stable section-id anchors;
- `settings-resources-browser-access` remains visible on Resources & Connections;
- legacy `assistants` returns to the OPL capability directory and never mounts
  AionUI `AssistantSettings`; hiding the entry does not authorize deletion of
  underlying AionUI user data;
- resource `Open`, `Diagnose`, and mutating actions obey their execution and
  dry-run claim boundaries;
- one fresh default desktop light check for the ordinary and secondary routes;
- exactly one selected sidebar item, bounded page-section cards with flat
  internal rows, shared repeated-entity column headers, and primary actions
  adjacent to their owning object or section;
- no nested cards, no sparse page-wide bare-divider layout, no duplicated global
  search, no text overlap, and no more than one primary action per page.

Release and runtime currentness remain separate owner gates.
