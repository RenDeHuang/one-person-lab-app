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
- `windows-host-readback.ps1` writes a bounded JSON inventory for Windows,
  WSL, Docker, the persistent install directories, the automatic update task,
  and the local HTTP endpoint.

Temporary login, firewall, port-proxy, container-log, or one-off probe scripts
belong in private validation staging and must not be committed here.
