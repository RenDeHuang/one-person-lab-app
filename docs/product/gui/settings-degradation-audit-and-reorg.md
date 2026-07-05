## Settings Degradation Audit And Reorg

Owner: `one-person-lab-app`
Purpose: `settings_user_mental_model_reorg`
State: `active_design_record`
Machine boundary: Human-readable rationale only. Machine-readable truth lives in
`contracts/app-gui-product-contract.json#settings_navigation.settings_ia`,
`contracts/app-settings-control-plane.json`, and
`contracts/app-page-state-matrix.json`.

## Root Cause

Settings drifted because three different concerns were presented as if they were
the same thing:

1. Product semantics were expressed with large purpose cards inside
   Capabilities, so users had to reverse-engineer whether they were looking at
   installed packages, launch shortcuts, or session behavior.
2. Maintenance pages accumulated package, update, and runtime-health controls
   next to signals that looked like ongoing task detail, which blurred the line
   between system upkeep and work progress.
3. Access adapted AionUI remote-access language into OPL concepts without
   clearly stating that native remote-access entry points were still preserved.
4. About and Update remained routable, but they were no longer described as
   stable discoverable pages, so they read like incidental links instead of
   durable entry points.

The fix is not another Settings abstraction. The fix is to restore one user
mental model per area and keep the App contract explicit about the boundary.

## Reorganized Mental Model

### Setup & Access

Access answers how the App connects and where work can happen. OPL App adds
Gateway, Workspace, Fabric, and Console context around the existing AionUI
remote-access abilities. It does not remove native remote-access entry points.

### Agents & Capabilities

Capabilities is package-first:

- agent package directory/list;
- Home shortcut list and order;
- package support details such as Codex Surface sync;
- tools/connectors as supporting sections below packages and shortcuts.

Purpose labels may still appear as Home shortcut names, but they are not the
primary page semantics. Settings must not grow a strong Session Contract here:
no stage behavior contract, prompt internals, artifact schema authority, or
readiness verdict authority.

### Maintenance & Updates

Maintenance is system maintenance only:

- installation carrier;
- runtime substrate;
- companion tools;
- OPL Packages and Codex Surface sync;
- local service health and repair.

It must not present in-progress task detail, workflow candidate state,
deliverable progress, or domain blocker ledgers as if they belonged to system
maintenance.

### About And Update

About and Update remain secondary pages, but they are stable pages with stable
routes and explicit discovery surfaces. They should be reachable from their
parent groups and Settings search, not demoted to incidental overflow links.

## Contract Landing

This reorg lands in three places together:

- `contracts/app-gui-product-contract.json`: user-facing IA, page semantics,
  and discoverability language.
- `contracts/app-settings-control-plane.json`: adapter, validator, upstream
  intake, and completion-audit rules.
- `contracts/app-page-state-matrix.json`: page-level must-show and must-not-show
  expectations.

If one changes without the others, Settings drift comes back.
