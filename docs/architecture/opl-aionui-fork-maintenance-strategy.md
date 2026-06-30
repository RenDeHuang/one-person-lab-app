# ADR: AionUI Settings Fork Maintenance Strategy

Owner: `one-person-lab-app`
Purpose: `aionui_settings_fork_maintenance_strategy`
State: `accepted`
Date: `2026-06-30`
Machine boundary: Human-readable architecture strategy. Machine-readable truth
lives in `contracts/app-settings-control-plane.json`,
`contracts/app-gui-product-contract.json`, `contracts/app-shell-adapter.json`,
active shell source, validation scripts, and release/user-path evidence.

## Context

The active One Person Lab App shell is the OPL-maintained AionUI fork under
`shells/aionui/`, backed by the external shell repository
`gaofeng21cn/opl-aion-shell`. Upstream AionUI remains useful implementation
material, but the App repo owns GUI product truth, Settings information
architecture, App state/action boundaries, page-state expectations, screenshots,
release/user docs, and release gates.

Claude's original assessment correctly identified that upstream Settings changes
can conflict with OPL Settings work. The current repo has already moved the
owner boundary away from "keep a large fork synchronized by hand" and toward an
App-owned Settings Control Plane:

- `contracts/app-settings-control-plane.json` owns the Settings registry, route
  behavior, legacy redirects, extension anchor remaps, state/action source
  policy, `SettingsHost` / `SettingsShellAdapterSlot`, page adapter policy,
  upstream intake checklist, visual QA policy, and product-system checklist.
- `contracts/app-gui-product-contract.json` owns the GUI product requirements
  and the `settings_ia.v1` source contract.
- `contracts/app-shell-adapter.json` owns the active shell adapter boundary and
  defines AionUI as implementation carrier, not product authority.

## Decision

Do not create a new three-layer architecture, new integration package, plugin
ecosystem, or standalone extension framework for Settings maintenance.

Maintain the AionUI fork through the existing App-owned control path:

1. **App-owned Settings Control Plane** stays the source for Settings product
   IA, ordinary and secondary routes, legacy redirects, extension anchor remaps,
   state/action source policy, page adapter policy, intake classification, and
   visual QA expectations.
2. **Thin shell adapter** remains the implementation boundary. AionUI may own
   renderer layout, route sync, tab switching, slot mounting, shell-local i18n,
   styling, process/preload details, package metadata, and focused shell tests.
   It must not own product IA, model/provider policy, runtime/domain truth,
   release readiness, or owner receipt authority.
3. **Upstream intake gate** classifies every upstream Settings surface before it
   enters the registry, `SettingsHost`, or `SettingsShellAdapterSlot`.
4. **Visual QA is behavior evidence only.** It can prove Settings route framing,
   overlap, screenshot, and rendering behavior for the active shell. It cannot
   prove release readiness, packaged App readiness, runtime currentness, owner
   acceptance, or production readiness.

This keeps the App contract first and the shell delta thin. The fork can absorb
upstream fixes, but only after checking them against App-owned contracts.

## Claude Proposal Disposition

| Claude proposal | Disposition | Reason |
| --- | --- | --- |
| Keep a clear upstream/custom boundary | Adopt | Matches the App contract-first shell policy. The boundary is `contracts/app-settings-control-plane.json` plus `contracts/app-shell-adapter.json`, not a new package tree. |
| Use adapter/facade concepts to absorb upstream change | Adopt in current form | The existing `SettingsHost` / `SettingsShellAdapterSlot` and explicit page view-model adapters are the facade/adapter boundary. Do not add another facade package unless a concrete contract gap appears. |
| Classify upstream Settings changes before accepting them | Adopt | The repo already uses `accepted`, `adapt`, `redirect`, and `reject` buckets for Settings-specific intake. |
| Keep OPL pages modular and view-model based | Adopt | Existing Access, Environment, Storage, and Capabilities adapters are the right direction. Continue splitting large pages by summary/action/maintenance/diagnostics ownership. |
| Create `packages/opl-aion-integration` and `packages/opl-extensions/*` | Do not adopt | This would create a second control plane and increase ownership surface. Current repo truth says App contracts own behavior and the shell renders/adapts it. |
| Build a plugin/extension ecosystem for Settings | Do not adopt | No current requirement needs a general plugin system. Upstream-compatible slots are enough for this App-owned product surface. |
| Convert AionUI into a pristine subtree with overlay layers | Do not adopt | `shells/aionui/` is an external shell checkout. App default branch must not vendor AionUI history or create a second upstream topology. |
| Add broad sync scripts and conflict analyzers as a strategy prerequisite | Do not adopt here | Sync automation belongs in the shell repo only when an observed repeatable failure justifies it. This ADR is not a script work order. |
| Claim numeric ROI such as 300%, 2/10, 10-day savings | Remove | The repo has no fresh evidence for those measurements. Maintenance claims must stay qualitative unless backed by live timing or release records. |

## Upstream Intake Policy

For Settings changes from upstream AionUI:

- `accepted`: layout, styling, accessibility, i18n, flicker, and extension tab
  rendering fixes that implement existing App-owned routes, task entries,
  protocols, or visual QA targets without changing authority.
- `adapt`: upstream skills/tools, assistant, provider/model, remote-access, or
  route changes that can be represented only through the App registry, adapter
  slot, page-state matrix, and App state/action routes.
- `redirect`: upstream setup shortcuts or raw configuration affordances that
  remain only as compatibility redirects or extension-anchor remaps to an
  App-owned Settings group.
- `reject`: upstream-only configuration, Team mode, raw provider or runtime
  internals, domain truth mutation, owner receipt mutation, silent developer
  checkout updates, or any forbidden ordinary-user surface.

The fixed intake sequence is:

1. Record the upstream Settings surface and user-visible behavior.
2. Classify it before changing the Settings registry or adapter slot.
3. Bind `accepted` and `adapt` entries to `SettingsHost` /
   `SettingsShellAdapterSlot` evidence.
4. Route `redirect` and `reject` entries through legacy redirects, extension
   anchor remaps, or forbidden probes.
5. Keep runtime truth, domain truth, provider implementation, owner receipts,
   release readiness, and currentness outside the shell adapter.

## Shell Delta Budget

Allowed AionUI shell delta for Settings:

- hydrated product profile and Settings registry consumption;
- route and tab compatibility redirects;
- `SettingsHost` and `SettingsShellAdapterSlot` rendering and route sync;
- thin renderer components for App-owned Settings slots;
- App state reads through `opl app state --profile fast --json`;
- App mutations through `opl app action execute --action <id> ... --json`;
- shell-local styling, i18n, layout, focused tests, and screenshot hooks needed
  to prove the App contract.

Forbidden shell delta:

- shell-owned product IA or ordinary Settings tabs;
- shell-owned model/provider/reasoning policy;
- direct runtime/domain truth reads or writes;
- owner receipt or domain artifact authority;
- release/currentness claims from Settings UI tests or screenshots;
- upstream Team mode or raw provider/runtime internals in ordinary Settings;
- silent dirty/developer checkout mutation.

## Consequences

- Upstream AionUI remains implementation material, not App truth.
- Settings maintenance work should usually change contracts/docs first, then
  shell rendering if behavior changes.
- The cheapest durable fix is to strengthen the existing control plane or
  adapter slot when a real gap appears, not to create a parallel package layer.
- Release/currentness remains release-owner evidence, even if Settings contract
  validation and visual QA pass.

## Verification

For this ADR update, docs-only landing requires `git diff --check`.

For future Settings behavior changes, use the existing boundaries:

- root active-shell validation after contract or wrapper changes;
- focused shell Settings tests for renderer behavior;
- Settings visual QA manifest for screenshot/framing claims;
- release-owner evidence for packaged App readiness, currentness, notarization,
  and release promotion.
