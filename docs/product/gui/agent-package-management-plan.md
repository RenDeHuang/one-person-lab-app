# Professional Agent Package Management Plan

Owner: `one-person-lab-app`
Purpose: `professional_agent_package_management_plan`
State: `app_landing_active_framework_lifecycle_partial_live_evidence_deferred`
Machine boundary: Human-readable product and architecture plan. Machine-readable
truth lives in `contracts/`, source, validators, package manifests, and OPL
Framework readback/receipt outputs. As of the App landing, App-owned
contracts, active-shell consumption, and package-management documentation are
in place. OPL Framework now owns and implements the non-live lifecycle readback
slice for registry refresh, manifest validation, selected install lock
recording, install/update/repair/rollback/uninstall/hide/unhide/enable/disable
receipts, status, and package list readback. The active shell exposes those
routes and persists local Home shortcut visibility/order preferences. Physical
plugin/skill materialization, release-packaged rollback cleanup, installed
Codex-surface reload proof, and live user-path evidence remain
Framework/runtime or release-owner work, not App contract work.

## Core Decision

OPL App should not add a strong session contract for professional agents.

The App remains a Codex-first wrapper and package manager. First-party starter
registry entries, organization entries, user entries, and future third-party
entries are Codex/OPL capability packages that the App can discover, select,
install, expose, update, hide, uninstall, and launch. The App records that
launch with a thin invocation receipt, but it must not decide the agent's
domain workflow, stage model, prompt internals, artifact schema, readiness
verdict, or quality/export authority.

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

## Module Positioning

| Module | Owns | Must not own |
| --- | --- | --- |
| OPL App | Registry discovery, user-facing package management, home shortcuts, Settings display, Codex launch, invocation receipt display, refs-only status panels. | Agent manifest authority, install/update/rollback execution, agent domain truth, prompt internals, stage progression, artifact bodies, quality verdicts, readiness truth. |
| OPL Agent Registry | Configurable discovery list from GitHub or URL; entry metadata, labels, source/trust hints, and manifest URLs for packages the user may install. | Agent business behavior, package lock state, installed receipts, runtime mutation, or domain authority. |
| Agent Manifest URL | Authoritative package input selected by a registry entry or explicit user import. | Registry-wide catalog policy, App shell behavior, or domain workflow truth. |
| OPL Framework | Managed package roots, manifest validation, install/update/apply/repair/rollback, package manifests, post-apply Codex surface sync, package locks, package receipts. | App product IA, shell rendering, domain artifact authority. |
| Codex Surface | Plugin registry, plugin-packaged skills, direct skill discovery, executor invocation. | OPL package lifecycle policy or domain truth. |
| Professional Agent Package | Agent manifest, bundled required skill packs, optional companion refs, entrypoints, health check, package version, rollback ref. | App shell behavior, App release readiness, other agents' package state. |
| Skill Pack | Reusable Codex skill content and metadata. It may live in a separate repo during development. | Runtime install policy or App GUI state. |
| Domain Agent Runtime | Domain workflow, artifacts, owner receipts, typed blockers, quality/export verdicts. | App package manager truth or generic Codex executor policy. |

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
Registry, the manifest URL is the authority Framework validates, locks, applies,
rolls back, and receipts:

```json
{
  "package_id": "opl.research-starter",
  "agent_id": "research-starter",
  "display_name": "Research starter",
  "publisher": "one-person-lab",
  "version": "1.4.0",
  "source": "first_party_starter",
  "codex_surface": {
    "plugin_ids": ["research-starter"],
    "required_skill_ids": ["research-starter"]
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
  "update_channel": "managed_opl_packages",
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
  "version_or_source_digest": "1.4.0+sha256:...",
  "installed_at": "2026-07-04T00:00:00Z",
  "updated_at": "2026-07-04T00:00:00Z",
  "codex_visible_entry": "research-starter",
  "bundled_required_skill_ids": [
    "research-starter",
    "research-starter-required-skills"
  ],
  "optional_skill_refs": ["opl-scholarskills:display"],
  "source_kind": "first_party_managed_cohort",
  "trust_tier": "first_party",
  "action_receipt_id": "opl-action-receipt-ref",
  "rollback_ref": "package-receipt-ref"
}
```

## First-Party Starter And External Skill Pack Management

A first-party starter agent may keep professional skills in a separate
repository, but ordinary package installation must treat the agent and its
required skill packs as one atomic package unit.

Recommended shape:

- The agent repo owns the package manifest and lock file for required skill
  packs.
- The skill repo remains independently developed and versioned.
- Release packaging materializes the locked skill pack into the agent package.
- Install/update/rollback applies agent runtime/plugin/skill-pack surfaces
  together.
- Development can use a local link, but only under an explicit Developer
  Profile override and never as the ordinary user default.
- Shared skill packs use package references and reference counting; uninstalling
  one agent must not delete a skill pack still used by another package.

Avoid this shape:

- App hard-coding agent skill repo paths.
- OPL App reading agent skill bodies.
- Runtime install depending on local symlinks or developer checkouts.
- A second bare `~/.codex/skills/<agent>` mirror that diverges from the plugin
  package.

## Landing Plan

| Order | Work item | Current completion | Status | Evidence now | Target evidence |
| --- | --- | ---: | --- | --- | --- |
| 1 | Document the no-strong-session-contract boundary. | 100% | done | This plan plus architecture/decision/invariant updates. | Markdown diff and `git diff --check`. |
| 2 | Rename product language from fixed assistants to configurable package shortcuts. | 100% | done | Product/profile contracts declare `professional_agent_packages` and `home_agent_shortcuts`; active Aion shell consumes package/shortcut fields for Home, Settings, skill allowlist, and launch receipt while keeping old assistant fields as migration aliases. | Old alias fields can be retired only after downstream consumers stop requiring the migration shape. |
| 3 | Add OPL Agent Registry discovery and manifest URL boundary. | 100% | done | `contracts/agent-package-registry.json` defines first-party starter entries; `agent_registry_policy` defines GitHub/URL registry sources, discovery-only semantics, manifest URL install routing, and no Session Contract; validator and release-boundary tests cover it. Framework readback exposes `connect agent-packages registry refresh`, `validate-manifest`, `install`, and `list`; local `list --json` returns the Framework state files and no-authority boundary. | Physical marketplace curation and public registry publication remain release/distribution work. |
| 4 | Define agent package manifest and shortcut metadata in contracts. | 85% | partial | First-party starter package metadata plus managed non-default package metadata are contract/profile fields with validator and release-boundary coverage; lifecycle policy defines package lock and receipt fields; registry entries now point at manifest URLs. Framework help/readback exposes manifest validation as a receipt-producing command and forbids session/domain authority fields by contract. | Standalone published JSON schema and broader manifest fixture set across first-party repos. |
| 5 | Keep launch evidence as thin invocation receipt. | 90% | partial | `agent_package_invocation_receipt_policy` requires launch-only package/shortcut/Codex fields and explicitly excludes session behavior, domain workflow, and readiness authority; active shell now emits `opl_agent_package_invocation` while retaining legacy `opl_assistant_route` as migration alias. | Runtime/readback surfaces still need to display or consume the new receipt end to end. |
| 6 | Add package lifecycle actions. | 100% | done | `app-install-exposure-policy` names discover/install/update/repair/rollback/uninstall/enable/disable/hide/unhide/manual_check/apply_selected, package-lock requirement, action receipt, rollback ref, plus validator and release-boundary coverage. Framework implements CLI and App-action routes for install/update/repair/rollback/uninstall/hide/unhide/enable/disable/status and writes lifecycle receipts/readback. | Physical plugin materialization and live Codex-surface reload proof are tracked separately below. |
| 7 | Make first-party starter packages plus required skill packs atomic. | 70% | partial | Contract now requires atomic package units to include plugin manifest, bundled required skill entries, optional companion skill refs, and treats each starter plus required professional skill pack as one lifecycle unit. Framework install lock contract records `bundled_required_skill_ids` and rollback ref. | Release packaging must materialize locked required skill packs into each first-party package and prove rollback across the physical Codex surface. |
| 8 | Build Settings > Agents & Capabilities package manager UI. | 92% | partial | Settings Capabilities projects package id, Codex entry, default Home visibility, user-configurable flag, registry discovery role, source kind, package lock ref, action receipt ref, rollback ref, workflow refs, connector refs, and resource refs from package/profile/runtime state. Active shell exposes registry refresh, manifest install, update, repair, rollback, uninstall, hide, and show action routes. | Post-install physical Codex-surface reload feedback remains release/runtime evidence. |
| 9 | Make Home shortcuts user-configurable. | 85% | partial | Contracts/profile and active shell model Home as `home_agent_shortcuts` over installed packages with `user_configurable=true`; Home shortcuts no longer come from hard-coded starter presentation constants. Active shell persists local shortcut visibility and ordering preferences. | Framework-backed or cross-device preference readback over installed packages remains open. |
| 10 | Support third-party/manual package install. | 90% | partial | Contract allows local manifest file, manifest URL, and manifest import only through explicit user action, validation, trust tier, package lock receipt, and rollback ref; the Registry is discovery-only and forbids App hardcoded repo paths, duplicate bare skill mirrors, and Homebrew package formulae. Framework readback exposes direct manifest install and registry-selected install routes. | Physical plugin/skill-pack materialization and uninstall/rollback cleanup for third-party packages. |
| 11 | Migration and regression gates. | 92% | partial | Validators/tests require package shortcuts, registry discovery, generic launch receipts, lifecycle/source/lock/atomic-bundle policy; active shell tests cover package profile getters, Home shortcut rendering, Settings projection, lifecycle action routing, and launch receipt emission. Framework tests cover package list, lock file, lifecycle ledger file, and no-authority boundary. | End-to-end live custom package install, physical uninstall/hide cleanup, no duplicate skill mirror against installed Codex surface, and release/install evidence. |

## Completion Audit

| Audit item | Status | Completion | Fresh evidence | Remaining gap |
| --- | --- | ---: | --- | --- |
| App registry and manifest URL contract | done | 100% | `contracts/agent-package-registry.json`; `contracts/app-install-exposure-policy.json#agent_installation_contract.agent_registry_policy`; Framework help/readback for `connect agent-packages registry refresh`, `validate-manifest`, `install`, and `list`. | Public registry publication is separate release/distribution work. |
| App no-strong-session and refs-only boundary | done | 100% | This plan, App decisions/invariants/architecture, and package/invocation receipt policy exclude prompt bodies, workflow schema, artifact schema, readiness verdicts, quality verdicts, and owner receipt authority. | None for App contract/docs. |
| Framework registry/manifest/install lock/readback slice | done | 100% | `node --experimental-strip-types /Users/gaofeng/workspace/one-person-lab/src/entrypoints/cli.ts connect agent-packages list --json` returns `surface_kind=opl_agent_package_readback`, state file refs, installed count, lifecycle receipt count, and no-authority boundary. | This is non-live local readback; it does not prove physical plugin materialization. |
| Update/repair/rollback/uninstall/hide/show execution | done | 100% | Framework implements CLI/App-action routes for update, repair, rollback, uninstall, hide, unhide, enable, disable, and status; focused tests cover package-only lifecycle actions and receipt/readback paths. | Physical Codex plugin/skill changes triggered by those receipts remain release/runtime evidence. |
| Persisted Home shortcut ordering/visibility | partial | 85% | App contracts/profile and active shell model `home_agent_shortcuts` with `user_configurable=true`; active shell persists local shortcut visibility/order preferences and tests Home resolution from them. | Framework-backed or cross-device preference readback over installed packages remains open. |
| Physical plugin and required skill-pack materialization | blocked | 0% | App contract requires atomic package units and forbids duplicate bare skill mirrors. | Needs release/runtime owner evidence that locked package payloads materialize into the Codex plugin/skill surface and can rollback/cleanup physically. |
| Live install/currentness/readiness evidence | blocked | 0% | Boundary explicitly remains deferred; no Live evidence claim is made here. | Requires real user-path or release-owner evidence, outside this docs/contract wording lane. |

## Remaining Landing Order

1. Contract rename and docs parity: introduce package/shortcut/invocation terms
   while keeping old fields as migration inputs.
2. Agent Registry discovery contract: default first-party registry fixture,
   organization/user registry URLs, and direct manifest URL import.
3. Package manifest schema and fixture: first-party starter registry entries
   become starter packages.
4. Invocation receipt schema: keep it launch-only and refs-only.
5. Physical Codex plugin/skill materialization: apply package locks to the
   installed Codex plugin/skill surface, prove reload, and prove rollback /
   uninstall cleanup. The registry, manifest validation, lock, lifecycle
   receipt, exposure, status, App action, and list readback slice is already
   Framework-owned.
6. Starter package lock: materialize required external skill packs into the
   agent package at release time.
7. Settings package manager: show package state, source, version, repair/update,
   uninstall/hide, Codex Surface sync.
8. Home shortcut config: user-selected shortcuts over installed packages.
9. Third-party/manual install: local manifest and manifest URL first;
   configurable Registry discovery after the lifecycle is stable; marketplace
   only after Registry plus manifest receipt flows are proven.
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
