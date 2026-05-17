# App Release

Owner: `one-person-lab-app`
Purpose: `app_release_docs`
State: `active`
Machine boundary: Human-readable release guide. Use
`contracts/app-release-channel.json`, release assets, and updater metadata for
machine decisions.

The App repository owns the macOS arm64 standard desktop package, Full
first-install DMG, updater metadata, GitHub Release uploads, release asset
normalization, GUI smoke, and user-facing release notes.

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
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
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
node --experimental-strip-types scripts/validate-release-boundary.ts
```

Standard updater metadata is restricted to macOS arm64 standard package assets.
Full first-install packages must be explicitly named with `Full` and must not
be referenced from `latest*.yml`.

Standard release builds run `scripts/prepare-standard-release-payload.ts`
before packaging so stale Full runtime payloads cannot leak into standard App
assets.

2026-05-17 release policy: the stable App release channel publishes macOS arm64
standard update assets only. Docker/WebUI support is validated separately
against the Framework runtime surfaces; it is not a desktop release asset lane.

The `gaofeng21cn/one-person-lab` and `gaofeng21cn/opl-aion-shell` GitHub
Release lists should stay empty so App release ownership has a single remote
entry point.
