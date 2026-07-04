# Professional Agent Package Management Plan

Owner: `one-person-lab-app`
Purpose: `professional_agent_package_management_plan`
State: `app_landing_active_external_runtime_pending`
Machine boundary: Human-readable product and architecture plan. Machine-readable
truth lives in `contracts/`, source, validators, package manifests, and OPL
Framework readback/receipt outputs. As of the App landing, App-owned
contracts, active-shell consumption, and package-management documentation are
in place; mutating package execution and live package receipts remain OPL
Framework/runtime-owned.

## Core Decision

OPL App should not add a strong session contract for professional agents.

The App remains a Codex-first wrapper and package manager. MAS, MAG, RCA,
BookForge, OMA, and future third-party agents are Codex/OPL capability packages
that the App can install, expose, update, hide, uninstall, and launch. The App
records that launch with a thin invocation receipt, but it must not decide the
agent's domain workflow, stage model, prompt internals, artifact schema,
readiness verdict, or quality/export authority.

The lazy first landing is:

```text
entry configurable + package manageable + receipt readable
```

No strong `Session Contract` should be introduced unless a future requirement
cannot be met by package metadata, home shortcut metadata, launch receipt, and
refs-only display.

## Module Positioning

| Module | Owns | Must not own |
| --- | --- | --- |
| OPL App | User-facing package management, home shortcuts, Settings display, Codex launch, invocation receipt display, refs-only status panels. | Agent domain truth, prompt internals, stage progression, artifact bodies, quality verdicts, readiness truth. |
| OPL Framework | Managed package roots, update/apply/repair/rollback, package manifests, post-apply Codex surface sync, package receipts. | App product IA, shell rendering, domain artifact authority. |
| Codex Surface | Plugin registry, plugin-packaged skills, direct skill discovery, executor invocation. | OPL package lifecycle policy or domain truth. |
| Professional Agent Package | Agent manifest, bundled required skill packs, optional companion refs, entrypoints, health check, package version, rollback ref. | App shell behavior, App release readiness, other agents' package state. |
| Skill Pack | Reusable Codex skill content and metadata. It may live in a separate repo during development. | Runtime install policy or App GUI state. |
| Domain Agent Runtime | Domain workflow, artifacts, owner receipts, typed blockers, quality/export verdicts. | App package manager truth or generic Codex executor policy. |

## Data Shapes

`OPL Agent Package Manifest` is the install/update unit:

```json
{
  "package_id": "opl.mas",
  "agent_id": "mas",
  "display_name": "Medical AutoScience",
  "publisher": "one-person-lab",
  "version": "1.4.0",
  "source": "first_party",
  "codex_surface": {
    "plugin_ids": ["mas"],
    "required_skill_ids": ["mas"]
  },
  "skill_packs": [
    {
      "id": "mas-core-skills",
      "source": "github:gaofeng21cn/mas-skills",
      "version": "1.4.0",
      "lock_sha": "sha256-or-commit",
      "install_mode": "bundled_required"
    }
  ],
  "entrypoints": [
    {
      "shortcut_id": "research",
      "label": "Research",
      "required_skill_ids": ["mas"],
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
  "package_id": "opl.mas",
  "label": "Research",
  "source": "first_party_starter",
  "required_skill_ids": ["mas"],
  "display_policy": "refs_only_no_domain_verdict"
}
```

`Invocation Receipt` records the launch fact only:

```json
{
  "receipt_type": "capability_invocation",
  "executor": "codex_cli",
  "package_id": "opl.mas",
  "agent_id": "mas",
  "skill_ids": ["mas"],
  "source": "first_party_starter",
  "launched_from": "opl_app_home",
  "display_policy": "refs_only_no_domain_verdict"
}
```

`Package Lock / Receipt` is the installed-state proof. App may display it, but
OPL Framework owns producing and applying it:

```json
{
  "package_id": "opl.mas",
  "version_or_source_digest": "1.4.0+sha256:...",
  "installed_at": "2026-07-04T00:00:00Z",
  "updated_at": "2026-07-04T00:00:00Z",
  "codex_visible_entry": "mas",
  "bundled_required_skill_ids": ["mas", "mas-professional-skill-pack"],
  "optional_skill_refs": ["opl-scholarskills:display"],
  "source_kind": "first_party_managed_cohort",
  "trust_tier": "first_party",
  "action_receipt_id": "opl-action-receipt-ref",
  "rollback_ref": "package-receipt-ref"
}
```

## MAS And External Skill Pack Management

MAS may keep professional skills in a separate repository, but ordinary package
installation must treat MAS and its required skill packs as one atomic package
unit.

Recommended shape:

- MAS repo owns the package manifest and lock file for required skill packs.
- The skill repo remains independently developed and versioned.
- Release packaging materializes the locked skill pack into the MAS package.
- Install/update/rollback applies MAS runtime/plugin/skill-pack surfaces
  together.
- Development can use a local link, but only under an explicit Developer
  Profile override and never as the ordinary user default.
- Shared skill packs use package references and reference counting; uninstalling
  one agent must not delete a skill pack still used by another package.

Avoid this shape:

- App hard-coding MAS skill repo paths.
- OPL App reading MAS skill bodies.
- Runtime install depending on local symlinks or developer checkouts.
- A second bare `~/.codex/skills/mas` mirror that diverges from the plugin
  package.

## Landing Plan

| Order | Work item | Current completion | Status | Evidence now | Target evidence |
| --- | --- | ---: | --- | --- | --- |
| 1 | Document the no-strong-session-contract boundary. | 100% | done | This plan plus architecture/decision/invariant updates. | Markdown diff and `git diff --check`. |
| 2 | Rename product language from fixed assistants to configurable package shortcuts. | 100% | done | Product/profile contracts declare `professional_agent_packages` and `home_agent_shortcuts`; active Aion shell consumes package/shortcut fields for Home, Settings, skill allowlist, and launch receipt while keeping old assistant fields as migration aliases. | Old alias fields can be retired only after downstream consumers stop requiring the migration shape. |
| 3 | Define agent package manifest and shortcut metadata in contracts. | 55% | partial | Starter MAS/MAG/RCA/BookForge packages plus managed non-default OMA metadata are contract/profile fields with validator and release-boundary coverage; lifecycle policy defines package lock and receipt fields. | Standalone JSON schema, fixtures, and real package receipt validation. |
| 4 | Keep launch evidence as thin invocation receipt. | 90% | partial | `agent_package_invocation_receipt_policy` requires launch-only package/shortcut/Codex fields and explicitly excludes session behavior, domain workflow, and readiness authority; active shell now emits `opl_agent_package_invocation` while retaining legacy `opl_assistant_route` as migration alias. | Runtime/readback surfaces still need to display or consume the new receipt end to end. |
| 5 | Add package lifecycle actions. | 65% | partial | `app-install-exposure-policy` now names discover/install/update/repair/rollback/uninstall/enable/disable/hide/unhide/manual_check/apply_selected, package-lock requirement, action receipt, rollback ref, plus validator and release-boundary coverage. | OPL Framework action execution and package receipts prove each mutating route. |
| 6 | Make MAS plus required skill packs atomic. | 60% | partial | Contract now requires atomic package units to include plugin manifest, bundled required skill entries, optional companion skill refs, and treats MAS plus professional skill pack as one lifecycle unit. | MAS package manifest lock, bundled skill-pack receipt, rollback proof from OPL Framework. |
| 7 | Build Settings > Agents & Capabilities package manager UI. | 70% | partial | Settings Capabilities now projects package id, Codex entry, default Home visibility, user-configurable flag, source kind, package lock ref, action receipt ref, rollback ref, workflow refs, connector refs, and resource refs from package/profile/runtime state. | Mutating install/update/repair/uninstall/hide/show buttons must wait for OPL Framework action execution and receipts. |
| 8 | Make Home shortcuts user-configurable. | 55% | partial | Contracts/profile and active shell model Home as `home_agent_shortcuts` over installed packages with `user_configurable=true`; Home shortcuts no longer come from hard-coded MAS/MAG/RCA-only presentation constants. | Home still needs persisted user shortcut ordering/visibility preferences over installed packages. |
| 9 | Support third-party/manual package install. | 55% | partial | Contract now allows local manifest file, manifest URL, and manifest import only through explicit user action, validation, trust tier, package lock receipt, and rollback ref; it forbids App hardcoded repo paths, duplicate bare skill mirrors, and Homebrew package formulae. | OPL Framework manual import command validates a real third-party manifest and emits lock/rollback receipt. |
| 10 | Migration and regression gates. | 80% | partial | Validators/tests now require package shortcuts, generic launch receipts, lifecycle/source/lock/atomic-bundle policy; active shell tests cover package profile getters, Home shortcut rendering, Settings projection, and launch receipt emission. | End-to-end custom package install, uninstall/hide, shortcut reorder, and no duplicate skill mirror still require Framework runtime routes. |

## Remaining Landing Order

1. Contract rename and docs parity: introduce package/shortcut/invocation terms
   while keeping old fields as migration inputs.
2. Package manifest schema and fixture: first-party MAS/MAG/RCA/BookForge/OMA
   become starter packages.
3. Invocation receipt schema: keep it launch-only and refs-only.
4. Framework package lifecycle actions: install, update, repair, rollback,
   uninstall, hide/show exposure.
5. MAS packaging lock: materialize required external skill packs into the MAS
   package at release time.
6. Settings package manager: show package state, source, version, repair/update,
   uninstall/hide, Codex Surface sync.
7. Home shortcut config: user-selected shortcuts over installed packages.
8. Third-party/manual install: local manifest and manifest URL first; catalog or
   marketplace only after the lifecycle is stable.
9. Cleanup old hard-coded assistant language after contracts, shell, and
   validators consume the new surfaces.

## Acceptance Rules

- OPL App can start with no MAS package installed and still function as a Codex
  wrapper.
- MAS can be installed, updated, hidden, unhidden, or uninstalled as a package
  exposure without changing the App executor.
- MAS can still be invoked directly from Codex/CLI through its plugin/skill.
- Installing a third-party compliant package does not require App source edits.
- Home shortcuts are user configuration over packages, not App hard-coding.
- Invocation receipt proves launch only; it never becomes domain readiness,
  quality, artifact, or session-behavior authority.
