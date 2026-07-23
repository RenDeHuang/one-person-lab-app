import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  FULL_RUNTIME_CACHE_LAYER_IDS,
  buildFullRuntimeAggregateCacheKeyInput,
  buildFullRuntimeCacheArchivePath,
  buildFullRuntimeCacheKey,
  buildFullRuntimePruneImplementationHash,
  buildFullRuntimePrunePolicyCacheHash,
  classifyFullRuntimeLayerCache,
  type FullRuntimeCacheLayerId,
} from '../full-first-install-package.ts';
import { archiveLayer, extractLayer } from './archive-output.ts';
import { copyPathContents } from './filesystem.ts';
import { readGitHead } from './git.ts';
import {
  completeDirectoryFingerprint,
  directoryFingerprint,
  existingFileSha256,
  packageJsonVersion,
  productionNodeModulesFingerprint,
} from './hashing.ts';
import { appRepoRoot } from './paths.ts';
import { commandOutput, durationSeconds, monotonicSeconds } from './process.ts';
import {
  FULL_RUNTIME_STARTER_PROFILE,
  resolveFrameworkPackageSetInput,
  type FullRuntimePackageProfile,
} from './runtime-cache-package-set.ts';
import { buildRuntimeLayerImplementationHash } from './runtime-layers.ts';
import {
  bookforgeSkillSnapshot,
  magSkillCandidates,
  masSkillCandidates,
  metaAgentSkillSnapshot,
  mineruDocumentExtractorSkillCandidates,
  officeCliCoreSkillCandidates,
  officeCliCoreSkillSnapshot,
  officeCliSkillCandidates,
  rcaSkillCandidates,
  skillSourceSnapshot,
} from './skills.ts';

function buildLayerImplementationInput(layerId: FullRuntimeCacheLayerId) {
  return {
    schema: 'opl_full_runtime_layer_implementation_input.v1',
    layer_id: layerId,
    layer_builder_sha256: buildRuntimeLayerImplementationHash(layerId),
    prune_implementation_sha256: buildFullRuntimePruneImplementationHash(),
    prune_policy_sha256: buildFullRuntimePrunePolicyCacheHash(layerId),
  };
}

function domainSourceFingerprints(options) {
  return {
    mas: directoryFingerprint(options.masRoot, 'modules/mas'),
    mag: directoryFingerprint(options.magRoot, 'modules/mag'),
    rca: directoryFingerprint(options.rcaRoot, 'modules/rca'),
    oma: directoryFingerprint(options.metaAgentRoot, 'modules/meta-agent'),
    obf: directoryFingerprint(options.bookforgeRoot, 'modules/bookforge'),
    'mas-scholar-skills': directoryFingerprint(
      options.masScholarSkillsRoot,
      'modules/mas-scholar-skills',
    ),
    'opl-flow': directoryFingerprint(options.oplFlowRoot, 'modules/opl-flow'),
  };
}

export function buildRuntimeCacheKeyInputs(
  options,
  sources,
  frameworkPackageSet = null,
  packageProfile: FullRuntimePackageProfile = FULL_RUNTIME_STARTER_PROFILE,
) {
  const packageSet = frameworkPackageSet ?? resolveFrameworkPackageSetInput(options, packageProfile);
  const nodeRoot = path.dirname(path.dirname(sources.nodeToolchain.nodeBin));
  const pythonRootName = path.basename(sources.pythonRoot);

  return {
    toolchain: {
        codex_package_version: packageJsonVersion(path.join(sources.codexRoot, 'package.json')),
        codex_binary_sha256: existingFileSha256(sources.codexBinaries.codex),
        rg_sha256: existingFileSha256(sources.codexBinaries.rg),
        node_sha256: existingFileSha256(sources.nodeToolchain.nodeBin),
        npm_bin_sha256: existingFileSha256(sources.nodeToolchain.npmBin),
        npx_bin_sha256: existingFileSha256(sources.nodeToolchain.npxBin),
        npm_package_version: packageJsonVersion(path.join(sources.nodeToolchain.npmRoot, 'package.json')),
        npm_package_fingerprint: directoryFingerprint(sources.nodeToolchain.npmRoot, 'node/lib/node_modules/npm'),
        node_runtime_fingerprint: directoryFingerprint(nodeRoot, 'node'),
        codex_vendor_fingerprint: completeDirectoryFingerprint(sources.codexBinaries.vendorRoot),
        bun_runtime_included: options.includeBunRuntime,
        bun_sha256: sources.bunBin ? existingFileSha256(sources.bunBin) : null,
        uv_sha256: existingFileSha256(sources.uvBin),
        temporal_cli_sha256: existingFileSha256(sources.temporalCliBin),
        temporal_cli_version: commandOutput(sources.temporalCliBin, ['--version']),
        temporal_cli_archive_sha256: existingFileSha256(sources.temporalCliArchive),
        officecli_sha256: existingFileSha256(sources.officeCliBin),
        officecli_version: commandOutput(sources.officeCliBin, ['--version']),
        mineru_open_api_sha256: existingFileSha256(sources.mineruOpenApiBin),
        mineru_open_api_version: commandOutput(sources.mineruOpenApiBin, ['version']),
        python_root_name: pythonRootName,
        python_version: commandOutput(path.join(sources.pythonRoot, 'bin', 'python3'), ['--version']),
        python_runtime_fingerprint: directoryFingerprint(
          sources.pythonRoot,
          `python/${pythonRootName}`,
        ),
        implementation: buildLayerImplementationInput('toolchain'),
    },
    'domain-runtime': {
        framework_package_set: packageSet,
        source_fingerprints: domainSourceFingerprints(options),
        implementation: buildLayerImplementationInput('domain-runtime'),
    },
    'opl-runtime': {
        opl_commit: readGitHead(options.frameworkRoot),
        framework_runtime_fingerprint: directoryFingerprint(options.frameworkRoot, 'opl'),
        package_json_sha256: existingFileSha256(path.join(options.frameworkRoot, 'package.json')),
        package_lock_sha256: existingFileSha256(path.join(options.frameworkRoot, 'package-lock.json')),
        production_node_modules_fingerprint: productionNodeModulesFingerprint(options.frameworkRoot),
        tsconfig_sha256: existingFileSha256(path.join(options.frameworkRoot, 'tsconfig.json')),
        implementation: buildLayerImplementationInput('opl-runtime'),
    },
    skills: {
        framework_package_set_identity: packageSet.identity,
        opl_flow_commit: readGitHead(options.oplFlowRoot),
        opl_flow_workflow_policy_sha256: existingFileSha256(
          path.join(options.oplFlowRoot, 'contracts', 'workflow-policy.json'),
        ),
        app_product_profile_sha256: existingFileSha256(
          path.join(appRepoRoot, 'contracts', 'app-product-profile.json'),
        ),
        med_autoscience_skill_source: skillSourceSnapshot(masSkillCandidates(options), 'skills/med-autoscience'),
        med_autogrant_skill_source: skillSourceSnapshot(magSkillCandidates(options), 'skills/med-autogrant'),
        redcube_ai_skill_source: skillSourceSnapshot(rcaSkillCandidates(options), 'skills/redcube-ai'),
        meta_agent_skill_source: metaAgentSkillSnapshot(options),
        bookforge_skill_source: bookforgeSkillSnapshot(options),
        officecli_root_commit: readGitHead(options.officeCliRoot),
        officecli_core_source: officeCliCoreSkillSnapshot(options),
        officecli_docx_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-docx'), 'skills/officecli-docx'),
        officecli_pptx_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-pptx'), 'skills/officecli-pptx'),
        officecli_xlsx_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-xlsx'), 'skills/officecli-xlsx'),
        officecli_academic_paper_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-academic-paper'), 'skills/officecli-academic-paper'),
        officecli_data_dashboard_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-data-dashboard'), 'skills/officecli-data-dashboard'),
        officecli_financial_model_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-financial-model'), 'skills/officecli-financial-model'),
        officecli_pitch_deck_source: skillSourceSnapshot(officeCliSkillCandidates(options, 'officecli-pitch-deck'), 'skills/officecli-pitch-deck'),
        mineru_document_extractor_root_commit: readGitHead(options.mineruDocumentExtractorRoot),
        mineru_document_extractor_source: skillSourceSnapshot(mineruDocumentExtractorSkillCandidates(options), 'skills/mineru-document-extractor'),
        ui_ux_pro_max_root_commit: readGitHead(options.uiUxProMaxRoot),
        ui_ux_pro_max_fingerprint: directoryFingerprint(options.uiUxProMaxRoot, 'skills/ui-ux-pro-max'),
        skills_packager_sha256: existingFileSha256(
          path.join(appRepoRoot, 'scripts', 'build-full-first-install-package', 'skills.ts'),
        ),
        implementation: buildLayerImplementationInput('skills'),
    },
  };
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

export function buildRuntimeCacheContext(
  options,
  sources,
  packageProfile: FullRuntimePackageProfile = FULL_RUNTIME_STARTER_PROFILE,
) {
  const frameworkPackageSet = resolveFrameworkPackageSetInput(options, packageProfile);
  const layerKeyInputs = buildRuntimeCacheKeyInputs(options, sources, frameworkPackageSet, packageProfile);
  return {
    frameworkPackageSet,
    layerKeyInputs,
    layers: buildRuntimeCacheKeysFromInputs(layerKeyInputs),
  };
}

function cacheLayerArchivePath(options, layerId, key) {
  return buildFullRuntimeCacheArchivePath({
    cacheDir: options.runtimeCacheDir,
    layerId,
    key,
  });
}

export function buildRuntimeCacheKeyReport(
  options,
  sources,
  packageProfile: FullRuntimePackageProfile = FULL_RUNTIME_STARTER_PROFILE,
) {
  const { frameworkPackageSet, layerKeyInputs, layers } = buildRuntimeCacheContext(
    options,
    sources,
    packageProfile,
  );
  return {
    status: 'runtime_cache_keys',
    version: options.version,
    runtime_cache_mode: options.runtimeCacheMode,
    runtime_cache_dir: options.runtimeCacheDir || null,
    framework_package_set: frameworkPackageSet,
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
