# Windows Docker/WebUI Validation Receipt: Public r1 and Frozen r2

Validation run ID: `20260724-windows-docker-webui-r1-r2`
State: `r1_reproduced_r2_publication_pending`
Lane: `windows_x64_docker_desktop_manual_vm`
Date: `2026-07-24`

## Scope

This run exercised the beginner Windows installer in an external-SSD VMware
Windows 11 x64 VM with Docker Desktop and WSL 2. It covered first install,
manual update, scheduled automatic update registration, persistent
`data`/`projects`, first-run recovery UI, Gateway account and API Key forms, and
the public image's cold-start behavior.

The VM has `4` vCPU and `32768 MiB` memory. Its virtual disk is stored under
`/Volumes/My Passport/Virtual Machines.localized/`; no VM disk, Docker data, or
large evidence directory was copied to the internal disk. No Docker prune or
VM snapshot was used.

The disposable guest account and password are intentionally excluded from this
receipt.

## Public r1 Identity

Anonymous OCI readback on `2026-07-25T02:55+08:00` returned the same manifest
digest for `latest`, `stable`, and `26.7.24-r1`:

```text
sha256:89b37c4b561ba4b614bfa1b4358e60fc0a39b2bd99d416b9e03f911ca9079de4
```

The public amd64 config labels bind:

```text
App       d9446b8803e23965bf6b0b58520a8d3815cf1255
Shell     c376e122e8fb55d778711806e600a19a93547cb5
Framework 02790aea1352f0a62aa0993327583d6814339e6d
Version   26.7.24-r1
```

`26.7.24-r2` returned `404` at that readback and was not public.

## Passed r1 Surfaces

| Surface | Result | Bounded readback |
| --- | --- | --- |
| One-click Windows install | `passed_with_runner_correction_required` | The public installer created `compose.yaml`, persistent `data` and `projects`, started the service, and reached HTTP `200`. The original runner later proved capable of reusing an old same-name Compose container, so this pass is not treated as true cold-install proof. |
| Manual update | `passed` | `install-docker-webui.ps1 -Update -Yes` completed and retained `compose.yaml`, `data`, and `projects`. |
| Automatic update | `passed` | Scheduled task `One Person Lab WebUI Latest Update` was registered for `03:00`, Interactive, limited user, following `latest`. |
| Missing-configuration recovery | `passed` | The lower-left `完成首次设置` entry remained available. A blocked send showed a local recovery message below the composer and retained the draft. |
| First-run forms | `passed` | The three-step first-run page exposed OPL Gateway email/password login and API Key compatibility without populated credentials. |
| Windows credential-helper recovery | `source_fixed_vm_revalidation_pending` | The public installer source now retries a public OPL GHCR pull with a temporary anonymous Docker config when the Windows credential helper is unavailable. |

## Confirmed r1 Defects

1. A fresh WebUI login with incomplete Core state stayed on `#/guid` instead
   of automatically opening first-run setup.
2. After state loading, Home displayed a central `本机运行环境需要处理`
   banner above the composer. The lower-left entry and send-time local recovery
   were sufficient; the central banner was redundant and visually disruptive.
3. A true container recreation stopped responding during
   `opl system startup-maintenance --scope runtime_substrate --json`. The old
   Framework attempted a remote Framework update into the Windows bind mount,
   while the image should own Framework bytes.
4. The first clean-install validation runner moved the install directory but
   did not reliably stop the existing Compose project. A same-name old
   container could therefore make a clean-install attempt appear healthy.

The four linked screenshots contain no credentials and record only the UI
surfaces needed to reproduce items 1, 2, and the already-correct recovery
forms.

- [Central environment banner reproduction](screenshots/r1-guid-attention.png)
- [Draft-preserving send-time recovery](screenshots/r1-send-inline-recovery.png)
- [Gateway account login form](screenshots/r1-first-run-gateway-login.png)
- [API Key compatibility form](screenshots/r1-first-run-api-key.png)

## Runner Repair

`windows-clean-install-run.ps1` now:

- runs `docker compose down --remove-orphans` before moving the old install
  root;
- supplies the original install root as `--project-directory`, so moving the
  directory cannot change Compose project identity;
- uses a temporary empty Docker config for public pulls during validation;
- records `previous_runtime_down` and `install_root_moved`;
- persists the successful runtime-down fact before moving the directory and
  refuses a retry whose rollback directory has no matching marker;
- avoids copying the installer onto itself in the scheduled worker.

A release test requires those properties and restricts the committed Windows
fixture directory to the clean-install runner, host readback, and README.

## Frozen r2 Repair Inputs

Stable run [`30111150192`](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/30111150192)
uploaded immutable Bundle:

```text
Version       26.7.24-r2
Bundle digest sha256:047da98566e32aef1a912150411cdc8499244acaf263aac635ccb452c15b2e56
App           98081eebbc5c3dfe765d283270c5c074d5c0a4d8
Shell         8647acb7845cea2dcfda168828f2e6b3e74212ff
Framework     eeb18aa51f148478d04a29821290dafbaa546a03
```

The Shell ref contains the fresh-login first-run routing fix and removal of the
new-task setup notice. The Framework ref keeps Framework updates image-owned.
This binds exact repair inputs, but it is not a public WebUI pass. The failed
Desktop Standard run must not be rerun or presented as Desktop publication.

## Remaining Terminal Acceptance

The authorized next route is the independent
`.github/workflows/release-webui-development.yml` workflow with exact inputs
`source_run_id=30111150192` and `expected_version=26.7.24-r2`. Completion still
requires:

1. protected WebUI publication success and anonymous OCI readback proving
   `26.7.24-r2 = stable = latest`;
2. a true cold Windows install with the repaired runner, HTTP `200`, and no
   image-owned startup-maintenance deadlock;
3. fresh login automatically opening first-run setup when configuration is
   incomplete;
4. Home without the central environment banner, while keeping the lower-left
   recovery entry and send-time draft-preserving message;
5. manual and automatic update readback with `data` and `projects` preserved;
6. public HTML and PDF guide readback after the validated current behavior is
   published.

Until all six complete, this receipt remains
`r1_reproduced_r2_publication_pending`.
