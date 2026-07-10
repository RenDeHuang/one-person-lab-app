# ADR: AionUI Fork Maintenance and Intake Strategy

Owner: `one-person-lab-app`
Purpose: `aionui_fork_maintenance_and_intake_strategy`
State: `accepted`
Date: `2026-06-30`
Updated: `2026-07-10`
Machine boundary: Human-readable architecture strategy. Machine-readable truth
lives in `contracts/app-settings-control-plane.json`,
`contracts/app-gui-product-contract.json`, `contracts/app-shell-adapter.json`,
`scripts/validate-active-shell/upstream-intake-policy-validator.ts`, active shell
source, validation scripts, and release/user-path evidence.

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
3. **Upstream intake gate** classifies every required shell capability and
   dependency before App release admission. Settings-specific changes must also
   pass their own classification before entering the registry, `SettingsHost`,
   or `SettingsShellAdapterSlot`.
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

## AionUI v2.1.31 Executable Intake

The July 2026 selective intake is pinned to three different Git roles. They
must not be collapsed into one generic "upstream ref":

- fork base: `70974c59a275e565e8fc2bd7ecaf2dcac74227f0`;
- evaluated upstream release: `v2.1.31` at
  `e49cd94935f4e461f002a1260a47c1b7b2ce81ca`;
- selective absorption and intake-record head:
  `e38b00ba37cafe56d704b498a4882264836463e4`.

The App does not track the current shell HEAD as proof of this intake because
the shell may contain later unrelated work. `contracts/app-shell-adapter.json`
records the fixed source refs, required capability IDs, required dependency
IDs, classification, owner ref, release gate, dependencies, and evidence.

| Intake item | Classification | App gate |
| --- | --- | --- |
| Backend startup directories | `absorbed` | Shell startup focused tests plus App quick validation |
| Corrupted database recovery | `absorbed` | Adapter code and its AionCore dependency are admitted; App release authority remains separate |
| AionCore database-recovery boundary | `absorbed` dependency | Requires actual `aioncoreVersion >= v0.1.44`, a typed corruption failure or strict corruption-marked `database.open` failure, verified `database.recovery` success, and a remediation ancestor |
| AionCore managed-agent API compatibility | `absorbed` | Quick validation checks the pinned remediation ancestor, required source/test paths, retired-facade absence, and exact focused-command registration; the focused Node/DOM commands prove DTO and caller behavior |
| Feedback diagnostics privacy | `absorbed` | Redaction/privacy evidence and queue-only user messaging are bound to a remediation ancestor for attached shell, AionCore, and AionRS logs |
| Cron history | `absorbed` | Shell Cron focused tests plus App quick validation |
| `/guid` slash allowlist | `absorbed` | OPL allowlist-focused tests plus App quick validation |
| Settings/i18n refinements | `absorbed` | Settings/i18n focused checks plus App quick validation; App Settings IA remains authoritative |
| Non-Chinese/English locale payload | `rejected` | Additional upstream locale payload must remain absent |
| AionUI Team | `rejected` | Existing fail-closed route, mutation, sidebar, deep-link, and MCP scrub probes |

The validator owns the required ID set. Removing an item from both the JSON
record and a JSON self-declared list cannot make the gate pass. It rejects
missing records or fields, duplicate or unknown IDs, invalid classifications,
unresolved dependencies, missing evidence, an unblocked capability with a
non-absorbed dependency, and weakened AionCore version/capability gates.

Validation is also bound to the resolved active shell checkout. The App reads
the shell `package.json` and requires its actual `aioncoreVersion` to match the
contract's `selective_absorption_version`. The selective absorption ref and any
record-level `remediation_ref` must be ancestors of the current shell `HEAD`;
`HEAD` may advance and is not required to remain exactly equal to either ref.
Moving AionCore recovery from `deferred` to `absorbed` therefore requires only
the final contract values and shell evidence: admitted version state, verified
capability evidence, an unblocked release gate, and a remediation SHA already
contained in active shell history.

The current active shell source package reports `aioncoreVersion=v0.1.44`, so
the version gate is `meets_minimum` and the recovery capability is `verified`.
The AionCore `v0.1.44` runtime probe establishes two valid failure boundaries:
`BOOTSTRAP_DATA_INIT_FAILED` at `database.recoverable_corruption`, or the same
code at `database.open` only when AionCore output also contains a strict SQLite
corruption marker such as `file is not a database`. Lock, permission, and
ordinary open failures remain generic. Successful recovery preserves the
original bytes in backup, creates a `SQLite format 3` database, emits
`BOOTSTRAP_RECOVERED_DATABASE_CORRUPTION` at `database.recovery`, and reaches
the listening state.

The feedback privacy remediation ancestor is
`9059e992324d18c00de1f2f7503f7da3e77706ba`. It keeps diagnostic attachments
opt-in, redacts credential and local-path material, and reports only queue
confirmation rather than server acceptance or delivery. The AionCore recovery
remediation ancestor is `81c8b37fdc067549341b41539d7648b09aa31d37`.
The managed-agent/AionCore write and event-contract remediation ancestor is
`6875ada9fa6e800b64980dadb02180def6b0f6e2`.
Source package and ancestry readback do not substitute for App release-owner
evidence.

### Managed-Agent API Compatibility Guard

The v2.1.31 intake originally missed the managed-agent migration even though the
selected shell already required AionCore `v0.1.44`. The direct cause was an
evidence-layer gap: App quick validation knew the intake matrix and AionCore
version, but no capability remediation ancestor or executable focused behavior
command was bound to the managed-agent contract.

`contracts/app-shell-adapter.json#upstream_intake.managed_agent_api_contract`
records the required wire behavior:

- business assistant selection uses `GET /api/assistants`;
- Agent Settings, diagnostics, and runtime metadata use
  `GET /api/agents/management`;
- managed-agent health checks use `POST /api/agents/{id}/health-check`;
- Conversation writes Assistant identity at top-level `assistant.id`;
- Channel settings use the centralized Assistant selector and canonical
  `assistant_id` GET/PUT boundary;
- Cron writes `agent_config.assistant_id`, `at_ms`, and `every_ms`;
- Team create/add uses the shared `assistant_id` mapper, canonical AionCore
  response fields, and the recorded Team WebSocket event adapters.

The managed-agent quick gate is structural. It proves only that:

- the contract has the exact required shape;
- the `managed_agent_api` capability is pinned to remediation ancestor
  `6875ada9fa6e800b64980dadb02180def6b0f6e2`, and active shell `HEAD`
  contains it;
- required source and focused-test paths exist;
- retired `useAgents.ts` and `useDetectedAgents.ts` facade paths are absent;
- the exact focused behavior command IDs and command bodies are registered
  before the full-test command.

Quick validation deliberately does not parse TypeScript source text and does
not execute focused tests. A fixture containing only `export {};` is therefore
valid structural evidence when all required paths are present; it is not
semantic or runtime behavior evidence.

Behavior is proved by two executable validation commands:

- `managed_agent_behavior_node` runs the exact adapter, migration,
  Conversation, Channel, Cron, and Team Node/Vitest files;
- `managed_agent_behavior_dom` runs the exact Guid caller and Assistant editor
  DOM files with the DOM Vitest project enabled.

Non-quick `validate:active-shell` executes both commands before the existing
full-test command. Only a successful command execution proves the focused
behavior suite passed. The subsequent full test portfolio broadens regression
coverage but still does not prove that an installed App contains the tested
shell.

Packaged-runtime validation, installed-App readback, user-path acceptance, and
release-owner evidence remain separate. Contract structure, remediation
ancestry, focused tests, and full tests must not be presented as packaged or
release readiness.

## Upstream Intake Policy

Broad shell intake uses `absorbed`, `rejected`, and `deferred` in
`contracts/app-shell-adapter.json`. Settings-specific intake continues to use
its narrower `accepted`, `adapt`, `redirect`, and `reject` buckets because it
routes changes through the App-owned Settings registry and adapter slot.

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

For the v2.1.31 executable intake contract, run:

- JSON parse for `contracts/app-shell-adapter.json`;
- focused upstream-intake release tests;
- `npm run validate:active-shell -- --quick` for structural contract,
  remediation ancestry, required-path, retired-facade, and command-registration
  proof only;
- `npm run validate:active-shell -- --only managed_agent_behavior_node` for
  focused non-DOM managed-agent behavior;
- `npm run validate:active-shell -- --only managed_agent_behavior_dom` for
  focused Guid/Assistant DOM behavior;
- non-quick `npm run validate:active-shell` for both focused commands plus the
  full configured validation chain;
- `git diff --check`.

None of these commands alone proves packaged App or release readiness. Use
packaged-runtime validation, installed-App readback, user-path acceptance, and
release-owner evidence for those claims.

For future Settings behavior changes, use the existing boundaries:

- root active-shell validation after contract or wrapper changes;
- focused shell Settings tests for renderer behavior;
- Settings visual QA manifest for screenshot/framing claims;
- release-owner evidence for packaged App readiness, currentness, notarization,
  and release promotion.
