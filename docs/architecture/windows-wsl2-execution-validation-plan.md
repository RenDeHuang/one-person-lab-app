# Windows WSL2-Only Technical Validation Plan

Owner: `one-person-lab-app`
Purpose: `windows_wsl2_execution_validation_only`
State: `validation_only_non_binding`
Last reviewed: `2026-07-25`
Parent decision boundary:
[`windows-wsl2-execution-exploration.md`](windows-wsl2-execution-exploration.md)
Reference blueprint:
[`windows-wsl2-execution-implementation-blueprint.md`](windows-wsl2-execution-implementation-blueprint.md)

## 1. Boundary

The owner has explicitly authorized technical validation of the conditional
Windows WSL2-only direction. This authorization is narrower than product
promotion and ordinary product implementation authorization. It permits the
small, explicitly gated validation build described in V6 only to obtain
evidence; it does not promote that build into the ordinary App path.

Validation may:

- use a disposable or snapshot-backed Windows 11 x64 VM;
- exercise WSL2, a temporary OPL-Linux fixture, launcher/proxy candidates,
  process lifetime, path projection, authentication, and route compatibility;
- create disposable scripts and sanitized fixtures or receipts under this
  validation surface; keep raw logs in private guest/staging quarantine outside
  version control; and
- build an explicitly `validation_only` Windows Electron candidate whose
  bounded, read-only status surface is limited to V6; and
- update this document, the parent exploration, and the reference blueprint
  when validation changes the documented evidence boundary.

Validation must not:

- add a row to `docs/active/app-ideal-state-gap-plan.md` or another product gap
  plan;
- change `contracts/`, generated expectations, supported-platform truth,
  Framework source, AionCore source, release workflows, installer bytes, or
  public support claims;
- make a validation-only Shell route part of the ordinary/default product path,
  select a native Windows executor, or present the validation candidate as a
  supported App experience;
- make Windows a release blocker or a prerequisite for unrelated development;
- mutate a user's existing WSL distribution, default distribution, or
  `docker-desktop`; or
- claim installer readiness, upgrade safety, production readiness, or a
  supported Windows platform from a prototype or VM result.

Validation artifacts are evidence about the tested path. They are not product
machine truth and do not authorize a second runtime or lifecycle authority.

## 2. Non-blocking Operating Rules

1. Run validation in an isolated worktree, disposable VM, or snapshot that can
   be restored without affecting unrelated development.
2. Prefer read-only inspection and reversible setup. Treat `wsl --unregister`,
   disk image replacement, credential deletion, and host policy changes as
   destructive operations requiring an explicit operator decision.
3. Record the exact host build, WSL version, distribution identity, App/Shell
   refs, fixture digests, bounded commands, and sanitized terminal readback for
   every run. Never collect passwords, tokens, full environment dumps, complete
   `opl app state` payloads, thread bodies, prompts, or raw logs into a receipt.
4. Unknown external results require fresh readback before retry. Do not infer
   success from process creation, `/health`, a registered distribution, or a
   partial log.
5. A failed or unavailable VM blocks only the corresponding validation item. It
   does not block unrelated development or create a product gap.
6. Delete or quarantine disposable credentials and guest data after the run.
7. A guest has one active writer. V6 guest execution remains unavailable until
   fresh native-Windows host receipts supply a platform owner and a V6 executor,
   both distinct from source custodian `019f9bc5-8707-78b2-b221-5453d9d9b855`
   and from each other. The immutable packet and active writer lease must bind
   both host identities, the exact VM ID, clean-VM attestation, operations, and
   validity window. A shared
   credential, historical task, or old handoff is not authority. Do not start,
   stop, enter, clone, or expand the historical Intel iMac VM for V6.
8. Preserve existing Docker containers, images, Docker data, and
   `OnePersonLab` data. V6 must not run Docker prune, global `wsl --shutdown`,
   unregister a distribution, or delete unknown guest data. After the bounded
   run, soft-shut down the fixture when appropriate and explicitly release the
   guest write authority.

## 3. Validation Sequence

### V0: Host and VM preflight

Record:

- Windows edition/build and x64 architecture;
- virtualization, WSL capability, reboot, UAC, firewall, VPN, and networking
  mode;
- available disk space and snapshot/restore capability;
- whether the VM is clean, has WSL without a distribution, or has an existing
  disposable fixture;
- exact App/Shell/Framework refs used by the run.

No product implementation is required for V0.

### V1: WSL identity and launcher viability

Using an owned or disposable distribution. The current
`OPL-Validation-g0001` Canonical Ubuntu 24.04 `.wsl` import is a disposable V1
fixture only; it is not a product distribution, minimum carrier, or production
carrier decision:

1. verify WSL2 and the guest architecture;
2. launch exact Linux AionCore bytes with Linux managed resources;
3. observe the selected endpoint and pass `/health`;
4. inspect guest identity, Linux executable format, `CODEX_HOME`, workspace,
   carrier identity, and component digests;
5. verify that no Windows executable is selected as an Agent or Framework
   executor; and
6. stop and restart the fixture, recording guest-side survivor readback.

V1 proves only launcher viability. It does not prove authenticated Desktop API
compatibility or production lifecycle safety.

### V2: Authentication and process ownership

Test the authenticated AionCore mode and, only if necessary, an OPL-owned proxy
around unmodified AionCore. Record:

- host-to-guest bind and listener visibility under NAT and mirrored networking;
- valid, stale, wrong-session, wrong-carrier, and unrelated-local-process
  requests;
- renderer/main-process secret exposure boundaries;
- operation-token to PID/starttime/process-group/executable-identity mapping;
- graceful cancellation, SIGTERM/SIGKILL escalation, App exit, WSL restart,
  and post-run survivor inventory.

The direct-child strategy remains the default. A supervisor is admissible only
when a reproducible direct-child failure and the smaller alternatives tried are
recorded in the evidence.

### V3: Independent route coverage

Validate the three current Shell execution seams independently:

- AionCore ACP conversation and WebSocket path;
- direct `codex app-server --stdio`; and
- `oplRuntimeBridge` bootstrap/initialize and canonical state/action surfaces,
  the dedicated typed IPC/stdin login route, and owner-routed update, repair,
  recovery, and cancellation paths.

The routes must report one guest identity, one owner-bound Codex executable,
one `CODEX_HOME`, and one Linux workspace. Scheduled or durable work remains
unsupported until its canonical owner is identified and verified. This
inventory proves transport coverage only; App and Shell do not acquire
Framework lifecycle authority.

### Observed V2/V3 status (2026-07-25)

The authorized validation lane produced two sanitized receipts:

- [`2026-07-24-v2-auth-process-ownership.md`](../delivery/validation/windows-wsl2/2026-07-24-v2-auth-process-ownership.md)
  is `partial`. AionCore remote mode, health/status reads, expected `401`
  negatives, NAT listener visibility, direct-child identity, cancellation, and
  survivor checks passed. Remote `/api/webui/reset-password` returned `403`;
  this is an upstream bootstrap boundary and no speculative workaround was
  attempted. Renderer/DevTools/Sentry secret isolation was not attempted.
- [`2026-07-24-v3-independent-route-coverage.md`](../delivery/validation/windows-wsl2/2026-07-24-v3-independent-route-coverage.md)
  is `partial`. Direct Codex App Server initialize/thread-list and read-only
  Framework state/help probes passed. The managed AionCore ACP route remains
  blocked by the V1 missing Linux Codex artifact, so one owner-bound Codex
  identity across all routes is not proven; direct-candidate cleanup was not
  independently recorded.

The V2 targeted restart readback (`20260725-v2-v3-g0023`) kept
`docker-desktop` as the default distribution and observed the fixture in
`Stopped` state immediately after termination. A subsequent targeted guest
query restarted the fixture; fresh readback then found zero AionCore/Codex
processes and zero native Windows executor processes/commands. Mirrored
networking was intentionally not run because it could affect Docker and global
WSL state; it remains an `unattempted_coordination_boundary`.

Non-root product identity, renderer/DevTools/Sentry secret isolation, and
scheduled/durable owner selection remain unproven. These results are
`validation_only_non_binding`, do not enter
`docs/active/app-ideal-state-gap-plan.md`, do not block unrelated development,
and do not constitute a Windows support or release-readiness claim.

### V4: Filesystem and host integration

Validate Linux-authoritative projects and centralized Windows presentation for:

- Explorer/UNC projection, file open, citations, attachments, and drag/drop;
- Git, worktree, and GitHub operations in the guest workspace;
- explicit Windows-path import with copy versus mounted semantics; and
- traversal, symlink escape, wrong-distribution, reserved-name, and
  file-versus-directory negatives.

### V5: Clean install and repair (VM-dependent)

Only when a disposable clean Windows VM is available:

- WSL enablement, UAC, reboot resume, and per-user identity;
- owned distribution creation without adopting an existing distribution;
- partial install, interrupted import, corrupt carrier, and identity conflict;
- user-authentication handoff independent from environment readiness; and
- retention/export/uninstall behavior without deleting unknown data.

V5 is a validation exercise, not an installer release gate.

### V6: Windows Electron technical-validation surface

V6 is the smallest usable Windows technical-validation build. It is a
diagnostic status surface, not the route-complete product described by the
reference blueprint's development definition of done. The candidate must be
visibly identified as `validation_only_non_binding`, explicitly gated away from
the ordinary App path, and bound to a recorded App acceptance revision plus the
Shell candidate source. The App revision is not claimed to be embedded in the
Shell-built ZIP.

On a real Windows VM, the V6 smoke passes only when the exact Electron
candidate:

1. launches a visible Windows Electron window and exposes a bounded readiness
   state instead of relying on a terminal-only process result;
2. discovers the disposable `OPL-Validation-g0001` guest and shows its bounded
   identity. An absent, stopped, mismatched, or non-WSL2 guest must be shown as
   unavailable; the candidate must not adopt another distribution, the default
   distribution, or `docker-desktop`;
3. shows only sanitized status for the discovered guest identity, AionCore
   health, direct Codex App Server, and read-only Framework state. It may retain
   stable status names, versions, digests, and top-level response keys, but not
   passwords, tokens, endpoints, complete Framework state, thread bodies,
   prompts, raw logs, or an unrestricted guest command channel;
4. labels AionCore ACP, authenticated user/bootstrap, and WebSocket
   conversation as `unverified` or `unavailable` until independently proven.
   It must not show an enabled chat/composer, streaming conversation, or a
   success state for those routes; and
5. renders each failed or unavailable readback distinctly, does not infer
   readiness from a process, imported distribution, or `/health` alone, and
   tears down only processes it owns when the candidate closes; and
6. passes distinct stopped, running, and post-restart persistence guest phases
   against one create-once
   Windows build-seal receipt. The build starts from an immutable intake
   manifest that binds the App acceptance revision, Shell source
   `868d6e818583547a5ec982b10b34464a3fa47c10` and root tree
   `1dc9960a357d9f64eaaac7eadf44b9c1a1d00ca7`, plus Framework fixture
   `e260ad46e2cf73ea334d2453d901ee448248d9e0`, repository
   `https://github.com/gaofeng21cn/one-person-lab.git`, root tree
   `6b72719e34a5dc8ac522a758296436be0c97b1bd`, and CLI blob Git/SHA256
   identities. The seal records the fresh
   checkout, frozen dependency install, resolved toolchain, command evidence,
   ZIP/executable/`app.asar` digests, and expanded tree identity. A historical
   ZIP digest is provenance only and cannot authorize a new run.

V6 permits only bounded read-only product/API probes and the transient process
state needed to launch the explicitly gated candidate under an acquired VM
writer lease. Login, password reset, update, repair, installer, importer,
destructive WSL, Docker, and general Framework-action routes remain outside the
candidate. A visible-smoke pass validates the bounded projection, not the
unavailable capabilities: `unverified` and `unavailable` remain negative
capability outcomes even when the UI renders them correctly. Passing V6 does
not complete V3, V4, V5, or the reference blueprint's development validation;
it is not a Windows support, installer, upgrade, or release-readiness claim.

## 4. Evidence and Exit

Each validation run records a small receipt with:

```text
validation_run_id
host_and_vm_identity
app_shell_framework_refs
candidate_artifact_and_validation_gate
fixture_and_component_digests
selected_transport_and_lifecycle_strategy
vm_storage_and_guest_write_authority
commands_and_readbacks
positive_results
negative_results
blocked_or_unavailable_items
cleanup_result
```

A V6 receipt additionally records `visible_smoke_evidence`: the exact Electron
artifact digest, its explicit validation gate, a sanitized visible-state proof
(for example a target-window screenshot digest and dimensions), the exact
Hyper-V VM identity, the platform-owner writer lease and release, and one outcome
for each required status group. It records `unverified` and `unavailable` as
observed outcomes rather than converting them into a capability pass. It must
not contain a guest password, token, full state payload, endpoint, thread/prompt
body, or raw terminal log.

A guest visible-smoke receipt is intentionally non-terminal:
`receipt_stage=guest_smoke_pending_host_closeout` and
`terminal_v6_verdict=false`, even when its bounded status is `passed`. The
terminal V6 receipt is a separate host closeout. It validates the stopped,
running, and restart-persistence guest receipts and screenshots against one
artifact, source-ref set, VM identity, intake manifest, build-seal receipt, and
authoritative writer lease;
queries the exact `OPL-V6-WSL2-01` Hyper-V VM ID; performs only bounded
`Stop-VM -Shutdown`; and confirms `Get-VM` reads `State=Off` before recording
writer release. It also requires operation-owned guest and host process,
listener, writer, and active-lease counts to be zero. No partial guest pass,
stale lease, mismatched tree, shutdown timeout, or hard power-off can produce
`terminal_v6_verdict=true`.

The validation lane may update the parent exploration and this blueprint with
observed facts, rejected options, and narrowed uncertainty. It may not promote
those results into contracts, active plans, support claims, or release evidence.

The validation lane exits when each attempted item is either:

- passed with reproducible evidence;
- rejected with a documented reason; or
- blocked by a VM, policy, credential, or upstream limitation that is clearly
  outside the current product boundary.

An exit does not authorize implementation. A later product decision must still
select the user-facing Windows outcome, owners, contracts, release policy, and
production qualification boundary.

## 5. Promotion Boundary

If validation supports implementation, the next step is a separately dated
product-promotion decision. That decision may create an active plan and a
development-only machine contract while keeping Windows unsupported for
release. It must not silently convert validation artifacts into a backlog,
release gap, or supported-platform claim.
