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

V0-V3 evidence and the planned V6 Windows Electron smoke remain
`validation_only_non_binding`. They do not enter
`docs/active/app-ideal-state-gap-plan.md`, do not block unrelated development,
and do not constitute a Windows support or release claim.

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

## V6 Candidate And Evidence

No V6 receipt exists until an exact Windows Electron candidate has completed a
real-VM smoke. The acceptance is defined in
[`V6: Windows Electron technical-validation surface`](../../../architecture/windows-wsl2-execution-validation-plan.md#v6-windows-electron-technical-validation-surface): a visibly gated
diagnostic surface may show only the discovered `OPL-Validation-g0001` guest
identity, AionCore health, direct Codex App Server, and read-only Framework
state. ACP, authenticated bootstrap, and WebSocket conversation remain clearly
`unverified` or `unavailable` and must not appear as usable chat.

Before a V6 run that needs guest writes, the current external-SSD VM owner must
release its single-writer authority. Do not use the historical internal-disk VM
for large writes, clone or expand a VM, prune Docker, globally shut down WSL, or
delete `OnePersonLab`/unknown Docker state. The resulting receipt records the
artifact and gate, external VM identity, guest-writer handoff/release, bounded
status outcomes, and a sanitized visible-state proof; it does not retain
credentials, endpoints, complete state payloads, thread/prompt bodies, or raw
logs.

The only approved V6 candidate identity is:

| Item | Exact identity |
| --- | --- |
| Windows ZIP | `OPL-Windows-WSL2-Validation-v6.zip` |
| ZIP SHA256 | `3b126175f77cad7c0b1ddc83f2008d2102539cef29f87dfd839ee70be86df9dd` |
| ZIP executable SHA256 | `60b86b47b4557e51e12d6d1f687f1544f420841356cdf1d6bae8523a6ebf6c42` |
| Shell candidate source | `868d6e818583547a5ec982b10b34464a3fa47c10` |
| Guest Framework fixture | `fe1fafa26f2c59922596718b305761bbc7558c9c` |
| Guest ZIP path | `C:\Users\oplrunner\OnePersonLabValidation\20260725-wsl2-v6\OPL-Windows-WSL2-Validation-v6.zip` |

The App SHA in a receipt identifies the acceptance runner and docs revision
used for that run; it is not claimed to be embedded in the Shell-built ZIP.

## Fixtures

`fixtures/` contains disposable validation-only scripts. They do not implement
an App, Shell, Framework, AionCore, installer, or release route.

The eleven committed PowerShell fixtures include the V0-V3 probes and the V6
visible-smoke runner; `v6-host-closeout.mjs` is a host-only finalizer.
Previously executed PowerShell fixtures were parsed in the Windows guest with
`System.Management.Automation.Language.Parser::ParseFile`; a new or changed
fixture still requires a zero-error target-Windows parse before its result can
be accepted.

Run
[`fixtures/v6-electron-visible-smoke.ps1`](fixtures/v6-electron-visible-smoke.ps1)
only after the external-SSD VM owner has issued an explicit writer-release
receipt. It verifies that fixed-path JSON receipt and its SHA, validates the
exact candidate ZIP digest, expands the verified ZIP into the current `RunId`
directory, and launches only that run-owned tree. It sets
`OPL_WINDOWS_WSL2_VALIDATION=1` only for the launched process, waits for a real
`MainWindowHandle`, reads the Chromium accessibility surface through Windows UI
Automation, captures the target window through `PrintWindow`, closes only the
process tree owned by that launch, removes only the run-owned expansion, and
compares WSL state before and after. It does not start, stop, import, unregister,
or adopt a WSL distribution and never calls Docker.

The writer handoff must exist both as the fixed guest JSON consumed by the
runner and as an authoritative host receipt. Its host bytes bind the exact
external-SSD VMX canonical path and SHA, VMware BIOS UUID, external volume UUID,
previous owner, next owner, receipt ID, and release time. The guest runner also
requires the host-provided handoff SHA256; comparing caller-supplied fields
alone is insufficient.

The sanitized output must match
[`windows-wsl2-v6-receipt.schema.json`](windows-wsl2-v6-receipt.schema.json).
The runner deliberately records AionCore health, direct Codex App Server, and
Framework state as `unverified` or `unavailable` when that is what the
status-only candidate shows. A visible-smoke pass means the bounded projection
is accurate and guest cleanup passed; it does not turn those unavailable
capabilities into a product claim. This runner emits only
`guest_smoke_pending_host_closeout` evidence with `terminal_v6_verdict=false`.
After distinct stopped and running runs pass, use
[`fixtures/v6-host-closeout.mjs`](fixtures/v6-host-closeout.mjs). It validates
both guest receipts with Draft 2020-12 JSON Schema, binds their receipt and
screenshot digests to the same artifact, source refs, VM identity, and writer
handoff, verifies the VMX on the expected external SSD, requests only a bounded
VMware soft shutdown, and waits for both `vmrun list` and the `vmware-vmx`
process readback to clear. Only then may it write
[`windows-wsl2-v6-host-closeout.schema.json`](windows-wsl2-v6-host-closeout.schema.json)
evidence with `terminal_v6_verdict=true` and a released writer receipt. A soft
shutdown timeout is a failed closeout; hard power-off cannot be substituted.

The previous uncontrolled candidate launch, in which processes appeared but no
window, UI state, negative boundary, screenshot, or cleanup receipt was
captured, does not count as a V6 smoke.
