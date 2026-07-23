# Professional Agent Package Management Plan

Owner: `one-person-lab-app`
Purpose: `professional_agent_package_management_plan`
State: `historical_implementation_record`
Currentness boundary: 本文保留 package-management 设计与当时的 non-live implementation
记录；其中 `100%` 只描述各行当时声明的 docs/contract/source/test slice，不得作为当前完成度、
关单、Pixel、Install 或 Release authority。当前唯一五轴账本是
[`app-ideal-state-gap-plan.md`](../../active/app-ideal-state-gap-plan.md) 与
[`shell-conformance-matrix.md`](shell-conformance-matrix.md)。
Machine boundary: Human-readable product and architecture plan. Machine-readable
truth lives in `contracts/`, source, validators, package manifests, and OPL
Framework readback/receipt outputs. As of the App landing, App-owned
contracts, agent package surface schema/fixtures, active-shell consumption, and
package-management documentation are in place. OPL Framework now owns and implements the non-live package readback
slice for registry refresh, manifest validation, selected install lock
recording, install/update/repair/uninstall receipts, rollback_ref recovery refs,
package exposure preference receipts for hide/unhide/enable/disable, status,
package list readback, and manifest-declared local Codex plugin materialization
into `CODEX_HOME` plugin cache, OPL state marketplace wrapper, Codex config
tables, package lock `physical_surface`, and action receipt `physical_surface`.
Framework also fails closed when a local packaged
plugin source is missing `skills/<required_skill_id>/SKILL.md`, records the
materialized required skill ids/paths in `physical_surface`, and persists
Framework-backed Home shortcut preference readback through
`agent_package_preferences_set` plus
`opl packages list/status#home_shortcut_preferences`. The active shell exposes those routes, reads Framework
Home shortcut preference readback from App state, persists Home shortcut
visibility/order changes through the Framework action route,
emits the launch-only
`opl_agent_package_invocation` readback in packaged route smoke, and displays
Framework `physical_surface` fields in Settings. First-party distribution payload contracts, locked required skill-pack refs,
and remote payload manifest fields are now landed in the non-live App/Framework
slice. Actual public publication, installed Codex-surface reload proof, and live
user-path evidence remain release/runtime owner work, not App contract work.

## 2026-07-23 Flexibility And Cost Audit

This plan keeps the package-management product boundary, but the previous
seven-package wording must be read as a starter-profile implementation snapshot,
not as the target ecology. The target model is:

```text
OPL Base ~= R
OPL App ~= RStudio / replaceable GUI or deployment carrier
OPL Package ~= R Package
Registry ~= discovery index
Full or Release Set ~= exact lock/snapshot for a reproducible composition
```

The objective is free composition with one implementation of each generic
concern. Package owners publish independently with SemVer, immutable OCI or
manifest digests, required/optional dependency declarations, and Base or
capability ABI ranges. The Framework then resolves a compatible candidate,
writes the exact installed lock and receipt, materializes the locked bytes, and
owns recovery. The App renders the directory, delegates declared actions, and
shows readback. It must not become a second package lifecycle owner.

The following is the intended source/channel boundary:

| Concern | Target rule | Status in this App documentation tranche |
| --- | --- | --- |
| Framework/package owner | One Framework resolver, transaction, exact lock, receipt, and rollback reference | Existing boundary retained; cross-repo migration still required |
| Starter profile | Current seven first-party packages are replaceable defaults, not a fixed closure or App capability ceiling | **Planned**; current contracts still contain fixed-profile metadata |
| Independent package release | Each package can publish and update without rebuilding App, Base, or unrelated packages | **Planned**; existing scheduled workflows need owner-level migration |
| Registry/source adapters | OCI, external/direct manifest, developer checkout, and offline seed are candidate adapters; only the resolver chooses currentness | **Partially landed**; mixed-source live behavior still needs consolidation |
| App/Shell boundary | App and Shell consume Framework directory/status/actions and do not copy package authority | Non-live projection path landed; duplicate authority cleanup remains pending |
| Stable/Docker/WebUI/Full/Nightly/Daily | Stable is a release policy, Docker/WebUI and Homebrew are carriers, Full is a snapshot, Nightly is optional canary, Daily is cadence/index reconciliation | **Documented target**; live terminal proof remains pending |

Ordinary user UI should expose only Install, Update, Remove, Enabled, and Home
pin controls. Repair belongs to diagnostics and rollback remains an automatic
Framework recovery reference or an advanced operator route. Compact directory
reads should be separated from lazy detail reads so a large package payload
cannot become the default App state.

This section is a target and migration plan. It does not claim public package
publication, installed Codex-surface reload, or release currentness. The three
terminal proofs required before asserting stable latest delivery are:

```text
App Stable -> GitHub Latest -> updater readback
WebUI exact digest -> :stable -> anonymous pull
one Package update -> unchanged Base/App/other Packages remain unchanged
```

## Current Runtime Boundary

Settings Agents is package-directory-first, and its only manageable collection is
`opl app state --profile fast --json#app_state.agent_packages.directory.entries`.
`app_state.agent_packages.status_index` adds package-id-keyed dependency,
activation, guard, exposure, receipt, rollback, and physical-surface diagnostics.
`app_state.modules.items[]`, runtime-source carriers, Home shortcuts, and static
product metadata may enrich diagnostics or labels only; they cannot create rows,
define actions, or substitute a directory when the canonical collection is absent.
The current starter-profile identities are projected by Framework and are
replaceable; they are not a required seven-package closure. The App ships no
default registry or empty catalog. Organization/user registries and direct
manifests remain optional candidate adapters. Framework alone resolves compatible
currentness, and the exact installed lock defines local truth.

That boundary is not cosmetic. Recent local readback shows MAS/MAG/RCA as
`health_status: dirty` with `effective_install_update_source: git_checkout`,
`configured_by: developer_mode`, `git.sync_status: behind`, and `git.dirty: true`,
while BookForge/OMA can be `health_status: ready` with
`recommended_action: update`. A single repair state or purpose-card primary UI
hides these differences. The contract/docs/validator target in this lane is
therefore:

- package directory as the primary Agents identity;
- Codex App plugin-manager-like compact grouped directory for Settings > 智能体;
- localized product role labels instead of raw package-role enums;
- professional Agents ordered by App product metadata, workflow profiles in a separate section,
  and capability packages grouped only from `dependent_guard.required_by_package_ids`;
- a single-parent dependency nests once under its visible parent, while multi-parent or
  parent-not-visible dependencies appear once in Shared dependencies;
- developer source and authorized-repository maintenance controls collapsed by default;
- registry refresh, search, status filter, and manifest URL install as the top
  package-management controls;
- Home shortcut visibility/order integrated into each package row;
- multi-axis status for install/update/source/trust/Codex Surface;
- receipt refs, `physical_surface`, workflow/connector/resource refs moved into
  a right-side or disclosure details surface;
- Skills, external tools, MCP, voice, and custom assistants collapsed behind
  explicit supporting-surface actions instead of rendering as the default long
  list;
- explicit loading, empty, stale-last-good, and failed states when the canonical
  directory cannot be read, without a synthetic fallback collection.

## Ordinary User Lifecycle UX

Settings > 智能体 is an App-owned product requirement, not a runtime
authority surface. AionUI and Native Workbench must consume the same
`app_state.agent_packages.directory.entries + app_state.agent_packages.status_index`
projection and the same `app_state.actions` refs. `app_state.modules.items[]`
must not become a second package directory, package execution truth, currentness
claim, or action authority.

The ordinary package manager UX checklist is:

- search package name, short name, purpose tag, source label, and description;
- filter by install/update/source/trust/Codex Surface/Home visibility state;
- explain install source in user language: OPL Packages, local developer
  checkout, organization registry, user registry, or direct manifest URL;
- show failure reason only when a package is failed, blocked, or needs user
  action;
- keep receipt refs, `physical_surface`, paths, manifest refs, cache config,
  marketplace config, workflow refs, connector refs, and resource refs in the
  detail panel or Maintenance diagnostics, not primary row density;
- use the same dry-run/confirmation/receipt pattern for hide, unhide, disable,
  enable, update, repair, uninstall, manifest URL install, and launch;
- keep registry-selected install on its projected action payload; the Agents
  advanced manifest-URL entry requires the user to choose an explicit `trust_tier`,
  never defaults to a verified tier, and sends `{ manifest_url, trust_tier }`;
- show `rollback_ref` only as a recovery reference; do not add an App-owned
  rollback verb.

Details must include the physical Codex surface when Framework provides it:
plugin id, `materialized_required_skill_ids`,
`materialized_required_skill_paths`, plugin cache path, marketplace path, Codex
config path, materialization status, and whether reload is required. Health of
the live installed Codex surface reload remains deferred release/runtime
evidence; landing this product contract does not claim installed-surface reload,
release readiness, or package execution readiness.

## Core Decision

OPL App should not add a strong session contract for professional agents.

The App remains a Codex-first wrapper and package manager. Framework directory
entries plus organization, user, and future third-party source candidates
describe Codex/OPL capability packages that the App can discover, select,
install, update, repair, uninstall, configure exposure, and launch. Exposure
state uses `agent_package_preferences_set` with an `exposure_action` such as
hide/unhide/enable/disable. Those mutations are Framework action refs with
receipts; AionUI and Native Workbench only display the package directory and
trigger the declared App action route. The App records launches with a thin
invocation receipt, but it must not decide the agent's domain workflow, stage
model, prompt internals, artifact schema, readiness verdict, quality/export
authority, or package lifecycle execution.

The lazy first landing is:

```text
entry configurable + package manageable + receipt readable
```

No strong `Session Contract` should be introduced unless a future requirement
cannot be met by package metadata, home shortcut metadata, launch receipt, and
refs-only display.

For users, the OPL Agent Registry is only the discovery directory: it can point
at a GitHub-hosted JSON file or another configured URL and tells the App which
agent packages are available. Selecting an entry installs from that entry's
agent manifest URL. The manifest URL, after Framework validation, lock, and
receipt creation, is the installation authority; the Registry is not authority
for agent behavior.

For ordinary users, managed GHCR OPL Packages use one moving stable path:
`latest-stable`. There is no user-visible nightly package split for OPL
Packages. Daily CI may build a GHCR OCI artifact when package source changes,
but only a candidate that passes manifest validation, payload checks, Codex
Surface materialization checks, and receipt/readback gates is promoted to
`latest-stable`. Framework resolves `latest-stable` to an immutable OCI digest before install
or update; the package lock records the immutable version tag plus digest as
the installed truth. Git repo and local checkout sources remain Developer
Profile sources only, not ordinary managed package state, and are excluded from
background auto-apply.

This moving-channel rule applies only to OPL Packages. Installation Carrier and
Runtime Payload stay on their stable/nightly/host-route release flows, while
Codex Surface is only the plugin/skill projection, readiness, and reload status
of the installed package.

`latest-stable` is a resolver input, not installed truth. A package owner may
publish a new immutable version without changing the App, Base, or any other
package. Framework index reconciliation may run daily or on demand, but Daily
does not form a seven-package atomic release and cannot promote a candidate
without the normal manifest, payload, compatibility, and readback gates.
Release Sets remain useful as exact Full/offline or qualification snapshots;
they are composition locks and must not become a second package publication
authority.

Rollback is a recovery reference, not a new App-owned verb. Agent Package rows
may show `rollback_ref`, fail-closed status, action receipts, and repair/update
routes from Framework readback. Agent Package lifecycle does not define a
rollback action id; managed update rollback for runtime substrate or
package-channel components remains owned by the Managed Update plane. AionUI and
Native Workbench must not invent shell-local rollback semantics beyond
displaying those recovery refs and triggering declared repair/update actions.

## Module Positioning

| Module                     | Owns                                                                                                                                                                                                                                                                    | Must not own                                                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPL App                    | Registry/source candidate discovery UI, user-facing package management, home shortcuts, Settings display, Codex launch, invocation receipt display, refs-only status panels, and delegation of Framework action refs. | Agent manifest authority, install/update execution, rollback execution, compatibility resolution, package currentness, agent domain truth, prompt internals, stage progression, artifact bodies, quality verdicts, readiness truth. |
| OPL Agent Registry         | Configurable discovery list from GitHub or URL; entry metadata, labels, source/trust hints, and manifest URLs for packages the user may install.                                                                                                                        | Agent business behavior, package lock state, installed receipts, runtime mutation, or domain authority.                                                                   |
| Agent Manifest URL         | Authoritative package input selected by a registry entry or explicit user import.                                                                                                                                                                                       | Registry-wide catalog policy, App shell behavior, or domain workflow truth.                                                                                               |
| OPL Framework              | Managed package roots, manifest validation, install/update/apply/repair/uninstall action refs, package exposure preferences, package manifests, post-apply Codex Surface sync, package locks, package receipts, rollback_ref recovery refs, and non-live physical Codex plugin materialization when a manifest declares a local plugin source. | App product IA, shell rendering, domain artifact authority, live release readiness, Agent Package rollback verb semantics.                                                |
| Codex Surface              | Plugin registry, plugin-packaged skills, direct skill discovery, executor invocation, post-apply readiness, and reload guidance.                                                                                                                                         | OPL package lifecycle policy, package source selection, `latest-stable` promotion, or domain truth.                                                                      |
| Professional Agent Package | Agent manifest, bundled required skill packs, optional companion refs, entrypoints, health check, package version, rollback ref.                                                                                                                                        | App shell behavior, App release readiness, other agents' package state.                                                                                                   |
| Skill Pack                 | Reusable Codex skill content and metadata. It may live in a separate repo during development.                                                                                                                                                                           | Runtime install policy or App GUI state.                                                                                                                                  |
| Domain Agent Runtime       | Domain workflow, artifacts, owner receipts, typed blockers, quality/export verdicts.                                                                                                                                                                                    | App package manager truth or generic Codex executor policy.                                                                                                               |

## Data Shapes

`OPL Agent Registry Entry` is the discovery unit. It is configurable and may be
served from GitHub or any allowed URL, but it does not define agent behavior:

```json
{
  "package_id": "org.example-literature-review",
  "package_kind": "domain_agent_package",
  "display_name": "Example Literature Review",
  "publisher": "example-research-org",
  "description": "An external literature-review package published by an organization registry.",
  "tags": ["literature-review", "external"],
  "package_role": "standard_agent",
  "source": "organization_registry_url",
  "manifest_url": "https://packages.example.org/opl/literature-review/manifest.json",
  "version_source_ref": "https://packages.example.org/opl/literature-review/manifest.json#/version",
  "selected_version": null,
  "stable_version": null,
  "manifest_validation": "deferred",
  "trust_tier": "user_review_required"
}
```

The public directory combines Framework built-in Release Set entries with
organization, user, and third-party external discovery entries. Only the
Framework built-in Release Set may project canonical first-party identities or
first-party trust. External entries use the canonical roles `standard_agent`,
`framework_capability_package`, and `workflow_profile`, but must use a non-reserved
identity and an explicit non-first-party source/trust value; installation still
requires manifest validation and the Framework-owned package lock receipt.
App-owned default descriptions and tags for built-in entries mirror the Framework
canonical package catalog generator. Entries keep `selected_version` and
`stable_version` null while `manifest_validation` is `deferred`; registry refresh
validates the referenced manifest, derives both versions from
`version_source_ref`, and then projects the resolved metadata. The App registry
must not copy a local Framework checkpoint version or treat a moving channel
label as version truth.

`OPL Agent Package Manifest` is the install/update unit. When selected from the
Registry, the manifest URL is the authority Framework validates, locks, applies
through install/update/repair/uninstall action refs, records recovery refs for,
and receipts:

```json
{
  "package_id": "opl.research-starter",
  "agent_id": "research-starter",
  "display_name": "Research starter",
  "publisher": "one-person-lab",
  "version": "1.4.0",
  "source": "first_party_starter",
  "distribution": {
    "type": "ghcr_oci_artifact",
    "ref": "ghcr.io/gaofeng21cn/one-person-lab-packages/research-starter:latest-stable",
    "immutable_version_tag": "1.4.0",
    "digest": "sha256:..."
  },
  "compatibility": {
    "base_abi": ">=0.3 <0.4",
    "capability_abi": {
      "opl.codex_surface": ">=2 <3"
    },
    "required_packages": [],
    "optional_packages": []
  },
  "codex_surface": {
    "plugin_ids": ["research-starter"],
    "required_skill_ids": ["research-starter"],
    "plugin_source_path": "/absolute/path/to/plugin-source"
  },
  "skill_packs": [
    {
      "id": "research-starter-required-skills",
      "source": "github:example/agent-skills",
      "version": "1.4.0",
      "lock_sha": "sha256-or-commit",
      "install_mode": "bundled_required"
    }
  ],
  "entrypoints": [
    {
      "shortcut_id": "research",
      "label": "Research",
      "required_skill_ids": ["research-starter"],
      "shortcut_eligible": true
    }
  ],
  "health_check": {
    "kind": "opl_package_receipt",
    "required_surfaces": ["plugin_registry", "required_skill_ids"]
  },
  "permissions": [],
  "update_channel": "latest-stable",
  "rollback_ref": "package-receipt-ref"
}
```

`Home Shortcut Metadata` is the launch/display unit. It is not a session
contract:

```json
{
  "shortcut_id": "research",
  "package_id": "opl.research-starter",
  "label": "Research",
  "source": "first_party_starter",
  "required_skill_ids": ["research-starter"],
  "display_policy": "refs_only_no_domain_verdict"
}
```

`Invocation Receipt` records the launch fact only:

```json
{
  "receipt_type": "capability_invocation",
  "executor": "codex_cli",
  "package_id": "opl.research-starter",
  "agent_id": "research-starter",
  "skill_ids": ["research-starter"],
  "source": "first_party_starter",
  "launched_from": "opl_app_home",
  "display_policy": "refs_only_no_domain_verdict"
}
```

`Package Lock / Receipt` is the installed-state proof. App may display it, but
OPL Framework owns producing and applying it:

```json
{
  "package_id": "opl.research-starter",
  "version_or_source_digest": "2026.7.6.1+sha256:...",
  "distribution_ref": "ghcr.io/gaofeng21cn/one-person-lab-packages/research-starter:latest-stable",
  "resolved_digest": "sha256:...",
  "installed_at": "2026-07-04T00:00:00Z",
  "updated_at": "2026-07-04T00:00:00Z",
  "codex_visible_entry": "research-starter",
  "bundled_required_skill_ids": [
    "research-starter",
    "research-starter-required-skills"
  ],
  "optional_skill_refs": ["mas-scholar-skills:display"],
  "source_kind": "first_party_starter_profile",
  "trust_tier": "first_party",
  "action_receipt_id": "opl-action-receipt-ref",
  "rollback_ref": "package-receipt-ref",
  "physical_surface": {
    "status": "materialized",
    "plugin_id": "research-starter",
    "marketplace_id": "opl.research-starter-local",
    "codex_plugin_cache_path": "$CODEX_HOME/plugins/cache/...",
    "marketplace_path": "$OPL_STATE_DIR/codex-plugin-marketplaces/.../.agents/plugins/marketplace.json",
    "codex_config_path": "$CODEX_HOME/config.toml",
    "reload_required": true
  }
}
```

## Canonical State / Display / Action Map

The App-owned bridge now keeps one thin map for the three ordinary semantic
lanes a shell must render: runtime, task, and package. Its machine source is
`contracts/app-runtime-bridge.json#canonical_state_display_action_map`, with
`contracts/app-gui-product-contract.json#framework_surfaces.canonical_state_display_action_map`
and `contracts/app-page-state-matrix.json#canonical_state_display_action_map_ref`
binding GUI and page-state validation to the same map.

| Semantic lane | Canonical source | Aion display role | Native Workbench display role | Action boundary |
| --- | --- | --- | --- | --- |
| Runtime | `opl app state --profile fast --json#app_state.operator.workbench.work_item_projection_v2` | Minimal WorkItem status, Stage, Attempt, Token, next action, and archive/restore | Same minimal WorkItem status contract | Only `work_item_visibility_set` through `opl app action execute`; selected-item detail stays projection-bound, while full operator drilldown belongs to Maintenance diagnostics. |
| Task | `opl app state --profile fast --json#app_state.operator.workbench.task_run_projection_v2.tasks[]` | Current task slice in conversation and right inspector | Task detail and artifact/provenance workbench pane | Task action, follow-up, export, and workflow-skill candidate refs only; no artifact body, owner receipt, or domain verdict authority. |
| Package | `opl app state --profile fast --json#app_state.agent_packages.directory.entries + app_state.agent_packages.status_index` | Settings Agents package directory rows | Packages panel rows | Package lifecycle and Home shortcut preference actions through Framework-backed App action refs; `rollback_ref` is displayed as a recovery reference, not an App-owned rollback verb; diagnostic enrichments cannot define rows or actions. |

## First-Party Starter And External Skill Pack Management

A first-party starter agent may keep professional skills in a separate
repository, but ordinary package installation must treat the agent and its
required skill packs as one atomic package unit.

Recommended shape:

- The agent repo owns the package manifest and lock file for required skill
  packs.
- The skill repo remains independently developed and versioned.
- Release packaging materializes the locked skill pack into the agent package.
- Ordinary release automation publishes a GHCR OCI artifact, moves only
  `latest-stable` after gates pass, and keeps immutable SemVer tags plus digests for
  install truth and recovery refs. Carrier and Runtime Payload releases do not
  use this rolling pointer.
- Install/update/repair/uninstall applies agent runtime/plugin/skill-pack
  surfaces together.
- Development can use a local link, but only under an explicit Developer
  Profile override and never as the ordinary user default or background
  auto-apply source.
- Shared skill packs use package references and reference counting; uninstalling
  one agent must not delete a skill pack still used by another package.

Avoid this shape:

- App hard-coding agent skill repo paths.
- OPL App reading agent skill bodies.
- Runtime install depending on local symlinks or developer checkouts.
- Ordinary package updates from a Git checkout. Git repo/local checkout sources
  are Developer Profile state and must not be silently overwritten by managed
  maintenance.
- A second bare `~/.codex/skills/<agent>` mirror that diverges from the plugin
  package.

## Landing Plan

| Order | Work item                                                                        | Current completion | Status  | Evidence now                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Target evidence                                                                                                                                                   |
| ----- | -------------------------------------------------------------------------------- | -----------------: | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Document the no-strong-session-contract boundary.                                |               100% | done    | This plan plus architecture/decision/invariant updates.                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Markdown diff and `git diff --check`.                                                                                                                             |
| 2     | Rename product language from fixed assistants to configurable package shortcuts. |               100% | done    | Product/profile contracts declare `professional_agent_packages` and `home_agent_shortcuts`; active Aion shell consumes package/shortcut fields for Home, Settings, skill allowlist, and launch receipt while keeping old assistant fields as migration aliases.                                                                                                                                                                                                                                                      | Old alias fields can be retired only after downstream consumers stop requiring the migration shape.                                                               |
| 3     | Add external Agent Registry discovery and manifest URL boundary.                 |               100% | done    | App ships no registry URL/ref or empty catalog. `agent_registry_policy` keeps organization/user registries and direct manifest URLs as optional candidate adapters, prohibits first-party identity/trust claims, and delegates refresh, validation, install, currentness, lock, and list to Framework. The generic schema validates configured registry documents without hardcoding the starter profile. | External registry operators own their own catalog publication/readback. |
| 4     | Define first-party product metadata, manifest, and shortcut shapes.               |               100% | done    | `app-product-profile.json#gui.agent_package_registry.first_party_release_set_metadata` owns static metadata for the current starter profile; `agent-package-surfaces.schema.json` defines external registry, manifest, shortcut, invocation receipt, and package lock receipt surfaces; the current starter fixtures live under `contracts/fixtures/agent-package-manifests`. Validators check profile/fixture alignment without treating the external registry as first-party truth. | Public per-package manifest publication and starter-profile replacement are release/distribution work, not an App contract gap. |
| 5     | Keep launch evidence as thin invocation receipt.                                 |               100% | done    | `agent_package_invocation_receipt_policy` requires launch-only package/shortcut/Codex fields and explicitly excludes session behavior, domain workflow, and readiness authority; active shell emits `opl_agent_package_invocation` in packaged VM route smoke while retaining legacy `opl_assistant_route` as migration alias.                                                                                                                                                                                       | Live installed App/Codex invocation evidence remains outside this non-live contract/readback landing.                                                             |
| 6     | Add package lifecycle actions.                                                   |               100% | done    | `app-install-exposure-policy` names `refresh_registry`, `install_from_manifest_url`, `agent_package_update`, `agent_package_repair`, `agent_package_uninstall`, `agent_package_preferences_set`, package-lock requirement, action receipt, rollback_ref recovery ref, and validator/release-boundary coverage. Exposure changes use `agent_package_preferences_set` with `exposure_action` values hide/unhide/enable/disable; Home shortcut preference changes use the same App action with `shortcut_id` payload. Framework writes action receipts/readback without defining Agent Package rollback as a lifecycle verb. | Live Codex-surface reload proof remains tracked separately below.                                                                                                 |
| 7     | Make first-party starter packages plus required skill packs atomic.              |               100% | done    | Contract now requires atomic package units to include plugin manifest, bundled required skill entries, optional companion skill refs, release payload proof fields, and locked required skill-pack refs that must not be `registry.version_source_ref` or another moving ref. First-party fixtures carry non-live `distribution_payload` proof refs; Framework records `bundled_required_skill_ids`, validates required skill files, reads back materialized skill ids/paths, and supports local plus remote payload manifest materialization. | Actual public payload publication and installed Codex reload proof remain release/runtime evidence, not this non-live item.                                       |
| 7.1   | Define `latest-stable` GHCR OCI OPL Package distribution semantics.              |               100% | done    | Docs define `latest-stable` as the only ordinary user OPL Package channel, candidate promotion after gates, immutable SemVer tags plus resolved OCI digest as installed truth, clean-managed-root auto-apply eligibility, and git checkout as Developer Profile source only. Framework release workflows, package manifest output, release discipline, focused tests, and package docs own the exact promotion behavior; App consumes that channel without copying current package versions. | Live GHCR publish/readback evidence remains release-owner evidence, not App contract evidence. |
| 8     | Build Settings package-directory UI.                                             |               100% | done    | Contracts/page-state/validators and the active shell implement a `directory.entries`-only compact grouped Agents catalog with localized roles, App-metadata ordering, a separate workflow section, dependency hierarchy derived only from `dependent_guard.required_by_package_ids`, search/filter/refresh, canonical row actions, inline Home shortcut management, multi-axis status, collapsed developer controls, detail disclosure, explicit empty/error/stale states, and no synthetic fallback collection. | Installed-App screenshot/readback remains visual evidence, not an open contract or shell-implementation gap. |
| 9     | Make Home shortcuts user-configurable in the package directory.                  |               100% | done    | Contracts/profile model `home_agent_shortcuts` over installed packages with `user_configurable=true`; Framework persists preference readback/action. Active shell manages shortcut visibility and order inline on the package-directory row/details surface instead of a detached second table.                                                                                                                                                                                                                        | Installed-App live acceptance can still be collected in release/user-path evidence, but the non-live App/Framework/shell implementation path is closed.                                          |
| 10    | Support third-party/manual package install.                                      |               100% | done    | Contract and shell keep direct manifest installation in the Agents page's advanced install entry, require an explicit user-selected trust tier, submit `{ manifest_url, trust_tier }`, and keep registry-selected install on its projected canonical payload. Framework owns validation, package lock receipts, rollback refs, and payload materialization/cleanup. | Live user-path evidence and installed Codex reload proof remain deferred.                                                                                         |
| 11    | Migration and regression gates.                                                  |               100% | done    | Validators/tests cover directory-only collection authority, exact action objects, no synthetic payloads, search/filter/empty/error states, workspace activation, trust-tier assignment, receipt/rollback and physical-surface projection, source semantics, and lifecycle guards. | Live installed/reload evidence remains a separate release/runtime lane. |

## Completion Audit

| Audit item                                                                         | Status  | Completion | Fresh evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Remaining gap                                                                                                                 |
| ---------------------------------------------------------------------------------- | ------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| App external registry adapters, first-party metadata, manifest URL, and schema contract | done | 100% | No App-owned default registry remains. Schema/policy preserve organization/user registry and direct-manifest extension points while prohibiting first-party identity/trust claims and a second currentness authority. App profile plus current starter fixtures carry presentation/schema evidence only; Framework directory/resolver/installed lock own lifecycle, target, and local truth. | External registry operators own catalog publication/readback; starter-profile replacement remains independent Package work. |
| App no-strong-session and refs-only boundary                                       | done    |       100% | This plan, App decisions/invariants/architecture, and package/invocation receipt policy exclude prompt bodies, workflow schema, artifact schema, readiness verdicts, quality verdicts, and owner receipt authority.                                                                                                                                                                                                                                                                                                                                           | None for App contract/docs.                                                                                                   |
| Framework registry/manifest/install lock/readback and physical Codex surface slice | done    |       100% | Framework main `5819e7fe` implements package remote payload materialization and `physical_surface` in package locks and lifecycle receipts; focused tests prove registry fetch, manifest validation, install, list, status, local plugin cache materialization under `CODEX_HOME`, OPL state marketplace wrapper, Codex config registration, required skill payload fail-closed validation, Home shortcut preference readback/action, repair, uninstall cleanup, rollback_ref recovery refs, and no-authority boundary.                                                         | This is non-live Framework evidence; it does not prove installed App reload or release/currentness readiness.                 |
| Current runtime projection for Settings Agents                                     | done    |       100% | `app_state.agent_packages.directory.entries` is the only manageable collection; status-index/runtime/module/profile data can enrich diagnostics only. App contracts, validators, fixture, and shell projection cover the compact list/detail UI and fail-closed catalog/action states. | Installed-App live evidence is tracked separately and does not reopen the non-live implementation item. |
| Active shell invocation receipt and Settings physical-surface display              | done    |       100% | Shell main `e4a22652e` validates `opl_agent_package_invocation` in packaged route smoke; shell main `f1fb6cae` displays package lock/action receipt `physical_surface` in Settings Capabilities and covers it with focused DOM test plus i18n validation.                                                                                                                                                                                                                                                                                                     | Live installed App/Codex reload or user-path proof remains outside this item.                                                 |
| Update/repair/uninstall and exposure preference execution                           | done    |       100% | Framework implements CLI/App-action routes for update, repair, uninstall, status, and package exposure preferences; focused tests cover package-only lifecycle actions, receipt/readback paths, physical repair/rematerialization, uninstall cleanup, and rollback_ref recovery display.                                                                                                                                                                                                                                                                     | Installed Codex-surface reload proof remains release/runtime evidence.                                                        |
| Persisted Home shortcut ordering/visibility                                        | done    |       100% | App contracts/profile, Framework preference readback/action routing, and the active shell manage `home_agent_shortcuts` visibility and order inline on canonical directory rows. | Installed-App live readback remains separate release/runtime evidence.                    |
| Physical plugin and required skill-pack materialization                            | done    |       100% | App contracts/fixtures require first-party distribution payload refs and locked required skill-pack refs; Framework materializes manifest-declared local and remote payload plugin sources into `CODEX_HOME` plugin cache, OPL state marketplace wrapper, Codex config tables, lock `physical_surface`, and receipt `physical_surface`; focused tests prove required skill validation, remote payload manifest materialization, materialized skill ids/paths readback, install/repair/uninstall cleanup and rollback_ref recovery refs; shell Settings displays `physical_surface`. | Installed Codex reload/live user-path evidence remains outside this non-live item.                                            |
| Live install/currentness/readiness evidence                                        | deferred |          - | No live claim is made by this non-live product/consumer implementation. | Real user-path, publication, installed reload, and release-currentness evidence remain with release/runtime owners. |

## Deferred Release Evidence

- external registry operator and Package owner publication readback;
- real installed-App direct and registry-selected install paths;
- installed Codex surface reload/readback;
- release currentness, notarization, and owner acceptance.

These are release/runtime evidence lanes, not blocked product-contract or shell
implementation work.

## Acceptance Rules

- OPL App can start with no starter agent package installed and still function
  as a Codex wrapper.
- A first-party starter package can be installed, updated, hidden, unhidden, or
  uninstalled as a package exposure without changing the App executor.
- A first-party starter package can still be invoked directly from Codex/CLI
  through its plugin/skill.
- Installing a third-party compliant package does not require App source edits.
- The Registry can be changed by GitHub/URL configuration without changing App
  source, but each installation still depends on a validated manifest URL,
  package lock, rollback ref, and Framework receipt.
- Home shortcuts are user configuration over packages, not App hard-coding.
- Invocation receipt proves launch only; it never becomes domain readiness,
  quality, artifact, or session-behavior authority.
