#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import { syncAppProductProfileToShell } from './app-product-profile.ts';
import {
  buildFullFirstInstallReadme,
  buildFullPackageArtifactNames,
} from './full-first-install-package.ts';
import {
  ensureFullDmgLocalAuthorization,
  findBuiltApp,
  findBuiltDmg,
  maybeCreateRuntimeTar,
  removeStandardGuiArtifacts,
  syncRuntimePayloadToBuildRoots,
} from './build-full-first-install-package/archive-output.ts';
import { parseArgs } from './build-full-first-install-package/env.ts';
import { requirePath } from './build-full-first-install-package/filesystem.ts';
import { ensureAppBundleAdHocCodesign } from './build-full-first-install-package/macos-trust.ts';
import {
  writeChecksums,
  writeJsonFile,
} from './build-full-first-install-package/manifest-checksum.ts';
import { appRepoRoot } from './build-full-first-install-package/paths.ts';
import { durationSeconds, monotonicSeconds, run } from './build-full-first-install-package/process.ts';
import { buildRuntimeCacheKeyReport } from './build-full-first-install-package/runtime-cache.ts';
import { resolveRuntimeSources } from './build-full-first-install-package/runtime-sources.ts';
import { prepareRuntime } from './build-full-first-install-package/staging.ts';

function main() {
  const options = parseArgs(process.argv.slice(2));
  const artifactNames = buildFullPackageArtifactNames(options.version);
  fs.mkdirSync(options.outDir, { recursive: true });

  for (const [label, source] of [
    ['GUI root', options.guiRoot],
    ['Framework root', options.frameworkRoot],
    ['MAS root', options.masRoot],
    ['MAG root', options.magRoot],
    ['RCA root', options.rcaRoot],
    ['OPL Meta Agent root', options.metaAgentRoot],
    ['Superpowers root', options.superpowersRoot],
  ]) {
    requirePath(source, label);
  }

  const sources = resolveRuntimeSources(options);
  if (options.printRuntimeCacheKeys) {
    console.log(JSON.stringify(buildRuntimeCacheKeyReport(options, sources), null, 2));
    return;
  }

  const timings = {};
  const buildStartedAt = monotonicSeconds();
  const prepared = prepareRuntime(options, sources);
  const runtimePreparedAt = monotonicSeconds();
  timings.runtime_materialize = durationSeconds(buildStartedAt, runtimePreparedAt);
  timings.runtime_cache_materialize = Number(prepared.runtime_cache.events.reduce((sum, event) => {
    return sum + (typeof event.duration_seconds === 'number' ? event.duration_seconds : 0);
  }, 0).toFixed(3));
  const runtimeCacheEventsPath = path.join(options.outDir, artifactNames.runtimeCacheEvents);
  writeJsonFile(runtimeCacheEventsPath, prepared.runtime_cache);
  const runtimeNativeTrustPath = path.join(options.outDir, 'full-runtime-native-trust.json');
  writeJsonFile(runtimeNativeTrustPath, prepared.manifest.native_trust);
  const cacheEventsWrittenAt = monotonicSeconds();
  const payloadRoots = syncRuntimePayloadToBuildRoots(prepared.runtimeRoot, prepared.manifest, options.guiRoot);
  const payloadSyncedAt = monotonicSeconds();
  timings.payload_sync = durationSeconds(cacheEventsWrittenAt, payloadSyncedAt);
  const productProfileSync = syncAppProductProfileToShell(options.guiRoot);

  if (!options.skipGuiBuild) {
    const shellBuildStartedAt = monotonicSeconds();
    const shellBuildArgs = ['run', 'build-mac:arm64'];
    if (options.reuseGuiViteOutput) {
      shellBuildArgs.push('--', '--skip-vite');
    }
    run('npm', shellBuildArgs, {
      cwd: options.guiRoot,
      env: {
        ...process.env,
        OPL_RELEASE_VERSION: options.version,
        OPL_REQUIRE_FULL_RUNTIME: '1',
      },
    });
    timings.shell_build = durationSeconds(shellBuildStartedAt, monotonicSeconds());
  } else {
    timings.shell_build = 0;
  }

  const packageCompressionStartedAt = monotonicSeconds();
  ensureAppBundleAdHocCodesign(findBuiltApp(options.guiRoot), 'Full built app bundle');
  const sourceDmg = findBuiltDmg(options.guiRoot, options.version);
  const targetDmg = path.join(options.outDir, artifactNames.dmg);
  fs.copyFileSync(sourceDmg, targetDmg);
  ensureFullDmgLocalAuthorization(options.guiRoot, targetDmg, options.version);
  removeStandardGuiArtifacts(options.guiRoot, options.version);
  const runtimeTar = maybeCreateRuntimeTar(options, prepared.runtimeRoot, artifactNames);
  timings.dmg_package_compression = durationSeconds(packageCompressionStartedAt, monotonicSeconds());

  const manifestChecksumStartedAt = monotonicSeconds();
  const manifestPath = path.join(options.outDir, artifactNames.manifest);
  fs.writeFileSync(manifestPath, `${JSON.stringify(prepared.manifest, null, 2)}\n`, 'utf8');
  const readmePath = path.join(options.outDir, artifactNames.readme);
  fs.writeFileSync(readmePath, buildFullFirstInstallReadme({
    version: options.version,
    dmgName: artifactNames.dmg,
    runtimeTarName: runtimeTar ? artifactNames.runtimeTar : null,
    notarized: process.env.OPL_FULL_PACKAGE_NOTARIZED === 'true',
  }), 'utf8');
  const checksumPath = writeChecksums(options.outDir, [
    targetDmg,
    manifestPath,
    runtimeCacheEventsPath,
    runtimeNativeTrustPath,
    readmePath,
    ...(runtimeTar ? [runtimeTar] : []),
  ]);
  timings.manifest_checksum = durationSeconds(manifestChecksumStartedAt, monotonicSeconds());
  const buildFinishedAt = monotonicSeconds();
  const timingPath = path.join(options.outDir, 'full-package-build-timing.json');
  writeJsonFile(timingPath, {
    schema: 'opl_full_package_build_timing.v1',
    version: options.version,
    duration_seconds: {
      full_package_build: durationSeconds(buildStartedAt, buildFinishedAt),
      full_package_build_breakdown: timings,
    },
    resolved_refs: prepared.resolved_refs,
  });

  console.log(JSON.stringify({
    status: 'completed',
    version: options.version,
    out_dir: options.outDir,
    app_repo_root: appRepoRoot,
    framework_root: options.frameworkRoot,
    dmg: targetDmg,
    runtime_tar: runtimeTar,
    manifest: manifestPath,
    runtime_cache_events: runtimeCacheEventsPath,
    runtime_native_trust: runtimeNativeTrustPath,
    timing: timingPath,
    readme: readmePath,
    checksums: checksumPath,
    payload_roots: payloadRoots,
    product_profile: productProfileSync,
    staging_root: prepared.stagingRoot,
    runtime_cache: prepared.runtime_cache,
    resolved_refs: prepared.resolved_refs,
    duration_seconds: {
      full_package_build: durationSeconds(buildStartedAt, buildFinishedAt),
      full_package_build_breakdown: timings,
    },
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
