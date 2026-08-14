# Superseded Professional Agent Package Management Implementation Snapshot

Owner: `one-person-lab-app`
Purpose: `superseded_professional_agent_package_management_snapshot`
State: `historical_only`
Currentness boundary: 本文保留 package-management 设计与当时的 non-live implementation
记录；其中 `100%` 只描述各行当时声明的 docs/contract/source/test slice，不得作为当前完成度、
关单、Pixel、Install 或 Release authority。当前唯一五轴账本是
[`app-ideal-state-gap-plan.md`](../active/app-ideal-state-gap-plan.md) 与
[`shell-conformance-matrix.md`](../product/gui/shell-conformance-matrix.md)。
Superseded target: 本文的 Framework resolver、SemVer/ABI、lock、payload、receipt、
materialization、LKG/rollback 和固定 starter/Agent/Skill surfaces 只保留为 current/
historical compatibility 说明，不得继续作为目标实现。新目标由
[`../active/opl-package-platform-composition-migration.md`](../active/opl-package-platform-composition-migration.md)
拥有：Package 是安装单元，平台原生 lifecycle 优先，capability 只检查
presence/callability，一个 Official Profile 服务 Standard/Full，Runtime 动态发现 Agent
producer 和 typed views；一方 Package 独立发布到 GHCR，Package identity、carrier
和 executor 分离，当前生产采用 Codex-first 但公共边界由 OPL 持有。所有用户结果
必须经该计划的功能等价矩阵后才能删除旧实现。
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

The separate 2026-07-23 “OPL Package Durable 轻量架构设计” is also superseded
historical input. Its `+5k` generic filesystem transaction rejection remains
valid, but its proposed Package-local intent, lock/ledger authority, lifecycle
receipt and LKG design must not be adopted. The current target removes that
custom Package-manager ownership instead of rebuilding a smaller variant.

## Reading Rule

本文所有 `should`、`target`、`decision`、`recommended`、`acceptance` 和完成百分比
均是当时实现快照中的原文，不再授权任何当前工作。本文只用于追溯旧 contracts/source
为何存在。不得从本文创建新 consumer、writer、validator、migration gate 或 release
claim。

本文及后续状态表仅记录历史实现，不再定义目标架构、GHCR 迁移顺序或删除门禁。
唯一目标 SSOT 是
[`../active/opl-package-platform-composition-migration.md`](../active/opl-package-platform-composition-migration.md)；
长期生态边界见 [`../architecture.md`](../architecture.md)，统一更新体验见
[`../product/managed-update-three-layer.md`](../product/managed-update-three-layer.md)。若本文与这些
active owners 冲突，以 active owners 为准。

## Superseded 2026-07-23 Flexibility And Cost Audit

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
manifest digests, and required/optional Package-id dependencies. Framework
follows the configured source, verifies required dependencies are present and
usable, records the transaction result, and owns recovery. Ordinary composition
does not require a version solver, pre-existing lock, or payload inventory;
version/ABI constraints are exceptional evidence-backed requirements. The App
renders the directory, delegates declared actions, and shows readback. It must
not become a second package lifecycle owner.

The following is the intended source/channel boundary:

| Concern | Target rule | Status in this App documentation tranche |
| --- | --- | --- |
| Framework/package owner | Package owner publishes; one Framework resolver and transaction choose and activate; the lifecycle receipt records the result and rollback reference | Existing boundary retained; cross-repo migration still required |
| Starter profile | Current seven first-party packages are replaceable defaults, not a fixed closure or App capability ceiling | **Planned**; current contracts still contain fixed-profile metadata |
| Official online carrier | Keep one per-Package GHCR repository with immutable SemVer artifacts and a Package-owned `latest-stable` pointer | **Published but half-migrated**; ordinary consumer still has a legacy Release Set bridge |
| Independent package release | Each Package owner can publish and update without rebuilding App, Base, Full, Release Set, or unrelated Packages | **Partially landed**; per-Package publisher exists, owner trigger and consumer migration remain |
| Registry/source adapters | A thin index discovers Package ids, OCI sources, and dependency ids; OCI, external/direct manifest, developer checkout, and offline seed remain candidate adapters; Framework follows the configured source and the Package owner advances its stable pointer | **Partially landed**; production index publication and mixed-source live behavior remain |
| Platform activation | Base keeps a thin OCI download adapter because Codex Plugin Manager does not consume OCI; Codex owns Plugin/config/cache mechanics and Framework activates additional runtime bytes | **Migration required**; existing Framework materialization must be reduced without losing runtime |
| Release Set | `one-person-lab-manifest` is Full/offline/integration-QA snapshot only and never ordinary online currentness | **Migration required**; current default consumer still reads the legacy bridge |
| App/Shell boundary | App and Shell consume Framework directory/status/actions and do not copy package authority | Non-live projection path landed; duplicate authority cleanup remains pending |
| Stable/Docker/WebUI/Full/Nightly/Daily | Stable is a release policy, Docker/WebUI and Homebrew are carriers, Full is a snapshot, Nightly publication is retired, Canary is independent validation, and Daily is cadence/index reconciliation | **Documented target**; live terminal proof remains pending |

### Official GHCR route and migration

The publication store stays on GitHub GHCR:

```text
owner tag
  -> ghcr.io/<owner>/one-person-lab-packages/<package-id>:<semver>
  -> ghcr.io/<owner>/one-person-lab-packages/<package-id>:latest-stable
```

The target consumer route is:

```text
thin repository index
  -> Framework follows the configured Package source
  -> GHCR tag resolves to immutable digest for this transaction
  -> thin Base OCI adapter downloads complete Package
  -> Codex activates Plugin/config/cache
  -> Framework activates Package runtime and records terminal receipt
```

The old route,
`one-person-lab-manifest:latest-stable -> selected_for_release_set -> Package
artifact`, remains a compatibility fallback only. It must be removed from the
ordinary update path after the new production index and per-Package route have
fresh installed readback. The Release Set continues to serve Full, offline
installation, integration testing, and release QA.

On 2026-07-24, live GHCR demonstrated why this migration is required: the
Release Set still selected MAS `0.2.12` and ScholarSkills `0.2.7`, while the
independent Package `latest-stable` pointers had advanced to MAS `0.2.19` and
ScholarSkills `0.2.20`. The source platform is working; the legacy shared
selection path is stale.

No-feature-regression acceptance is explicit:

- Standard and Full install all required official starter Packages selected by
  their profile, including required Package dependencies.
- MAS activation ensures ScholarSkills is present and usable without requiring
  unrelated Package versions to match. Default dependency declarations require
  presence and usability, not a version range.
- Silent background update advances only the selected Package and
  preserves App, Base, and unrelated Packages.
- Codex Plugin, Skill, icon, config, and cache read back active after install or
  update; any additional Package runtime also reads back ready.
- Home shortcuts, Settings lifecycle state, runtime task status, and
  Agent-specific extension interfaces remain sourced from Framework/owner
  projections rather than from GHCR or the index.
- Full/offline installation reproduces the build-selected Package set without
  making that snapshot the online latest authority.

The resolved OCI digest belongs to the active transaction and receipt. OPL
must not turn it into a pre-existing family lock, Package-to-App release edge,
or hand-maintained payload inventory.

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
manifests remain optional candidate adapters. Framework follows the configured
source and verifies required dependency presence. Codex/platform installed
state plus terminal Framework readback defines local truth. Existing Package
lock fields remain migration and support readback, not a required target
architecture or currentness authority.

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
authority surface. AionUI and OPL Studio must consume the same
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

## Superseded Core Decision

OPL App should not add a strong session contract for professional agents.

The App remains a Codex-first wrapper and package manager. Framework built-in
first-party Release Set entries plus organization, user, and future third-party
external registry entries are Codex/OPL capability packages that the App can discover, select,
install, update, repair, uninstall, configure exposure, and launch. Exposure
state uses `agent_package_preferences_set` with an `exposure_action` such as
hide/unhide/enable/disable. Those mutations are Framework action refs with
receipts; AionUI and OPL Studio only display the package directory and
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

Package manifests describe identity, compatibility, dependencies, and optional
source hints. Framework may resolve any compatible configured source: OCI,
GitHub, local checkout, direct manifest, bundled bytes, or another adapter. No
single moving channel, Release Set, payload inventory, version, or digest is
required before resolution.

After an install or update, Framework records the exact source and materialized
bytes in its package lock and receipt. Those records prove the result of that
operation; they do not restrict future composition or require App, Base, Flow,
or unrelated Packages to move together. Installation Carrier, Runtime Payload,
and Codex Surface remain separate projections of what was actually selected.
authority.

Rollback is a recovery reference, not a new App-owned verb. Agent Package rows
may show `rollback_ref`, fail-closed status, action receipts, and repair/update
routes from Framework readback. Agent Package lifecycle does not define a
rollback action id; managed update rollback for runtime substrate or
package-channel components remains owned by the Managed Update plane. AionUI and
OPL Studio must not invent shell-local rollback semantics beyond
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
  "source": "first_party_starter",
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
      "source": "skills-manager:research-starter-required-skills",
      "install_mode": "required"
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
  "resolved_source": "skills-manager:research-starter",
  "resolved_ref": "sha256:...",
  "installed_at": "2026-07-04T00:00:00Z",
  "updated_at": "2026-07-04T00:00:00Z",
  "codex_visible_entry": "research-starter",
  "materialized_skill_ids": [
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

| Semantic lane | Canonical source | Aion display role | OPL Studio display role | Action boundary |
| --- | --- | --- | --- | --- |
| Runtime | `opl app state --profile fast --json#app_state.operator.workbench.work_item_projection_v2` | Minimal WorkItem status, Stage, Attempt, Token, next action, and archive/restore | Same minimal WorkItem status contract | Only `work_item_visibility_set` through `opl app action execute`; selected-item detail stays projection-bound, while full operator drilldown belongs to Maintenance diagnostics. |
| Task | `opl app state --profile fast --json#app_state.operator.workbench.task_run_projection_v2.tasks[]` | Current task slice in conversation and right inspector | Task detail and artifact/provenance workbench pane | Task action, follow-up, export, and workflow-skill candidate refs only; no artifact body, owner receipt, or domain verdict authority. |
| Package | `opl app state --profile fast --json#app_state.agent_packages.directory.entries + app_state.agent_packages.status_index` | Settings Agents package directory rows | Packages panel rows | Package lifecycle and Home shortcut preference actions through Framework-backed App action refs; `rollback_ref` is displayed as a recovery reference, not an App-owned rollback verb; diagnostic enrichments cannot define rows or actions. |

## Superseded First-Party Starter And External Skill Pack Management

A first-party starter agent may keep professional skills in a separate
repository, but ordinary package installation must treat the agent and its
required skill packs as one atomic package unit.

Superseded implementation shape:

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
| 4     | Define first-party product metadata, manifest, and shortcut shapes.               |               100% | done    | `app-product-profile.json#gui.agent_package_registry.starter_package_metadata` owns replaceable UI metadata for the current starter profile; `agent-package-surfaces.schema.json` defines external registry, manifest, shortcut, invocation receipt, and package lock receipt surfaces; the current starter fixtures live under `contracts/fixtures/agent-package-manifests`. Validators check profile/fixture alignment without treating metadata as collection or lifecycle truth. | Public per-package manifest publication and starter-profile replacement are release/distribution work, not an App contract gap. |
| 5     | Keep launch evidence as thin invocation receipt.                                 |               100% | done    | `agent_package_invocation_receipt_policy` requires launch-only package/shortcut/Codex fields and explicitly excludes session behavior, domain workflow, and readiness authority; active shell emits `opl_agent_package_invocation` in packaged VM route smoke while retaining legacy `opl_assistant_route` as migration alias.                                                                                                                                                                                       | Live installed App/Codex invocation evidence remains outside this non-live contract/readback landing.                                                             |
| 6     | Add package lifecycle actions.                                                   |               100% | done    | `app-install-exposure-policy` names `refresh_registry`, `install_from_manifest_url`, `agent_package_update`, `agent_package_repair`, `agent_package_uninstall`, `agent_package_preferences_set`, package-lock requirement, action receipt, rollback_ref recovery ref, and validator/release-boundary coverage. Exposure changes use `agent_package_preferences_set` with `exposure_action` values hide/unhide/enable/disable; Home shortcut preference changes use the same App action with `shortcut_id` payload. Framework writes action receipts/readback without defining Agent Package rollback as a lifecycle verb. | Live Codex-surface reload proof remains tracked separately below.                                                                                                 |
| 7     | Resolve required Skills through the generic Package lifecycle.                   |               100% | done    | Package manifests declare required and optional Skills by source without requiring version, lock, digest, or bundled payload fields. Framework resolves the dependency closure, materializes selected capabilities, and records exact installed results; App only renders projected status and actions. | Installed Codex reload proof remains release/runtime evidence, not a composition prerequisite. |
| 7.1   | Keep Package sources and releases independently composable.                      |               100% | done    | OCI, GitHub, local checkout, direct manifest, bundled bytes, and future adapters are compatible resolver inputs. There is no global source order, moving-channel requirement, family Release Set, or fixed package cohort. Exact refs and digests belong only to the install/update/build that actually selected them. | Live publication/readback remains owner evidence for that specific artifact, not App contract evidence. |
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

## Superseded Acceptance Snapshot

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
