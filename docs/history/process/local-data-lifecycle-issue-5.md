# Local Data Lifecycle Issue 5 Provenance

Owner: `one-person-lab-app`
Purpose: `local_data_lifecycle_issue_5_provenance`
State: `historical_provenance`
Machine boundary: Human-readable Issue #5 landing provenance. Current machine-readable policy lives in `contracts/app-release-channel.json#local_data_lifecycle`; executable shell behavior lives in `shells/aionui/packages/desktop/src/process/services/localDataLifecycle/index.ts`, IPC bridge wiring, Settings / Storage UI, active-shell validation, and focused release-boundary tests.

## Owner Foldback

GitHub issue `#5` was originally only partially addressed by legacy updater
cache cleanup. The current owner for this surface is no longer an active plan:

- Policy: `contracts/app-release-channel.json#local_data_lifecycle`.
- Settings UI contract: `contracts/app-gui-product-contract.json#pages.settings_storage`.
- Page-state contract: `contracts/app-page-state-matrix.json#settings_storage`.
- Validation: `scripts/validate-active-shell/release-contract-validator.ts` and focused release-boundary tests.
- Implementation carrier: `shells/aionui/packages/desktop/src/process/services/localDataLifecycle/index.ts`.

This document keeps the historical issue split and no-silent-delete rationale.
It is not release-ready, owner-acceptance, packaged-smoke, or real
user-directory migration evidence.

## Archived Finding

The broader local data growth classes were split into explicit lifecycle classes with inventory-first UI and receipt-backed execution:

| Class | Current status | Required handling |
| --- | --- | --- |
| Updater cache | `landed_contract_and_shell_test_backed` | Remove stale installer packages only, preserving recovery metadata and the active pending package; current and retired updater cache roots are included in the lifecycle inventory and receipt path. |
| Conversation artifacts | `landed_contract_and_shell_test_backed` | Inventory first; archive/export receipt and restore proof are required before explicit user-confirmed cleanup can run. |
| Runtime/toolchain roots | `landed_contract_and_shell_test_backed` | Prune only roots not referenced by current or rollback pointers; execution requires the exact dry-run plan hash and writes a receipt. |
| Logs | `landed_contract_and_shell_test_backed` | Bounded rotation by age/count/size; execution requires the exact dry-run plan hash, removes only `.log` files, and does not prove user artifact cleanup. |

## Adopted External Patterns

| Pattern source | Local adoption |
| --- | --- |
| Docker prune | Treat cleanup as removal of unused objects, not arbitrary data deletion; keep stronger separation for opt-in scopes. Official reference: <https://docs.docker.com/reference/cli/docker/system/prune/>. |
| pnpm store prune | Only unreferenced cache/store entries are candidates. Official reference: <https://pnpm.io/cli/store#prune>. |
| Hugging Face cache tooling | Scan/dry-run before deletion and expose explicit candidate sets. Official reference: <https://huggingface.co/docs/huggingface_hub/en/guides/manage-cache>. |
| Electron app paths | Keep `userData`, cache/session data, and logs as separate lifecycle classes. Official reference: <https://electronjs.org/docs/latest/api/app>. |

## Task Split

| Task | Owner surface | Completion gate |
| --- | --- | --- |
| Storage inventory panel | `Settings / Storage`; `contracts/app-release-channel.json#local_data_lifecycle.storage_inventory` | GUI shows size/path/classification for updater cache, conversation artifacts, runtime/toolchain, and logs from the App-owned lifecycle inventory. |
| Conversation archive and restore proof | `conversation_artifacts` lifecycle contract | Archive receipt records source paths, archive path, sha256, manifest, and restore probe before any delete button can execute. |
| Runtime pointer retention prune | `runtime_toolchain` lifecycle contract and managed updater pointer policy | Dry-run plan protects `current.json`, `current`, and rollback refs; execute action only removes unreferenced runtime roots with a receipt. |
| Log bounded rotation | `logs` lifecycle contract | Dry-run plan classifies candidates by age/count/size and execute action removes only log files. |
| Updater retired cache cleanup | `updater_cache` lifecycle contract | Current and retired updater roots are covered by focused shell tests and active-shell validation. |

## Verification Boundary

This lifecycle work is considered landed for App contracts, active shell implementation, focused shell tests, and active-shell validation. It is not by itself a packaged App smoke, real user-directory migration run, release-ready claim, or owner acceptance receipt.

## Current Non-Goals

- Do not silently delete conversation workdirs, generated papers, baselines, reports, or intermediate deliverables.
- Do not use runtime/toolchain cleanup as an Electron updater cache cleanup.
- Do not use log cleanup as evidence that user artifacts were retained, archived, or removed.
- Do not use focused tests or contract validation alone as a packaged App smoke, real user-directory E2E proof, release-ready claim, or owner acceptance receipt.
