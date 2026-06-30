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
`diagnostics/`, `api-key-flow-evidence.json`, command stdout/stderr files when
commands were run, and the diagnostics archive when the installer produced one.
Do not upload only logs or screenshots; they are supporting evidence, not the
gate result.

For the Windows clean VM gate, the VM operator may upload either the evidence
directory itself or a `.zip` archive produced by the installer. The importer
accepts both forms and applies the same manifest, diagnostics, API key flow,
and secret-scan validation after extracting the archive.

## Desktop Release Import

The desktop release workflow has an explicit import gate for clean VM evidence:
`docker-webui-clean-vm-evidence`. It runs the clean Linux gate on the same
GitHub-hosted Ubuntu clean VM job when no Linux artifact is supplied, then
downloads optional same-run artifacts named by these dispatch inputs:

- `docker_webui_clean_linux_evidence_artifact`
- `docker_webui_clean_windows_evidence_artifact`

The Linux input is optional. When it is empty, the workflow runs:

```bash
npm run smoke:docker-webui:linux-clean-vm -- \
  --artifacts docker-webui-clean-vm-evidence/clean-linux-vm-generated \
  --health-timeout 180 \
  --json
```

and validates the generated `docker-webui-smoke-gate-result.json` as
`artifact_name: same_job_ubuntu_clean_vm_generated`. Supplying
`docker_webui_clean_linux_evidence_artifact` overrides this default and imports
that artifact instead.

For preflight or rerun without the whole desktop release flow, dispatch
`.github/workflows/docker-webui-clean-linux-vm.yml`. It uploads
`docker-webui-clean-linux-vm-evidence` by default; pass that artifact name to
`docker_webui_clean_linux_evidence_artifact` when the desktop release should
reuse the preflight result instead of generating Linux evidence in-job.

The Windows input is still required for a clean Windows gate because a hosted
Windows runner is not Docker Desktop + WSL 2 clean-machine evidence. Each named
artifact can provide either a completed
`docker-webui-smoke-gate-result.json`, or for Windows the raw
`windows-smoke-evidence.json` plus `diagnostics/` and
`api-key-flow-evidence.json`, or a `.zip` archive containing those files. The
workflow imports raw or zipped Windows evidence through the existing smoke gate
runner.

The workflow uploads `docker-webui-clean-vm-evidence-<version>` with:

- `docker-webui-clean-vm-evidence-validation.json`
- `clean_linux_vm-validation-summary.json`
- `clean_windows_vm-validation-summary.json`

If the Linux generated or imported artifact cannot validate as `status=passed`,
or if the Windows dispatch input is empty or invalid, the workflow writes a
typed blocker summary and the release readiness admission job does not run. The
missing artifact blocker codes are:

- `missing_clean_linux_vm_docker_webui_evidence_artifact`
- `missing_clean_windows_vm_docker_webui_evidence_artifact`

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
- `api_key_flow.status` proves the WebUI/API proxy accepted the first-run API
  key action and called `opl system configure-codex --api-key-stdin --json`
  without putting key material in the command line or artifact.
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

If the VM produced `windows-clean-evidence.zip`, import the archive directly:

```bash
npm run smoke:docker-webui:windows-clean-vm -- \
  --evidence windows-clean-evidence.zip \
  --artifacts tmp/docker-webui-smoke/windows-clean-import
```

Without `--evidence`, the Windows gate still writes a typed blocker rather than
claiming the local host proved a clean Windows VM run.

On the Windows VM, let the installer create the uploadable evidence skeleton:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-docker-webui.ps1 `
  -Yes `
  -NoOpen `
  -EvidenceDir windows-clean-evidence `
  -EvidenceArchive windows-clean-evidence.zip
```

If a clean Windows runner is available, use the standalone workflow instead of
collecting the zip by hand:

```bash
npm run smoke:docker-webui:windows-clean-vm:dispatch -- --execute --json
```

That operator helper reads repository self-hosted runner inventory with the
local `gh` token, passes the normalized inventory into the workflow as
`runner_inventory_json`, and dispatches
`.github/workflows/docker-webui-clean-windows-vm.yml`. When no matching runner
exists, the workflow uploads `docker-webui-clean-windows-vm-runner-blocker` with
`typed_blocker.code=missing_clean_windows_self_hosted_runner`; this is a
blocked evidence artifact, not a clean Windows pass.

Use dry-run mode before dispatching if you need to inspect the command and
runner inventory:

```bash
npm run smoke:docker-webui:windows-clean-vm:dispatch -- --json
```

```text
.github/workflows/docker-webui-clean-windows-vm.yml
artifact: docker-webui-clean-windows-vm-evidence
default runner labels: ["self-hosted","Windows","X64","docker-webui-clean-vm"]
```

That workflow runs the same PowerShell installer with `-EvidenceDir` and
`-EvidenceArchive`, imports the archive through
`scripts/docker-webui-smoke-gate.ts --gate clean_windows_vm --evidence`, and
uploads the raw evidence, zip archive, imported gate result, and validation
summary. Pass the uploaded artifact name to the desktop release workflow as
`docker_webui_clean_windows_evidence_artifact`.

For desktop release trains with `publish_docker_webui=true` and
`run_vm_smoke=true`, this artifact name is optional diagnostic input. Docker/WebUI
release readiness is blocked by Docker build, GHCR publish, and clean Linux
Docker runtime smoke; it is not blocked by missing clean Windows VM evidence.

### Clean Windows Runner Bootstrap

The clean Windows gate needs a real disposable Windows machine. A GitHub-hosted
`windows-latest` runner is not acceptable evidence because this path must prove
Docker Desktop and WSL 2 on the same class of host a Windows beginner would use.

Use a fresh Windows 11 x64 VM when possible. Do not reuse a developer machine
with existing OPL data for this gate. The runner must be online, idle, and carry
these labels:

```text
self-hosted
Windows
X64
docker-webui-clean-vm
```

Bootstrap checklist for the VM operator:

1. Install Windows updates and enable WSL 2.
2. Install Docker Desktop, enable the WSL 2 backend, start Docker Desktop, and
   verify these commands in PowerShell:

   ```powershell
   docker version
   docker compose version
   ```

3. In GitHub, open
   `gaofeng21cn/one-person-lab-app -> Settings -> Actions -> Runners -> New
   self-hosted runner`, choose Windows x64, and use GitHub's generated
   registration token. Keep the generated registration token out of docs, logs,
   artifacts, and chat.
4. Add the custom label `docker-webui-clean-vm` during runner configuration.
   GitHub supplies `self-hosted`, `Windows`, and `X64`.
5. Start the runner as a short-lived foreground runner or as a service. Confirm
   the repository runner inventory shows it as online and idle.
6. From the App repo on an operator machine, dispatch the smoke:

   ```bash
   npm run smoke:docker-webui:windows-clean-vm:dispatch -- --execute --json
   ```

7. If the workflow uploads `docker-webui-clean-windows-vm-evidence`, download
   and validate the result before using it in the desktop release workflow:

   ```bash
   gh run download <run-id> \
     --repo gaofeng21cn/one-person-lab-app \
     --name docker-webui-clean-windows-vm-evidence \
     --dir tmp/docker-webui-clean-windows-run-<run-id>

   node --experimental-strip-types scripts/docker-webui-smoke-gate.ts \
     --validate-result tmp/docker-webui-clean-windows-run-<run-id>/docker-webui-clean-windows-vm/docker-webui-smoke-gate-result.json \
     --json
   ```

8. Pass `docker-webui-clean-windows-vm-evidence` to the desktop release workflow
   as `docker_webui_clean_windows_evidence_artifact`.
9. After evidence is collected, remove or stop the self-hosted runner and delete
   the disposable VM if it was created only for this gate.

If the dispatch uploads `docker-webui-clean-windows-vm-runner-blocker` instead,
read `runner-preflight.json`. A `missing_clean_windows_self_hosted_runner`
blocker means the repository inventory was readable but no online idle runner
matched the required labels. A `runner_inventory_unreadable` blocker means an
operator must either grant runner inventory read access or provide
`runner_inventory_json` through the dispatch helper.

`-EvidenceDir` defaults diagnostics into `windows-clean-evidence/diagnostics`
and writes `windows-clean-evidence/windows-smoke-evidence.json`. It also calls
the WebUI access backend to write `api-key-flow-evidence.json`, proving the UI
path reaches `opl system configure-codex --api-key-stdin --json` without putting
access material in installer arguments or diagnostics. If that receipt cannot
be collected, the installer fails the evidence package instead of producing a
placeholder that could be mistaken for pass evidence.

`-EvidenceArchive` packages the complete evidence directory into one uploadable
zip after the manifest, diagnostics, and access receipt exist. It requires
`-EvidenceDir`, and the release workflow can import either the raw directory
artifact or this zip artifact.

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

## API Key Flow Evidence

The beginner path requires API keys to be entered inside the WebUI, not passed
to the installer. A passed smoke gate must therefore include
`api-key-flow-evidence.json` with schema
`opl_docker_webui_api_key_flow_evidence.v1`.

The evidence must prove only the safe transport shape:

- the WebUI endpoint is `/api/opl-runtime/configure-codex`;
- the command is the redacted `opl system configure-codex --api-key-stdin
  --json`;
- `stdin_transport` is `true`;
- `key_material_recorded` is `false`;
- no API key-like marker appears in the evidence or diagnostics.

This receipt does not prove a real provider key is valid. It proves that the
new-user UI path writes through the Framework-owned stdin command without
leaking key material into shell history, compose files, diagnostics, or uploaded
artifacts.

## Windows Evidence Import

A Windows VM artifact directory, or zip archive, must contain:

- `windows-smoke-evidence.json`
- `diagnostics/` with the diagnostic files listed above

The manifest must use schema `opl_docker_webui_windows_smoke_evidence.v1` and
bind the artifact to `gate_id: clean_windows_vm`, `status: passed`,
`host_platform: win32`, an `observed_at` timestamp, an `installer_command` that
references `install-docker-webui.ps1` with `-Yes`, and `diagnostics_dir:
diagnostics`. It must also reference `api_key_flow_evidence:
api-key-flow-evidence.json`.

Example:

```json
{
  "schema": "opl_docker_webui_windows_smoke_evidence.v1",
  "gate_id": "clean_windows_vm",
  "status": "passed",
  "host_platform": "win32",
  "observed_at": "2026-06-30T00:00:00Z",
  "installer_command": "powershell -ExecutionPolicy Bypass -File scripts/install-docker-webui.ps1 -Yes -NoOpen -DiagnosticsDir diagnostics",
  "diagnostics_dir": "diagnostics",
  "api_key_flow_evidence": "api-key-flow-evidence.json"
}
```

The importer validates the manifest, runs the diagnostic validator, and scans
the artifact directory for API key-like plaintext markers. It also validates the
API key flow receipt. Do not put API keys in installer arguments, environment
dumps, compose files, diagnostics, API key flow receipts, or artifact manifests.

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
- `api_key_flow.status=passed`, `api_key_flow.stdin_transport=true`, and the
  receipt path points to `api-key-flow-evidence.json`.
- `secret_scan.status=passed` and no forbidden secret markers are reported.

If any item is missing, mark that gate `partial` or `blocked` with the typed
blocker owner route. Passing docs, contract tests, a local typed blocker, or a
diagnostic directory without a valid gate result cannot justify `100%`.
