# OPL Native Workbench Candidate Boundary

Owner: `one-person-lab-app`
Purpose: `opl_native_workbench_candidate_boundary`
State: `deferred_not_in_26_7_15_release_scope`

## Decision

`opl-native-workbench` remains a foreground alternative candidate. AionUI remains the active release
shell. The candidate is not part of the `26.7.15` release cohort and cannot define current App or Shell
requirements.

The prior unified coordination plan is superseded by
`/Users/gaofeng/Documents/Codex/2026-07-15/OPL-App-thin-shell-low-maintenance-decision-2026-07-15.md`.
Historical candidate experiments involving model-triggered cross-thread tools, private delivery ledgers,
cross-host handoff, or a second thread runtime are evidence of those experiments only. They are not
required capabilities, release blockers, or an authority source for the active AionUI shell.

## Current Boundary

- Codex Core/App Server owns canonical thread identity, history, lifecycle, permissions, and turn state.
- A candidate may consume the same minimal user-triggered thread operations as the active shell:
  list, read, start, resume, fork, archive, and restore.
- Session/thread is the primary identity. A project or directory is initial/current cwd and presentation
  grouping only; it does not own sessions, context, or artifacts.
- Ordinary conversation uses the platform's existing ACP surface.
- Candidate-specific storage, protocol, renderer, package, or live-smoke evidence never proves active-shell
  adoption, release readiness, or shared physical Runtime parity.
- Model dynamic tools, JSONL audit/idempotency ledgers, write-set advisory control planes, pending-request
  coordination UI, and cross-host task handoff require a separate future product decision.

## Re-entry Gate

Native Workbench work resumes only after an explicit user decision names the product scope, maintenance
owner, App contract delta, and release relationship. Until then, App release validators must not depend on
candidate source, package artifacts, or historical protocol cohorts.
