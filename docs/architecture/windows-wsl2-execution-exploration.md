# Windows WSL2-Only Execution Exploration

Owner: `one-person-lab-app`
Purpose: `windows_wsl2_execution_exploration_ssot`
State: `exploration_non_binding`
Last reviewed: `2026-07-24`
Machine boundary: This document records a conditional architecture and
maintenance direction for possible future Windows product work. It is not an
implementation plan, backlog, release gap, supported-platform declaration,
readiness claim, or authorization to change App, Shell, AionCore, Framework,
installer, workflow, or release bytes. Current machine truth remains in
`contracts/`, source, tests, produced artifacts, and fresh runtime readback.

## 1. Decision Boundary

The App currently supports `macos-arm64` for release. Windows can be built
manually, but that does not make Windows a supported release platform.

If OPL later decides to develop or publish a Windows desktop product, the
conditional product requirement explored here is:

```text
agent_executor = wsl2_linux_only
native_windows_codex_allowed = false
native_windows_agent_or_framework_execution_allowed = false
windows_host_role = gui_installer_launcher_and_host_integration
missing_or_unhealthy_wsl_behavior = block_and_repair
```

This requirement is intentionally conditional. Until a separate product
decision promotes Windows work, every phase, estimate, gate, and interface
below is reference material only. Its presence must not create an App gap,
release blocker, roadmap commitment, due date, or implied owner assignment.

The detailed, implementable reference is
[`windows-wsl2-execution-implementation-blueprint.md`](windows-wsl2-execution-implementation-blueprint.md).
It selects a maintainable target shape, protocols, state machines, repository
write sets, phase gates, and qualification criteria, but remains non-binding
under this parent decision boundary. It is not a dated active plan and does not
change current support or readiness.

The scope is the complete Codex execution plane, not the integrated terminal.
The terminal may remain an independently selected Windows or WSL shell. No
execution surface may silently route an Agent, Codex App Server, OPL Framework
command, scheduled task, review, or other Codex-backed operation to native
Windows. Native Windows remains the correct place for Electron, installation,
the WSL launcher, path presentation, and explicit host integrations.

## 2. Verified Baseline

### 2.1 OpenAI product behavior

As of the review date:

- The Windows ChatGPT/Codex App defaults to a Windows-native Agent, which runs
  commands in PowerShell.
- The App can switch the Agent environment to WSL2; the change takes effect
  after restart. Agent environment and integrated terminal are independent.
- For CLI use, the official documentation instructs users to install and run
  Linux Codex inside WSL. It does not describe a Windows CLI `config.toml`
  setting that delegates execution into WSL.
- Codex `0.115` and later require WSL2 for the Linux sandbox path. WSL1 is not
  supported after the move to `bwrap`; Linux uses `bwrap` plus `seccomp`.
- The supplied screenshot shows the App attempting to use `docker-desktop`,
  reporting that `/usr/bin/bash` is missing, and retaining the Windows-native
  Agent environment. It does not establish whether this check occurred during
  enumeration, selection validation, or launch. The private distribution
  selection algorithm is not documented and is not an OPL contract to copy.

Official references:

- <https://learn.chatgpt.com/docs/windows/windows-app#windows-subsystem-for-linux-wsl>
- <https://learn.chatgpt.com/docs/windows/wsl#use-codex-cli-with-wsl>
- <https://learn.chatgpt.com/docs/agent-approvals-security#os-level-sandbox>

### 2.2 Current OPL implementation

The current App and Shell are not WSL2-only on Windows:

- `contracts/app-product-profile.json` lists only `macos-arm64` under
  `supported_release_platforms`.
- `contracts/app-shell-adapter.json` binds AionCore, managed Codex ACP, and
  Codex CLI to the target-platform managed-resource payload.
- The Shell resolves `win32-<arch>/aioncore.exe` on Windows.
- The Windows managed-resource verifier expects a Windows Codex ACP payload and
  `codex.exe`.
- AionCore currently applies native Windows sandbox configuration for Codex
  full-access launches.
- The Shell also has a direct Codex App Server path that resolves and starts
  `codex app-server --stdio` independently of the AionCore ACP conversation
  path.
- The Shell's `oplRuntimeBridge` independently resolves and spawns the OPL
  Framework CLI for bootstrap/initialize, Codex configuration, state, actions,
  login, update, and rollback surfaces.
- The current backend launcher uses AionCore local mode, which upstream defines
  as skipping authentication. Moving that endpoint across Windows/WSL localhost
  forwarding creates a host-to-guest trust boundary that current local-process
  semantics do not settle.
- First-run and release qualification do not define a WSL2 runtime identity or
  a clean Windows desktop install starting without WSL.

These facts describe current behavior. They are not defects while Windows is
not a supported release platform.

## 3. Architecture Principles

Any future Windows exploration should preserve these constraints:

1. **Do not fork AionCore for WSL routing.** Consume an upstream Linux AionCore
   binary byte-for-byte. OPL owns only its launch, installation, supervision,
   path projection, and acceptance boundary.
2. **Keep the Linux execution plane coherent.** Linux AionCore, managed Codex
   ACP, managed Codex CLI, OPL Framework/runtime, `CODEX_HOME`, and authoritative
   workspaces run inside the same WSL2 distribution.
3. **Keep the Windows host thin.** Windows Electron renders the product and
   talks to the Linux backend through a deliberately scoped and authenticated
   transport compatible with the existing HTTP/WebSocket protocol. PowerShell
   or native installer code may detect, install, repair, start, and inspect WSL,
   but may not execute Agent or Framework work.
4. **Use an OPL-managed distribution identity.** Do not depend on the user's
   default Ubuntu, mutate an arbitrary user distribution, or select
   `docker-desktop`. A dedicated name such as `OPL-Linux` makes installation,
   upgrade, recovery, and support more deterministic. This is a product identity
   and servicing boundary, not a tamper-proof WSL ownership primitive.
5. **Fail closed without fallback.** Missing WSL2, invalid distribution
   identity, failed Linux handshake, or wrong runtime bytes leads to an
   install/repair state. It never activates Windows Codex or PowerShell as an
   Agent executor.
6. **Keep product truth in the App.** The App owns the conditional Windows
   product contract and acceptance semantics. Shell owns the concrete launcher
   and renderer integration. Framework and package/domain owners retain their
   existing authorities.
7. **Prefer protocol boundaries over path/process leakage.** The Windows side
   should consume an explicit runtime identity, authorization result, and
   health result instead of understanding AionCore internals, ACP package
   layout, or Linux child PIDs.

## 4. Preferred Exploration Shape

```text
Windows OPL Installer / Electron GUI
        |
        | OPL-owned WSL launcher and lifecycle adapter
        | wsl.exe -d OPL-Linux --exec ...
        | scoped, authenticated host-to-guest transport
        | HTTP/WebSocket protocol where proven
        v
Dedicated OPL-Linux WSL2 distribution
        |
        +-- unmodified Linux AionCore
        +-- managed Linux Codex ACP
        +-- managed Linux Codex CLI
        +-- OPL Framework/runtime
        +-- Linux-authoritative ~/.codex
        +-- Linux-authoritative ~/code
```

“Start Linux AionCore” does not mean modifying its source. The smallest
maintainable adaptation is an OPL-owned launcher and short-lived wrapper around
the existing Linux binary. A foreground supervisor is an evidence-triggered
lifecycle option, not part of the starting shape.

### 4.1 Launcher compatibility

The existing process boundary makes a launcher experiment plausible:

- AionCore's `--parent-pid` is optional. A Windows PID must not be passed into
  the Linux parent monitor.
- AionCore already emits its selected port to stdout, so a wrapper can preserve
  stdout/stderr and reuse the Shell's current port discovery.
- The Shell already performs `127.0.0.1:<port>/health` polling. Windows normally
  reaches WSL-hosted services through localhost; the experiment must still test
  NAT/mirrored networking, VPN, firewall, sleep, and restart behavior. A health
  response alone does not prove that mutation endpoints are safely scoped or
  authenticated.
- In bundled mode, AionCore can resolve managed resources beside its Linux
  executable. The Linux payload therefore remains internally consistent.

The launcher owns only host-to-guest adaptation:

```text
detect OPL-Linux and WSL2
translate selected host intent into fixed guest paths
start exact Linux runtime bytes
preserve stdout/stderr and startup timeout behavior
return runtime identity plus discovered endpoint
stop or reconcile the guest process on App quit/restart
```

The first experiment may use a small executable or a Shell launcher class. A
permanent `aioncore.exe`-named shim is not required; the preferred implementation
should make the WSL backend an explicit launch strategy rather than pretend a
Linux process is a native Windows binary.

### 4.2 Independent Shell execution routes

The AionCore ACP conversation path is not the only execution path. The current
Shell also:

- starts Codex App Server directly for canonical thread, history, and review
  behavior; and
- starts the OPL Framework CLI through `oplRuntimeBridge` for bootstrap,
  initialize, Codex configuration, state, actions, login, update, and rollback.

A valid WSL2-only design must route both paths into the same `OPL-Linux`
identity, Linux `CODEX_HOME`, and Linux Framework installation. The Windows host
may own the transport, but it must not resolve or spawn native `codex.exe` or
`opl.exe` as a fallback.

Candidate transports include:

- starting Linux `codex app-server --stdio` through an OPL-owned WSL stdio
  transport, or reusing a stable remote App Server transport if the selected
  Codex version and Shell contract expose one; and
- invoking Linux `opl` through a narrow WSL command transport that preserves
  argv, stdin, stdout, stderr, exit status, cancellation, and runtime identity.

The final inventory must cover every Shell IPC surface and first-run action, not
only chat. A native route left in bootstrap, authentication, configuration,
state/action, scheduled work, update, repair, or rollback violates the
conditional invariant.

### 4.3 Host-to-guest trust boundary

The current Shell's local AionCore mode skips authentication. WSL localhost
forwarding can make a guest listener reachable from Windows host processes, so
reusing the HTTP/WebSocket protocol does not authorize reusing the current
same-process trust assumption.

The launcher experiment must determine and record. Localhost is a transport,
not an authentication or caller-identity boundary:

- the guest bind address and actual listener visibility under NAT and mirrored
  networking;
- which health, read, mutation, and WebSocket routes are reachable from the
  host;
- whether existing non-local AionCore authentication is sufficient or an
  OPL-owned launcher/proxy must narrow and authenticate the host connection;
- how an ephemeral credential is issued, rotated, delivered to Electron, and
  kept out of command lines, logs, crash reports, and renderer-readable storage;
- whether missing, stale, or invalid credentials are rejected, including from
  an unrelated Windows process; and
- whether App restart, WSL restart, sleep, and upgrade invalidate stale
  endpoints and credentials.

This boundary can be implemented around unmodified AionCore by using its
existing authenticated mode or an OPL-owned launcher/proxy. It is not a reason
to fork AionCore before those options are tested.

### 4.4 Filesystem authority

Default authoritative locations should be Linux-native:

```text
runtime/config: /home/opl/.codex and OPL-owned Linux data roots
projects:       /home/opl/code
Windows view:   \\wsl.localhost\OPL-Linux\home\opl\code
```

Avoid `/mnt/c` as the default project or runtime-data location. Host file-picker,
open-with, citation, drag/drop, and explicit user-selected Windows paths require
one centralized path projection policy. Ad hoc conversion inside individual
features is not acceptable.

The design must state, per field, whether a path is:

- a Linux-authoritative path sent to AionCore or Codex;
- a Windows presentation path used by Explorer or another host application; or
- an explicit imported/mounted host path with documented performance and
  permission semantics.

### 4.5 Process lifetime

`taskkill` of the host `wsl.exe` process does not by itself prove that the Linux
AionCore and Agent descendants stopped. The exploration should begin with the
least custom reliable mechanism:

1. launch AionCore as the direct child of the `wsl.exe --exec` invocation;
2. stop it through an explicit guest command or a distribution-scoped service;
3. verify termination from the guest and make restart idempotent;
4. add a lease/heartbeat only if the direct lifecycle experiment demonstrates
   a reproducible orphan or stale-owner gap.

A custom daemon, Windows service, durable journal, or new control protocol is
not a starting requirement. Add one only after evidence shows the simpler
launcher cannot preserve lifecycle correctness.

### 4.6 Installation and runtime identity

A possible installer sequence is:

```text
detect -> request UAC when needed -> install/enable WSL
       -> record resumable host state -> restart when Windows requires it
       -> import/initialize exact OPL-Linux bytes as WSL2
       -> initialize the non-root user and Linux runtime
       -> verify component identity and Linux sandbox capability
       -> start AionCore -> complete Codex initialize -> mark App usable
```

For its documented clean-machine path, Microsoft instructs users to run
`wsl --install` from administrator PowerShell and then restart. The CLI also
supports installing WSL without a default distribution and importing a named
distribution at a selected host location with `--version 2`. These primitives
make the candidate sequence technically plausible; they do not provide OPL
installation state, automatic resume, payload signing, digest verification,
transactional updates, CVE servicing, or rollback.

OPL may automate and resume this flow, but must not promise a no-UAC, silent
no-restart install. A future installer must also treat `wsl --unregister` as
destructive because Microsoft documents that it permanently deletes the
distribution's data, settings, and software. Repair, uninstall, and rebuild
therefore need an explicit data-retention decision before using it.

Microsoft references:

- <https://learn.microsoft.com/en-us/windows/wsl/install#install-wsl-command>
- <https://learn.microsoft.com/en-us/windows/wsl/basic-commands#install>
- <https://learn.microsoft.com/en-us/windows/wsl/basic-commands#import-a-distribution>
- <https://learn.microsoft.com/en-us/windows/wsl/basic-commands#unregister-or-uninstall-a-linux-distribution>
- <https://learn.microsoft.com/en-us/windows/wsl/networking#accessing-linux-networking-apps-from-windows-localhost>

An imported custom distribution is one candidate, not a fixed decision.
Before choosing it, compare:

- a signed OPL rootfs/VHDX with exact digest and controlled updates;
- a Microsoft-distributed base plus an idempotent OPL bootstrap;
- online and offline installer size, servicing, CVE ownership, and rollback;
- Windows Store/MSIX policy, enterprise restrictions, and ARM64 implications.

The runtime identity eventually needs exact distribution name/version, WSL
version, architecture, AionCore identity, Codex ACP/CLI identity, Framework
identity, config root, workspace root, and health/initialize result. The final
schema belongs in machine contracts only after an implementation direction is
selected.

## 5. Options And Disposition

| Option | Disposition | Reason |
| --- | --- | --- |
| OPL-owned WSL launcher/lifecycle adapter running unmodified Linux AionCore and Linux Codex | Preferred exploration | Keeps the whole execution plane on Linux without an AionCore fork; isolates platform adaptation in OPL-owned code and leaves a foreground supervisor evidence-triggered. |
| Native Windows AionCore with only `codex.exe` replaced by a WSL forwarding shim | Prototype only | Small initial patch, but splits AionCore/ACP and Codex across Windows/Linux; cwd, config, process cleanup, managed-resource identity, and direct App Server routing remain inconsistent. |
| Modify or fork AionCore to add WSL behavior | Rejected unless upstream later exposes a required gap | Creates long-term upstream maintenance for behavior that a launcher can currently absorb. |
| Run native Windows Codex or PowerShell when WSL fails | Rejected | Violates the conditional WSL2-only product invariant and makes behavior dependent on an accidental fallback. |
| Use any detected user/default WSL distribution | Rejected for a managed product path | Cannot guarantee shell, packages, versions, ownership, upgrade safety, or non-interference with user state. |
| Build a new daemon/control plane before testing the launcher | Deferred by evidence | Adds ownership and lifecycle complexity before a reproducible need exists. |

## 6. Conditional Exploration Sequence

The following is not an implementation backlog. It is the order in which
future experiments should retire uncertainty if Windows development is
separately authorized.

### E0: Product promotion decision

Entry condition: an explicit owner decision asks to explore a Windows desktop
product under the WSL2-only invariant.

Outcome: selected Windows architecture questions may move to an active plan.
Without this decision, no later item is missing work.

### E1: Launcher viability

Use an already-installed WSL2 development distribution or disposable
`OPL-Linux` fixture. From Windows Electron or a minimal Node harness:

1. launch exact, unmodified Linux AionCore and its Linux managed resources;
2. observe its port and pass `/health`;
3. complete a real Codex ACP initialize and one conversation;
4. confirm Linux cwd, `CODEX_HOME`, executable identity, and sandbox semantics;
5. prove the intended host client can authenticate while an unrelated local
   process cannot use protected read, mutation, or WebSocket routes; and
6. stop the App and prove no AionCore, ACP, Codex, or Agent descendant remains.

This is the single highest-value technical experiment.

### E2: Independent bridge viability

Route both the Shell's direct `codex app-server --stdio` path and
`oplRuntimeBridge` through WSL. Verify thread list/read/start, review, cwd,
bootstrap/initialize, Codex configuration, App state/action, login, scheduled
work, update, repair, rollback, cancellation, shutdown, and restart. Do not
claim WSL2-only coverage while any Shell IPC surface remains native,
unclassified, or untested.

### E3: Path and host-integration viability

Verify Linux-authoritative projects plus Windows presentation for Explorer,
file open, citations, drag/drop, Git/worktree operations, attachments, and
explicit Windows-path import. Select one centralized mapping owner.

### E4: Install and repair viability

Start from a clean Windows 11 x64 VM with no WSL. Exercise UAC, restart/resume,
distribution setup, exact runtime validation, corrupt/partial install repair,
uninstall/data retention, and network-restricted behavior.

### E5: Servicing and release design

Only after E1-E4 pass, decide rootfs/base ownership, component update policy,
rollback, signing, telemetry/diagnostics, installer packaging, release bundle
identity, host-to-guest authorization hardening, supported architectures, and
clean-VM acceptance. This is where `contracts/`, release workflows, test
matrices, and supported-platform claims would first become eligible for change.

## 7. Promotion Rules

This document remains exploration-only until an explicit decision names:

- the user-facing Windows outcome;
- supported Windows editions and architectures;
- the WSL2-only no-fallback invariant;
- selected distribution ownership;
- selected launcher/App Server/Framework bridge/path/lifecycle approach;
- selected host-to-guest exposure and authorization boundary;
- exact repository owners and write sets;
- development-validation acceptance; and
- the later, separate transition criteria for production release.

When that happens:

1. copy only the selected work into a dated `docs/active/` implementation plan;
2. update App contracts before user-visible behavior or release claims;
3. keep Shell changes in `opl-aion-shell`;
4. keep AionCore upstream byte-for-byte unless a separately reviewed,
   demonstrated upstream gap makes that impossible;
5. keep installer/runtime ownership in its canonical App/Framework surface;
6. qualify on a clean Windows 11 x64 VM; and
7. do not convert unselected alternatives or later phases into backlog rows.

Experiment success proves only the tested path. It does not prove a supported
Windows platform, installer readiness, upgrade safety, release readiness, or a
production transition.

## 8. Conditional Ownership And Maintenance

This section describes where selected work would belong only after E0
promotion. It assigns no current implementation work.

| Surface | Conditional owner | Allowed change | Must remain outside |
| --- | --- | --- | --- |
| Product invariant, user-visible install/repair states, acceptance semantics | `one-person-lab-app` | App contracts, product docs, test matrices, release inputs after promotion | Shell or upstream defaults becoming product authority |
| Windows Electron integration, WSL launcher/transport, path projection, IPC routing | `opl-aion-shell` OPL-owned adapter/overlay | Narrow host-to-guest strategies and focused tests | Broad upstream fork rewrites or a second runtime authority |
| Framework Linux install, state/action semantics, receipts, package lifecycle | `one-person-lab` | Existing Framework contracts and Linux execution/readback | App/Shell duplicating Framework state machines |
| AionCore process and protocol | Upstream AionCore | Consume released Linux bytes and documented flags/protocols | OPL fork or source patch unless a demonstrated gap survives launcher/proxy alternatives and a separate review |
| WSL distribution and host installer payload | Owner selected during E4/E5 | Signed, digest-bound, resumable install/update/rollback bytes | Mutating arbitrary user distributions or treating host mutable state as release proof |

The preferred maintenance shape is therefore an OPL-owned patch at the
launcher, transport, installer, and projection boundaries. It is not an AionCore
source patch. Any proposal to modify AionCore must first show a reproducible
requirement that cannot be met by documented upstream behavior, existing
authenticated mode, or an OPL-owned launcher/proxy; it then needs its own
upstream-first maintenance decision.

## 9. Maintenance Rules

- Update this SSOT when official Codex WSL behavior, OPL process topology, or
  the selected future direction materially changes.
- Keep volatile versions and observed private-client behavior in the verified
  baseline with a review date; do not turn them into timeless invariants.
- Link here instead of duplicating the architecture in App, Shell, Framework,
  installer, or release docs.
- Do not add implementation status, checkboxes, completion percentages, dates,
  or owner assignments while the state remains `exploration_non_binding`.
- Do not list this document in `docs/status.md` or
  `docs/active/app-ideal-state-gap-plan.md` unless E0 explicitly promotes it.
- If implementation is promoted, this document keeps the decision history and
  alternatives; the active plan owns execution state, and machine contracts
  own executable acceptance.
- Re-read current upstream AionCore and Codex behavior before future
  implementation. The evidence reviewed here may drift.
