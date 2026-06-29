# Docker/WebUI Smoke Gates

This runbook owns the App-side execution entry for Docker/WebUI installer smoke
evidence. It does not replace the install exposure contract, and it does not
turn local container smoke into clean VM proof.

## Required Gates

The Docker/WebUI beginner path is release-ready only after every required gate
has a fresh smoke artifact or a typed blocker:

- `clean_linux_vm`: a clean Linux VM runs `install-docker-webui.sh --yes`.
- `clean_windows_vm`: a clean Windows VM runs `install-docker-webui.ps1 -Yes`.
- `existing_docker`: a host with Docker already working reruns the installer
  without reinstalling Docker.
- `existing_old_onepersonlab_data_dir`: a host with existing
  `OnePersonLab/data` proves the installer preserves or migrates data instead
  of deleting it.

Contract-only rows and docs are not pass evidence. The gate runner writes a
typed blocker when the current host cannot prove a gate.

## Commands

Run these from the App repo root:

```bash
npm run smoke:docker-webui:linux-clean-vm -- --artifacts tmp/docker-webui-smoke/linux-clean
npm run smoke:docker-webui:windows-clean-vm -- --artifacts tmp/docker-webui-smoke/windows-clean
npm run smoke:docker-webui:existing-docker -- --artifacts tmp/docker-webui-smoke/existing-docker
npm run smoke:docker-webui:old-data -- --artifacts tmp/docker-webui-smoke/old-data
```

Each artifact directory must be uploaded as one reviewer-visible package. Keep
the four directories separate so release review can map evidence back to the
gate that produced it:

- `tmp/docker-webui-smoke/linux-clean/`
- `tmp/docker-webui-smoke/windows-clean/`
- `tmp/docker-webui-smoke/existing-docker/`
- `tmp/docker-webui-smoke/old-data/`

Each directory must include `docker-webui-smoke-gate-result.json`,
`diagnostics/`, command stdout/stderr files when commands were run, and the
diagnostics archive when the installer produced one. Do not upload only logs or
screenshots; they are supporting evidence, not the gate result.

## Gate Result Readback

`docker-webui-smoke-gate-result.json` uses
`opl_docker_webui_smoke_gate_result.v1`. Reviewers must verify these fields
before accepting an artifact:

- `gate` and `gate_id` identify one of the four required gates.
- `status` is `passed`, `typed_blocker`, or `failed`.
- `typed_blocker` is present as `null` for non-blocked results and as a
  structured owner route for `typed_blocker` results.
- `diagnostics_validation.status` is `passed` for any `passed` gate.
- `health.url`, `health.status`, and `health.http_status` summarize the WebUI
  HTTP probe.
- `compose.path` and `compose.status` identify the compose file readback.
- `container` and `image` summarize container/image evidence captured from
  Docker.
- `data_preservation.status`, `data_preservation.verdict`, and
  `data_preservation.summary` summarize old-data behavior.
- `secret_scan.status` is `passed` and
  `secret_scan.forbidden_secret_markers` is empty.

Validate an uploaded gate result without rerunning Docker or the installer:

```bash
node --experimental-strip-types scripts/docker-webui-smoke-gate.ts \
  --validate-result <artifact-dir>/docker-webui-smoke-gate-result.json \
  --json
```

For `clean_windows_vm`, a non-Windows App checkout cannot execute the VM gate
itself. Import the artifact set produced on the Windows VM instead:

```bash
npm run smoke:docker-webui:windows-clean-vm -- \
  --evidence <windows-artifact-dir> \
  --artifacts tmp/docker-webui-smoke/windows-clean-import
```

Without `--evidence`, the Windows gate still writes a typed blocker rather than
claiming the local host proved a clean Windows VM run.

## Diagnostic Directory

Installer diagnostics must include:

- `metadata.txt`
- `diagnostics-manifest.json`
- `compose.yaml`
- `docker-version.txt`
- `docker-compose-version.txt`
- `docker-compose-ps.txt`
- `docker-compose-logs.txt`
- `docker-image.txt`
- `http-probe.txt`
- `directories.txt`
- `data-preservation.txt`

Validate a captured diagnostic directory with:

```bash
npm run validate:docker-webui-diagnostics -- --diagnostics-dir <diagnostics-dir> --json
```

The validator checks required files, secret-like markers, and the preservation
verdict. It is structural evidence only; it does not prove a VM gate was run on
the right host.

## Windows Evidence Import

A Windows VM artifact directory must contain:

- `windows-smoke-evidence.json`
- `diagnostics/` with the diagnostic files listed above

The manifest must use schema `opl_docker_webui_windows_smoke_evidence.v1` and
bind the artifact to `gate_id: clean_windows_vm`, `status: passed`,
`host_platform: win32`, an `observed_at` timestamp, an `installer_command` that
references `install-docker-webui.ps1` with `-Yes`, and `diagnostics_dir:
diagnostics`.

Example:

```json
{
  "schema": "opl_docker_webui_windows_smoke_evidence.v1",
  "gate_id": "clean_windows_vm",
  "status": "passed",
  "host_platform": "win32",
  "observed_at": "2026-06-30T00:00:00Z",
  "installer_command": "powershell -ExecutionPolicy Bypass -File scripts/install-docker-webui.ps1 -Yes -NoOpen -DiagnosticsDir diagnostics",
  "diagnostics_dir": "diagnostics"
}
```

The importer validates the manifest, runs the diagnostic validator, and scans
the artifact directory for API key-like plaintext markers. Do not put API keys
in installer arguments, environment dumps, compose files, diagnostics, or
artifact manifests.

## Completion Boundary

A gate can be marked `passed` only when the command ran in the required
environment and the diagnostic validator passed. A gate that reports
`typed_blocker` is an explicit next-owner route, not a release-ready claim.

Completion for a gate can be marked `100%` only when the uploaded artifact for
that exact gate has all of the following fresh evidence:

- `docker-webui-smoke-gate-result.json` validates against
  `opl_docker_webui_smoke_gate_result.v1`.
- `status=passed` for the gate, with no typed blocker.
- The artifact was produced on the required host class for that gate; local
  macOS or developer-host blockers cannot count as clean Linux/Windows VM
  proof.
- `diagnostics_validation.status=passed`.
- `health.status=passed` with a captured URL and HTTP status.
- `compose.status=present`.
- Container/image evidence is present from Docker readback.
- `data_preservation.status=passed`; for the old-data gate, the summary must
  show pre/post data inventory preservation rather than a newly-created-only
  data directory.
- `secret_scan.status=passed` and no forbidden secret markers are reported.

If any item is missing, mark that gate `partial` or `blocked` with the typed
blocker owner route. Passing docs, contract tests, a local typed blocker, or a
diagnostic directory without a valid gate result cannot justify `100%`.
