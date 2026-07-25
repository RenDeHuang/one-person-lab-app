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

The only V6 executor is task
`019f97e4-288a-7140-8850-925c657d8c71` on the Windows Hyper-V VM
`OPL-V6-WSL2-01` (`host_platform=windows_hyperv`). It may enter the VM only
after the Windows platform owner has
issued an active writer lease matching
[`windows-wsl2-v6-writer-lease.schema.json`](windows-wsl2-v6-writer-lease.schema.json).
The lease binds the exact Hyper-V VM ID, executor, clean-VM attestation,
operations, and validity window. A password, an old VM handoff, or ownership of
historical bytes is not a writer lease.

The source-bound V6 identity is:

| Item | Exact identity |
| --- | --- |
| App acceptance source | `b52a88a1a185a0ce28b043b160657a1bb8cdb097` |
| App acceptance tree | `40191054962bb7858abdf19dfe9294dfbb7487b4` |
| Immutable packet | [`packets/b52a88a1a185a0ce28b043b160657a1bb8cdb097/`](packets/b52a88a1a185a0ce28b043b160657a1bb8cdb097/) |
| Intake manifest SHA256 | `19a743d2da1c1217e523d55c5fee247dd3badbcc0af977646fc20547504eac17` |
| Packet file set | `22` manifest-bound payloads plus the manifest |
| Shell candidate source | `868d6e818583547a5ec982b10b34464a3fa47c10` |
| Shell root tree | `1dc9960a357d9f64eaaac7eadf44b9c1a1d00ca7` |
| Shell validation subtree | `6f8519a26c3075f8b252c79a81e42f328c6efbb8` |
| Shell `bun.lock` SHA256 | `8975e67539a778ef9058419d990646b21ce35757d4cdaf45e0b101e4ce3cff7b` |
| Guest Framework repository | `https://github.com/gaofeng21cn/one-person-lab.git` |
| Guest Framework fixture | `fe1fafa26f2c59922596718b305761bbc7558c9c` |
| Guest Framework root tree | `5b27bf9fbe74815446e9ee401e81e0a192973d75` |
| Guest Framework CLI blob | Git `9a81790365e5140c7965cad870c109c6afa4b564`, SHA256 `e040d5ddab2e4c6cb660e5ba728e61172fe9e7e2f272974b19c7c4b653e159a5` |
| Windows VM | `OPL-V6-WSL2-01` with identity `hyperv-vmid:<VM-ID>` |
| Validation root | `C:\Users\Public\Documents\OnePersonLabValidation\windows-wsl2-v6-v1` |
| Sealed ZIP | `OPL-Windows-WSL2-Validation-v6.zip`, identity created by the build-seal receipt |

The App SHA identifies the acceptance source revision and is not claimed to be
embedded in the Shell-built ZIP. The historical Intel-VM ZIP SHA256
`3b126175...9dd` and executable SHA256 `60b86b47...f6c42` are provenance only.
ZIP timestamps, Bun/Node versions, cache state, and compression inputs were not
fully pinned, so those historical digests are not the acceptance authority for
a fresh Windows build.

No packet from an earlier delivery is current. The only executable intake is a
fresh create-once directory under `packets/<APP_ACCEPTANCE_SHA>/`, generated by
`v6-materialize-intake.mjs` from a clean checkout at that exact acceptance
commit, then published by a distinct delivery commit. The manifest SHA256 and
delivery commit are transport inputs to the C-root request and writer lease;
neither may be replaced by a historical packet or lease. The delivery commit is
the commit that first adds the exact packet directory above; consumers must
read it from the remote task ref rather than copying a self-referential SHA into
this document.

## Fixtures

`fixtures/` contains disposable validation-only scripts. They do not implement
an App, Shell, Framework, AionCore, installer, or release route.

The committed PowerShell fixtures include the V0-V3 probes, the V6 source
builder/sealer, and the V6 visible-smoke runner. `v6-materialize-intake.mjs`
creates the immutable source packet and `v6-host-closeout.mjs` is the Hyper-V
host finalizer.
The packet and receipts are validated against:

- [`windows-wsl2-v6-intake-manifest.schema.json`](windows-wsl2-v6-intake-manifest.schema.json);
- [`windows-wsl2-v6-build-seal.schema.json`](windows-wsl2-v6-build-seal.schema.json);
- [`windows-wsl2-v6-writer-lease.schema.json`](windows-wsl2-v6-writer-lease.schema.json);
- [`windows-wsl2-v6-receipt.schema.json`](windows-wsl2-v6-receipt.schema.json); and
- [`windows-wsl2-v6-host-closeout.schema.json`](windows-wsl2-v6-host-closeout.schema.json).

Previously executed PowerShell fixtures were parsed in the Windows guest with
`System.Management.Automation.Language.Parser::ParseFile`; a new or changed
fixture still requires a zero-error target-Windows parse before its result can
be accepted.

From a clean checkout at the exact App acceptance commit, create the packet
once:

```powershell
node .\docs\delivery\validation\windows-wsl2\fixtures\v6-materialize-intake.mjs `
  --app-sha <APP_ACCEPTANCE_SHA> `
  --output-dir C:\v6-packet
Get-FileHash -Algorithm SHA256 `
  C:\v6-packet\windows-wsl2-v6-intake-manifest.json
```

Copy the create-once manifest plus its twenty-two payload files without changing
their bytes into the empty
validation root. The platform owner then writes `writer-lease.json`; record its
SHA256 and run:

```powershell
.\v6-build-seal.ps1 `
  -ExpectedIntakeManifestSha256 <INTAKE_MANIFEST_SHA256> `
  -ExpectedWriterLeaseSha256 <WRITER_LEASE_SHA256>
```

The build seal uses a fresh detached Shell checkout, validates its commit,
tree, lock and harness inputs, runs frozen install plus the focused tests,
builds the x64 ZIP target, and creates
`v6-build-seal-receipt.json`. The receipt records the exact Windows build,
Git/Bun/Node and builder tools, environment evidence, commands and logs, ZIP,
executable, `app.asar`, expanded tree, and file count. It identifies that
specific build; source equality alone does not predict its ZIP digest.

Run
[`fixtures/v6-electron-visible-smoke.ps1`](fixtures/v6-electron-visible-smoke.ps1)
three times under the same active lease and build receipt: first with
`-ExpectedPhase stopped` and a distinct stopped `-RunId`, then with
`-ExpectedPhase running` and a distinct running `-RunId`, then after one normal
guest restart with `-ExpectedPhase restart_persistence`, the pre-restart boot
time, and a third distinct `-RunId`. Supply the exact App/Shell/Framework refs,
manifest/build/lease/ZIP digests, VM identity, lease ID and times on all three
commands. The runner verifies those fixed-path receipts,
validates the exact sealed ZIP digest, keeps the same read-only archive stream locked
against writers while rejecting zip-slip and duplicate paths and expanding
into the current `RunId` directory, then launches only that run-owned tree.
The runner holds read handles that deny writes and deletion across every
extracted file from the final pre-launch tree check until the owned processes
exit, then verifies the complete tree again. Each receipt binds that tree's
SHA256 and file count. It sets
`OPL_WINDOWS_WSL2_VALIDATION=1` only for the launched process, waits for a real
`MainWindowHandle`, reads the Chromium accessibility surface through Windows UI
Automation, captures the target window through `PrintWindow`, closes only the
process tree owned by that launch, removes only the run-owned expansion, and
compares WSL state before and after. It does not start, stop, import, unregister,
or adopt a WSL distribution and never calls Docker.

The runner writes each receipt and screenshot under
`<validation-root>\evidence\<RunId>\`. A `passed` guest receipt is still
non-terminal and keeps `writer_release.status=pending_host_soft_shutdown`.
It cannot release the writer or claim a product verdict.

The sanitized output must match
[`windows-wsl2-v6-receipt.schema.json`](windows-wsl2-v6-receipt.schema.json).
The runner deliberately records AionCore health, direct Codex App Server, and
Framework state as `unverified` or `unavailable` when that is what the
status-only candidate shows. A visible-smoke pass means the bounded projection
is accurate and guest cleanup passed; it does not turn those unavailable
capabilities into a product claim. This runner emits only
`guest_smoke_pending_host_closeout` evidence with `terminal_v6_verdict=false`.
After distinct stopped, running, and restart-persistence runs pass, use
[`fixtures/v6-host-closeout.mjs`](fixtures/v6-host-closeout.mjs). It validates
all three guest receipts with Draft 2020-12 JSON Schema, binds their receipt,
screenshot, and identical three-phase tree identities to the same artifact,
source refs, Hyper-V VM identity, active writer lease, intake manifest, and
build-seal receipt. It queries `Get-VM`, requests only
`Stop-VM -Shutdown`, and waits for the exact VM ID to read back `State=Off`.
Only then may it write
[`windows-wsl2-v6-host-closeout.schema.json`](windows-wsl2-v6-host-closeout.schema.json)
evidence with `terminal_v6_verdict=true` and a released writer receipt. A soft
shutdown timeout is a failed closeout; hard power-off cannot be substituted.

The previous uncontrolled candidate launch, in which processes appeared but no
window, UI state, negative boundary, screenshot, or cleanup receipt was
captured, does not count as a V6 smoke.
