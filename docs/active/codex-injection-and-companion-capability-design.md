# Codex Injection And Companion Capability Design

Owner: `one-person-lab-app`
Purpose: define the App-owned Codex configuration, OPL Flow installation, Full companion packaging, and user-facing exposure boundary.
State: `active`
Machine boundary: contracts remain authoritative for executable product policy; this document explains the approved design and implementation scope.

## Approved Target

The App separates four concerns that must not be collapsed into one list:

1. Full package contents: payloads required for offline first install.
2. Installed and enabled state: exact versions, source digests, and receipts.
3. Codex task routing: skills available to native discovery when a task matches.
4. App presentation: purpose entries and settings shown to ordinary users.

Being packaged does not make a capability default-visible.

## Codex Configuration Ownership

- A missing Codex config receives the current OPL provider, model, reasoning effort, and submitted Gateway credential.
- An active provider that points to the direct OPL Gateway is OPL-managed regardless of its local provider alias. Auto-managed model and reasoning values follow the current App profile while unowned provider-table keys remain intact.
- A user edit that differs from the last OPL-applied model or reasoning value becomes a local override and is preserved.
- A non-OPL active provider remains active. OPL may register or refresh an inactive OPL Gateway provider entry without replacing the user's root provider, model, or reasoning values, and must choose a non-conflicting provider ID when `gflab` is already user-owned.
- Every mutation creates a backup and an OPL-owned receipt with the managed keys, last applied values, route, and selection mode.

## OPL Flow

`opl-flow` is a required Standard and Full workflow plugin.

The plugin keeps two separate skills:

- `opl-flow`: thin routing and workflow entry, including risk and evidence-budget selection.
- `codex-ops-kit`: deterministic Git lane and public GitHub release checks.

Existing user instructions are preserved outside managed marker blocks. Reusable algorithms stay in their owning skill instead of being repeated in `AGENTS.md`.

## OPL Flow Dependency Projection

- OPL App does not own a companion skill list. Flow declares composable capability intent; Framework reuses compatible Skills or projects install actions. Full may carry available compatible Skill payloads, but their absence does not block Flow or App.
- OfficeCLI remains one upstream-owned atomic release; MinerU and UI UX Pro Max remain independently owned, task-routed dependencies.
- Superpowers, Ponytail, and CodexCont are manifest conflicts/retired surfaces. Framework owns backup, discovery removal, receipt, and rollback.
- The App displays dependency state and accepts user overrides; Framework performs install/config mutation.
- `cron` is not a skill payload. Scheduling belongs to the App automation surface.
- OPL does not package or maintain a duplicate `pdf` skill. Official OpenAI Primary Runtime Documents, Presentations, Spreadsheets, and PDF capabilities are preferred and are never mirrored into OPL skill directories.

## Acceptance

- App contracts distinguish packaged, installed, task-routed, and default-visible state.
- Full package assembly may carry the available OfficeCLI skill family but does not use that payload as dependency authority; it contains no `cron` or OPL-owned `pdf` skill.
- Framework configuration tests cover new install, OPL direct route, local override preservation, and non-OPL provider preservation.
- OPL Flow installation readback proves the plugin and all three skills are installed and enabled without overwriting unmanaged user instructions.
