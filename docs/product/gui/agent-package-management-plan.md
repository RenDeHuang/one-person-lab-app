# Professional Agent Package Management Plan

Owner: `one-person-lab-app`
Purpose: `professional_agent_package_management_plan`
State: `ideal_package_directory_contract_landed_current_runtime_projection_gap_explicit`
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
visibility/order changes through the Framework action route with local fallback,
emits the launch-only
`opl_agent_package_invocation` readback in packaged route smoke, and displays
Framework `physical_surface` fields in Settings. First-party distribution payload contracts, locked required skill-pack refs,
and remote payload manifest fields are now landed in the non-live App/Framework
slice. Actual public publication, installed Codex-surface reload proof, and live
user-path evidence remain release/runtime owner work, not App contract work.

## Current Runtime Boundary

Ideal Settings IA is package-directory-first, and canonical runtime evidence is
now `opl app state --profile fast --json#app_state.agent_packages.directory +
app_state.agent_packages.status_index`. The shell may still derive Capabilities
rows from `app_state.modules.items[]` plus Home-shortcut preferences and
task-awareness refs as rollout fallback when older runtime payloads or partial
projections remain in circulation.

That boundary is not cosmetic. Recent local readback shows MAS/MAG/RCA as
`health_status: dirty` with `effective_install_update_source: git_checkout`,
`configured_by: developer_mode`, `git.sync_status: behind`, and `git.dirty: true`,
while BookForge/OMA can be `health_status: ready` with
`recommended_action: update`. A single repair state or purpose-card primary UI
hides these differences. The contract/docs/validator target in this lane is
therefore:

- package directory as the primary Capabilities identity;
- Codex App plugin-manager-like compact directory for Settings > 智能体与能力;
- registry refresh, search, status filter, and manifest URL install as the top
  package-management controls;
- Home shortcut visibility/order integrated into each package row;
- multi-axis status for install/update/source/trust/Codex Surface;
- receipt refs, `physical_surface`, workflow/connector/resource refs moved into
  a right-side or disclosure details surface;
- Skills, external tools, MCP, voice, and custom assistants collapsed behind
  explicit supporting-surface actions instead of rendering as the default long
  list;
- explicit statement that canonical runtime projection is `agent_packages` and
  `modules.items[]` remains fallback-only compatibility.

## Ordinary User Lifecycle UX

Settings > 智能体与能力 is an App-owned product requirement, not a runtime
authority surface. AionUI and Native Workbench must consume the same
`app_state.agent_packages.directory + app_state.agent_packages.status_index`
projection and the same `app_state.actions` refs. `app_state.modules.items[]`
is fallback-only for older or partial runtime payloads and must not become a
second package directory, package execution truth, currentness claim, or action
authority.

The ordinary package manager UX checklist is:

- search package name, short name, purpose tag, source label, and description;
- filter by install/update/source/trust/Codex Surface/Home visibility state;
- explain install source in user language: OPL Packages, local developer
  checkout, organization registry, user registry, or direct manifest URL;
- show failure reason only when a package is failed, blocked, or needs user
  action;
- keep receipt refs, `physical_surface`, paths, manifest refs, cache config,
  marketplace config, workflow refs, connector refs, and resource refs in the
  detail panel or Advanced diagnostics, not primary row density;
- use the same dry-run/confirmation/receipt pattern for hide, unhide, disable,
  enable, update, repair, uninstall, manifest URL install, and launch;
- show `rollback_ref` only as a recovery reference; do not add an App-owned
  rollback verb.

Details must include the physical Codex surface when Framework provides it:
plugin id, required skill ids/paths, plugin cache path, marketplace path, Codex
config path, materialization status, and whether reload is required. Health of
the live installed Codex surface reload remains deferred release/runtime
evidence; landing this product contract does not claim installed-surface reload,
release readiness, or package execution readiness.

## Core Decision

OPL App should not add a strong session contract for professional agents.

The App remains a Codex-first wrapper and package manager. First-party starter
registry entries, organization entries, user entries, and future third-party
entries are Codex/OPL capability packages that the App can discover, select,
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
| OPL App                    | Registry discovery, user-facing package management, home shortcuts, Settings display, Codex launch, invocation receipt display, refs-only status panels.                                                                                                                | Agent manifest authority, install/update execution, rollback execution, agent domain truth, prompt internals, stage progression, artifact bodies, quality verdicts, readiness truth. |
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
  "entry_id": "starter.research",
  "display_name": "Research starter",
  "source": "first_party_starter",
  "manifest_url": "https://example.com/agents/research/manifest.json",
  "trust_hint": "first_party"
}
```

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
  "source_kind": "first_party_managed_cohort",
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
| Runtime | `opl app state --profile fast --json#app_state.operator.current_owner_delta + app_state.operator.workbench + app_state.actions` | Runtime page user-task-status cockpit | Workbench task cockpit | `app_state.actions[]` through `opl app action execute`; full drilldown is explicit detail only. |
| Task | `opl app state --profile fast --json#app_state.operator.workbench.task_run_projection_v2.tasks[]` | Current task slice in conversation and right inspector | Task detail and artifact/provenance workbench pane | Task action, follow-up, export, and workflow-skill candidate refs only; no artifact body, owner receipt, or domain verdict authority. |
| Package | `opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index` | Settings Capabilities package directory rows | Packages panel rows | Package lifecycle and Home shortcut preference actions through Framework-backed App action refs; `rollback_ref` is displayed as a recovery reference, not an App-owned rollback verb; `modules.items[]` is fallback only and cannot collapse developer checkout state. |

Fallback projections preserve older payload usability only. They must not claim
currentness, release readiness, domain readiness, or mutation authority.

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
| 3     | Add OPL Agent Registry discovery and manifest URL boundary.                      |               100% | done    | `contracts/agent-package-registry.json` defines first-party starter entries; `agent_registry_policy` defines GitHub/URL registry sources, discovery-only semantics, manifest URL install routing, and no Session Contract; validator and release-boundary tests cover it. Framework readback routes registry refresh, manifest validation, install, and list through the canonical `opl packages` lifecycle; local `opl packages list --json` returns the Framework state files and no-authority boundary.                                         | Physical marketplace curation and public registry publication remain release/distribution work.                                                                   |
| 4     | Define agent package manifest and shortcut metadata in contracts.                |               100% | done    | `contracts/agent-package-surfaces.schema.json` defines manifest, shortcut, invocation receipt, and package lock receipt surfaces; first-party MAS/MAG/RCA/BookForge/OMA fixtures live under `contracts/fixtures/agent-package-manifests`; validator and release-boundary tests check required fields, no Session Contract authority, and registry/profile alignment.                                                                                                                                                 | Public per-agent manifest publication is release/distribution work, not an App contract gap.                                                                      |
| 5     | Keep launch evidence as thin invocation receipt.                                 |               100% | done    | `agent_package_invocation_receipt_policy` requires launch-only package/shortcut/Codex fields and explicitly excludes session behavior, domain workflow, and readiness authority; active shell emits `opl_agent_package_invocation` in packaged VM route smoke while retaining legacy `opl_assistant_route` as migration alias.                                                                                                                                                                                       | Live installed App/Codex invocation evidence remains outside this non-live contract/readback landing.                                                             |
| 6     | Add package lifecycle actions.                                                   |               100% | done    | `app-install-exposure-policy` names `refresh_registry`, `install_from_manifest_url`, `agent_package_update`, `agent_package_repair`, `agent_package_uninstall`, `agent_package_preferences_set`, package-lock requirement, action receipt, rollback_ref recovery ref, and validator/release-boundary coverage. Exposure changes use `agent_package_preferences_set` with `exposure_action` values hide/unhide/enable/disable; Home shortcut preference changes use the same App action with `shortcut_id` payload. Framework writes action receipts/readback without defining Agent Package rollback as a lifecycle verb. | Live Codex-surface reload proof remains tracked separately below.                                                                                                 |
| 7     | Make first-party starter packages plus required skill packs atomic.              |               100% | done    | Contract now requires atomic package units to include plugin manifest, bundled required skill entries, optional companion skill refs, release payload proof fields, and locked required skill-pack refs that must not be `registry.version_source_ref` or another moving ref. First-party fixtures carry non-live `distribution_payload` proof refs; Framework records `bundled_required_skill_ids`, validates required skill files, reads back materialized skill ids/paths, and supports local plus remote payload manifest materialization. | Actual public payload publication and installed Codex reload proof remain release/runtime evidence, not this non-live item.                                       |
| 7.1   | Define `latest-stable` GHCR OCI OPL Package distribution semantics.              |               100% | done    | Docs define `latest-stable` as the only ordinary user OPL Package channel, candidate promotion after gates, immutable SemVer tags plus resolved OCI digest as installed truth, clean-managed-root auto-apply eligibility, and git checkout as Developer Profile source only. Framework release workflows, package manifest output, release discipline, focused tests, and package docs own the exact promotion behavior; App consumes that channel without copying current package versions. | Live GHCR publish/readback evidence remains release-owner evidence, not App contract evidence. |
| 8     | Build Settings package-directory UI.                                             |               100% | done    | Contracts/page-state/validators target package-directory-first Capabilities, integrated Home shortcut management, direct global Managed / Automatic / Developer source control, package-level Auto / Managed / Developer overrides, actual and fallback path readback, detail disclosure, and the Codex App plugin-manager-like compact directory target for Settings > 智能体与能力. Framework exposes canonical package state plus `app_state.modules.items[]` source selection readback; the active shell consumes these projections without inferring source truth. | Installed-App screenshot/readback remains visual evidence, not an open contract or shell-implementation gap. |
| 9     | Make Home shortcuts user-configurable in the package directory.                  |               100% | done    | Contracts/profile model `home_agent_shortcuts` over installed packages with `user_configurable=true`; Framework persists preference readback/action. Active shell manages shortcut visibility and order inline on the package-directory row/details surface instead of a detached second table.                                                                                                                                                                                                                        | Installed-App live acceptance can still be collected in release/user-path evidence, but the non-live App/Framework/shell implementation path is closed.                                          |
| 10    | Support third-party/manual package install.                                      |               100% | done    | Contract allows local manifest file, manifest URL, manifest import, and remote distribution payload refs only through explicit user action, validation, trust tier, package lock receipt, rollback ref, and no live-download/reload claim. Framework supports registry-selected and direct manifest install plus manifest-declared local and remote payload materialization/cleanup.                                                                                                                                 | Live user-path evidence and installed Codex reload proof remain deferred.                                                                                         |
| 11    | Migration and regression gates.                                                  |                80% | partial | Validators/tests require package shortcuts, registry discovery, generic launch receipts, lifecycle/source/lock/atomic-bundle policy, and now the package-directory/current-runtime boundary wording.                                                                                                                                                                                                                                                                                                                 | End-to-end live custom package install, no duplicate skill mirror against an installed running Codex surface, and package-native runtime projections remain open. |

## Completion Audit

| Audit item                                                                         | Status  | Completion | Fresh evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Remaining gap                                                                                                                 |
| ---------------------------------------------------------------------------------- | ------- | ---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| App registry, manifest URL, and schema contract                                    | done    |       100% | `contracts/agent-package-registry.json`; `contracts/agent-package-surfaces.schema.json`; `contracts/fixtures/agent-package-manifests/*.json`; `contracts/app-install-exposure-policy.json#agent_installation_contract.agent_registry_policy`; Framework help/readback routes registry refresh, manifest validation, install, and list through the canonical `opl packages` lifecycle.                                                                                                                                                                                              | Public registry publication is separate release/distribution work.                                                            |
| App no-strong-session and refs-only boundary                                       | done    |       100% | This plan, App decisions/invariants/architecture, and package/invocation receipt policy exclude prompt bodies, workflow schema, artifact schema, readiness verdicts, quality verdicts, and owner receipt authority.                                                                                                                                                                                                                                                                                                                                           | None for App contract/docs.                                                                                                   |
| Framework registry/manifest/install lock/readback and physical Codex surface slice | done    |       100% | Framework main `5819e7fe` implements package remote payload materialization and `physical_surface` in package locks and lifecycle receipts; focused tests prove registry fetch, manifest validation, install, list, status, local plugin cache materialization under `CODEX_HOME`, OPL state marketplace wrapper, Codex config registration, required skill payload fail-closed validation, Home shortcut preference readback/action, repair, uninstall cleanup, rollback_ref recovery refs, and no-authority boundary.                                                         | This is non-live Framework evidence; it does not prove installed App reload or release/currentness readiness.                 |
| Current runtime projection for Settings Capabilities                               | partial |        82% | Fresh local readback now shows canonical `app_state.agent_packages.directory` and `app_state.agent_packages.status_index`, while legacy `app_state.modules.items[]` remains useful as compatibility fallback. Those rows still mix dirty developer checkouts and update-needed ready packages, which is why the IA/contract moves to multi-axis package-directory UX. The current 1:1 visual mismatch against the compact Codex-plugin directory target is now an explicit acceptance gap instead of an informal design note. | Shell implementation and installed-App live evidence still need to converge fully on canonical projection and compact list/detail UI. |
| Active shell invocation receipt and Settings physical-surface display              | done    |       100% | Shell main `e4a22652e` validates `opl_agent_package_invocation` in packaged route smoke; shell main `f1fb6cae` displays package lock/action receipt `physical_surface` in Settings Capabilities and covers it with focused DOM test plus i18n validation.                                                                                                                                                                                                                                                                                                     | Live installed App/Codex reload or user-path proof remains outside this item.                                                 |
| Update/repair/uninstall and exposure preference execution                           | done    |       100% | Framework implements CLI/App-action routes for update, repair, uninstall, status, and package exposure preferences; focused tests cover package-only lifecycle actions, receipt/readback paths, physical repair/rematerialization, uninstall cleanup, and rollback_ref recovery display.                                                                                                                                                                                                                                                                     | Installed Codex-surface reload proof remains release/runtime evidence.                                                        |
| Persisted Home shortcut ordering/visibility                                        | partial |        75% | App contracts/profile and active shell model `home_agent_shortcuts` with `user_configurable=true`; Framework main `f2c8ce17` adds package Home shortcut preference write/readback through `agent_package_preferences_set` with `shortcut_id` payload and canonical `opl packages list/status#home_shortcut_preferences`.                                                                                                                                                                                                                                      | The integrated package-directory row UX and live installed-App readback remain outside this non-live item.                    |
| Physical plugin and required skill-pack materialization                            | done    |       100% | App contracts/fixtures require first-party distribution payload refs and locked required skill-pack refs; Framework materializes manifest-declared local and remote payload plugin sources into `CODEX_HOME` plugin cache, OPL state marketplace wrapper, Codex config tables, lock `physical_surface`, and receipt `physical_surface`; focused tests prove required skill validation, remote payload manifest materialization, materialized skill ids/paths readback, install/repair/uninstall cleanup and rollback_ref recovery refs; shell Settings displays `physical_surface`. | Installed Codex reload/live user-path evidence remains outside this non-live item.                                            |
| Live install/currentness/readiness evidence                                        | blocked |         0% | Boundary explicitly remains deferred; no Live evidence claim is made here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Requires real user-path or release-owner evidence, outside this docs/contract wording lane.                                   |

## Remaining Landing Order

1. Contract rename and docs parity: introduce package/shortcut/invocation terms
   while keeping old fields as migration inputs.
2. Agent Registry discovery contract: default first-party registry fixture,
   organization/user registry URLs, and direct manifest URL import.
3. Package manifest schema and fixture: first-party starter registry entries
   are covered by App schema and starter fixtures.
4. Invocation receipt schema: keep it launch-only and refs-only.
5. Installed Codex surface proof: Framework now writes local plugin cache,
   marketplace wrapper, Codex config tables, lock `physical_surface`, and
   receipt `physical_surface` for manifest-declared local plugin sources;
   next proof is installed App/Codex reload readback and public release-owner publication readback; non-live first-party payload and remote payload-manifest contracts are landed.
6. Starter package lock: required external skill packs now carry release-lock refs in first-party fixtures and are materialized into the package by Framework payload handling; public release publication readback remains a release-owner evidence item.
7. Settings package manager: show the compact package directory with refresh,
   search, status filter, manifest URL install, inline Home shortcut controls,
   package state/source/version, repair/update, uninstall, exposure preferences,
   package
   lock/action receipts, and Codex Surface `physical_surface` sync/readback.
8. Home shortcut config: user-selected shortcuts over installed packages, with
   Framework preference readback/action routing and local shell fallback.
9. Third-party/manual install: local manifest, manifest URL, manifest import, and remote payload manifest refs are supported at contract/Framework level; marketplace curation and live user-path proof remain release/runtime evidence.
10. Cleanup old hard-coded assistant language after contracts, shell, and
    validators consume the new surfaces.

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
