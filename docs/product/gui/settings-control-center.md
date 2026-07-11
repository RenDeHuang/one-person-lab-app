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

- the eight ordinary product pages;
- the two secondary product pages;
- compatibility redirect targets and anchors;
- the single Settings search index;
- each page's primary information, primary action, exception state, technical
  detail boundary, required DOM, anchors, and search entries;
- the established OPL bounded-card visual grammar for Settings.

They do not own runtime truth, provider implementation, domain truth, release
readiness, installed App currentness, or owner acceptance.

## Canonical Information Architecture

Product page ids are stable product semantics. Carrier route ids remain stable
implementation ids so the shell can migrate without changing user-facing IA.

| Product page   | Chinese label | Carrier route  | Path                     | Scope     |
| -------------- | ------------- | -------------- | ------------------------ | --------- |
| `overview`     | 概览          | `general`      | `/settings/general`      | ordinary  |
| `access`       | 模型与访问    | `access`       | `/settings/access`       | ordinary  |
| `workspace`    | 工作区        | `workspace`    | `/settings/workspace`    | ordinary  |
| `capabilities` | 智能体与能力  | `capabilities` | `/settings/capabilities` | ordinary  |
| `resources`    | 资源与连接    | `resources`    | `/settings/resources`    | ordinary  |
| `maintenance`  | 维护          | `environment`  | `/settings/environment`  | ordinary  |
| `storage`      | 数据与存储    | `storage`      | `/settings/storage`      | ordinary  |
| `preferences`  | 偏好          | `appearance`   | `/settings/appearance`   | ordinary  |
| `advanced`     | 高级          | `advanced`     | `/settings/advanced`     | secondary |
| `about`        | 关于          | `about`        | `/settings/about`        | secondary |

`secondary_pages` contains only `advanced` and `about`. About is an independent
page and must never be redirected to Advanced.

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

- a bounded card is used only for a configuration group with at least two related controls, one consequential action, an exception/recovery workflow, or an independent decision boundary;
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

Settings has three surface types. This distinction prevents implementation data
from deciding the page layout.

1. **Configuration group**: interactive controls and consequential actions. It
   may use one bounded card when it satisfies the card eligibility rule.
2. **Status row**: read-only evidence that supports a nearby configuration. It
   remains inside the owning group; normal state is muted and an exception may
   add one recovery action.
3. **Diagnostic surface**: paths, refs, action ids, receipts, runtime enums,
   payloads, and logs. These values never remain inline on an ordinary Settings
   page. One explicit Diagnostics action opens a modal or drawer with a
   plain-language summary first and raw fields second.

Workspace therefore uses one owner card containing location, writability, and
actions. Preferences uses two full-width groups rather than a 2+1 grid. Agents
and Capabilities keeps catalog, conversation, and Home counts as one compact
status row inside the catalog card, exposes Home visibility and Manage on each
item row, and keeps package refs diagnostic. Resources and Storage keep
configuration and user-safe status on the page, show total storage use as a
header status rather than a standalone card, and move control-plane details into
one diagnostic surface.
About combines version, channel, update state, and update action in one card;
help links are full-width rows with their trailing icon on the container edge.

## Page Contracts

### Overview

Primary information:

- model access, workspace, background services, capabilities, and updates;
- an impact-ordered issue queue, one next useful action, and contextual common entries.

Primary action: open the highest-priority attention item, only when one exists.

Exception state: emphasize one actionable issue, not every status.

Technical details: raw state keys, timestamps, paths, and receipts stay
collapsed.

Required anchors: `status`, `attention`, `next-action`, `common-actions`.

Overview must not copy the Settings sidebar into page cards or render a
directory wall for the other pages.

### Models & Access / 模型与访问

Primary information:

- model access readiness;
- the real source from `app_state.core.codex.model_access_source`;
- selected and default model;
- OPL Gateway, Codex CLI, and account or API-key state.

Primary action: configure model access when missing or when the user explicitly
requests a change.

Codex CLI installation or model-readback attention must not promote the Gateway
key button. The primary-action emphasis follows model-access readiness only.

Exception state: missing, expired, or unreachable access with one corrective
action.

Technical details: base URL, environment variables, token paths, Codex CLI
details, and raw provider ids.

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
surfaces. Legacy `assistants` resolves to `capabilities?tab=skills` so old links
land on the OPL capability directory instead of exposing upstream UI.

### Resources & Connections

Primary information:

- resource readiness;
- whether the related operation is executable;
- owner or management mode.

Primary action: open an available resource action only when the action is
projected as executable.

An action that requires input but has no legal App input flow is not promoted as
the primary action. It remains visible under more actions with a plain-language
blocked reason, so the page never reports "no actions" when the App did project
one. A model-access action may route to Access when that page owns the required
input flow.

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
- updates;
- local services;
- OPL Packages;
- one recommended action.

Primary action: run the recommended maintenance action when attention is
required.

Exception state: emphasize only components that need action and explain user
impact before action.

Technical details: raw action ids, component ids, raw statuses, command
mappings, paths, and receipts.

Required anchors: `health`, `updates`, `services`, `packages`.

Update and Local Services are anchors on this page. Maintenance must not show a
second navigation directory, a runtime task board, or three equal action buttons
sharing one loading state.

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

### Preferences

Primary information:

- reply waiting time in human units;
- tray and close-window behavior;
- hardware acceleration;
- themes and appearance.

Primary action: none. Preferences use inline controls.

Exception state: restart-required or unsupported hardware states appear next to
the affected setting only.

Technical details: raw millisecond values, Electron flags, and theme
implementation ids.

Required anchors: `behavior`, `tray`, `hardware`, `themes`.

Theme is an anchor on Preferences, not an independent page.

### Advanced

Primary information: read-only working directories with user-facing labels.

Primary action: none.

Exception state: missing or inaccessible directories without shell-owned repair
controls.

Technical details: raw path refs may be copied from collapsed details but cannot
be edited here.

Required anchor: `working-directories`.

Advanced must not contain Developer Mode, Developer Profile, OPL Flow editing,
source-channel mutation, provider controls, or runtime/domain mutation.

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

Pages render `settings-<product_page_id>-technical-details` only when the detail
surface contains information not already visible on the page. Access and
Advanced intentionally omit it because their former disclosures repeated the
same model/CLI facts or paths.

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
  AionUI `AssistantSettings`;
- resource `Open`, `Diagnose`, and mutating actions obey their execution and
  dry-run claim boundaries;
- one fresh default desktop light check for the ordinary and secondary routes;
- exactly one selected sidebar item, bounded page-section cards with flat
  internal rows, shared repeated-entity column headers, and primary actions
  adjacent to their owning object or section;
- no nested cards, no sparse page-wide bare-divider layout, no duplicated global
  search, no text overlap, and no more than one primary action per page.

Release and runtime currentness remain separate owner gates.
