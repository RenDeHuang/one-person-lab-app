# Settings Control Center

Owner: `one-person-lab-app`
Purpose: `settings_control_center_product_design`
State: `active_design_target`
Machine boundary: Human-readable product design. Machine-readable truth lives in
`contracts/app-gui-product-contract.json`,
`contracts/app-settings-control-plane.json`,
`contracts/app-page-state-matrix.json`, active shell source, validation scripts,
and release/user-path evidence.

Current validation boundary: `contracts/app-settings-control-plane.json` is the
active Settings Control Plane contract. It hydrates the Settings registry,
legacy redirect table, extension anchor remap, route behavior, state/action
source policy, and `SettingsHost` / `SettingsShellAdapterSlot` adapter slot.
`settings_ia.v1` in
`contracts/app-gui-product-contract.json#settings_navigation.settings_ia` remains
the App GUI source contract consumed by that control plane.

## Reading Order And SSOT

Use this document for the human product design of Settings as the OPL Control
Center. Use `contracts/app-settings-control-plane.json` for route, checklist,
registry, redirect, adapter-slot, and validator truth. Use
`settings-degradation-audit-and-reorg.md` for the root-cause audit and the user
mental-model reorg rationale. Use
`settings-control-center-completion-audit.md` only as a compact audit pointer;
it must not grow back into a dated evidence ledger, release proof transcript, or
installed-currentness record.

## Goal

Settings is the One Person Lab App OPL Control Center, not an upstream AionUI
configuration dump. It should answer user questions in this order:

1. Can I use the App now?
2. What do I need to configure?
3. What OPL capabilities can I use?
4. What needs maintenance?
5. How do I safely manage local data?
6. Which local, remote, or managed resources can my tasks use?
7. Where are technical diagnostics when I need them?

The default surface gives conclusions and next actions. Raw paths, ids,
receipts, component ids, JSON payloads, operation modes, and implementation
diagnostics remain behind disclosure controls or Advanced pages.

## Information Architecture

The target navigation groups are:

| Group | Pages | Primary user question |
| --- | --- | --- |
| Overview | Overview | Is the App usable now, and what should I do next? |
| Setup & Access | Access & Model, Workspace | How do I connect the App, and where does work happen? |
| Capabilities | Agents & Capabilities | Which agent packages, Home shortcuts, and tools/connectors are available? |
| Maintenance & Updates | Updates & Maintenance, Local Services | How do I keep the App foundation healthy, repaired, and updated? |
| Data & Storage | Storage & Data | How do I safely manage local App data? |
| Preferences | Appearance, Language & Notifications | How should the App behave and look for me? |
| Advanced | Developer & Diagnostics, About | Where are technical details, raw references, versions, and links? |

Legacy routes such as `runtime`, `model`, `agent`, `assistants`, `skills-hub`,
`tools`, `display`, `webui`, `pet`, and `system` remain compatibility redirects.
They must not reappear as ordinary navigation.

`contracts/app-settings-control-plane.json` is the machine-readable registry and
route resolver for this design. It consumes `settings_ia.v1` at
`contracts/app-gui-product-contract.json#settings_navigation.settings_ia` and
is mirrored by route metadata in `contracts/app-page-state-matrix.json#pages`.
The control plane deliberately separates user-facing groups from current shell
route ids:

- ordinary route ids remain `general`, `access`, `capabilities`, `environment`,
  `storage`, `appearance`, and `advanced`;
- `workspace` and `local-services` are independent user task pages surfaced as
  secondary/deep-link routes under Overview and Maintenance & Updates. `about`,
  `update`, and `theme` are also secondary or deep-link route ids.
  unless the contract, page-state matrix, validators, and release-boundary tests
  are deliberately changed together;
- user-facing groups remain Overview, Setup & Access, Agents & Capabilities,
  Maintenance & Updates, Data & Storage, Preferences, and Advanced.

## Page Contracts

## Shared Protocols

Settings pages use the same Control Center protocol instead of page-specific
ad hoc cards:

- Issue queue entries use `needs_action`, `in_progress`, `resolved`, `blocked`,
  and `dismissed`.
- Actions come from `app_state.actions` and mutate only through
  `opl app action execute --action <action_id> [--payload <json>] [--dry-run]
  --json`.
- The Maintenance hub may expose one primary "Make OPL usable" action. It is a
  shell-orchestrated composite over existing repair prep and managed update
  actions: it may check status, repair components with explicit repair receipts,
  apply safe non-restart package/capability sync actions, and refresh fast App
  state. It must not implement a second updater kernel, silently update dirty or
  developer checkouts, silently apply restart-required OPL Runtime Fabric changes,
  auto-rollback, or write runtime/domain truth.
- Settings search filters ordinary route labels, task entries, and action
  keywords. It is a navigation aid only: selecting a result changes the page,
  but search results do not create a second status source or expose internal
  route ids.
- Summary cards require id, title, state, summary, recommended action, last
  checked time, and details disclosure.
- State-changing or destructive actions use a confirmation drawer that states
  what changes, what does not change, and which rollback or receipt reference
  will exist before the mutation runs. The implementation may render this as a
  drawer, modal, or inline confirmation surface as long as the same required
  fields are visible before confirmation.
- Post-update notices show component id, result, receipt ref, next check, and
  restart or reload guidance in the ordinary Settings layer after a manual or
  background action, without claiming domain, production, currentness, or
  release readiness.
- Diagnostics, raw ids, paths, receipts, JSON, and component ids are collapsed
  by default and live under Advanced or explicit disclosure.
- Unknown deep links redirect to the nearest App-owned Settings group; legacy
  deep links follow `settings_navigation.legacy_route_redirects`.

## Task Entries

The OPL Control Center keeps seven top-level IA groups. User task entries are surfaced
inside those groups instead of adding more tabs.

P0 entries:

- Model & Account: current model, model access/API key readiness, connection
  check, and repair entry. It belongs to Setup & Access.
- Workspace: current path, open/change/verify actions, and permission status.
  It belongs to Overview as an ordinary setup entry.
- Maintenance Hub: App updates, OPL Runtime Fabric, OPL Packages, storage
  cleanup entry, and repair recommendations. It belongs to Maintenance & Updates.
- Capability Status: installed packages, Home shortcuts, tools/connectors, and
  capability support state. It belongs to Agents & Capabilities.

P1 entries:

- Web / Docker / Remote Access: direct route for users who need WebUI, Docker,
  OPL Workspace, user-provided SSH/HPC, or OPL Cloud-managed resources. It
  belongs to Setup & Access and is displayed as Cloud & Remote Access when the
  App has OPL Gateway or Fabric refs.
- Developer Profile Status: local checkout source, auto-update impact, and
  dirty checkout risk. It belongs to Advanced.
- External Tools & Voice: ordinary label for tools, MCP support, and voice.
  MCP is explanatory detail, not the primary entry name.
  K-Dense BYOK learning reinforces this product boundary: users see External
  Tools or OPL Connect refs, while MCP server names, transports, and tool lists
  stay implementation detail behind disclosure.
- Custom Assistant: secondary or Advanced capability depending on product
  policy; it must not replace built-in OPL purpose entries.

The ordinary UI must not expose AionUI Team, backend/provider raw selectors,
AG-UI implementation surfaces, AionUI implementation skills, or raw
runtime/provider internals as product capabilities.

### Overview

The overview is a summary-first dashboard. It shows:

- a single overall state: usable, needs attention, or blocked;
- status chips for access, workspace, local services, and capabilities;
- one recommended primary action and at most two secondary actions;
- direct entries for Workspace, Model & Account, Maintenance & Updates,
  Data & Storage, Capabilities, and Web / Remote Access;
- last maintenance check and next background check when known;
- a collapsed technical detail section.

The overview must not show raw readiness booleans, OPL command names, framework
phase names, git state, or package receipt ids as first-screen content.

### Access & Model

Access & Model owns user-facing connection readiness:

- Codex CLI availability;
- Model & Account with current model, account/API key readiness, connection
  check, and repair entry;
- OPL Gateway status as the branded AI access surface for model routing, key
  state, provider policy, and use refs;
- model access/API key state;
- default model and reasoning selection;
- permission meaning in user language;
- Cloud & Remote Access for Local App, Docker/WebUI, OPL Workspace,
  user-provided SSH/HPC, and OPL Cloud-managed compute or storage refs;
- OPL Fabric resource-source status for compute, storage, connector, and
  environment refs when the Framework projection provides them;
- Environment Catalog refs that show template, version, source, and task fit;
- Console-managed resource refs for policy, quota, billing, and permission, and
  self-managed status for local, user-provided SSH, and user-provided HPC
  resources.

The Access reorg is additive over AionUI native remote access. Native remote
access entry points stay available as stable Access entries; OPL App adds
Gateway, Workspace, Fabric, and Console context around them.

Base URLs, token paths, raw config files, and provider internals are advanced
details, not first-screen content. Console billing, organization policy, and
managed-resource entitlement are displayed only as Console-managed refs; the App
does not make those decisions.

### Workspace

Workspace is an independent setup task page, not hidden inside Local
Environment. It may render as a secondary/deep-link route rather than a new
top-level tab, but search and Overview task entries must be able to route to
it. It shows:

- current workspace folder;
- whether the folder exists and is writable;
- where App work products and project files are stored by default;
- choose, change, open, and repair-permission actions.

Workspace must not be presented as a runtime diagnostic-only field.

### Agents & Capabilities

Capabilities are organized by installed Agent Packages and user-facing work
shortcuts before implementation detail. First-party starter registry entries
and starter shortcuts are defaults, not the only packages OPL App can manage.

The package discovery source is the OPL Agent Registry. Users may point it at a
GitHub-hosted JSON file or another configured URL; Settings uses it to show
available packages and starter shortcuts. Installing from a selected manifest
URL follows OPL Framework validation, lock, rollback ref, receipt creation, and
package list readback. Updating, repairing, rolling back, uninstalling,
hiding/unhiding, enabling/disabling, and status readback are Framework-owned
lifecycle receipt routes that Settings may expose as App actions. Active shell
reads Framework-backed Home shortcut preference readback from App state, routes
visibility/order changes through the Framework action, and keeps local
preference storage as fallback/migration. Framework owns package Home shortcut
preference readback through
`agent_package_home_shortcut_preferences_set` and
`connect agent-packages list/status#home_shortcut_preferences`. Framework also
owns manifest-declared local Codex plugin materialization and records it through
package lock / lifecycle receipt `physical_surface`; Settings displays that
`physical_surface` as package state, plugin id, marketplace id, Codex config
path, materialized required skill ids/paths, and reload required status.
First-party distribution payload refs and remote payload manifest fields are non-live contract/Framework evidence; installed Codex-surface reload proof and live install readiness remain runtime or release-owner evidence; Settings must not present contract/readback evidence as
live install readiness. The Registry never defines the agent's business
behavior.

The ordinary model is:

- Agent Package: install/update/repair/rollback/hide/unhide/uninstall unit;
- Agent Registry: configurable GitHub/URL discovery list with manifest URLs,
  not an install or behavior authority;
- Home Shortcut: user-selected launch entry over an installed package;
- Codex Surface: plugin registry, required skills, optional companion tools,
  and post-apply sync state;
- Invocation Receipt: launch fact only, not a session-behavior contract.

Default starter shortcuts may still be labeled by work purpose:

- Research;
- Grant Writing;
- Presentations;
- Book / manuscript work;
- OPL automation and Meta Agent.

Each package/shortcut card shows current availability, source
(`first_party`, `organization`, `user`, `third_party`, or developer override),
primary entry, required package or skill support, whether it needs update,
repair, rollback, hide/unhide, or uninstall, and last capability sync when
available. Skills, external tools, MCP, voice, and custom assistants are
supporting sections below the package/shortcut model. Large purpose cards are
not the primary semantic model for this page.

Settings must not introduce a strong Session Contract. Shortcut/profile
metadata may describe label, package id, required skill ids, optional companion
refs, source, and refs-only display policy. It must not describe a domain
workflow, agent stage behavior, prompt internals, artifact schema, readiness
verdict, quality/export verdict, or owner receipt authority.

Connector readiness appears as OPL Connect refs grouped by user purpose, such
as literature databases, research databases, storage, tools/API, internal
systems, and compute schedulers. Environment and resource-source readiness
appears as OPL Fabric refs. Environment Catalog appears as read-only template,
version, source, and task-fit refs. Settings must not expose connector
credentials, connector bodies, environment bodies, or domain verdicts.
External-tool implementation details such as MCP transport shape remain OPL
Connect disclosure details, not separate ordinary capability categories.

### Updates & Maintenance

Updates & Maintenance owns normal maintenance and update actions, while About owns only version and
links. The maintenance page groups:

- Installation carrier;
- OPL Runtime Fabric;
- OPL Packages;
- storage cleanup;
- repair recommendations;
- Codex Surface sync.

It is system maintenance only. It must not carry in-progress task detail,
workflow candidate state, deliverable progress, or domain blocker ledgers.
The Update page remains a stable secondary page with a stable route and stable
entry from Maintenance & Updates and Settings search.

Each group uses the same structure: current state, user summary, recommended
action, last check, next check, and details disclosure. Apply, repair, and
rollback actions are per component and show component-specific loading state.
Dangerous or state-changing actions require a confirmation surface explaining
what will change, what will not change, and what rollback or receipt reference
will exist before the mutation runs.

The primary "Make OPL usable" action is a convenience entry, not a new authority
surface. It sequences existing App/Framework actions and only applies safe
non-restart repairs or capability sync actions. Restart-required runtime changes,
dirty/developer checkouts, cleanup execution, and rollback remain explicit
per-component actions with their own confirmation and guidance.

The App remains a consumer of OPL/App action routes and managed updater status;
it must not implement the update kernel or write runtime/domain truth.

### Storage & Data

Storage & Data is its own Control Center group and uses user safety language:

- Update cache;
- Conversation archives;
- Runtime cache;
- Logs;
- Workspace data lifecycle.

The first screen shows size, safety classification, and the recommended action.
Technical terms such as dry-run may appear as secondary labels, but primary
copy should say "Preview cleanup plan" and "Clean selected cache". Destructive
actions stay disabled until the required preview, archive, restore proof, or
receipt exists.

For research workspaces, Storage & Data is a read-only consumer of OPL/MAS
lifecycle refs. It can show lifecycle planes, large body refs, small-file
pressure, runtime compact dry-run refs, completed-project closeout refs, and
forbidden generic-cleanup boundaries. The App must not read SQLite sidecars
directly, scan workspace trees to infer cleanup candidates, delete clinical
data bodies, write runtime/domain truth, or authorize artifact cleanup.

### Local Services

Local Services is an independent service-health task page under Maintenance &
Updates. It answers whether the local foundation can run without mixing in
package update, rollback, storage cleanup, or workspace management controls:

- Codex executor;
- local background service;
- Temporal worker when present;
- OPL System Bridge and runtime support;
- module loading health.

It offers diagnose, refresh, start/restart, and repair actions. Module paths,
repo urls, git status, and component receipt refs stay collapsed.

### Appearance

Appearance belongs to Preferences, not Maintenance & Updates, Data & Storage, or Local Runtime. It owns:

- visual theme;
- density;
- typography scale when supported;
- sidebar behavior;
- reduced-motion or animation preference when supported.

The page should use a compact preview plus setting rows instead of large
technical cards.

### Developer & Diagnostics

Developer & Diagnostics owns power-user detail:

- Developer Profile capabilities;
- raw paths and logs;
- OPL Flow context;
- JSON/read-model references;
- copy diagnostics actions.

This page is not part of the ordinary setup path.

### About

About shows:

- App version and channel;
- GUI shell version;
- OPL Framework revision;
- release notes and documentation links;
- feedback and issue links.

It is a stable secondary page with a stable route and stable entry from
Advanced and Settings search. It can link to Updates & Maintenance but must not
be the primary maintenance page.

## Visual System

Settings should feel like a quiet engineering control center:

- left navigation on desktop, horizontally scrollable section nav on narrow
  screens;
- one page header pattern: title, short description, state badge, last refresh,
  and primary action;
- setting rows for ordinary controls;
- cards only for summary states, purpose entries, and repeated entities;
- 8px radius, restrained borders, semantic color, and no decorative gradients;
- one icon family with consistent stroke width;
- at most one primary action per page;
- danger actions separated from ordinary actions.

## Maintainability Rules

The App must not maintain several hidden copies of Settings IA.
`contracts/app-settings-control-plane.json` is the long-term source for:

- visible navigation groups and page ids;
- route redirects;
- extension anchor remaps;
- `SettingsHost` / `SettingsShellAdapterSlot` ownership;
- upstream intake classification before registry or slot changes;
- i18n key coverage;
- page-state matrix expectations;
- validation fixtures and smoke route ids;
- screenshot/user-guide targets.

The AionUI fork maintenance strategy is
`docs/architecture/opl-aionui-fork-maintenance-strategy.md`: strengthen this
control plane, keep the shell adapter thin, and classify upstream Settings
intake before changing the registry or adapter slot. Do not create a parallel
Settings package, plugin ecosystem, or shell-owned product IA to solve fork
maintenance.

The route identity rule is part of maintainability: current shell route ids are
implementation facts, while the seven IA groups are user-facing product groups.
Do not rename shell routes to match prose group labels, and do not promote
secondary/deep-link routes such as Workspace, Local Services, About, Update, or Theme into
ordinary routes without updating the contract, matrix, validators, tests, and
visual QA targets.

Implementation components must consume explicit typed view-model adapters for
the ordinary pages that carry OPL state/action semantics:

- Access: `packages/desktop/src/renderer/pages/settings/accessProjection.ts`;
- Maintenance & Updates: `packages/desktop/src/renderer/pages/settings/RuntimeSettings/runtimeSettingsViewModel.ts`;
- Data & Storage: `packages/desktop/src/renderer/pages/settings/storageProjection.ts`;
- Capabilities: `packages/desktop/src/renderer/pages/settings/capabilitiesProjection.ts`.

Large mixed pages such as Maintenance & Updates should stay split into summary,
action, maintenance, and diagnostics components so each part has one owner and
one test surface. Renderers may own layout and event wiring; adapters own the
normalization from App state, managed-update projections, and local lifecycle
receipts into user-facing view models.

## Product System Checklist

Completion audits for Settings Control Center work use
`contracts/app-settings-control-plane.json#product_system_checklist` as the
machine-readable checklist. The checklist tracks product-system outcomes rather
than only page names:

| Track | Checklist items |
| --- | --- |
| Product positioning | Control Center positioning |
| IA and routes | Seven-entry IA, secondary route strategy, Settings search |
| Control plane | Single control plane, contract validators |
| Shell adapter | Host adapter slot, view-model layer |
| State/action protocol | Issue/action protocol, Make OPL usable reconcile |
| User task UX | Maintenance noise reduction, update/rollback UX, Workspace, Local Services, Access, Capabilities, Data & Storage, Preferences, Advanced, Developer Profile, user copy system |
| Visual QA | Visual system, screenshot QA |
| Ops hygiene | Worktree/lane hygiene |
| Release/currentness | Installed/release currentness |

Each item is audited against fresh evidence. Docs, contracts, tests,
screenshots, and shell code prove only the slice they directly cover. The
installed/release currentness item stays in the checklist so audits cannot omit
it, but it remains a release-owner gate. Settings tests, visual QA, contract
validation, and pushed source commits must not be used as installed App,
notarization, running-version, or release-ready evidence.

## Validation Boundary

Settings validation is split into three layers:

1. App behavior contracts: `scripts/validate-active-shell/settings-control-plane-validator.ts`
   validates Settings Control Plane behavior from
   `contracts/app-settings-control-plane.json`, `settings_ia.v1`,
   `contracts/app-page-state-matrix.json`, `contracts/app-product-profile.json`,
   and the active shell adapter contract. This layer owns the hydrated registry
   snapshot, ordinary and secondary route behavior, legacy redirects, extension
   anchor remaps, route ids, route scopes, IA groups, task entries, action
   routing, confirmation protocols, diagnostics visibility, post-update notice
   policy, upstream intake classification, and route promotion rules.
2. Shell adapter slot: active-shell validation may verify that the shell consumes
   the App-owned Settings registry through `SettingsHost` and
   `SettingsShellAdapterSlot`, including ordinary routes, secondary routes,
   legacy redirects, and extension anchor remaps. This is a slot and registry
   behavior check, not a source-code inventory of every Settings component.
3. High-risk forbidden source probes: source-string probes remain appropriate
   only for rejected or dangerous upstream surfaces, including AionUI Team mode,
   Team MCP state, raw runtime/domain truth writes, owner receipt writes, silent
   dirty/developer checkout updates, and direct reads of OPL internal state
   files.

Visual/UX QA is shell behavior evidence, not release evidence. The fixed
Settings Control Center visual command is:

```bash
E2E_SCREENSHOTS=1 bun run test:e2e -- tests/e2e/specs/navigation.e2e.ts --grep "Settings Pages|Sidebar Navigation"
```

That evidence must cover desktop and mobile viewports for the ordinary routes
`/settings/general`, `/settings/access`, `/settings/capabilities`,
`/settings/environment`, `/settings/storage`, `/settings/appearance`, and
`/settings/advanced`. Workspace and Local Services are secondary/deep-link
task pages; visual evidence must either capture `/settings/workspace` and
`/settings/local-services` or explicitly mark them as route-unit-covered without
claiming screenshot coverage.

The shell evidence bundle must write
`tests/e2e/screenshots/settings-control-center-manifest.json` with the command,
commit, viewport, route, screenshot path, and status anchors observed for each
entry. Status anchors include collapsed diagnostics, confirmation before
state-changing actions, post-action recovery notice, and legacy redirect
landing behavior. Passing visual QA proves that the active shell can render the
Settings Control Center without obvious navigation, overlap, or route-framing
regressions. It does not prove release readiness, packaged App readiness,
runtime currentness, or owner acceptance.

## Upstream Intake Classification

Incoming upstream AionUI Settings changes are classified before they enter the
Settings registry, `SettingsHost`, or `SettingsShellAdapterSlot`:

- `accepted`: layout, styling, accessibility, i18n, flicker, and extension tab
  rendering fixes that implement existing App-owned routes, task entries,
  protocols, or visual QA targets without changing authority.
- `adapt`: upstream skills/tools, assistant, provider/model, remote-access, or
  route changes that can be consumed only through the App registry, adapter
  slot, page-state matrix, and App action/state routes.
- `redirect`: upstream setup shortcuts or raw configuration affordances that
  remain only as compatibility redirects or extension-anchor remaps to an
  App-owned Settings group.
- `reject`: exposes upstream-only configuration, Team mode, raw provider or
  runtime internals, domain truth mutation, owner receipt mutation, silent
  developer checkout updates, or another forbidden ordinary-user surface.

Fixed intake checklist:

1. Record the upstream Settings surface and user-visible behavior.
2. Classify it as `accepted`, `adapt`, `redirect`, or `reject` before changing
   the Settings registry or adapter slot.
3. Bind `accepted` and `adapt` entries to `SettingsHost` /
   `SettingsShellAdapterSlot` evidence.
4. Route `redirect` and `reject` entries through legacy redirects, extension
   anchor remaps, or forbidden probes.
5. Keep runtime truth, domain truth, provider implementation, owner receipts,
   and release readiness outside the shell adapter.

## Verification Expectations

Structural landing requires:

- App contracts and page-state matrix updated;
- `settings_ia.v1` route ids, user task entries, protocols, and visual QA
  targets covered by active-shell validation and release-boundary tests;
- active shell navigation and routes updated;
- i18n labels updated in English and Chinese;
- active-shell validation passing;
- affected shell typecheck or focused UI checks passing;
- docs decisions/invariants updated.

This does not by itself prove release readiness, packaged App readiness, VM
smoke, or production readiness. Those remain release-owner and runtime evidence
lanes.
