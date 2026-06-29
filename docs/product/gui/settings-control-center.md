# Settings Control Center

Owner: `one-person-lab-app`
Purpose: `settings_control_center_product_design`
State: `active_design_target`
Machine boundary: Human-readable product design. Machine-readable truth lives in
`contracts/app-gui-product-contract.json`,
`contracts/app-page-state-matrix.json`, active shell source, validation scripts,
and release/user-path evidence.

## Goal

Settings is the One Person Lab App control center, not an upstream AionUI
configuration dump. It should answer user questions in this order:

1. Can I use the App now?
2. What do I need to configure?
3. What OPL capabilities can I use?
4. What needs maintenance?
5. How do I safely manage local data?
6. Where are technical diagnostics when I need them?

The default surface gives conclusions and next actions. Raw paths, ids,
receipts, component ids, JSON payloads, operation modes, and implementation
diagnostics remain behind disclosure controls or Advanced pages.

## Information Architecture

The target navigation groups are:

| Group | Pages | Primary user question |
| --- | --- | --- |
| Overview | Overview | Is the App usable now, and what should I do next? |
| Get Started | Access & Model, Workspace | How do I connect the App, and where does work happen? |
| Capabilities | Agents & Capabilities | What can OPL help me do? |
| Maintenance | Updates & Maintenance, Storage & Data, Local Services | How do I keep the local App healthy and safe? |
| Preferences | Appearance, Language & Notifications | How should the App behave and look for me? |
| Advanced | Developer & Diagnostics, About | Where are technical details, raw references, versions, and links? |

Legacy routes such as `runtime`, `model`, `agent`, `assistants`, `skills-hub`,
`tools`, `display`, `webui`, `pet`, and `system` remain compatibility redirects.
They must not reappear as ordinary navigation.

## Page Contracts

## Task Entries

The Control Center keeps six top-level groups. User task entries are surfaced
inside those groups instead of adding more tabs.

P0 entries:

- Model & Account: current model, model access/API key readiness, connection
  check, and repair entry. It belongs to Get Started.
- Workspace: current path, open/change/verify actions, and permission status.
  It belongs to Overview as an ordinary setup entry.
- Maintenance Hub: App updates, runtime/toolchain, OPL Packages, storage
  cleanup, and repair recommendations. It belongs to Maintenance.
- Capability Status: Research, Grant Writing, Presentations, Book/manuscript
  work, and OPL automation show usable / needs update / needs repair /
  not configured. It belongs to Capabilities.

P1 entries:

- Web / Docker / Remote Access: direct route for users who need WebUI, Docker,
  or remote access. It belongs to Get Started.
- Developer Profile Status: local checkout source, auto-update impact, and
  dirty checkout risk. It belongs to Advanced.
- External Tools & Voice: ordinary label for tools, MCP support, and voice.
  MCP is explanatory detail, not the primary entry name.
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
- direct entries for Workspace, Model & Account, Maintenance, Capabilities, and
  Web / Remote Access;
- last maintenance check and next background check when known;
- a collapsed technical detail section.

The overview must not show raw readiness booleans, OPL command names, framework
phase names, git state, or package receipt ids as first-screen content.

### Access & Model

Access & Model owns user-facing connection readiness:

- Codex CLI availability;
- Model & Account with current model, account/API key readiness, connection
  check, and repair entry;
- model access/API key state;
- default model and reasoning selection;
- permission meaning in user language;
- Web / Docker / Remote Access as a clearly named secondary surface.

Base URLs, token paths, raw config files, and provider internals are advanced
details, not first-screen content.

### Workspace

Workspace is an ordinary setup page, not hidden inside Local Environment. It
shows:

- current workspace folder;
- whether the folder exists and is writable;
- where App work products and project files are stored by default;
- choose, change, open, and repair-permission actions.

Workspace must not be presented as a runtime diagnostic-only field.

### Agents & Capabilities

Capabilities are organized by work purpose before implementation detail:

- Research;
- Grant Writing;
- Presentations;
- Book / manuscript work;
- OPL automation and Meta Agent.

Each purpose card shows current availability, primary entry, required package or
skill support, whether it needs update or repair, and last capability sync when
available. Skills, external tools, MCP, voice, and custom assistants are
supporting sections below the purpose model.

### Updates & Maintenance

Updates & Maintenance owns normal maintenance, while About owns only version and
links. The maintenance page groups:

- App binary;
- runtime/toolchain;
- OPL Packages;
- storage cleanup;
- repair recommendations;
- capability exposure sync.

Each group uses the same structure: current state, user summary, recommended
action, last check, next check, and details disclosure. Apply, repair, and
rollback actions are per component and show component-specific loading state.
Dangerous or state-changing actions require a confirmation surface explaining
what will change, what will not change, and what rollback or receipt reference
will exist.

The App remains a consumer of OPL/App action routes and managed updater status;
it must not implement the update kernel or write runtime/domain truth.

### Storage & Data

Storage & Data uses user safety language:

- Update cache;
- Conversation archives;
- Runtime cache;
- Logs.

The first screen shows size, safety classification, and the recommended action.
Technical terms such as dry-run may appear as secondary labels, but primary
copy should say "Preview cleanup plan" and "Clean selected cache". Destructive
actions stay disabled until the required preview, archive, restore proof, or
receipt exists.

### Local Services

Local Services answers whether the local foundation can run:

- Codex executor;
- local background service;
- Temporal worker when present;
- native helpers and runtime support;
- module loading health.

It offers diagnose, refresh, start/restart, and repair actions. Module paths,
repo urls, git status, and component receipt refs stay collapsed.

### Appearance

Appearance belongs to Preferences, not Maintenance or Local Runtime. It owns:

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

It can link to Updates & Maintenance but must not be the primary maintenance
page.

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

The App should not maintain several hidden copies of Settings IA. A
machine-readable Settings IA contract should be the long-term source for:

- visible navigation groups and page ids;
- route redirects;
- i18n key coverage;
- page-state matrix expectations;
- validation fixtures and smoke route ids;
- screenshot/user-guide targets.

Implementation components should consume typed view models. Large mixed pages
such as Local Environment should be split into summary, action, maintenance,
and diagnostics components so each part has one owner and one test surface.

## Verification Expectations

Structural landing requires:

- App contracts and page-state matrix updated;
- active shell navigation and routes updated;
- i18n labels updated in English and Chinese;
- active-shell validation passing;
- affected shell typecheck or focused UI checks passing;
- docs decisions/invariants updated.

This does not by itself prove release readiness, packaged App readiness, VM
smoke, or production readiness. Those remain release-owner and runtime evidence
lanes.
