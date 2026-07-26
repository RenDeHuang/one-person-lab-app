import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { directorySizeBytes } from './filesystem.ts';
import { readGitHead } from './git.ts';
import { ensureFullRuntimeNativeTrust } from './runtime-native-trust.ts';
import { assertFullRuntimeCurrentness } from './runtime-currentness.ts';
import {
  buildResolvedFullPayloadRefs,
  resolveMasScholarSkillsFullRuntimeSource,
  writeFullRuntimeManifest,
} from './manifest-checksum.ts';
import { commandOutput } from './process.ts';
import { assertOfficeCliBinaryMatchesRelease } from './upstream-release.ts';
import {
  buildRuntimeCacheContext,
  runCachedLayer,
} from './runtime-cache.ts';
import {
  assertOplRuntimeProductionDependencies,
  assertTemporalCoreBridgeMacosArm64Only,
  buildDomainLayer,
  buildOplLayer,
  buildSkillsLayer,
  buildToolchainLayer,
  writeDomainMarkers,
} from './runtime-layers.ts';

export function prepareRuntime(options, sources, sourceResolutions = {}) {
  const masScholarSkillsSource = sourceResolutions.masScholarSkills
    ?? resolveMasScholarSkillsFullRuntimeSource(options);
  const resolvedSelectedBundleDescriptor = sourceResolutions.resolvedSelectedBundleDescriptor ?? null;
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-runtime-'));
  const runtimeRoot = path.join(stagingRoot, 'current');
  fs.mkdirSync(path.join(runtimeRoot, 'bin'), { recursive: true });

  const packagedAt = new Date().toISOString();
  const {
    selectedPackageSet,
    layerKeyInputs: cacheKeyInputs,
    layers: cacheKeys,
  } = buildRuntimeCacheContext(
    options,
    sources,
    undefined,
    resolvedSelectedBundleDescriptor,
  );
  const cacheEvents = [
    runCachedLayer(options, 'toolchain', cacheKeys.toolchain, runtimeRoot, (layerRoot) => {
      buildToolchainLayer(layerRoot, sources);
    }),
    runCachedLayer(options, 'domain-runtime', cacheKeys['domain-runtime'], runtimeRoot, (layerRoot) => {
      buildDomainLayer(layerRoot, options);
    }),
    runCachedLayer(options, 'opl-runtime', cacheKeys['opl-runtime'], runtimeRoot, (layerRoot) => {
      buildOplLayer(layerRoot, options);
    }),
    runCachedLayer(options, 'skills', cacheKeys.skills, runtimeRoot, (layerRoot) => {
      buildSkillsLayer(layerRoot, options, resolvedSelectedBundleDescriptor);
    }),
  ];
  assertOplRuntimeProductionDependencies(path.join(runtimeRoot, 'opl'));
  assertTemporalCoreBridgeMacosArm64Only(path.join(runtimeRoot, 'opl', 'node_modules'));
  writeDomainMarkers(runtimeRoot, options, packagedAt);
  const nativeTrust = ensureFullRuntimeNativeTrust(runtimeRoot);

  const officeCliVersion = commandOutput(path.join(runtimeRoot, 'bin', 'officecli'), ['--version']);
  assertOfficeCliBinaryMatchesRelease(officeCliVersion, options.officeCliRelease);
  const components = {
    opl: { source_path: options.frameworkRoot, git_commit: readGitHead(options.frameworkRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'opl')) },
    codex: {
      source_path: sources.codexRoot,
      version: commandOutput(path.join(runtimeRoot, 'bin', 'codex'), ['--version']),
      size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'codex')),
      binary_path: null,
      archive_path: 'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz',
      archive_size_bytes: fs.statSync(path.join(runtimeRoot, 'vendor', 'codex', 'codex_cli_darwin_arm64.tar.gz')).size,
    },
    mas: { source_path: options.masRoot, git_commit: readGitHead(options.masRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'mas')) },
    mas_scholar_skills: {
      source_path: options.masScholarSkillsRoot,
      git_commit: readGitHead(options.masScholarSkillsRoot),
      size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'mas-scholar-skills')),
    },
    mag: { source_path: options.magRoot, git_commit: readGitHead(options.magRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'mag')) },
    rca: { source_path: options.rcaRoot, git_commit: readGitHead(options.rcaRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'rca')) },
    meta_agent: { source_path: options.metaAgentRoot, git_commit: readGitHead(options.metaAgentRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'meta-agent')) },
    bookforge: { source_path: options.bookforgeRoot, git_commit: readGitHead(options.bookforgeRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'bookforge')) },
    opl_flow: { source_path: options.oplFlowRoot, git_commit: readGitHead(options.oplFlowRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'opl-flow')) },
    node: { source_path: sources.nodeToolchain.nodeBin, version: commandOutput(path.join(runtimeRoot, 'node', 'bin', 'node'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'node')) },
    python: { source_path: sources.pythonRoot, version: commandOutput(path.join(runtimeRoot, 'python', path.basename(sources.pythonRoot), 'bin', 'python3'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'python')) },
    uv: { source_path: sources.uvBin, version: commandOutput(path.join(runtimeRoot, 'uv', 'bin', 'uv'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'uv')) },
    temporal_cli: {
      source_path: sources.temporalCliBin,
      version: commandOutput(path.join(runtimeRoot, 'bin', 'temporal'), ['--version']),
      size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'temporal')),
      archive_path: 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz',
      archive_size_bytes: fs.statSync(sources.temporalCliArchive).size,
    },
    officecli: { source_path: sources.officeCliBin, version: officeCliVersion, size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'officecli')) },
    mineru_open_api: { source_path: sources.mineruOpenApiBin, version: commandOutput(sources.mineruOpenApiBin, ['version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'mineru-open-api')) },
    skills: {
      source_path: resolvedSelectedBundleDescriptor
        ? 'resolved_selected_bundle_descriptor'
        : 'contracts/app-product-profile.json#companion_payloads',
      size_bytes: directorySizeBytes(path.join(runtimeRoot, 'skills')),
    },
  };
  const optionalComponents = {
    bun: sources.bunBin
      ? {
          source_path: sources.bunBin,
          version: commandOutput(path.join(runtimeRoot, 'bin', 'bun'), ['--version']),
          size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'bun')),
          status: 'packaged',
        }
      : {
          source_path: null,
          version: null,
          size_bytes: 0,
          status: 'not_packaged',
        },
  };

  const resolvedRefs = buildResolvedFullPayloadRefs(options, sources, components, {
    masScholarSkills: masScholarSkillsSource,
    resolvedSelectedBundleDescriptor,
  });
  const manifest = writeFullRuntimeManifest(
    runtimeRoot,
    options,
    packagedAt,
    components,
    resolvedRefs,
    optionalComponents,
    nativeTrust,
  );
  const currentness = assertFullRuntimeCurrentness(runtimeRoot, {
    frameworkRoot: options.frameworkRoot,
    masRoot: options.masRoot,
    masScholarSkillsRoot: options.masScholarSkillsRoot,
    masScholarSkillsRef: options.masScholarSkillsRef,
    resolvedSelectedBundleDescriptor,
  });

  return {
    stagingRoot,
    runtimeRoot,
    manifest,
    runtime_cache: {
      mode: options.runtimeCacheMode,
      dir: options.runtimeCacheDir || null,
      keys: cacheKeys,
      key_inputs: cacheKeyInputs,
      selected_package_set: selectedPackageSet,
      resolved_selected_bundle_descriptor: resolvedSelectedBundleDescriptor,
      events: cacheEvents,
      currentness,
    },
    resolved_refs: resolvedRefs,
  };
}
