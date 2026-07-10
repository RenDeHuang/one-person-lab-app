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
- The CodexCont intelligence proxy URL is preserved only when an OPL Flow intelligence receipt or matching OPL config-management receipt proves ownership. A third-party provider named `gflab` is not OPL-managed by ID alone.
- A user edit that differs from the last OPL-applied model or reasoning value becomes a local override and is preserved.
- A non-OPL active provider remains active. OPL may register or refresh an inactive OPL Gateway provider entry without replacing the user's root provider, model, or reasoning values, and must choose a non-conflicting provider ID when `gflab` is already user-owned.
- Every mutation creates a backup and an OPL-owned receipt with the managed keys, last applied values, route, and selection mode.

## OPL Flow

`opl-flow` is a required Standard and Full workflow plugin. Intelligence enhancement is an optional feature of that installed plugin, not the reason the plugin exists.

The plugin keeps three separate skills:

- `opl-flow`: thin routing and workflow entry.
- `risk-based-development-flow`: risk class, evidence budget, and TDD selection.
- `codex-ops-kit`: deterministic Git lane and public GitHub release checks.

Existing user instructions are preserved outside managed marker blocks. Reusable algorithms stay in their owning skill instead of being repeated in `AGENTS.md`.

## Companion Payloads

- Superpowers is packaged as the current stable upstream release, locked by exact release identity in each Full artifact. Full remains available while the ordinary profile stays Lite.
- OfficeCLI is packaged as one upstream-owned atomic release. Full resolves the latest stable release before publishing, then records the exact version, commit, and digest. All eight upstream skills stay owned by OfficeCLI and are task-routed rather than default-visible.
- MinerU Document Extractor is packaged and task-routed for OCR, scans, complex PDF extraction, tables, and formulas.
- UI UX Pro Max is packaged but exposed only for design, RCA, and frontend tasks.
- `cron` is not a skill payload. Scheduling belongs to the App automation surface.
- OPL does not package or maintain a duplicate `pdf` skill. Official OpenAI Primary Runtime Documents, Presentations, Spreadsheets, and PDF capabilities are preferred and are never mirrored into OPL skill directories.

## Acceptance

- App contracts distinguish packaged, installed, task-routed, and default-visible state.
- Full package assembly contains the complete OfficeCLI skill family but no `cron` or OPL-owned `pdf` skill.
- Framework configuration tests cover new install, OPL direct route, intelligence proxy route, local override preservation, and non-OPL provider preservation.
- OPL Flow installation readback proves the plugin and all three skills are installed and enabled without overwriting unmanaged user instructions.
