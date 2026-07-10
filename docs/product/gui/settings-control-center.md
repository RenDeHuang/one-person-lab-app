
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
- the Codex App visual grammar for Settings.

They do not own runtime truth, provider implementation, domain truth, release
readiness, installed App currentness, or owner acceptance.

## Canonical Information Architecture

Product page ids are stable product semantics. Carrier route ids remain stable
implementation ids so the shell can migrate without changing user-facing IA.

| Product page | Chinese label | Carrier route | Path | Scope |
| --- | --- | --- | --- | --- |
| `overview` | 概览 | `general` | `/settings/general` | ordinary |
| `access` | 访问方式 | `access` | `/settings/access` | ordinary |
| `workspace` | 工作区 | `workspace` | `/settings/workspace` | ordinary |
| `capabilities` | 智能体与能力 | `capabilities` | `/settings/capabilities` | ordinary |
| `resources` | 资源与连接 | `resources` | `/settings/resources` | ordinary |
| `maintenance` | 维护 | `environment` | `/settings/environment` | ordinary |
| `storage` | 数据与存储 | `storage` | `/settings/storage` | ordinary |
| `preferences` | 偏好 | `appearance` | `/settings/appearance` | ordinary |
| `advanced` | 高级 | `advanced` | `/settings/advanced` | secondary |
| `about` | 关于 | `about` | `/settings/about` | secondary |

`secondary_pages` contains only `advanced` and `about`. About is an independent
page and must never be redirected to Advanced.

## Compatibility Redirects

`update`, `theme`, and `local-services` are not product pages. They are
machine-readable compatibility redirects:

| Source route | Target route | Anchor | Hash-router transport |
| --- | --- | --- | --- |
| `/settings/update` | `environment` | `updates` | `/settings/environment?section=updates` |
| `/settings/theme` | `appearance` | `themes` | `/settings/appearance?section=themes` |
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

Settings uses a Codex App-style quiet workbench:

- few cards, only for summaries or repeated entities;
- no nested cards;
- page sections are not floating cards;
- maximum border radius is 8 px;
- spacing uses 12 / 16 / 24 px;
- headings are compact;
- each page shows at most one primary action;
- normal states are visually muted;
- only attention or failure states receive accent emphasis;
- technical details are collapsed by default;
- full-page routes let the page wrapper own scrolling, while modal content keeps
  its own reachable scroll area;
- when an inline confirmation is rendered away from the triggering control, it
  is scrolled into view and receives keyboard focus;
- letter spacing is 0.

The ordinary first screen must describe user impact and the next decision. Raw
ids, raw statuses, command mappings, paths, payloads, and receipts belong in the
page's technical-details disclosure.

## Page Contracts

### Overview

Primary information:

- overall usability and attention count;
- one next useful action.

Primary action: open the highest-priority attention item, only when one exists.

Exception state: emphasize one actionable issue, not every status.

Technical details: raw state keys, timestamps, paths, and receipts stay
collapsed.

Required anchors: `status`, `next-action`.

Overview must not copy the Settings sidebar into page cards or render a
directory wall for the other pages.

### Access / 访问方式

Primary information:

- model access readiness;
- the real source from `app_state.core.codex.model_access_source`;
- selected model and authentication state;
- browser access to this computer as a visible user entry.

Primary action: configure model access when missing or when the user explicitly
requests a change.

Codex CLI installation or model-readback attention must not promote the Gateway
key button. The primary-action emphasis follows model-access readiness only.

Exception state: missing, expired, or unreachable access with one corrective
action.

Technical details: base URL, environment variables, token paths, Codex CLI
details, and raw provider ids.

Required anchors: `provider-source`, `model`, `authentication`.

The browser entry is labeled `这台电脑的浏览器访问`, opens the existing local
browser-access settings, and keeps shell implementation provenance in technical
details. Docker WebUI, OPL Workspace, SSH/HPC, cloud, Fabric, and
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
- custom assistant entry.

Primary action: add a capability.

Exception state: failed or blocked capabilities are emphasized; normal packages
remain quiet.

Technical details: package ids, receipts, paths, manifests, physical surfaces,
and raw status axes.

Required anchors: `availability`, `source`, `home-visibility`,
`custom-assistants`.

The page has `skills`, `tools`, and a third on-demand `assistants` tab. The
`assistants` tab mounts the real `AssistantSettings` surface at
`custom-assistants`; it is not a search-only placeholder and is not a top-level
or secondary page. Legacy `assistants` resolves to
`capabilities?tab=assistants#custom-assistants`. Under the hash router, the
shell must preserve `tab=assistants` and encode the anchor as
`section=custom-assistants`.

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
- `settings-<product_page_id>-technical-details`.

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
- all required page roots, primary regions, actions, exception regions,
  technical-details disclosures, and stable section-id anchors;
- `settings-access-browser-access` remains visible on Access;
- legacy `assistants` opens the third on-demand `AssistantSettings` tab and
  focuses `custom-assistants`;
- resource `Open`, `Diagnose`, and mutating actions obey their execution and
  dry-run claim boundaries;
- desktop and mobile visual QA;
- no nested cards, no duplicated global search, no text overlap, and no more
  than one primary action per page.

Release and runtime currentness remain separate owner gates.
