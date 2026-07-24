# App History

Owner: `one-person-lab-app`
Purpose: `app_history`
State: `history_index`
Machine boundary: Human-readable historical notes. Machine truth stays in `contracts/`, source, release artifacts, updater metadata, test outputs, active shell validation, and OPL Framework CLI/read-model output consumed by the App.

Historical references to `opl-aion-shell` belong here or inside
`shells/aionui/` upstream-intake documentation. Current product docs should use
`one-person-lab-app`.

## Superseded Product Designs

- [Professional Agent Package management implementation snapshot](./agent-package-management-implementation-snapshot.md):
  provenance for the former resolver/version/lock/payload/receipt/materialization
  design. It is historical only; current architecture and deletion gates live in
  [`../architecture.md`](../architecture.md) and
  [`../active/opl-package-platform-composition-migration.md`](../active/opl-package-platform-composition-migration.md).
- The 2026-07-23 “OPL Package Durable 轻量架构设计” is retained outside this
  repository as reviewed research input. Its rejection of the `+5k` generic
  filesystem transaction is accepted, while its Package-local intent/lock/ledger
  target is superseded because the target architecture deletes the custom
  Package manager. No active document may use that design as implementation
  authority.

## Process History

- [Process history index](./process/README.md)
- [v26.6.12 stable release profile](./process/2026-06-12-stable-release-profile.md)
- [v26.6.18 stable release profile](./process/2026-06-18-stable-release-profile.md)
