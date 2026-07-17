# ADR: Codex Thread Operations Boundary

Owner: `one-person-lab-app`
Purpose: `codex_thread_operations_boundary`
State: `superseded_private_orchestration_target_current_thin_boundary`
Original date: `2026-07-14`
Updated: `2026-07-17`
Machine boundary: Current machine truth lives in
`contracts/app-gui-product-contract.json#interaction_baseline.thread_coordination`.
This file records the disposition of the former private cross-thread orchestration
target and is not a parallel feature plan, implementation ledger, or completion
authority.

## Decision

The former OPL coordination host, model-tool, receipt/ledger, and cross-host parity
target is superseded. The current product boundary is the smallest Codex-owned
thread surface needed by an ordinary user:

- one existing Codex App Server adapter owns canonical thread discovery and
  user-triggered operations;
- the existing thread directory/actions may list, read, start, resume, fork,
  archive, restore, rename, and delete threads according to the App contract;
- ordinary conversation continues through the existing AionUI ACP path;
- ordinary navigation has no independent coordination page or agent dashboard;
- Codex Core/App Server remains the authority for thread identity, history,
  execution state, permissions, approval, and lifecycle;
- Shell-local persistence is limited to drafts, preferences, and rebuildable cache;
- project/workspace is initial cwd, visible metadata, and sidebar grouping only,
  never an authorization domain or a second thread owner.

These operations are `user_initiated_only=true` and
`model_tool_access=false`. A newer model or Codex release does not authorize the
App or Shell to introduce a private delivery protocol.

## Forbidden Private Layers

The App and every carrier must not add or require:

- a second JSON-RPC/App Server client or a second thread runtime;
- an App-owned JSONL coordination audit store;
- coordination idempotency, replay, queue, or write-set advisory ledgers;
- model delivery or dynamic thread tools;
- a pending-server-request control plane;
- an independent coordination page;
- cross-host task handoff or remote-host parity maintained by OPL.

These retired surfaces are X0-05 `no_build` material. A stable upstream capability
and a new explicit product decision would be required before re-evaluation; old
source, fixtures, contracts, validators, tests, pixels, or probes do not keep them
in the current worklist.

## Codex Subagents Are Separate

AionUI Team and Codex subagents are different axes. Team stays hidden and disabled
for ordinary OPL use. Codex delegated execution, App Server metadata intake, and
canonical discovery already use the Codex runtime and the single existing adapter.
Ordinary read-only Active/Done lists, completed detail/result, and open-thread UI
remain source-partial. They may add only thin metadata/display adaptation and
owner-supported controls proven by a real delegated-turn fixture. They do not
authorize a Team store, second client, scheduler, or Shell execution authority.

## Superseded Target Disposition

| Former target | Current disposition |
| --- | --- |
| OPL coordination host | Superseded; use the single existing App Server thread-directory/user-action adapter. |
| Coordination receipts, audit, replay, idempotency, queue, or write-set advisory | Superseded X0-05; no App-owned ledger or control plane. |
| Model-callable list/read/send/fork/wait tools | Superseded X0-05; `model_tool_access=false`. |
| Cross-host aggregation, transfer, or remote parity | Superseded X0-05; not an App, Shell, Native phase-1, or release requirement. |
| User-triggered thread list/read/start/resume/fork/archive/restore | Retained B0 behavior through the existing adapter and existing directory/actions. |
| Codex delegated subagent activity | Separate B0-11 axis; execution and metadata are implemented while ordinary activity/detail UI remains partial. |

The former P0/P1/P2 implementation phases and remote acceptance matrix are
retired. They must not seed future work, candidate parity, release blockers, or
source-completion claims.

## Known Machine Cleanup

Some `opl-native-workbench` candidate contracts, validator modules, fixtures, and
focused tests still require the retired typed host bridge, dynamic tools,
coordination ledger, bilateral receipts, advisory/idempotency, security cases, and
Desktop/WebUI coordination parity. This is a documented
`current_contract_deviation`, not a current product requirement. The P1c row in
`docs/active/app-ideal-state-gap-plan.md` owns the later machine cleanup: preserve
the canonical user-triggered thread operations and remove only the private X0-05
requirements. This docs-only tranche does not modify those machine files.

## Evidence Boundary

Contract, Source, Pixel, Install, and Release remain independent. Existing source
or tests for a retired private surface prove only those retained bytes; they do not
make X0-05 necessary or complete. Current five-axis status lives only in
`docs/active/app-ideal-state-gap-plan.md` and
`docs/product/gui/shell-conformance-matrix.md`.

Current references:

- `contracts/app-gui-product-contract.json#interaction_baseline.thread_coordination`
- `docs/product/gui/feature-inventory.md#x0-条件保留--当前非目标`
- `docs/active/aionui-mainline-gui-convergence-plan.md`
- `docs/active/app-ideal-state-gap-plan.md`
- `docs/product/gui/shell-conformance-matrix.md`
