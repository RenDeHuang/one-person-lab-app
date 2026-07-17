# OPL Native Workbench Candidate Boundary

Owner: `one-person-lab-app`
Purpose: `opl_native_workbench_candidate_boundary`
State: `deferred_not_in_active_release_scope`
Machine boundary: 本文只记录 foreground alternative 的人读候选边界。当前 GUI
角色归 App contracts，候选实现归独立 Shell source/tests，adoption、package、pixel、install
与 release 结论归对应 owner evidence；本文不改变 active AionUI 角色。

## Decision

`opl-native-workbench` remains a foreground alternative candidate. AionUI remains the active release
shell. The candidate is not part of the current active AionUI release cohort and cannot define current
App or Shell requirements.

The prior unified coordination plan is superseded by the repo-owned boundaries in
[`aionui-mainline-gui-convergence-plan.md`](../../active/aionui-mainline-gui-convergence-plan.md),
[`feature-inventory.md`](feature-inventory.md), and [`decisions.md`](../../decisions.md).
Historical candidate experiments involving model-triggered cross-thread tools, private delivery ledgers,
cross-host handoff, or a second thread runtime are evidence of those experiments only. They are not
required capabilities, release blockers, or an authority source for the active AionUI shell.

## Current Boundary

- Codex Core/App Server owns canonical thread identity, history, lifecycle, permissions, and turn state.
- A candidate may consume the same minimal user-triggered thread operations as the active shell:
  list, read, start, resume, fork, archive, and restore.
- Session/thread is the primary identity. A project or directory may provide a new session's initial cwd
  and read-only recorded-workspace grouping; runtime `pwd` changes do not rewrite either, and the directory
  does not own sessions, context, or artifacts.
- Ordinary conversation uses the platform's existing ACP surface.
- Candidate-specific storage, protocol, renderer, package, or live-smoke evidence never proves active-shell
  adoption, release readiness, or shared physical Runtime parity.
- Model dynamic tools, JSONL audit/idempotency ledgers, write-set advisory control planes, pending-request
  coordination UI, and cross-host task handoff require a separate future product decision.

## Re-entry Gate

Native Workbench work resumes only after an explicit user decision names the product scope, maintenance
owner, App contract delta, and release relationship. Until then, App release validators must not depend on
candidate source, package artifacts, or historical protocol cohorts.
