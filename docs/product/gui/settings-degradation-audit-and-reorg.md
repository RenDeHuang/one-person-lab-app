# Settings Degradation Audit And Reorganization

Owner: `one-person-lab-app`
Purpose: `settings_user_cognition_reorg_proposal_history`
State: `superseded_by_settings_ia_v1`
Machine boundary: This document preserves the diagnosis and rejected interim IA
that led to the current design. It is not current product authority. Current
truth lives in `contracts/app-settings-control-plane.json`,
`docs/product/gui/settings-control-center.md`, source, validators, and tests.

Supersession: the final IA has ten ordinary pages: Overview, Account & Access,
Models, Workspace, Agents, Capabilities, Resources &
Connections, Maintenance, Data & Storage, and Preferences. About is the only
independent secondary page; Advanced only redirects to Maintenance diagnostics.
The combined Agent/Capabilities and standalone Advanced proposals below are
retained as historical reasoning and must not be implemented.

## Conclusion

The current Settings experience is degraded because it is organized as an
implementation-heavy control plane instead of a user-facing control center.
Different layers are mixed together:

- user tasks;
- package lifecycle operations;
- runtime maintenance;
- project progress;
- receipts, refs, and dry-run routes;
- AionUI base capabilities;
- OPL-added cloud or deployment concepts.

The result is not just "too much information". The page boundaries themselves
are wrong.

## Root Cause

### 1. Product boundary drift

Settings was pushed toward a universal OPL control plane. In practice this made
ordinary Settings absorb runtime cockpit, package manager, maintenance console,
remote deployment guide, and diagnostics all at once.

### 2. Implementation grouping replaced user grouping

Current grouping follows owner surfaces and state sources more than user
questions. Examples:

- package lifecycle actions, Home shortcut management, physical plugin surface,
  and capability summaries are merged into one page;
- update, repair, package sync, storage cleanup, local services, and task
  progress are all treated as one maintenance bucket;
- remote access, Docker WebUI, OPL Workspace, SSH/HPC, and cloud resource refs
  are flattened into one broad entry.

### 3. Summary-first was lost

Cards are used where list or table density is more appropriate. The biggest
case is Agent Packages: a per-agent card layout makes the page feel like a
dashboard even though the user's task is directory-style management.

### 4. Runtime evidence leaked into ordinary Settings

The maintenance page currently includes "ongoing tasks" and deep task detail.
That belongs to Runtime / Run Status, not Settings. Settings should answer:

- is the foundation healthy;
- do I need to update or repair;
- what will change if I do.

It should not become a secondary project-progress console.

### 5. Capability replacement was allowed where only extension was acceptable

The current "Cloud & Remote Access" framing partially replaces AionUI's native
remote-access capability instead of extending it. That violates a basic product
rule for this App family:

- upstream AionUI user capability must not regress;
- OPL-specific capability should be additive;
- implementation detail may be hidden, but user ability must not shrink.

### 6. Secondary-route policy hid expected pages

`About` and `Update` were pushed into secondary or hidden surfaces. Even if the
route still exists, from a user perspective the page is gone. That is a
discoverability failure, not only a nav-label issue.

## Current Symptoms

The drift is visible in current implementation:

- Agent Packages are rendered as large per-purpose cards with inline package
  actions, Home visibility controls, movement controls, receipt fields, and
  physical-surface details instead of a directory-style list view.
  Reference: [CapabilitiesSettings.tsx](/Users/gaofeng/workspace/one-person-lab-app/shells/aionui/packages/desktop/src/renderer/pages/settings/CapabilitiesSettings.tsx:488)
- Maintenance includes task-run overview and task detail, which duplicates the
  Run Status concern.
  Reference: [RuntimeSettings.tsx](/Users/gaofeng/workspace/one-person-lab-app/shells/aionui/packages/desktop/src/renderer/pages/settings/sections/RuntimeSettings.tsx:287)
- Access merges remote-access tags, dry-run route entries, Docker/WebUI actions,
  and resource-source refs into one broad surface.
  Reference: [AccessSettings.tsx](/Users/gaofeng/workspace/one-person-lab-app/shells/aionui/packages/desktop/src/renderer/pages/settings/sections/AccessSettings.tsx:151)
- `About` still exists technically, but the page itself tells users maintenance
  moved away, reinforcing the disappearance of a normal "About & Updates"
  destination.
  Reference: [AboutModalContent.tsx](/Users/gaofeng/workspace/one-person-lab-app/shells/aionui/packages/desktop/src/renderer/components/settings/SettingsModal/contents/AboutModalContent.tsx:212)
- The current contract still encodes "Maintenance & Updates" as the place for
  updates, runtime fabric, companion tools, package maintenance, and related
  actions, which is structurally too broad.
  Reference: [app-gui-product-contract.json](/Users/gaofeng/workspace/one-person-lab-app/contracts/app-gui-product-contract.json:1784)

## Reorganization Principles

### User cognition first

Top-level Settings pages should answer stable user questions:

1. Can I start using the App?
2. What can this App do for me?
3. Do I need to update or repair anything?
4. Where is my local data?
5. How do I change preferences?
6. Where are advanced diagnostics if I really need them?

### No capability regression

If AionUI already provides a user-facing capability, OPL App may:

- rename it in user language;
- reorganize its presentation;
- add OPL-specific entry points or summaries;
- add domain-specific guidance.

OPL App may not remove or weaken the capability unless the replacement is
strictly stronger from the user's point of view.

### Summary first, detail on entry

- use summary cards for page-level health;
- use list or table views for catalogs, packages, and directories;
- use drawers or details pages for refs, manifests, receipts, paths, and raw
  technical state.

### Runtime progress stays out of Settings

Project/task status belongs to Runtime / Run Status. Settings can link there,
but must not duplicate the detailed surface.

## Target Information Architecture

### Ordinary pages

- `总览`
- `访问方式`
- `智能体与能力`
- `资源与连接`（secondary/deep-link under Access）
- `维护与更新`
- `数据与存储`
- `偏好`
- `高级`

### Always-discoverable secondary page

- `关于与更新`

This page may still be secondary in routing terms, but it must be visibly
discoverable from Settings navigation, for example in a footer slot or a stable
"About & Updates" entry under Advanced.

## Target Page Design

### 1. 智能体与能力

This page should stop behaving like a dashboard of big cards and become a
directory-style management surface.

#### Structure

- Top summary strip:
  installed package count, packages needing attention, Home shortcuts count,
  tools/connectors readiness summary.
- `智能体目录`:
  list view, one row per package.
- `首页快捷入口`:
  separate compact list for visible Home shortcuts and ordering.
- `工具与连接器`:
  separate section for Tools / MCP / voice / external tools readiness.

#### Smart Agent Directory row model

Each row should show only:

- package name;
- source;
- installed version;
- status;
- Home visibility;
- primary action.

Primary actions:

- `安装`
- `更新`
- `修复`
- `卸载`
- `详情`

Detail view should hold:

- manifest URL and registry source;
- required skills;
- plugin materialization state;
- rollback ref / receipt ref / physical surface;
- failure reason;
- advanced refs.

What should be removed from the default row:

- long descriptive paragraphs;
- grouped purpose cards;
- receipt-heavy blocks;
- per-row Home reorder buttons mixed into package actions.

#### Home shortcut management

Home shortcuts are not package identity. They should be a separate list:

- shortcut label;
- bound package;
- visible/hidden;
- order.

This is a small "launcher config" list, not part of the package directory row.

### 2. 维护与更新

This page should own only system maintenance, not project progress.

#### Remove

- `进行中的任务`
- task status overview blocks
- task condition detail
- evidence/action/resource ref drilldowns for active work

Those belong to Runtime / Run Status only.

#### Keep

- App update status
- runtime/toolchain health
- package sync and repair health
- local services entry
- storage cleanup deep link
- repair suggestions

#### Page model

The page should read like a maintenance hub with four sections:

- `应用更新`
- `运行环境`
- `智能体包与能力同步`
- `本机服务与修复`

Each section should show:

- current state;
- impact in user language;
- one recommended action;
- whether restart is needed.

Advanced details such as dry-run route, receipt ref, rollback ref, and manual
guidance belong behind disclosure.

### 3. 开始使用

This page should answer access questions only.

#### Target sections

- `模型与账号`
- `Codex CLI`
- `本机远程访问`
- `资源与连接` deep link

#### Remote access rule

`本机远程访问` must preserve the local browser-access capability while hiding
implementation provenance from first-screen copy. Do not use "AionUI native" as
the primary user label.

The page should be split into:

- `访问方式`
  OPL Gateway, Codex CLI, local browser access to this computer.
- `资源与连接`
  Docker WebUI, OPL Workspace, SSH/HPC, OPL Cloud or Fabric refs, Environment
  Catalog refs, and Console-managed resource context.

#### Do not make these primary

- raw dry-run command routes;
- payload-required action rows;
- infrastructure tags as the first thing users see.

Those belong in "details" or "advanced route information".

### 4. 关于与更新

This must come back as an expected Settings destination.

#### It should contain

- current App version;
- release channel;
- shell/framework revision;
- latest stable version if known;
- `检查更新`;
- release notes / changelog link;
- feedback and repository links.

#### It should not contain

- a message whose main job is to say maintenance moved somewhere else;
- package maintenance controls;
- storage cleanup;
- runtime diagnostics.

The relationship should be:

- `关于与更新` answers "what version am I on, and is there an update?"
- `维护与更新` answers "what should I repair, sync, or maintain?"

## Recommended Navigation Labels

Use this top-level wording:

- `总览`
- `开始使用`
- `智能体与能力`
- `维护与更新`
- `数据与存储`
- `偏好`
- `高级`

Use these stable task labels inside pages:

- `模型与账号`
- `工作区`
- `远程访问与部署`
- `智能体目录`
- `首页快捷入口`
- `工具与连接器`
- `应用更新`
- `运行环境`
- `本机服务`
- `关于与更新`

## Implementation Direction

### Contract changes needed

- move task-progress visibility out of Settings ordinary pages;
- restore discoverable `About & Updates`;
- redefine Capabilities ordinary surface as package directory plus shortcut list,
  not purpose-card dashboard;
- define non-regression rule for AionUI remote-access capability;
- narrow Maintenance page to system maintenance only.

### Shell changes needed

- replace package-purpose card grid with list view plus detail drawer;
- remove runtime task panel from Maintenance page;
- split remote-access surface into base AionUI capability and OPL additive
  sections;
- restore visible `About & Updates` entry.

## Acceptance Standard

The reorganization is correct when:

- a new user can explain what each Settings page is for in one sentence;
- no page mixes project progress with system maintenance;
- package management feels like directory management, not dashboard browsing;
- AionUI native remote-access capability is still directly usable;
- `About & Updates` is easy to find without knowing a hidden route;
- receipts, refs, raw routes, and implementation diagnostics are not first-screen
  content.
