# App History

Owner: `one-person-lab-app`
Purpose: `app_history`
State: `history_index`
Machine boundary: Human-readable historical notes. Machine truth stays in `contracts/`, source, release artifacts, updater metadata, test outputs, active shell validation, and OPL Framework CLI/read-model output consumed by the App.

Retained records explain a past decision or failure for their original cohort.
They cannot authorize current implementation or publication. Current Shell
references remain valid in active documentation when they identify its actual
implementation ownership.

## Superseded Product Designs

- [September 2026 Studio cutover evidence](./studio-cutover-2026-09.md):
  original Stable, Full, Preview handoff and Docker cohorts, including the limits
  of the recorded sequential-upgrade evidence. Current implementation is owned
  by the [Studio product boundary](../product/gui/opl-studio-plan.md).
- [Legacy App product map](../../assets/branding/opl-app-product-map.png):
  historical fixed-Agent sidebar and panel composition, retained unchanged for
  design provenance. The current public overview is the
  [user journey](../../assets/branding/opl-app-user-journey-v2.png); GUI behavior
  and dynamic Package membership come from current App contracts and projections.
- [Professional Agent Package management implementation snapshot](./agent-package-management-implementation-snapshot.md):
  provenance for the former resolver/version/lock/payload/receipt/materialization
  design. It is historical only; current architecture and deletion gates live in
  [`../architecture.md`](../architecture.md) and
  [`../active/opl-package-platform-composition-migration.md`](../active/opl-package-platform-composition-migration.md).
- [2026-07-23 OPL Package Durable design review](./process/2026-07-23-opl-package-durable-design-review.md):
  repository-contained supersession record for the reviewed research input. Its
  rejection of the `+5k` generic filesystem transaction and bounded adapter
  safety rules are retained, while its Package-local intent/lock/ledger target
  is superseded because the target architecture deletes the custom Package
  manager. No active document may use that design as implementation authority.

## Process History

- [Process history index](./process/README.md)
- [Windows WSL2 V0-V3 receipts](./windows-wsl2/): historical probe evidence;
  current execution and qualification use the Windows validation owner.
- [K-Dense BYOK evaluation](./gui/kdense-byok-evaluation.md): sealed external
  reference analysis; no active implementation requirement.
