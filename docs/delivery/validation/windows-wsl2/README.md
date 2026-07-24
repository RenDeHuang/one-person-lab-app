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

V2 and V3 are recorded here as `validation_only_non_binding` evidence. They do
not enter `docs/active/app-ideal-state-gap-plan.md`, do not block unrelated
development, and do not constitute a Windows support or release claim.

## Receipts

- [`2026-07-24-v0-local-vm-host-preflight.md`](2026-07-24-v0-local-vm-host-preflight.md)
  records the completed host and guest preflight.
- [`2026-07-24-v1-wsl-launcher-viability.md`](2026-07-24-v1-wsl-launcher-viability.md)
  records the attempted V1 launcher and direct component probes.
- [`2026-07-24-v2-auth-process-ownership.md`](2026-07-24-v2-auth-process-ownership.md)
  records V2 authentication-enabled remote-mode listener, process ownership,
  cancellation, and negative-request readback. It is partial because upstream
  credential bootstrap returned `403` and renderer secret isolation was not
  attempted.
- [`2026-07-24-v3-independent-route-coverage.md`](2026-07-24-v3-independent-route-coverage.md)
  records V3 direct Codex and Framework route probes. It is partial because
  the managed AionCore ACP artifact remains blocked and a single owner binding
  was not established.

## Fixtures

`fixtures/` contains disposable validation-only scripts. They do not implement
an App, Shell, Framework, AionCore, installer, or release route.

The three committed PowerShell fixtures were parsed in the Windows guest with
`System.Management.Automation.Language.Parser::ParseFile`; all returned zero
AST errors and their guest SHA256 values matched the corresponding host bytes.
