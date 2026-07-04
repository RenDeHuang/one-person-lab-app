# Professional Agent Package Management Plan

Owner: `one-person-lab-app`
Purpose: `professional_agent_package_management_plan`
State: `app_landing_active_framework_registry_runtime_partial`
Machine boundary: Human-readable product and architecture plan. Machine-readable
truth lives in `contracts/`, source, validators, package manifests, and OPL
Framework readback/receipt outputs. As of the App landing, App-owned
contracts, active-shell consumption, and package-management documentation are
in place. OPL Framework now owns and implements the first runtime slice for
external registry refresh, third-party manifest validation, install lock
recording, and lifecycle receipts; physical plugin materialization plus
update/repair/rollback/uninstall/hide/show execution remain Framework/runtime
work, not App contract work.

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
| 3 | Add OPL Agent Registry discovery and manifest URL boundary. | 100% | done | `contracts/agent-package-registry.json` defines first-party starter entries; `agent_registry_policy` defines GitHub/URL registry sources, discovery-only semantics, manifest URL install routing, and no Session Contract; validator and release-boundary tests cover it. Framework now exposes `opl connect agent-packages registry refresh --registry-url <url>` and writes registry cache plus lifecycle receipt. | Physical marketplace curation and public registry publication remain release/distribution work. |
| 4 | Define agent package manifest and shortcut metadata in contracts. | 75% | partial | First-party starter package metadata plus managed non-default package metadata are contract/profile fields with validator and release-boundary coverage; lifecycle policy defines package lock and receipt fields; registry entries now point at manifest URLs. Framework `validate-manifest` enforces required manifest fields and forbidden session/domain authority fields, then writes a validation receipt. | Standalone published JSON schema and broader manifest fixture set across first-party repos. |
| 5 | Keep launch evidence as thin invocation receipt. | 90% | partial | `agent_package_invocation_receipt_policy` requires launch-only package/shortcut/Codex fields and explicitly excludes session behavior, domain workflow, and readiness authority; active shell now emits `opl_agent_package_invocation` while retaining legacy `opl_assistant_route` as migration alias. | Runtime/readback surfaces still need to display or consume the new receipt end to end. |
| 6 | Add package lifecycle actions. | 78% | partial | `app-install-exposure-policy` now names discover/install/update/repair/rollback/uninstall/enable/disable/hide/unhide/manual_check/apply_selected, package-lock requirement, action receipt, rollback ref, plus validator and release-boundary coverage. Framework now implements registry refresh, manifest validation, direct/registry selected install, dry-run install, package lock writing, and lifecycle receipt readback. | Update/repair/rollback/uninstall/hide/show still need Framework execution and receipts. |
| 7 | Make first-party starter packages plus required skill packs atomic. | 68% | partial | Contract now requires atomic package units to include plugin manifest, bundled required skill entries, optional companion skill refs, and treats each starter plus required professional skill pack as one lifecycle unit. Framework install locks `bundled_required_skill_ids` from the manifest and records rollback ref. | Release packaging must materialize locked required skill packs into each first-party package and prove rollback across the physical Codex surface. |
| 8 | Build Settings > Agents & Capabilities package manager UI. | 78% | partial | Settings Capabilities now projects package id, Codex entry, default Home visibility, user-configurable flag, registry discovery role, source kind, package lock ref, action receipt ref, rollback ref, workflow refs, connector refs, and resource refs from package/profile/runtime state. App action catalog routes `refresh_registry` and `install_from_manifest_url` to Framework package lifecycle commands. | Full UI controls for update/repair/uninstall/hide/show, shortcut preference editing, and post-install Codex-surface reload feedback. |
| 9 | Make Home shortcuts user-configurable. | 55% | partial | Contracts/profile and active shell model Home as `home_agent_shortcuts` over installed packages with `user_configurable=true`; Home shortcuts no longer come from hard-coded starter presentation constants. | Home still needs persisted user shortcut ordering/visibility preferences over installed packages. |
| 10 | Support third-party/manual package install. | 78% | partial | Contract now allows local manifest file, manifest URL, and manifest import only through explicit user action, validation, trust tier, package lock receipt, and rollback ref; the Registry is discovery-only and forbids App hardcoded repo paths, duplicate bare skill mirrors, and Homebrew package formulae. Framework direct manifest install validates a real third-party manifest, requires trust tier unless selected from registry, and emits lock/rollback receipt. | Physical plugin/skill-pack materialization and uninstall/rollback cleanup for third-party packages. |
| 11 | Migration and regression gates. | 86% | partial | Validators/tests now require package shortcuts, registry discovery, generic launch receipts, lifecycle/source/lock/atomic-bundle policy; active shell tests cover package profile getters, Home shortcut rendering, Settings projection, and launch receipt emission. Framework focused tests cover registry HTTP fetch, manifest validation receipt, registry-selected install, App action install routing, list readback, invalid-manifest fail-closed behavior, typecheck, and source-module boundaries. | End-to-end custom package install, uninstall/hide, shortcut reorder, no duplicate skill mirror, and live release/install evidence. |

## Remaining Landing Order

1. Contract rename and docs parity: introduce package/shortcut/invocation terms
   while keeping old fields as migration inputs.
2. Agent Registry discovery contract: default first-party registry fixture,
   organization/user registry URLs, and direct manifest URL import.
3. Package manifest schema and fixture: first-party starter registry entries
   become starter packages.
4. Invocation receipt schema: keep it launch-only and refs-only.
5. Framework package lifecycle expansion: update, repair, rollback, uninstall,
   hide/show exposure, and physical Codex plugin/skill materialization. The
   registry refresh, manifest validation, install lock, and receipt slice is
   already Framework-owned.
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
