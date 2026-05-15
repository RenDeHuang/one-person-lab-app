# App Release

Owner: `one-person-lab-app`
Purpose: `app_release_docs`
State: `active`
Machine boundary: Human-readable release guide. Use
`contracts/app-release-channel.json`, release assets, and updater metadata for
machine decisions.

The App repository owns standard desktop packages, Full first-install DMGs,
updater metadata, GitHub Release uploads, release asset normalization, GUI
smoke, and user-facing release notes.

The OPL Framework repository is a payload source for the Full DMG
runtime/CLI/contracts layer. It does not own App release workflows.

The active shell source is `gaofeng21cn/opl-aion-shell`. It is consumed as an
external checkout at `shells/aionui` and is not tracked in the clean App repo
history.

## Commands

```bash
npm run ensure:shell
npm run release:prepare-standard
npm run build-mac:arm64
node scripts/prepare-release-assets.mjs build-artifacts release-assets
node scripts/validate-release.mjs release-assets
npm run release:publish -- --version <version> --repo gaofeng21cn/one-person-lab-app
```

Full first-install DMG:

```bash
OPL_FRAMEWORK_ROOT=/Users/gaofeng/workspace/one-person-lab \
  npm run release:full -- --version <version>
npm run release:publish -- \
  --version <version> \
  --repo gaofeng21cn/one-person-lab-app \
  --full-package-only \
  --include-full-package
```

Boundary guard:

```bash
npm run test:release-boundary
node scripts/validate-release-boundary.mjs
```

Standard updater metadata is restricted to standard package assets. Full
first-install packages must be explicitly named with `Full` and must not be
referenced from `latest*.yml`.

Standard release builds run `scripts/prepare-standard-release-payload.mjs`
before packaging so stale Full runtime payloads cannot leak into standard App
assets.

2026-05-15 local release validation used the real macOS arm64 26.5.15
artifacts together with mock Windows/Linux matrix entries. In the no-universal
matrix, `latest-arm64-mac.yml` pointed to
`One-Person-Lab-26.5.15-mac-arm64.zip` and
`One-Person-Lab-26.5.15-mac-arm64.dmg`; `node scripts/validate-release.mjs`
passed and confirmed standard updater metadata excludes Full first-install
assets.
