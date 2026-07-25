# Windows Docker/WebUI Validation Fixtures

Owner: `one-person-lab-app`
Purpose: `windows_docker_webui_manual_validation_fixtures`
State: `validation_only_non_binding`

These fixtures support bounded manual validation in a disposable Windows VM.
They are not end-user install entrypoints, release receipts, or product machine
truth. Do not store passwords, Gateway credentials, API keys, complete runtime
state, or raw private logs beside them.

- `windows-clean-install-run.ps1` stops any existing Compose project with the
  original install directory as the explicit project directory, moves the old
  install root aside, runs the current public installer from an interactive
  scheduled task, and records whether the previous runtime was actually down.
  It also enforces a configurable C: free-space floor, stops only the current
  validation process tree on a timeout or low-space breakpoint, and records a
  resumable `supervisor-breakpoint.json` for the same `RunId`.
- `windows-host-readback.ps1` writes a bounded JSON inventory for Windows,
  WSL, Docker, the persistent install directories, the automatic update task,
  and the local HTTP endpoint. Docker and WSL calls have hard timeouts; after a
  Docker daemon breakpoint it records the repair route and skips dependent
  probes instead of stacking more hung Docker commands.

A stopped operation is not a completed validation objective. Read the
structured breakpoint, repair the first reported issue, then resume the same
`RunId` until the required install and readback checks pass. Pause only for a
real authority, safety, data-integrity, or external-input blocker.

Temporary login, firewall, port-proxy, container-log, or one-off probe scripts
belong in private validation staging and must not be committed here.
