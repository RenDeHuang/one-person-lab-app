# Windows Docker/WebUI Validation Evidence

Owner: `one-person-lab-app`
Purpose: `windows_docker_webui_install_and_update_validation_evidence`
State: `validation_in_progress`
Machine boundary: Sanitized receipts and screenshots only. App install and
release contracts, workflow artifacts, GHCR manifests, installer bytes, and
live runtime readback remain authoritative.

This directory records the Windows x64 Docker Desktop validation requested for
the public beginner guide. It does not store passwords, Gateway credentials,
API keys, complete runtime state, or raw logs.

## Receipts

- [`2026-07-24-r1-and-r2-validation.md`](2026-07-24-r1-and-r2-validation.md)
  records the public `r1` clean-install/update findings, the false-positive
  runner defect, the frozen `r2` repair inputs, and the remaining publication
  and true cold-install acceptance work.
- [`screenshots.manifest.json`](screenshots.manifest.json) binds the four
  sanitized `r1` UI captures to exact bytes and expected visible behavior.

## Fixtures

Reusable Windows validation scripts live under
[`../../user-guides/docker-webui-install/fixtures/`](../../user-guides/docker-webui-install/fixtures/).
One-off probes stay outside version control.

When `r2` publication and the second true cold install finish, update the
receipt and screenshot manifest with exact public digest, workflow run, and
post-fix UI evidence. A candidate, source fix, or immutable Bundle alone must
not be converted into a public pass.
