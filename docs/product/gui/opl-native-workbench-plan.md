# OPL Native Workbench Candidate Boundary

Owner: `one-person-lab-app`
Purpose: `opl_native_workbench_candidate_boundary`
State: `manual_evaluation_not_in_active_release_scope`
Machine boundary: 本文只记录 foreground alternative 的人读候选边界。当前 GUI
角色归 App contracts，候选实现归独立 Shell source/tests，adoption、package、pixel、install
与 release 结论归对应 owner evidence；本文不改变 active AionUI 角色。

## Decision

`opl-native-workbench` remains a foreground alternative candidate. AionUI remains the active release
shell. The candidate is not part of the current active AionUI release cohort and cannot define current
App or Shell requirements.

Native is maintained only as a manual, non-periodic technical evaluation option. A maintainer may run
bounded experiments, improvements, and focused tests when useful, but Native is not a required mainline
development task, release blocker, parity program, scheduled workstream, or product-completion obligation.

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
- Session/thread is the primary identity. Project affinity is zero-or-one: a project or directory may provide
  a new session's initial cwd, and a projectless session may be adopted once after canonical readback. A bound
  session is not arbitrarily reassigned; runtime `pwd` changes do not rewrite affinity, and the directory does
  not own sessions, context, or artifacts.
- Ordinary conversation uses the platform's existing ACP surface.
- Native does not require, start, package, or read AionCore. It resolves an exact Codex executable through
  `OPL_CODEX_BIN` or a candidate-owned equivalent, starts Codex App Server directly, and consumes OPL only
  through Framework `opl app state/action` contracts.
- Candidate-specific storage, protocol, renderer, package, or live-smoke evidence never proves active-shell
  adoption, release readiness, or shared physical Runtime parity.
- Model dynamic tools, JSONL audit/idempotency ledgers, write-set advisory control planes, pending-request
  coordination UI, and cross-host task handoff require a separate future product decision.

## Manual Evaluation Gate

Native Workbench may be evaluated or improved only through an explicit manual task with a bounded objective
and focused acceptance surface. Ordinary technical evaluation does not require a parity plan, release
relationship, roadmap, or promise to close all known gaps. Product expansion, active-shell adoption, or
release participation still requires a separate App owner decision and corresponding App contract delta.
App release validators must not depend on candidate source, package artifacts, or historical protocol cohorts.

## Optional Design Evaluation Tooling

For an explicit, bounded UI hypothesis, maintainers may use the `build-web-apps`
frontend design and React review skills as authoring and visual-QA aids. The App
design system remains the specification: concept generation must preserve its
information architecture and contracts, and any implementation claim still
requires browser screenshots and focused interaction checks against the selected
acceptance surface.

This tooling is not a Native runtime or package dependency, a routine validation
gate, or a reason to start an unsolicited redesign. A full visual redesign is
appropriate only when a manual evaluation task names the target screen or flow
and the design question to answer.
