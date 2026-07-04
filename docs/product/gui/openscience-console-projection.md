# OpenScience Console Projection

Owner: `one-person-lab-app`
Purpose: `console_product_projection_contract`
State: `active_product_contract_note`
Machine boundary: Human-readable product note. Machine-readable acceptance lives
in `contracts/app-runtime-bridge.json#openscience_console_projection` and
`contracts/app-page-state-matrix.json` Runtime page state.

## Product Shape

OpenScience-inspired material enters OPL Console only as a watch-only
drilldown/projection. The App may render four cards when the Framework projects
refs for a task:

| Card | Console expression | Boundary |
| --- | --- | --- |
| Artifact graph | Graph refs for artifact nodes, edges, and lineage. | No artifact body and no storage truth. |
| Claim warning | Warning refs tied to claim/source/severity context. | No publication verdict, quality verdict, or source readiness claim. |
| Project-local ledger pointer | Pointer to the local project ledger or provenance record. | Pointer only; no ledger write, owner receipt, or storage authority. |
| Native viewer preview | Preview/open refs for the active shell viewer. | Preview only; no artifact mutation and no release/source readiness signal. |

## Authority Boundary

The projection is `refs_only` and `watch_only`. It is not:

- release readiness;
- source readiness;
- publication verdict;
- owner receipt;
- storage truth;
- compute policy.

Runtime/source producers remain the source of refs. Console owns only the user
projection shape, disclosure placement, and forbidden-claim boundary.

## Acceptance Surface

- Runtime bridge contract: `contracts/app-runtime-bridge.json#openscience_console_projection`.
- Runtime page projection: `contracts/app-page-state-matrix.json`, Runtime page
  `runtime_view_model.openscience_console_projection`.
- Focused validator: `scripts/validate-active-shell/shared-contract-validators.ts`
  enforces required cards, ref fields, watch-only flags, and forbidden claims.
