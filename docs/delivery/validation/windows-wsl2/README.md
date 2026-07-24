# Windows WSL2 Validation Evidence

Owner: `one-person-lab-app`
Purpose: `windows_wsl2_execution_validation_evidence`
State: `validation_only_non_binding`
Machine boundary: Sanitized receipts and disposable validation fixtures only.
This directory is not product machine truth, a release receipt, a supported
platform claim, an active implementation plan, or an App development gap.

Use
[`../../../architecture/windows-wsl2-execution-validation-plan.md`](../../../architecture/windows-wsl2-execution-validation-plan.md)
for scope and operating rules. Keep passwords, tokens, complete environment
dumps, full `opl app state` payloads, thread or prompt bodies, and raw logs out
of version control. Raw diagnostics stay in private guest/staging quarantine
and are removed after bounded evidence has been extracted.

## Receipts

- [`2026-07-24-v0-local-vm-host-preflight.md`](2026-07-24-v0-local-vm-host-preflight.md)
  records the completed host and guest preflight.
- `2026-07-24-v1-wsl-launcher-viability.md` records the attempted V1 launcher
  and direct component probes.

## Fixtures

`fixtures/` contains disposable validation-only scripts. They do not implement
an App, Shell, Framework, AionCore, installer, or release route.
