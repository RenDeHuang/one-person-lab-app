# Professional Agent Package Management Plan

Owner: `one-person-lab-app`
Purpose: `professional_agent_package_management_plan`
State: `active_plan`
Machine boundary: Human-readable product and architecture plan. Machine-readable
truth must land later in `contracts/`, source, validators, package manifests,
and OPL Framework readback/receipt outputs.

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
| 2 | Rename product language from fixed assistants to configurable package shortcuts. | 70% | partial | Product/profile contracts now declare `professional_agent_packages` and `home_agent_shortcuts`; old assistant fields remain migration aliases for shell/tests. | Shell consumes package/shortcut fields directly and old alias fields can be retired. |
| 3 | Define agent package manifest and shortcut metadata in contracts. | 45% | partial | Starter MAS/MAG/RCA/BookForge packages plus managed non-default OMA metadata are contract/profile fields with validator and release-boundary coverage. | Standalone JSON schema, fixtures, and lifecycle action coverage. |
| 4 | Keep launch evidence as thin invocation receipt. | 75% | partial | `agent_package_invocation_receipt_policy` requires launch-only package/shortcut/Codex fields and explicitly excludes session behavior, domain workflow, and readiness authority. | Shell receipt producer emits the new route kind and runtime evidence consumes it end to end. |
| 5 | Add package lifecycle actions. | 20% | partial | Existing managed update plane and OPL Packages policy. | Install/update/repair/rollback/uninstall/hide/show action routes with receipts. |
| 6 | Make MAS plus required skill packs atomic. | 25% | partial | Current skill/plugin ABI boundary; this plan defines the packaging rule. | MAS package manifest lock, bundled skill-pack receipt, rollback proof. |
| 7 | Build Settings > Agents & Capabilities package manager UI. | 40% | partial | Existing Settings Capabilities page and OPL Packages maintenance entry. | Installed package list, source, version, update, repair, uninstall/hide/show status. |
| 8 | Make Home shortcuts user-configurable. | 35% | partial | Contracts/profile now model Home as `home_agent_shortcuts` over installed packages with `user_configurable=true`; legacy purpose entries remain aliases. | Home reads persisted user shortcut config over installed packages. |
| 9 | Support third-party/manual package install. | 5% | not_started | Policy direction only. | Manifest URL/local manifest import with trust, compatibility, and rollback receipt. |
| 10 | Migration and regression gates. | 40% | partial | Validators/tests now require package shortcuts and the generic launch receipt while keeping legacy assistant fields as migration inputs. | Tests prove custom package install, uninstall/hide, shortcut reorder, and no duplicate skill mirror. |

## Suggested Landing Order

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
