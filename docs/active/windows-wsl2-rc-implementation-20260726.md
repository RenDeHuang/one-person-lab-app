# Windows WSL2-Only RC Implementation

Owner: `one-person-lab-app`
State: `active`
Started: `2026-07-26`
Decision contract: `contracts/app-windows-wsl2-execution.json`

## Conclusion

The first Windows x64 RC is blocked until One Person Lab automatically prepares
and owns a dedicated WSL2 environment and every Codex-backed execution route
uses the same Linux Codex identity. The existing AionUI Windows/NSIS packaging
is reusable, but its native Windows AionCore and Codex path is not an acceptable
OPL Windows RC runtime and must never be a fallback.

This publication gate does not block source absorption or continued RC
development on `main`. Windows RC contracts, manual build support, guides, and
tests may land incrementally, but the existing Stable/Latest release flow must
not depend on them, wait for them, or treat their acceptance as a required gate.

## Frozen Decisions

- Host: Windows 11 x64, 22H2 or later.
- Logical and initial physical distribution: `OPL-Linux`.
- Guest user: `opl`; `CODEX_HOME=/home/opl/.codex`; default workspace
  `/home/opl/code`.
- The App owns one guided provisioning, restart-resume, repair, and progress
  experience. Windows UAC is permitted only when Windows must enable a missing
  system feature.
- Existing user distributions, the default distribution, and
  `docker-desktop` are never adopted or mutated.
- AionCore remains unmodified upstream Linux bytes.
- AionCore ACP, direct Codex App Server, and Framework CLI/state/action all use
  one Shell-owned structured WSL execution port.
- Native Windows AionCore, Codex, Framework, PowerShell Agent execution, and
  native fallback are forbidden.
- No Windows RC publication occurs before exact release-byte acceptance proves
  these invariants.
- Existing Stable/Latest publication remains independent and non-blocking while
  Windows RC implementation and physical-host acceptance continue.

## Repository Write Sets

App:

- `contracts/app-windows-wsl2-execution.json`
- Windows projections in App product/install/release contracts
- Windows RC cohort, release-boundary tests, active plan, and user guide

Shell:

- `packages/desktop/src/process/services/runtime-execution/**`
- `packages/desktop/src/process/services/windows-wsl/**`
- the three existing execution integration surfaces
- Windows Linux-runtime payload preparation and packaging
- focused unit/integration/physical-host tests

Framework:

- No Windows or WSL knowledge.
- Only a demonstrated owner-neutral Linux Codex binding or receipt gap may be
  changed, in the Framework repository and under its own source owner.

AionCore:

- No source changes.

## Delivery Sequence

1. Introduce the execution port without changing macOS/Linux behavior.
2. Implement inspect, direct-child spawn, structured control, path projection,
   and no-native-fallback guards for Windows.
3. Implement the idempotent provisioner, owned distribution identity, packaged
   Linux runtime seed, Framework owner activation, receipts, restart resume, and
   repair.
4. Route AionCore ACP, direct Codex App Server, and Framework state/action
   through the same guest identity.
5. Prove physical Windows stopped/running/restart/exit behavior and the absence
   of native executors and App-session survivors.
6. Build and seal the exact RC, then repeat the clean-machine and installed-byte
   acceptance before publishing a non-Latest GitHub Prerelease.

## Terminal Outcome

`WINDOWS_WSL2_ONLY_RC_ACCEPTANCE_PASS` requires every evidence item in
`contracts/app-windows-wsl2-execution.json#release_boundary.required_evidence`
against the exact RC bytes. A build, unit-test pass, physical-host prototype, or
single WSL route is not terminal and cannot authorize publication.
