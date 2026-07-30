# ADR: AionUI Fork Maintenance and Intake Strategy

Owner: `one-person-lab-app`
Purpose: `aionui_fork_maintenance_and_intake_strategy`
State: `accepted`
Date: `2026-06-30`
Updated: `2026-07-22`
Machine boundary: Human-readable architecture strategy. Machine-readable truth
lives in `contracts/app-settings-control-plane.json`,
`contracts/app-gui-product-contract.json`, `contracts/app-shell-adapter.json`,
`scripts/validate-active-shell/upstream-intake-policy-validator.ts`, active shell
source, validation scripts, and release/user-path evidence.

## Context

The active One Person Lab App shell is the OPL-maintained AionUI fork under
`shells/aionui/`, backed by the external shell repository
`gaofeng21cn/opl-aion-shell`. Upstream AionUI remains useful implementation
material, but the App repo owns GUI product truth, Codex-reference translation,
Settings information architecture, App state/action boundaries, page-state
expectations, screenshots, release/user docs, and release gates.

Settings conflicts exposed the wider maintenance problem: OPL cannot keep a large
private renderer rewrite synchronized by hand. The owner boundary therefore applies
to the whole GUI, not only Settings. App contracts and design docs define the target;
AionUI provides the runtime, route/component primitives and upstream update stream;
OPL customization is constrained to explicit profile, bridge, composition and token
surfaces wherever possible.

The default is to inherit AionUI/AionCore official capability, not to reconstruct
or suppress it. An App contract may adapt a user-facing result or explicitly cut
a surface such as Team, but an unrelated upstream capability is not disabled
merely because it is absent from an OPL allowlist. A complex feature absent
upstream stays unbuilt unless a protected B0/R1/U1 result demonstrates its need.
Problems confined to rejected, retired, or private legacy features remain outside
the ordinary product repair queue.

- `contracts/app-settings-control-plane.json` owns the Settings registry, route
  behavior, legacy redirects, extension anchor remaps, state/action source
  policy, `SettingsHost` / `SettingsShellAdapterSlot`, page adapter policy,
  upstream intake checklist, visual QA policy, and product-system checklist.
- `contracts/app-gui-product-contract.json` owns the GUI product requirements
  and the `settings_ia.v2` source contract.
- `contracts/app-shell-adapter.json` owns the active shell adapter boundary and
  defines AionUI as implementation carrier, not product authority.

## Decision

Do not create a new integration package, private component framework, plugin ecosystem
or second shell-local product model to maintain the GUI.

Maintain the AionUI fork through the existing App-owned control path:

1. **App-owned product definition** stays the source for Codex baseline translation,
   OPL deltas, ordinary navigation, page-state, model/access policy, Settings IA,
   user-triggered thread operations, state/action source policy and visual acceptance.
2. **Thin shell adapter** remains the implementation boundary. AionUI may own
   upstream renderer primitives, route sync, slot mounting, shell-local i18n,
   styling, process/preload details, package metadata and focused shell tests.
   It must not own product IA, model/provider policy, runtime/domain truth,
   thread identity/history, thread-operation policy, release readiness, or
   owner receipt authority.
3. **Upstream intake gate** classifies every required shell capability and
   dependency before App release admission. Settings-specific changes must also
   pass their own classification before entering the registry, `SettingsHost`,
   or `SettingsShellAdapterSlot`.
4. **Core workflow has priority.** Evidence is collected in the order
   `P0 Codex Core -> P1 OPL Professional -> P2 Administration`. Settings evidence
   cannot substitute for rail/Home/conversation/composer evidence.
5. **Visual QA is behavior evidence only.** It can prove route framing, overlap,
   screenshot and rendering behavior for the active shell. It cannot
   prove release readiness, packaged App readiness, runtime currentness, owner
   acceptance, or production readiness.
6. **Session Project affinity stays minimal.** The thread ID owns task identity;
   the workspace selector only sets a new task's initial cwd. A projectless
   session with no canonical `projectId` may make one user-triggered
   `unbound -> bound` transition. The existing App Server adapter uses its typed
   affinity IPC, requires exact assignment and `thread/read.projectId` readback
   with recorded cwd unchanged, and only then commits the local projection.
   Failure leaves the session projectless and usable; an existing explicit
   affinity blocks reassignment. Environment stays read-only, and recorded cwd,
   turn/command `pwd`, plus writable roots remain independent. The fork does not
   maintain a second client or adoption service, managed Worktree/Handoff, projection
   rollback, receipt, or `workspace_handoff` metadata.
7. **Package user results stay whole while lifecycle machinery shrinks.**
   Package owners define identity, capabilities, complete bytes, runtime health,
   and independent publication. Configured carriers own install/update state;
   Framework aggregates fresh complete-Package readback, required-presence
   status, executor-route readiness, and generic actions. App owns preferences,
   while Shell only renders and invokes projected actions. Existing Framework
   locks, receipts, `rollback_ref`, materialization, and Shell compatibility
   parsers remain migration surfaces only until the functionality-equivalence
   gates in
   [`../active/opl-package-platform-composition-migration.md`](../active/opl-package-platform-composition-migration.md)
   close; they are not accepted long-term authority and must then be deleted.

This keeps the App contract first and the shell delta thin. The fork can absorb
upstream fixes, but only after checking them against App-owned contracts.

## GUI Customization Model

The allowed customization ladder is deliberately short:

1. `profile/data`: generated product profile, registry and existing config;
2. `bridge/adapter`: App state/action, Codex transport and platform adapter;
3. `composition/token`: existing slots, wrappers, layout primitives, CSS variables
   and i18n;
4. `fork-body patch`: minimum direct upstream component change only when levels 1-3
   cannot express a P0/P1 requirement.

Every level-4 patch records the upstream file, why the stable boundaries were
insufficient, focused regression coverage and expected intake conflict. Broad page
rewrites, duplicated state models and CSS coupled to incidental upstream DOM are not
thin adaptation.

The product mapping is also fixed:

- inherit the ChatGPT `26.707.41301` directory/session rail, single timeline,
  bottom composer, quiet visual grammar and on-demand Environment details;
- adapt labels, product profile, model/access policy and desktop/WebUI affordances;
- add OPL capability selection, progress, evidence/artifacts and safe action receipts
  through progressive disclosure while keeping all user-selected inputs scoped to the
  current session;
- reject Home dashboards, card walls, ordinary provider/backend controls, permanent
  third columns and raw runtime/protocol surfaces.

The exact observed baseline and OPL delta live in
`docs/product/gui/codex-to-opl-app-delta.md`; this ADR owns maintenance strategy only.
The repeatable stable-tag, reference-promotion, overlap-budget and visual-comparison
workflow lives in `docs/product/gui/gui-maintenance-policy.md` and is machine-backed by
`contracts/app-gui-product-contract.json#gui_maintenance_policy`.
The single App Server adapter boundary for canonical thread discovery and
user-triggered operations lives in
`docs/architecture/codex-cross-thread-orchestration.md`.

## Historical Settings Proposal Disposition

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

### Startup and `/guid` Behavior Regression

The installed-App startup path exposed two behavior regressions that structural
intake and Settings-only visual QA did not detect:

- `opl app state --profile fast --json` expanded to hundreds of megabytes when
  the local stage-attempt ledger contained thousands of historical work units.
  The desktop bridge rejected the output at its bounded command-output limit,
  and `StartupGate` incorrectly interpreted the command failure as incomplete
  first-run setup even though `opl system initialize --json` reported
  `ready_to_launch=true`.
- The upstream React 19 runtime plus Arco Design `Input.TextArea` layout effect
  made a previously tolerated unstable `autoSize` object identity fatal on
  `/guid`. Entering the App triggered `Maximum update depth exceeded`, unmounted
  the renderer root, and left a white window.

These are capability and behavior intake concerns, not cosmetic code drift.
Future AionUI intake must therefore prove the complete installed user path, not
only route presence or Settings rendering:

1. Exercise `fast` App state against a non-empty, large historical runtime
   ledger and enforce the Framework-owned fast JSON size budget before the
   payload reaches the desktop bridge.
2. Keep startup route truth authoritative: the normal path uses bounded fast
   App state; command failure falls back to `system initialize` readiness and
   never creates a second local completion flag.
3. From a completed FirstRun state, activate the explicit entry action and
   prove `/guid` renders a non-empty Home composer with no fatal renderer error
   or root unmount.
4. Relaunch with the same user data and prove the App routes directly to
   `/guid` rather than reopening FirstRun.
5. Treat dependency/runtime upgrades as behavior changes when they alter
   component lifecycle semantics. Stable object/function identity required by
   third-party layout effects belongs in focused shell regression coverage.

The validator owns the required ID set. Removing an item from both the JSON
record and a JSON self-declared list cannot make the gate pass. It rejects
missing records or fields, duplicate or unknown IDs, invalid classifications,
unresolved dependencies, missing evidence, an unblocked capability with a
non-absorbed dependency, and weakened AionCore version/capability gates.

Validation is also bound to the resolved active shell checkout. The App reads
the Shell `contracts/aionui-upstream-intake.json` receipt and requires its schema,
official stable metadata, fail-closed policy, exact AionCore source/archive,
managed-resource manifest digest, ACP package-lock digest, and Codex binary
digest to be structurally valid. The Shell `package.json#aioncoreVersion` must
match the receipt's AionCore version, and every receipt implementation ref must
be an ancestor of the current Shell `HEAD`. The selective absorption ref and any
record-level `remediation_ref` must also be ancestors of the current shell `HEAD`;
`HEAD` may advance and is not required to remain exactly equal to either ref.
Moving AionCore recovery from `deferred` to `absorbed` therefore requires only
the final contract values and shell evidence: admitted version state, verified
capability evidence, an unblocked release gate, and a remediation SHA already
contained in active shell history.

The selected AionCore exact version comes from the Shell receipt and managed
manifest/lock projection; App does not duplicate that moving value. The compatibility
floor remains `v0.1.44`, so the version gate is `meets_minimum` only when the
receipt-selected version satisfies that floor and exact package readback. The
AionCore `v0.1.44` runtime probe establishes two valid failure boundaries:
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

### AionUI v2.1.34 GUI Review

The latest reviewed stable upstream is `v2.1.34` at
`0fea1eb82634f3746b9ccf68507277c347fa08a3`, published on `2026-07-13` with
`draft=false` and `prerelease=false`. Relative to `v2.1.33`, it changes the
conversation command queue, ACP/AionRS send boxes, Team renderer/runtime and a
non-supported locale payload. These surfaces require `accept/adapt/redirect/reject`
classification before selective intake. The release is recorded as reviewed, not
absorbed, and does not justify a broad history merge. The active adapter binds
`a0ce713b65801fd9ca7f46ad168c977c75a187de` as the minimum verified GUI
conformance ancestor; the current shell HEAD is read from the active checkout and
must contain that ancestor. Human docs do not copy the transient current HEAD.
This section is a historical GUI classification and maintenance-budget baseline.
Stable release currentness is read from the Shell receipt and can advance without
rewriting this measured baseline.

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

Allowed AionUI shell delta:

- hydrated product profile and registry consumption;
- App-owned bridge and platform adapters;
- composition slots for rail context, composer context, timeline events and
  Environment secondary refs;
- the single existing App Server thread-directory and user-action adapter,
  projected through existing rail, composer, timeline and mobile composition slots;
- route and tab compatibility redirects;
- `SettingsHost` and `SettingsShellAdapterSlot` rendering and route sync;
- thin renderer components for App-owned Settings slots;
- App state reads through `opl app state --profile fast --json`;
- bounded fast App state consumption with large-history regression evidence;
- App mutations through `opl app action execute --action <id> ... --json`;
- shell-local token mapping, i18n, focused tests and screenshot hooks needed to prove
  the App contract;
- minimum fork-body changes that have a recorded upstream conflict owner and cannot
  be expressed through profile, bridge or composition boundaries.

Forbidden shell delta:

- shell-owned product IA, ordinary navigation or Settings tabs;
- shell-owned model/provider/reasoning policy;
- shell-owned thread store, global agent registry, cross-thread permission policy,
  or direct Codex JSONL parsing;
- duplicate project/conversation/runtime state models;
- broad rewrites whose only justification is visual similarity;
- Home dashboard/card wall or a permanent third-column inspector;
- direct runtime/domain truth reads or writes;
- owner receipt or domain artifact authority;
- release/currentness claims from Settings UI tests or screenshots;
- upstream Team mode or raw provider/runtime internals in ordinary Settings;
- silent dirty/developer checkout mutation.

## Consequences

- Upstream AionUI remains implementation material, not App truth.
- GUI maintenance work should change product docs/contracts first, then choose the
  lowest viable customization level; Settings remains a secondary surface.
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

For future GUI behavior changes, use the existing boundaries:

- root active-shell validation after contract or wrapper changes;
- focused shell tests for the changed P0/P1/P2 renderer behavior;
- focused startup and `/guid` DOM tests plus an installed-App ready-entry and
  relaunch smoke using the same user data;
- core GUI visual evidence for rail/Home/conversation/composer/Environment claims;
- Settings visual QA manifest only for Settings screenshot/framing claims;
- release-owner evidence for packaged App readiness, currentness, notarization,
  and release promotion.
