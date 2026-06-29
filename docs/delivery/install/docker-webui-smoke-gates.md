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

The result is written to
`docker-webui-smoke-gate-result.json` under the artifact directory.

## Diagnostic Directory

Installer diagnostics must include:

- `metadata.txt`
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

## Completion Boundary

A gate can be marked `passed` only when the command ran in the required
environment and the diagnostic validator passed. A gate that reports
`typed_blocker` is an explicit next-owner route, not a release-ready claim.
