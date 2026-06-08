import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  FULL_RUNTIME_CACHE_LAYER_IDS,
  buildFullRuntimeAggregateCacheKeyInput,
  buildFullRuntimeCacheArchivePath,
  buildFullRuntimeCacheKey,
  classifyFullRuntimeLayerCache,
  shouldExcludeRuntimePath,
} from '../full-first-install-package.ts';
import { archiveLayer, extractLayer } from './archive-output.ts';
import {
  assertNoExternalSymlinks,
  copyExecutableOrSymlinkTarget,
  copyNodeRuntimePayload,
  copyPathContents,
  copyPortableTree,
  copyProductionNodeModules,
  copySingleFile,
  copyTreeFiltered,
} from './filesystem.ts';
import { readGitHead } from './git.ts';
import {
  directoryFingerprint,
  fileSha256,
  functionSourceSha256,
  hashFiles,
  packageJsonVersion,
  productionNodeModulesFingerprint,
  stringSha256,
} from './hashing.ts';
import { appRepoRoot } from './paths.ts';
import { commandOutput, durationSeconds, monotonicSeconds } from './process.ts';
import {
  findBunBinary,
  findTemporalCliArchive,
  findTemporalCliBinary,
} from './runtime-sources.ts';
import {
  buildDomainLayer,
  buildOplLayer,
  buildSkillsLayer,
  buildToolchainLayer,
  pruneTemporalCoreBridgeReleases,
  writeTemporalCliWrapper,
} from './runtime-layers.ts';
import {
  appCompanionSkillCandidates,
  appCompanionSkillRoot,
  copyFirstSkillSource,
  copyOfficeCliCoreSkill,
  copyOplMetaAgentSkill,
  copyPackagedSkills,
  copySkillDirectory,
  copySuperpowersBundle,
  copyUiUxProMaxSkill,
  firstExistingSkillSource,
  magSkillCandidates,
  masSkillCandidates,
  metaAgentSkillSnapshot,
  mineruDocumentExtractorSkillCandidates,
  officeCliCoreSkillCandidates,
  officeCliCoreSkillSnapshot,
  officeCliSkillCandidates,
  packagedSkillCopyHandlers,
  rcaSkillCandidates,
  skillFileSourceSnapshot,
  skillSourceSnapshot,
} from './skills.ts';

function buildRuntimeLayerPackagerInputs() {
  return {
    support_files: hashFiles(appRepoRoot, [
      'contracts/app-product-profile.json',
      'scripts/build-full-first-install-package.ts',
      'scripts/build-full-first-install-package/archive-output.ts',
      'scripts/build-full-first-install-package/env.ts',
      'scripts/build-full-first-install-package/filesystem.ts',
      'scripts/build-full-first-install-package/git.ts',
      'scripts/build-full-first-install-package/hashing.ts',
      'scripts/build-full-first-install-package/macos-trust.ts',
      'scripts/build-full-first-install-package/manifest-checksum.ts',
      'scripts/build-full-first-install-package/paths.ts',
      'scripts/build-full-first-install-package/process.ts',
      'scripts/build-full-first-install-package/runtime-cache.ts',
      'scripts/build-full-first-install-package/runtime-layers.ts',
      'scripts/build-full-first-install-package/runtime-sources.ts',
      'scripts/build-full-first-install-package/skills.ts',
      'scripts/build-full-first-install-package/staging.ts',
      'scripts/full-first-install-package.ts',
      'scripts/full-first-install-runtime-wrappers.ts',
    ]),
    runtime_layer_builder_source_hash: functionSourceSha256([
      buildToolchainLayer,
      buildDomainLayer,
      buildOplLayer,
      buildSkillsLayer,
      copyPackagedSkills,
      ...Object.values(packagedSkillCopyHandlers),
      findBunBinary,
      findTemporalCliBinary,
      findTemporalCliArchive,
      copyOplMetaAgentSkill,
      copySuperpowersBundle,
      copyOfficeCliCoreSkill,
      copyUiUxProMaxSkill,
      copyFirstSkillSource,
      copySkillDirectory,
      firstExistingSkillSource,
      skillSourceSnapshot,
      skillFileSourceSnapshot,
      appCompanionSkillRoot,
      appCompanionSkillCandidates,
      officeCliSkillCandidates,
      metaAgentSkillSnapshot,
      officeCliCoreSkillSnapshot,
      masSkillCandidates,
      magSkillCandidates,
      rcaSkillCandidates,
      officeCliCoreSkillCandidates,
      mineruDocumentExtractorSkillCandidates,
      copyTreeFiltered,
      copySingleFile,
      copyPortableTree,
      copyExecutableOrSymlinkTarget,
      copyNodeRuntimePayload,
      writeTemporalCliWrapper,
      assertNoExternalSymlinks,
      copyProductionNodeModules,
      pruneTemporalCoreBridgeReleases,
    ]),
  };
}

export function buildRuntimeCacheKeyInputs(options, sources) {
  const packagerInputs = buildRuntimeLayerPackagerInputs();
  const excludePolicyHash = stringSha256(shouldExcludeRuntimePath.toString());

  return {
    toolchain: {
        codex_package_version: packageJsonVersion(path.join(sources.codexRoot, 'package.json')),
        codex_binary_sha256: fileSha256(sources.codexBinaries.codex),
        rg_sha256: fileSha256(sources.codexBinaries.rg),
        node_sha256: fileSha256(sources.nodeToolchain.nodeBin),
        npm_bin_sha256: fileSha256(sources.nodeToolchain.npmBin),
        npx_bin_sha256: fileSha256(sources.nodeToolchain.npxBin),
        npm_package_version: packageJsonVersion(path.join(sources.nodeToolchain.npmRoot, 'package.json')),
        npm_package_fingerprint: directoryFingerprint(sources.nodeToolchain.npmRoot, 'node/lib/node_modules/npm'),
        bun_runtime_included: options.includeBunRuntime,
        bun_sha256: sources.bunBin ? fileSha256(sources.bunBin) : null,
        uv_sha256: fileSha256(sources.uvBin),
        temporal_cli_sha256: fileSha256(sources.temporalCliBin),
        temporal_cli_version: commandOutput(sources.temporalCliBin, ['--version']),
        temporal_cli_archive_sha256: fileSha256(sources.temporalCliArchive),
        officecli_sha256: fileSha256(sources.officeCliBin),
        officecli_version: commandOutput(sources.officeCliBin, ['--version']),
        mineru_open_api_sha256: fileSha256(sources.mineruOpenApiBin),
        mineru_open_api_version: commandOutput(sources.mineruOpenApiBin, ['version']),
        python_root_name: path.basename(sources.pythonRoot),
        python_version: commandOutput(path.join(sources.pythonRoot, 'bin', 'python3'), ['--version']),
        packager_inputs: packagerInputs,
        exclude_policy_hash: excludePolicyHash,
    },
    'domain-runtime': {
        mas_commit: readGitHead(options.masRoot),
        mag_commit: readGitHead(options.magRoot),
        rca_commit: readGitHead(options.rcaRoot),
        meta_agent_commit: readGitHead(options.metaAgentRoot),
        packager_inputs: packagerInputs,
        exclude_policy_hash: excludePolicyHash,
    },
    'opl-runtime': {
        opl_commit: readGitHead(options.frameworkRoot),
        package_json_sha256: fileSha256(path.join(options.frameworkRoot, 'package.json')),
        package_lock_sha256: fileSha256(path.join(options.frameworkRoot, 'package-lock.json')),
        production_node_modules_fingerprint: productionNodeModulesFingerprint(options.frameworkRoot),
        tsconfig_sha256: fileSha256(path.join(options.frameworkRoot, 'tsconfig.json')),
        packager_inputs: packagerInputs,
        exclude_policy_hash: excludePolicyHash,
    },
    skills: {
        mas_skill_source: skillSourceSnapshot(masSkillCandidates(options), 'skills/mas'),
        mag_skill_source: skillSourceSnapshot(magSkillCandidates(options), 'skills/mag'),
        rca_skill_source: skillSourceSnapshot(rcaSkillCandidates(options), 'skills/rca'),
        meta_agent_skill_source: metaAgentSkillSnapshot(options),
        superpowers_root_commit: readGitHead(options.superpowersRoot),
        superpowers_fingerprint: directoryFingerprint(options.superpowersRoot, 'skills/superpowers'),
        officecli_root_commit: readGitHead(options.officeCliRoot),
        officecli_core_source: officeCliCoreSkillSnapshot(options),
        cron_skill_source: skillSourceSnapshot(appCompanionSkillCandidates('cron'), 'skills/cron'),
        officecli_docx_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-docx'), 'skills/officecli-docx'),
        officecli_pptx_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-pptx'), 'skills/officecli-pptx'),
        officecli_xlsx_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-xlsx'), 'skills/officecli-xlsx'),
        officecli_academic_paper_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-academic-paper'), 'skills/officecli-academic-paper'),
        officecli_data_dashboard_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-data-dashboard'), 'skills/officecli-data-dashboard'),
        officecli_financial_model_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-financial-model'), 'skills/officecli-financial-model'),
        officecli_pitch_deck_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-pitch-deck'), 'skills/officecli-pitch-deck'),
        pdf_skill_source: skillSourceSnapshot(appCompanionSkillCandidates('pdf'), 'skills/pdf'),
        mineru_document_extractor_root_commit: readGitHead(options.mineruDocumentExtractorRoot),
        mineru_document_extractor_source: skillSourceSnapshot(mineruDocumentExtractorSkillCandidates(options), 'skills/mineru-document-extractor'),
        ui_ux_pro_max_root_commit: readGitHead(options.uiUxProMaxRoot),
        ui_ux_pro_max_fingerprint: directoryFingerprint(options.uiUxProMaxRoot, 'skills/ui-ux-pro-max'),
        packager_inputs: packagerInputs,
        exclude_policy_hash: excludePolicyHash,
    },
  };
}

function buildRuntimeCacheKeys(options, sources) {
  return buildRuntimeCacheKeysFromInputs(buildRuntimeCacheKeyInputs(options, sources));
}

export function buildRuntimeCacheKeysFromInputs(layerInputs) {
  return {
    toolchain: buildFullRuntimeCacheKey({
      layerId: 'toolchain',
      parts: layerInputs.toolchain,
    }),
    'domain-runtime': buildFullRuntimeCacheKey({
      layerId: 'domain-runtime',
      parts: layerInputs['domain-runtime'],
    }),
    'opl-runtime': buildFullRuntimeCacheKey({
      layerId: 'opl-runtime',
      parts: layerInputs['opl-runtime'],
    }),
    skills: buildFullRuntimeCacheKey({
      layerId: 'skills',
      parts: layerInputs.skills,
    }),
  };
}

function cacheLayerArchivePath(options, layerId, key) {
  return buildFullRuntimeCacheArchivePath({
    cacheDir: options.runtimeCacheDir,
    layerId,
    key,
  });
}

export function buildRuntimeCacheKeyReport(options, sources) {
  const layerKeyInputs = buildRuntimeCacheKeyInputs(options, sources);
  const layers = buildRuntimeCacheKeysFromInputs(layerKeyInputs);
  return {
    status: 'runtime_cache_keys',
    version: options.version,
    runtime_cache_mode: options.runtimeCacheMode,
    runtime_cache_dir: options.runtimeCacheDir || null,
    aggregate_key_input: buildFullRuntimeAggregateCacheKeyInput({ layers }),
    layer_key_inputs: layerKeyInputs,
    layers,
    layer_ids: FULL_RUNTIME_CACHE_LAYER_IDS,
  };
}

export function runCachedLayer(options, layerId, key, targetRoot, builder) {
  const startedAt = monotonicSeconds();
  const archivePath = cacheLayerArchivePath(options, layerId, key);
  const cacheEvent = classifyFullRuntimeLayerCache({
    mode: options.runtimeCacheMode,
    cacheDir: options.runtimeCacheDir || null,
    layerId,
    key,
    archiveExists: fs.existsSync(archivePath),
  });

  if (cacheEvent.read_archive) {
    extractLayer(archivePath, targetRoot);
    return {
      ...cacheEvent,
      duration_seconds: durationSeconds(startedAt, monotonicSeconds()),
    };
  }

  const tempLayerRoot = fs.mkdtempSync(path.join(os.tmpdir(), `opl-full-${layerId}-`));
  try {
    builder(tempLayerRoot);
    copyPathContents(tempLayerRoot, targetRoot);
    if (cacheEvent.write_archive) {
      archiveLayer(tempLayerRoot, archivePath);
    }
    return {
      ...cacheEvent,
      duration_seconds: durationSeconds(startedAt, monotonicSeconds()),
    };
  } finally {
    fs.rmSync(tempLayerRoot, { recursive: true, force: true });
  }
}
