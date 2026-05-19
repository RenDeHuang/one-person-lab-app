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

## GitHub Actions release path

Use **OPL Desktop Release** from the GitHub Actions tab for App-owned release
builds that should run on GitHub runners instead of this Mac.

- `release_mode=refresh_existing` rebuilds standard macOS arm64 assets, validates
  updater metadata, uploads them to the existing `v<opl_version>` release with
  clobber semantics, then optionally builds and publishes the Full first-install
  assets.
- `release_mode=new_release` builds the same assets, creates and pushes the
  `v<opl_version>` tag from the workflow commit, creates the GitHub Release, and
  optionally adds the Full first-install assets after the standard release exists.
- `include_full_package=true` delegates to the Full first-install workflow so the
  slower runtime/package assembly runs on GitHub Actions with the runtime layer
  cache.
- `run_vm_smoke=true` runs the clean Full first-run VM smoke after Full assets
  are uploaded. Leave it off for fast packaging-only refreshes or when the
  self-hosted Tart runner is unavailable.

The older automatic path is still valid for standard-only releases: pushing a
`v<version>` tag triggers **Build and Release**. After that completes, run
**OPL Full First-Install Release** with `publish_to_release=true` if the release
also needs Full first-install assets.

## Local commands

Release candidate plan:

```bash
npm run release:plan -- --version <version> --include-full-package
```

The plan output separates fast candidate checks, parallel build lanes, the
clean no-CLT VM gate, and the final publish step. Use it as the release runbook
for new versions so standard and Full builds can run concurrently while publish
stays serialized.

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
OPL_FULL_RUNTIME_CACHE_MODE=readwrite \
OPL_FRAMEWORK_ROOT=/Users/gaofeng/workspace/one-person-lab \
OPL_FULL_META_AGENT_ROOT=/Users/gaofeng/workspace/opl-meta-agent \
  npm run release:full -- --version <version>
npm run release:publish -- \
  --version <version> \
  --repo gaofeng21cn/one-person-lab-app \
  --full-package-only \
  --include-full-package
```

Full runtime payload assembly uses a content-addressed layer cache by default
under `~/Library/Caches/One Person Lab/full-runtime-layers`. The layer keys cover
the toolchain, domain runtime modules, OPL runtime, skills, packager inputs, and
runtime exclusion policy. Use `--print-runtime-cache-keys` for a fast
preflight, `OPL_FULL_RUNTIME_CACHE_MODE=readonly` to consume existing layers
without writing, or `OPL_FULL_RUNTIME_CACHE_MODE=off` for a clean rebuild.

Publishing to an existing tag is intentional for Full first-install refreshes:
`scripts/publish-release.ts` uses `gh release upload --clobber`, so the same
`v<version>` tag can receive rebuilt Full assets after the standard App release
already exists. Use `--full-package-only --include-full-package` for that lane;
it updates the Full release-note section and overwrites matching Full assets
without rebuilding or replacing standard updater assets.

GitHub Actions standard refreshes use the same publish script with
`--standard-artifacts-dir release-assets`, which publishes the already-built
standard assets from the workflow artifact download instead of rebuilding the
App inside the publish job.

For new same-day versions, prefer a new tag such as `v26.5.19` over deleting and
replacing a previous release. The publish script is resumable: existing release
assets are skipped only when the asset name, size, and GitHub `sha256:` digest
all match the local file. Assets with missing or different digests are uploaded
with `--clobber`. Pass
`--force-upload` only when the release operator intentionally wants to overwrite
all matching asset names.

Boundary guard:

```bash
npm run test:release-boundary
node --experimental-strip-types scripts/validate-release-boundary.ts
```

Standard updater metadata is restricted to macOS arm64 standard package assets.
Full first-install packages must be explicitly named with `Full` and must not
be referenced from `latest*.yml`.

Full companion text assets, including `README-Full-First-Install.txt`, are
English-only release assets. Keep those generated strings professional and free
of Chinese copy so GitHub Release downloads, checksums, and manual diagnostic
instructions present a single public language surface.

Release notes should name the user-visible validation scope when assets are
rebuilt after packaging smoke. For Full first-install refreshes, include the
clean no-CLT VM lane, settings-page coverage, deferred CLT handling, and the
current Codex default profile applied by the packaged App session path.

Standard release builds run `scripts/prepare-standard-release-payload.ts`
before packaging so stale Full runtime payloads cannot leak into standard App
assets.

2026-05-17 release policy: the stable App release channel publishes macOS arm64
standard update assets only. Docker/WebUI support is validated separately
against the Framework runtime surfaces; it is not a desktop release asset lane.

The `gaofeng21cn/one-person-lab` and `gaofeng21cn/opl-aion-shell` GitHub
Release lists should stay empty so App release ownership has a single remote
entry point.
