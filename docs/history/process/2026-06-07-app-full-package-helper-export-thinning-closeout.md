# 2026-06-07 App Full package helper export thinning closeout

Owner: `one-person-lab-app`
Purpose: `app_full_package_helper_export_thinning_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current Full first-install package truth stays in `scripts/build-full-first-install-package.ts`, `scripts/build-full-first-install-package/**`, release workflows, release contracts, validation scripts, release-boundary tests, release artifacts, and Full package evidence manifests.

## Snapshot

- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Commit: `f5d17c212bca4940ddfc778ca1fc7575bcdcccd2`
- Semantic theme: `Full first-install package helper export thinning`

## Single Source Of Truth

- `scripts/build-full-first-install-package.ts` owns the public Full first-install package build entrypoint.
- `scripts/build-full-first-install-package/**` owns internal package assembly helpers, runtime layer/cache construction, macOS native trust checks, runtime source resolution, payload sync, and checksum/manifest helpers.
- `tests/release/app-release-boundary-cases/full-first-install-runtime.ts` and `tests/release/release-speed-vm-plan.test.ts` own focused release-boundary coverage for Full package behavior and release-train speed gates.

## Retired Surface

The Full package helper modules had accumulated extra `export function` surfaces for module-local helpers such as tar creation, payload sync internals, DMG candidate cleanup, macOS native trust subroutines, cache-key internals, runtime source finders, Temporal release listing helpers, and manifest size breakdown helpers.

Those helper functions were never intended as public App script APIs. They now remain module-local, while the two intentional helper exports continue to exist:

- `syncRuntimePayloadToBuildRoots`, consumed by the Full package builder entrypoint.
- `buildRuntimeCacheKeysFromInputs`, consumed as a stable cache-key pure helper.

No release workflow, Full package manifest schema, runtime payload selection, local authorization policy, macOS trust policy, release docs, or App shell behavior changed.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app` after the thinning was on `main`:

```bash
rtk node --experimental-strip-types --test tests/release/app-release-boundary.test.ts --test-name-pattern "Full package" --test-reporter=dot
rtk node --experimental-strip-types --test tests/release/release-speed-vm-plan.test.ts --test-reporter=dot
rtk rg -n "export function (createTarZst|syncRuntimePayload|removeBuiltDmgCandidates|createFullDmgFromVerifiedApp|defaultRuntimeCacheDir|isInsidePath|strictMacosRuntimeSigningRequired|macosSigningIdentity|relativeRuntimePath|isNativeRuntimeExecutable|requiresGatekeeperExecutableAssessment|listFullRuntimeNativeExecutables|hasExtendedAttribute|readCodeSignature|signMacosRuntimeExecutable|verifyMacosRuntimeExecutable|directoryChildSizes|sizeBreakdownEntry|collectFullRuntimeSizeBreakdown|buildRuntimeLayerPackagerInputs|buildRuntimeCacheKeys|cacheLayerArchivePath|temporalCoreBridgeReleasesRoot|listTemporalCoreBridgeReleases|countRuntimeModuleVenvDirectories|findOfficeCliBinary|findMineruOpenApiBinary|findCodexRoot|findCodexBinary|findNodeToolchain|findPythonRoot)" scripts/build-full-first-install-package
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
```

Observed result:

- Full package focused release-boundary entrypoint passed with `85/85`.
- Release-speed VM plan suite passed with `8/8`.
- Export scan found only `syncRuntimePayloadToBuildRoots` and `buildRuntimeCacheKeysFromInputs` as remaining exported helpers in the scanned Full package helper set.
- App doctor returned `finding_count=0`.

## Remaining Scope

This lane only thins accidental helper exports inside the Full first-install package builder. It does not run a real Full package build, produce release artifacts, validate VM first-run behavior, change the Full package cache policy, change native trust behavior, or alter release-channel contracts.
