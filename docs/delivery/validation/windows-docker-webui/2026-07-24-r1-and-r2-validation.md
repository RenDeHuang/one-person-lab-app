# Windows Docker/WebUI Validation Receipt: Public r3

Validation run ID: `20260724-25-windows-docker-webui-r3`
State: `r3_install_update_persistence_pass_first_login_fix_pending_public_digest`
Lane: `windows_x64_docker_desktop_manual_vm`
Date: `2026-07-25`

## Scope

This run exercised the beginner Windows installer in an external-SSD VMware
Windows 11 x64 VM with Docker Desktop and WSL 2. It covered update from the
predecessor image, a clean-data first start, persistent `data`/`projects`,
manual and scheduled updates, ordinary startup, first-run recovery, Gateway
account/API Key forms, and an authenticated fresh-login route.

The VM has `4` vCPU and `32768 MiB` memory. Its virtual disk is stored under
`/Volumes/My Passport/Virtual Machines.localized/`; no VM disk or Docker data
was moved to the internal 512 GB disk. The host ended this validation with about
`40 GiB` free internally and `608 GiB` free on the external SSD. No Docker
prune or VM snapshot was used.

The guest account, VMware guest password, temporary WebUI validation password,
Gateway credentials, API keys, raw authentication cookies, and full logs are
intentionally excluded from this receipt.

## Canonical Public Identity

Anonymous OCI readback on `2026-07-25` returned the same manifest digest for
`latest`, `stable`, and `26.7.24-r3`:

```text
sha256:e3cdd3806ef40f3414e81d990c718cc454c7bb58623367ee51f6fdbd2138aaeb
```

The public amd64 image labels bind:

```text
Version   26.7.24-r3
App       cc0467ca171b79e50029a3de406bc6d2aca9109e
Shell     6b83b181b46c74c5c9195ecc2e9b1fbf0327287e
Framework 4b415104a3bdbe1b2c6bfaad0cefbc0712fee62b
Bundle    sha256:9a64d2efbfc0523dc150433b3004431c2f4dd22b5b9e5496101fa10d03bb2c21
```

No image was published or retagged by this validation lane.

## Passed r3 Surfaces

| Surface | Result | Bounded readback |
| --- | --- | --- |
| Windows installer and HTTP | `passed` | Fixed installer completed with exit `0` in about 16 seconds, pinned `latest` to the r3 digest, reused the local image, kept Compose running, and reached HTTP `200`. |
| Timeout cleanup | `source_fixed_and_retested` | A child-process exit race made `taskkill` stderr fatal under PowerShell `Stop`. App commit `b56cb716` suppresses only that cleanup stderr; focused installer tests pass. |
| Update from predecessor | `passed` | Host update resolved the immutable r3 digest and recreated/reused the Compose service without deleting persistent directories. |
| Persistent data | `passed` | `data` grew from 5,903 files / 1,267,764,448 bytes to 5,912 files / 1,321,295,401 bytes; `projects` retained its 78-byte sentinel. |
| Mounts | `passed` | Windows `OnePersonLab/data` and `OnePersonLab/projects` remained bound to `/data` and `/projects`. |
| Scheduled update | `passed` | `One Person Lab WebUI Latest Update` is Ready with daily 03:00 and AtLogOn triggers, user `oplrunner`, Interactive logon, Limited run level, and last result `0`. |
| AtLogOn execution | `passed` | A one-time login triggered the task. Auto-logon registry values and LSA private data were then removed and read back absent. No Windows password remains stored. |
| Ordinary startup | `passed` | A new browser context reached an enabled Guid workbench in about 0.4 seconds; a clean-data context loaded the workbench in about 0.26 seconds and did not wait 20 seconds. |
| Home recovery placement | `passed` | In incomplete Core state, Home showed only the lower-left `完成首次设置` entry with `不影响浏览`; the former central `本机运行环境需要处理` banner was absent. |
| First-run UI | `passed` | Direct recovery opened the three-step setup. Clean data resolved Workspace and Local assistant ready, Model access missing, with OPL Gateway account login first, API Key compatibility, and existing-config recheck. |
| Console stability | `passed_with_expected_auth_probe` | Local-auto and setup pages had no React errors or blank screen. Password-auth login page emitted the expected initial unauthenticated `/api/auth/user` 401 only. |
| Disk cleanup boundary | `passed` | When guest C: reached zero earlier in the run, only seven known unreferenced validation images were removed. No prune or broad cache deletion was used. Final C: free space was about 23.4 GiB. |

## Remaining r3 Defect: Fresh Login Auto-Route Race

A clean-data password-authenticated login exercised the exact product boundary.
The fresh fast-state request returned in `11,486 ms`, below the `20,000 ms`
UI deadline, and explicitly reported:

```text
codex installed=true
model_access_ready=false
model_access_status=missing
```

The page nevertheless remained on `#/guid` and rendered only the lower-left
recovery entry instead of replacing Guid with `#/first-run`.

The root cause was a renderer authority race. Multiple App-state consumers share
the same fast-state request. After the fresh-login consumer obtained a live
payload, another consumer's cache-update event could downgrade its provenance
from `live` to `derived_bootstrap`. Guid correctly fails open for bootstrap
or unknown state, so it lost the known-incomplete auto-route signal.

The Shell repair is:

```text
opl-aion-shell main 0928ce1f92e8777318b959523c770d8f6dd25863
fix(first-run): preserve live login readiness
```

The patch keeps already-established live authority across shared cache
broadcasts and adds a regression test for this race. Focused DOM validation
passed `4` files / `69` tests, with formatting and diff checks clean.

This source repair is on Shell `main`, but public r3 still contains Shell
`6b83b181...`. Therefore r3 is not the terminal fresh-login pass and must not
be described as if it contains `0928ce1f9`.

## Installer Repair Checkpoint

The Windows installer cleanup correction is on the App task branch:

```text
one-person-lab-app b56cb71694f85dee54a6b2db573b089b8de1e278
fix(webui): tolerate Windows timeout cleanup races
```

It changes only the best-effort `taskkill` cleanup path and the matching
installer contract/test text. Focused Windows installer tests passed `8/8`.

## Security and Cleanup Readback

- One-time Windows auto-login is disabled.
- `AutoLogonCount` and plaintext `DefaultPassword` are absent.
- LSA `DefaultPassword` readback reports no secret.
- The temporary password-auth validation container, directories, and scripts
  were removed.
- The canonical r3 Compose container was restored and returned HTTP `200`.
- The guest validation port and host loopback forward are temporary surfaces
  and must be removed before VM shutdown.
- No Gateway password, API Key, Windows password, or browser session is retained
  in committed evidence.

## Remaining Terminal Acceptance

Completion now requires:

1. the unique WebUI publication owner to build and qualify a successor digest
   containing Shell `0928ce1f9` and the App installer correction;
2. protected `latest`/`stable` promotion with anonymous exact-digest readback;
3. Windows update from public r3 to that exact successor digest while preserving
   `data` and `projects`;
4. a clean-data authenticated login that automatically enters `#/first-run`
   after known incomplete Core readiness;
5. ordinary startup still entering Guid immediately, central Home alert absent,
   lower-left recovery retained, and no React error/blank screen;
6. final public HTML and PDF guide build/readback from App `main`.

Until those six complete, this receipt remains
`r3_install_update_persistence_pass_first_login_fix_pending_public_digest`.
