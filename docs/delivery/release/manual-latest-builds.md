# Manual Latest App And Full DMG

These two operator lanes provide current development builds without entering the
formal Stable release control plane:

- `npm run manual:local-app` builds a Full App, safely replaces
  `/Applications/One Person Lab.app`, and relaunches it.
- `npm run manual:full-dmg` builds a distributable Full DMG.

Both commands use the same `opl_manual_latest_build_source_lock.v1` resolver.
When the repositories and upstream releases have not changed, the generated
`manual-latest-source-lock.json` is byte-identical for both lanes.

## Source Policy

First-party inputs come from the clean `main` HEAD in each development
directory: App, active Shell, Framework, MAS, MAG, RCA, OMA, OBF, MAS Scholar
Skills, and OPL Flow. The command fails closed if one of those directories is
dirty, detached, or checked out on another branch.

Temporal CLI, OfficeCLI, and MinerU OpenAPI come from their latest official
stable GitHub Release. The command downloads the macOS arm64 asset into the
manual build cache and verifies the SHA-256 digest published by GitHub. Temporal
is additionally checked against its official `checksums.txt`. Local installed
copies are never used as build authority.

The Framework package catalog is projected only in a temporary checkout when a
first-party owner `main` is newer than Framework `main`. The canonical Framework
checkout is not changed, and the Full builder still runs its normal source
closure checks against the projected catalog.

## Commands

Inspect and freeze the current inputs without building:

```bash
npm run manual:full-dmg -- --print-plan --out-dir /tmp/opl-manual-latest-plan
```

Build, install, and launch the local Full App:

```bash
npm run manual:local-app
```

Build the distributable Full DMG:

```bash
npm run manual:full-dmg
```

By default, versions are allocated from the current Asia/Shanghai date. For
example, `26.7.21` is the display/UI version and `26.7.2100` is the monotonic
Electron/updater version used by `app.getVersion()` and both CFBundle version
fields. A later formal `26.7.21-r1` build uses `26.7.2101`, so the manual App can
update forward through the normal updater.

Useful options:

- `--version <YY.M.D>` and `--updater-version <YY.M.D00>` override the bound
  version pair; the release contract validates the pair.
- `--no-launch` installs the local App without opening it.
- `--install-path <path.app>` changes the local App destination.
- `--out-dir <path>` changes the managed evidence or DMG directory.
- `--reuse-gui-vite-output` is an explicit optimization and should be used only
  when the cached Shell renderer was compiled for the same display version.

Normal builds use a sibling staging directory and replace the managed output
directory only after the App or DMG passes verification. A failed rebuild leaves
the previous successful output directory intact. Immediately before installing
the App or promoting the DMG, the command rechecks every first-party repository
against the frozen source snapshot. A dirty repository or changed HEAD, branch,
local `main`, or remote-tracking `main` fails closed.

## Evidence And Boundary

Each successful lane writes:

- `manual-latest-source-lock.json`, binding exact repository SHAs, projected
  Framework catalog identity, upstream tags, digests, binaries, and versions.
- `manual-latest-build-receipt.json`, binding the lane, both version identities,
  source-lock SHA-256, and final output.

The local lane also writes `manual-local-app-installation.json`. It verifies the
staged App before stopping the installed App, uses a same-volume atomic rename,
retains a rollback copy until the new App starts, and restores the old App on a
failed replacement or launch.

The Full lane runs the existing Full package gates and independently verifies
the final DMG before writing its success receipt. Its receipt records DMG size
and SHA-256 plus both Full manifests.

These lanes do not create a Release Bundle, Framework checkpoint, Git tag,
GitHub Release, Latest mutation, updater metadata, or Homebrew mutation. Their
receipts are not formal Stable admission or updater qualification evidence.
