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
promotion and implementation authorization.

Validation may:

- use a disposable or snapshot-backed Windows 11 x64 VM;
- exercise WSL2, a temporary OPL-Linux fixture, launcher/proxy candidates,
  process lifetime, path projection, authentication, and route compatibility;
- create disposable scripts and sanitized fixtures or receipts under this
  validation surface; keep raw logs in private guest/staging quarantine outside
  version control; and
- update this document, the parent exploration, and the reference blueprint
  when validation changes the documented evidence boundary.

Validation must not:

- add a row to `docs/active/app-ideal-state-gap-plan.md` or another product gap
  plan;
- change `contracts/`, generated expectations, supported-platform truth, Shell
  source, Framework source, AionCore source, release workflows, installer bytes,
  or public support claims;
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
   does not block macOS/Linux development or create a product gap.
6. Delete or quarantine disposable credentials and guest data after the run.

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

## 4. Evidence and Exit

Each validation run records a small receipt with:

```text
validation_run_id
host_and_vm_identity
app_shell_framework_refs
fixture_and_component_digests
selected_transport_and_lifecycle_strategy
commands_and_readbacks
positive_results
negative_results
blocked_or_unavailable_items
cleanup_result
```

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
