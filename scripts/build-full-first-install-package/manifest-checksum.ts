import fs from 'node:fs';
import path from 'node:path';

import { buildFullPackageManifest } from '../full-first-install-package.ts';
import { FULL_RUNTIME_CACHE_LAYER_TAXONOMY } from '../full-first-install-package.ts';
import { directorySizeBytes } from './filesystem.ts';
import { readGitHead, readGitOriginUrl } from './git.ts';
import { existingFileSha256, packageJsonVersion } from './hashing.ts';
import { run } from './process.ts';
import { collectRuntimeAssertions } from './runtime-layers.ts';

const FRAMEWORK_BUNDLED_FULL_RUNTIME_CATALOG_REF =
  'contracts/opl-framework/bundled-full-runtime-package-catalog.json';
const MAS_PACKAGE_ID = 'mas';
const MAS_RUNTIME_MODULE_PATH = 'modules/mas';
const MAS_SCHOLAR_SKILLS_PACKAGE_ID = 'mas-scholar-skills';
const MAS_SCHOLAR_SKILLS_RUNTIME_MODULE_PATH = 'modules/mas-scholar-skills';
const MAS_SCHOLAR_SKILLS_SOURCE_MANIFEST_REF = 'contracts/opl_capability_package_manifest.json';

function objectValue(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Full runtime ${label} must be an object.`);
  }
  return value;
}

function stringValue(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Full runtime ${label} must be a non-empty string.`);
  }
  return value;
}

function assertMasScholarSkillsConsumer(manifest, label) {
  const primaryConsumer = objectValue(
    manifest.primary_consumer,
    `${label} primary_consumer`,
  );
  for (const [field, expected] of [
    ['agent_id', MAS_PACKAGE_ID],
    ['package_id', MAS_PACKAGE_ID],
    ['dependency_kind', 'hard_runtime_dependency'],
    ['required', true],
  ]) {
    if (primaryConsumer[field] !== expected) {
      throw new Error(
        `Full runtime ${label} primary_consumer.${field} drifted: expected ${String(expected)}, found ${String(primaryConsumer[field])}.`,
      );
    }
  }
  const consumerPolicy = objectValue(
    manifest.consumer_policy,
    `${label} consumer_policy`,
  );
  if (
    JSON.stringify(consumerPolicy.supported_required_by) !== JSON.stringify([MAS_PACKAGE_ID])
    || consumerPolicy.non_primary_runtime_dependency_supported !== false
  ) {
    throw new Error(
      `Full runtime ${label} consumer policy must keep MAS as the sole supported runtime dependency owner.`,
    );
  }
  return primaryConsumer;
}

function safeRelativePath(value, label) {
  const relativePath = stringValue(value, label);
  const normalized = path.posix.normalize(relativePath).replace(/^\.\//, '');
  if (
    normalized === ''
    || normalized === '.'
    || normalized === '..'
    || normalized.startsWith('../')
    || path.posix.isAbsolute(normalized)
  ) {
    throw new Error(`Full runtime ${label} is unsafe: ${relativePath}`);
  }
  return normalized;
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Full runtime ${label} is missing: ${filePath}`);
  }
  return filePath;
}

function sha256RefForFile(filePath, label) {
  const checksum = existingFileSha256(requireFile(filePath, label));
  if (!checksum) {
    throw new Error(`Full runtime ${label} checksum could not be read: ${filePath}`);
  }
  return `sha256:${checksum}`;
}

function assertFileChecksum(filePath, expectedChecksum, label) {
  const expected = stringValue(expectedChecksum, `${label} expected checksum`);
  const actual = sha256RefForFile(filePath, label);
  if (actual !== expected) {
    throw new Error(
      `Full runtime ${label} checksum drifted: expected ${expected}, found ${actual} at ${filePath}.`,
    );
  }
  return actual;
}

function frameworkCatalogPayloadPath(frameworkRoot, relativeRef, label) {
  const catalogRoot = path.join(frameworkRoot, 'contracts', 'opl-framework');
  const normalized = safeRelativePath(relativeRef, label);
  const resolved = path.resolve(catalogRoot, ...normalized.split('/'));
  if (resolved !== catalogRoot && !resolved.startsWith(`${catalogRoot}${path.sep}`)) {
    throw new Error(`Full runtime ${label} escapes the Framework catalog root: ${relativeRef}`);
  }
  return requireFile(resolved, label);
}

function readJsonFile(filePath, label) {
  try {
    return objectValue(JSON.parse(fs.readFileSync(filePath, 'utf8')), label);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Full runtime ${label} is not valid JSON: ${filePath}`);
    }
    throw error;
  }
}

function resolveRequestedGitCommit(sourceRoot, requestedRef, label) {
  const ref = stringValue(requestedRef, `${label} requested ref`);
  const result = run('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
    cwd: sourceRoot,
    capture: true,
  });
  const resolvedCommit = result.stdout.trim();
  if (!/^[0-9a-f]{40}$/i.test(resolvedCommit)) {
    throw new Error(`Full runtime ${label} ref ${ref} did not resolve to a commit.`);
  }
  return resolvedCommit;
}

export function resolveMasScholarSkillsFullRuntimeSource(options) {
  const sourceRoot = options.masScholarSkillsRoot;
  if (!sourceRoot || !fs.existsSync(sourceRoot) || !fs.statSync(sourceRoot).isDirectory()) {
    throw new Error(`Full runtime MAS Scholar Skills root is missing: ${sourceRoot || '<unset>'}`);
  }
  const sourceCommit = readGitHead(sourceRoot);
  if (!sourceCommit) {
    throw new Error(`Full runtime MAS Scholar Skills root has no readable git HEAD: ${sourceRoot}`);
  }
  const requestedRefCommit = resolveRequestedGitCommit(
    sourceRoot,
    options.masScholarSkillsRef,
    'MAS Scholar Skills',
  );
  if (requestedRefCommit !== sourceCommit) {
    throw new Error(
      `Full runtime MAS Scholar Skills checkout HEAD ${sourceCommit} does not match requested ref ${options.masScholarSkillsRef} (${requestedRefCommit}).`,
    );
  }

  const catalogPath = requireFile(
    path.join(options.frameworkRoot, ...FRAMEWORK_BUNDLED_FULL_RUNTIME_CATALOG_REF.split('/')),
    'Framework bundled package catalog',
  );
  const catalog = readJsonFile(catalogPath, 'Framework bundled package catalog');
  if (catalog.surface_kind !== 'opl_bundled_full_runtime_package_catalog.v1') {
    throw new Error(
      `Full runtime Framework bundled package catalog has unsupported surface_kind: ${String(catalog.surface_kind)}.`,
    );
  }
  const packages = objectValue(catalog.packages, 'Framework bundled package catalog packages');
  const masEntry = objectValue(
    packages[MAS_PACKAGE_ID],
    `Framework bundled package catalog entry ${MAS_PACKAGE_ID}`,
  );
  for (const [field, expected] of [
    ['package_id', MAS_PACKAGE_ID],
    ['package_role', 'standard_agent'],
    ['runtime_module_relative_path', MAS_RUNTIME_MODULE_PATH],
  ]) {
    if (masEntry[field] !== expected) {
      throw new Error(
        `Full runtime Framework catalog MAS ${field} drifted: expected ${expected}, found ${String(masEntry[field])}.`,
      );
    }
  }
  const masManifestRef = safeRelativePath(
    masEntry.manifest_ref,
    'Framework catalog MAS manifest_ref',
  );
  const masManifestPath = frameworkCatalogPayloadPath(
    options.frameworkRoot,
    masManifestRef,
    'MAS package manifest',
  );
  const masManifestSha256 = assertFileChecksum(
    masManifestPath,
    masEntry.manifest_sha256,
    'MAS package manifest',
  );
  const masManifest = readJsonFile(masManifestPath, 'MAS package manifest');
  for (const [field, expected] of [
    ['surface_kind', 'opl_agent_package_manifest.v1'],
    ['package_id', MAS_PACKAGE_ID],
    ['version', stringValue(masEntry.package_version, 'Framework catalog MAS package_version')],
  ]) {
    if (masManifest[field] !== expected) {
      throw new Error(
        `Full runtime MAS package manifest ${field} drifted: expected ${expected}, found ${String(masManifest[field])}.`,
      );
    }
  }
  if (!Array.isArray(masManifest.capability_dependencies)) {
    throw new Error('Full runtime MAS package manifest declares no capability_dependencies.');
  }
  const masScholarDependencies = masManifest.capability_dependencies.filter(
    (dependency) => dependency?.package_id === MAS_SCHOLAR_SKILLS_PACKAGE_ID,
  );
  const [masScholarDependency] = masScholarDependencies;
  if (
    masScholarDependencies.length !== 1
    || !masScholarDependency
    || typeof masScholarDependency !== 'object'
    || masScholarDependency.kind !== 'framework_capability_package'
    || masScholarDependency.required !== true
  ) {
    throw new Error(
      'Full runtime MAS package manifest must require MAS Scholar Skills exactly once as a framework capability package.',
    );
  }

  const entry = objectValue(
    packages[MAS_SCHOLAR_SKILLS_PACKAGE_ID],
    `Framework bundled package catalog entry ${MAS_SCHOLAR_SKILLS_PACKAGE_ID}`,
  );
  if (entry.package_id !== MAS_SCHOLAR_SKILLS_PACKAGE_ID) {
    throw new Error(`Full runtime Framework catalog MAS Scholar Skills package_id drifted: ${String(entry.package_id)}.`);
  }
  if (entry.package_role !== 'framework_capability_package') {
    throw new Error(`Full runtime Framework catalog MAS Scholar Skills package_role drifted: ${String(entry.package_role)}.`);
  }
  if (entry.runtime_module_relative_path !== MAS_SCHOLAR_SKILLS_RUNTIME_MODULE_PATH) {
    throw new Error(
      `Full runtime Framework catalog MAS Scholar Skills module path drifted: ${String(entry.runtime_module_relative_path)}.`,
    );
  }

  const ownerSourceCommit = stringValue(
    entry.owner_source_commit,
    'Framework catalog MAS Scholar Skills owner_source_commit',
  );
  if (sourceCommit !== ownerSourceCommit) {
    throw new Error(
      `Full runtime MAS Scholar Skills source is stale: checkout has ${sourceCommit}, Framework catalog requires ${ownerSourceCommit}.`,
    );
  }

  const manifestRef = safeRelativePath(entry.manifest_ref, 'Framework catalog MAS Scholar Skills manifest_ref');
  const manifestPath = frameworkCatalogPayloadPath(options.frameworkRoot, manifestRef, 'MAS Scholar Skills package manifest');
  const manifestSha256 = assertFileChecksum(
    manifestPath,
    entry.manifest_sha256,
    'MAS Scholar Skills package manifest',
  );
  const packageManifest = readJsonFile(manifestPath, 'MAS Scholar Skills package manifest');
  for (const [field, expected] of [
    ['surface_kind', 'opl_capability_package_manifest.v2'],
    ['package_id', MAS_SCHOLAR_SKILLS_PACKAGE_ID],
    ['package_role', 'required_agent_capability_package'],
    ['version', stringValue(entry.package_version, 'Framework catalog MAS Scholar Skills package_version')],
  ]) {
    if (packageManifest[field] !== expected) {
      throw new Error(
        `Full runtime MAS Scholar Skills package manifest ${field} drifted: expected ${expected}, found ${String(packageManifest[field])}.`,
      );
    }
  }
  const primaryConsumer = assertMasScholarSkillsConsumer(
    packageManifest,
    'MAS Scholar Skills package manifest',
  );
  for (const field of ['version_requirement', 'capability_abi']) {
    const dependencyValue = stringValue(
      masScholarDependency[field],
      `MAS package manifest Scholar Skills dependency ${field}`,
    );
    if (primaryConsumer[field] !== dependencyValue) {
      throw new Error(
        `Full runtime MAS Scholar Skills package manifest primary_consumer.${field} drifted: expected ${dependencyValue}, found ${String(primaryConsumer[field])}.`,
      );
    }
  }
  const payloadManifestRef = safeRelativePath(
    entry.payload_manifest_ref,
    'Framework catalog MAS Scholar Skills payload_manifest_ref',
  );
  const payloadManifestPath = frameworkCatalogPayloadPath(
    options.frameworkRoot,
    payloadManifestRef,
    'MAS Scholar Skills payload manifest',
  );
  const payloadManifestSha256 = assertFileChecksum(
    payloadManifestPath,
    entry.payload_manifest_sha256,
    'MAS Scholar Skills payload manifest',
  );
  const payloadManifest = readJsonFile(payloadManifestPath, 'MAS Scholar Skills payload manifest');
  if (payloadManifest.surface_kind !== 'opl_package_payload_manifest.v2') {
    throw new Error(
      `Full runtime MAS Scholar Skills payload manifest has unsupported surface_kind: ${String(payloadManifest.surface_kind)}.`,
    );
  }
  for (const [field, expected] of [
    ['package_id', MAS_SCHOLAR_SKILLS_PACKAGE_ID],
    ['package_version', stringValue(entry.package_version, 'Framework catalog MAS Scholar Skills package_version')],
    ['source_commit', ownerSourceCommit],
  ]) {
    if (payloadManifest[field] !== expected) {
      throw new Error(
        `Full runtime MAS Scholar Skills payload manifest ${field} drifted: expected ${expected}, found ${String(payloadManifest[field])}.`,
      );
    }
  }
  if (!Array.isArray(payloadManifest.files) || payloadManifest.files.length === 0) {
    throw new Error('Full runtime MAS Scholar Skills payload manifest declares no files.');
  }

  const payloadFiles = payloadManifest.files.map((fileEntry, index) => {
    const payloadFile = objectValue(fileEntry, `MAS Scholar Skills payload manifest files[${index}]`);
    const relativePath = safeRelativePath(
      payloadFile.path,
      `MAS Scholar Skills payload manifest files[${index}].path`,
    );
    const expectedSha256 = stringValue(
      payloadFile.sha256,
      `MAS Scholar Skills payload manifest files[${index}].sha256`,
    );
    const sourcePath = path.join(sourceRoot, ...relativePath.split('/'));
    assertFileChecksum(
      sourcePath,
      expectedSha256,
      `MAS Scholar Skills source payload ${relativePath}`,
    );
    return { path: relativePath, sha256: expectedSha256 };
  });
  const payloadPaths = payloadFiles.map((entry) => entry.path);
  if (new Set(payloadPaths).size !== payloadPaths.length) {
    throw new Error('Full runtime MAS Scholar Skills payload manifest contains duplicate paths.');
  }

  const sourceManifestPath = requireFile(
    path.join(sourceRoot, ...MAS_SCHOLAR_SKILLS_SOURCE_MANIFEST_REF.split('/')),
    'MAS Scholar Skills owner capability manifest',
  );
  const sourceManifest = readJsonFile(sourceManifestPath, 'MAS Scholar Skills owner capability manifest');
  if (sourceManifest.surface_kind !== 'opl_capability_package_manifest.v2') {
    throw new Error(
      `Full runtime MAS Scholar Skills owner manifest surface_kind drifted: ${String(sourceManifest.surface_kind)}.`,
    );
  }
  if (sourceManifest.package_id !== MAS_SCHOLAR_SKILLS_PACKAGE_ID) {
    throw new Error(`Full runtime MAS Scholar Skills owner manifest package_id drifted: ${String(sourceManifest.package_id)}.`);
  }
  if (sourceManifest.version !== entry.package_version) {
    throw new Error(
      `Full runtime MAS Scholar Skills owner manifest version drifted: expected ${String(entry.package_version)}, found ${String(sourceManifest.version)}.`,
    );
  }
  const sourcePrimaryConsumer = assertMasScholarSkillsConsumer(
    sourceManifest,
    'MAS Scholar Skills owner manifest',
  );
  for (const field of ['version_requirement', 'capability_abi']) {
    if (sourcePrimaryConsumer[field] !== primaryConsumer[field]) {
      throw new Error(
        `Full runtime MAS Scholar Skills owner manifest primary_consumer.${field} drifted from the Framework package manifest.`,
      );
    }
  }
  const contentLock = objectValue(sourceManifest.content_lock, 'MAS Scholar Skills owner manifest content_lock');
  const payloadContentLock = objectValue(
    payloadManifest.content_lock,
    'MAS Scholar Skills payload manifest content_lock',
  );
  for (const field of ['algorithm', 'canonicalization', 'digest']) {
    const ownerValue = stringValue(contentLock[field], `MAS Scholar Skills owner manifest content_lock.${field}`);
    const payloadValue = stringValue(
      payloadContentLock[field],
      `MAS Scholar Skills payload manifest content_lock.${field}`,
    );
    if (payloadValue !== ownerValue) {
      throw new Error(
        `Full runtime MAS Scholar Skills content_lock.${field} drifted: owner has ${ownerValue}, payload manifest has ${payloadValue}.`,
      );
    }
  }
  if (!Array.isArray(contentLock.paths) || JSON.stringify(contentLock.paths) !== JSON.stringify(payloadPaths)) {
    throw new Error('Full runtime MAS Scholar Skills owner content_lock paths drifted from the Framework payload manifest.');
  }

  return {
    package_id: MAS_SCHOLAR_SKILLS_PACKAGE_ID,
    package_role: entry.package_role,
    package_version: entry.package_version,
    source_path: sourceRoot,
    source_commit: sourceCommit,
    requested_ref: options.masScholarSkillsRef,
    requested_ref_commit: requestedRefCommit,
    owner_source_commit: ownerSourceCommit,
    runtime_module_relative_path: MAS_SCHOLAR_SKILLS_RUNTIME_MODULE_PATH,
    framework_catalog_ref: FRAMEWORK_BUNDLED_FULL_RUNTIME_CATALOG_REF,
    framework_catalog_source_path: catalogPath,
    mas_manifest_ref: masManifestRef,
    mas_manifest_sha256: masManifestSha256,
    manifest_ref: manifestRef,
    manifest_sha256: manifestSha256,
    payload_manifest_ref: payloadManifestRef,
    payload_manifest_sha256: payloadManifestSha256,
    source_manifest_ref: MAS_SCHOLAR_SKILLS_SOURCE_MANIFEST_REF,
    source_manifest_sha256: sha256RefForFile(sourceManifestPath, 'MAS Scholar Skills owner capability manifest'),
    content_lock_digest: stringValue(contentLock.digest, 'MAS Scholar Skills owner manifest content_lock.digest'),
    payload_file_count: payloadPaths.length,
    payload_files: payloadFiles,
    checksum_status: 'verified',
    currentness_status: 'current',
    currentness: {
      source_commit_matches_framework_catalog: true,
      package_version_matches_framework_catalog: true,
      mas_dependency_edge_matches_framework_catalog: true,
      primary_consumer_matches_mas: true,
      catalog_manifest_checksums_verified: true,
      source_payload_checksums_verified: true,
      owner_content_lock_paths_match_payload_manifest: true,
    },
  };
}

export function assertMasScholarSkillsRuntimePayload(runtimeRoot, resolution) {
  const moduleRoot = path.join(
    runtimeRoot,
    ...resolution.runtime_module_relative_path.split('/'),
  );
  if (!fs.existsSync(moduleRoot) || !fs.statSync(moduleRoot).isDirectory()) {
    throw new Error(`Full runtime MAS Scholar Skills module root is missing: ${moduleRoot}`);
  }
  assertFileChecksum(
    path.join(moduleRoot, ...resolution.source_manifest_ref.split('/')),
    resolution.source_manifest_sha256,
    'packaged MAS Scholar Skills owner capability manifest',
  );
  for (const payloadFile of resolution.payload_files) {
    assertFileChecksum(
      path.join(moduleRoot, ...payloadFile.path.split('/')),
      payloadFile.sha256,
      `packaged MAS Scholar Skills payload ${payloadFile.path}`,
    );
  }
  return {
    runtime_module_relative_path: resolution.runtime_module_relative_path,
    payload_file_count: resolution.payload_files.length,
    checksum_status: 'verified',
  };
}

export function buildResolvedFullPayloadRefs(options, sources, components, sourceResolutions = {}) {
  const mineruRepoRoot = sources.mineruRepoRoot || options.mineruRoot;
  const masScholarSkills = sourceResolutions.masScholarSkills
    ?? resolveMasScholarSkillsFullRuntimeSource(options);
  return {
    opl_framework: {
      label: 'OPL Framework',
      source_path: options.frameworkRoot,
      repository: readGitOriginUrl(options.frameworkRoot) || 'gaofeng21cn/one-person-lab',
      requested_ref: options.frameworkRef || 'main',
      resolved_commit: components.opl?.git_commit ?? readGitHead(options.frameworkRoot),
    },
    opl_runtime_environment_substrate: {
      label: 'OPL Runtime Environment Substrate',
      source_path: path.join(options.frameworkRoot, 'contracts', 'opl-framework', 'runtime-environment-substrate-contract.json'),
      repository: readGitOriginUrl(options.frameworkRoot) || 'gaofeng21cn/one-person-lab',
      requested_ref: options.frameworkRef || 'main',
      resolved_commit: components.opl?.git_commit ?? readGitHead(options.frameworkRoot),
      contract_path: 'contracts/opl-framework/runtime-environment-substrate-contract.json',
      readback_commands: [
        'opl runtime env contract --json',
        'opl runtime env build --domain <domain> --profile <profile> --platform <platform> --json',
        'opl runtime env materialize --domain <domain> --profile <profile> --platform <platform> --dry-run --json',
        'opl runtime env run-context --domain <domain> --profile <profile> --platform <platform> --json',
      ],
    },
    mas: {
      label: 'MAS',
      source_path: options.masRoot,
      repository: readGitOriginUrl(options.masRoot) || 'gaofeng21cn/med-autoscience',
      requested_ref: options.masRef,
      resolved_commit: components.mas?.git_commit ?? readGitHead(options.masRoot),
    },
    mas_scholar_skills: {
      label: 'MAS Scholar Skills',
      source_path: options.masScholarSkillsRoot,
      repository: readGitOriginUrl(options.masScholarSkillsRoot) || 'gaofeng21cn/mas-scholar-skills',
      requested_ref: options.masScholarSkillsRef,
      requested_ref_commit: masScholarSkills.requested_ref_commit,
      resolved_commit: masScholarSkills.source_commit,
      package_role: masScholarSkills.package_role,
      package_version: masScholarSkills.package_version,
      owner_source_commit: masScholarSkills.owner_source_commit,
      runtime_module_relative_path: masScholarSkills.runtime_module_relative_path,
      framework_catalog_ref: masScholarSkills.framework_catalog_ref,
      mas_manifest_ref: masScholarSkills.mas_manifest_ref,
      mas_manifest_sha256: masScholarSkills.mas_manifest_sha256,
      manifest_ref: masScholarSkills.manifest_ref,
      manifest_sha256: masScholarSkills.manifest_sha256,
      payload_manifest_ref: masScholarSkills.payload_manifest_ref,
      payload_manifest_sha256: masScholarSkills.payload_manifest_sha256,
      source_manifest_ref: masScholarSkills.source_manifest_ref,
      source_manifest_sha256: masScholarSkills.source_manifest_sha256,
      content_lock_digest: masScholarSkills.content_lock_digest,
      payload_file_count: masScholarSkills.payload_file_count,
      checksum_status: masScholarSkills.checksum_status,
      currentness_status: masScholarSkills.currentness_status,
      currentness: masScholarSkills.currentness,
    },
    mag: {
      label: 'MAG',
      source_path: options.magRoot,
      repository: readGitOriginUrl(options.magRoot) || 'gaofeng21cn/med-autogrant',
      requested_ref: options.magRef,
      resolved_commit: components.mag?.git_commit ?? readGitHead(options.magRoot),
    },
    rca: {
      label: 'RCA',
      source_path: options.rcaRoot,
      repository: readGitOriginUrl(options.rcaRoot) || 'gaofeng21cn/redcube-ai',
      requested_ref: options.rcaRef,
      resolved_commit: components.rca?.git_commit ?? readGitHead(options.rcaRoot),
    },
    opl_meta_agent: {
      label: 'OPL Meta Agent',
      source_path: options.metaAgentRoot,
      repository: readGitOriginUrl(options.metaAgentRoot) || 'gaofeng21cn/opl-meta-agent',
      requested_ref: options.metaAgentRef,
      resolved_commit: components.meta_agent?.git_commit ?? readGitHead(options.metaAgentRoot),
    },
    opl_bookforge: {
      label: 'OPL Book Forge',
      source_path: options.bookforgeRoot,
      repository: readGitOriginUrl(options.bookforgeRoot) || 'gaofeng21cn/opl-bookforge',
      requested_ref: options.bookforgeRef,
      resolved_commit: components.bookforge?.git_commit ?? readGitHead(options.bookforgeRoot),
    },
    opl_flow: {
      label: 'OPL Flow',
      source_path: options.oplFlowRoot,
      repository: readGitOriginUrl(options.oplFlowRoot) || 'gaofeng21cn/opl-flow',
      requested_ref: options.oplFlowRef,
      resolved_commit: components.opl_flow?.git_commit ?? readGitHead(options.oplFlowRoot),
      package_kind: 'workflow_plugin_package',
    },
    officecli: {
      label: 'OfficeCLI',
      source_path: options.officeCliRoot,
      repository: readGitOriginUrl(options.officeCliRoot) || 'iOfficeAI/OfficeCLI',
      requested_ref: options.officeCliRelease?.requested_ref ?? options.officeCliRef,
      resolved_ref: options.officeCliRelease?.resolved_ref ?? options.officeCliRef,
      resolved_commit: options.officeCliRelease?.resolved_commit ?? readGitHead(options.officeCliRoot),
      latest_stable_verified: options.officeCliRelease?.latest_stable_verified ?? false,
      source_policy: options.officeCliRelease?.policy ?? 'unverified',
      package_unit: 'atomic_upstream_release',
      owner: 'iOfficeAI/OfficeCLI',
      bundled_skill_ids: [
        'officecli',
        'officecli-docx',
        'officecli-pptx',
        'officecli-xlsx',
        'officecli-academic-paper',
        'officecli-data-dashboard',
        'officecli-financial-model',
        'officecli-pitch-deck',
      ],
      version: components.officecli?.version ?? null,
    },
    mineru: {
      label: 'MinerU',
      source_path: mineruRepoRoot,
      repository: 'opendatalab/MinerU-Ecosystem',
      requested_ref: options.mineruRef,
      resolved_commit: readGitHead(mineruRepoRoot),
      version: components.mineru_open_api?.version ?? null,
    },
    ui_ux_skill: {
      label: 'UI UX skill',
      source_path: options.uiUxProMaxRoot,
      repository: readGitOriginUrl(options.uiUxProMaxRoot) || 'nextlevelbuilder/ui-ux-pro-max-skill',
      requested_ref: options.uiUxProMaxRef,
      resolved_commit: readGitHead(options.uiUxProMaxRoot),
    },
  };
}

function directoryChildSizes(root) {
  if (!fs.existsSync(root)) {
    return {};
  }
  return Object.fromEntries(
    fs.readdirSync(root)
      .sort()
      .map((entry) => [
        entry,
        {
          relative_path: entry,
          size_bytes: directorySizeBytes(path.join(root, entry)),
        },
      ]),
  );
}

function sizeBreakdownEntry(runtimeRoot, relativePath, children = undefined) {
  const absolutePath = path.join(runtimeRoot, ...relativePath.split('/').filter(Boolean));
  return {
    relative_path: relativePath,
    size_bytes: directorySizeBytes(absolutePath),
    ...(children ? { children } : {}),
  };
}

function collectFullRuntimeSizeBreakdown(runtimeRoot) {
  return {
    measurement_policy: 'uncompressed_file_bytes_after_full_runtime_pruning',
    total_runtime_uncompressed_bytes: directorySizeBytes(runtimeRoot),
    opl_layer_taxonomy: FULL_RUNTIME_CACHE_LAYER_TAXONOMY,
    layers: {
      toolchain: {
        relative_paths: ['bin', 'node', 'python', 'uv', 'vendor'],
        size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin'))
          + directorySizeBytes(path.join(runtimeRoot, 'node'))
          + directorySizeBytes(path.join(runtimeRoot, 'python'))
          + directorySizeBytes(path.join(runtimeRoot, 'uv'))
          + directorySizeBytes(path.join(runtimeRoot, 'vendor')),
        children: {
          bin: sizeBreakdownEntry(runtimeRoot, 'bin', directoryChildSizes(path.join(runtimeRoot, 'bin'))),
          node: sizeBreakdownEntry(runtimeRoot, 'node'),
          python: sizeBreakdownEntry(runtimeRoot, 'python'),
          uv: sizeBreakdownEntry(runtimeRoot, 'uv'),
          vendor: sizeBreakdownEntry(runtimeRoot, 'vendor', directoryChildSizes(path.join(runtimeRoot, 'vendor'))),
        },
      },
      'domain-runtime': sizeBreakdownEntry(runtimeRoot, 'modules', directoryChildSizes(path.join(runtimeRoot, 'modules'))),
      'opl-runtime': sizeBreakdownEntry(runtimeRoot, 'opl', {
        'node_modules': sizeBreakdownEntry(runtimeRoot, 'opl/node_modules'),
      }),
      skills: sizeBreakdownEntry(runtimeRoot, 'skills', directoryChildSizes(path.join(runtimeRoot, 'skills'))),
    },
  };
}

export function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertOfflineRequiredPayloadsPresent(runtimeAssertions) {
  const missingPayloads = (runtimeAssertions.offline_required_payloads ?? []).filter((entry) => {
    if (entry.exists !== true) return true;
    return Object.prototype.hasOwnProperty.call(entry, 'executable') && entry.executable !== true;
  });
  if (missingPayloads.length > 0) {
    throw new Error(
      [
        'Full runtime package is missing required offline payload(s):',
        ...missingPayloads.map((entry) =>
          Object.prototype.hasOwnProperty.call(entry, 'executable') && entry.executable !== true
            ? `  - ${entry.path} (not executable)`
            : `  - ${entry.path}`,
        ),
      ].join('\n'),
    );
  }
}

export function writeFullRuntimeManifest(runtimeRoot, options, packagedAt, components, resolvedRefs, optionalComponents = {}, nativeTrust = undefined) {
  const manifestDir = path.join(runtimeRoot, 'manifest');
  const manifestPath = path.join(manifestDir, 'full-package-manifest.json');
  fs.mkdirSync(manifestDir, { recursive: true });

  const runtimeAssertions = collectRuntimeAssertions(runtimeRoot);
  assertOfflineRequiredPayloadsPresent(runtimeAssertions);
  let manifest = buildFullPackageManifest({
    version: options.version,
    generatedAt: packagedAt,
    components,
    optionalComponents,
    resolvedRefs,
    runtimeAssertions,
    nativeTrust,
  });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const sizeBreakdown = collectFullRuntimeSizeBreakdown(runtimeRoot);
    const nextRuntimeAssertions = collectRuntimeAssertions(runtimeRoot);
    assertOfflineRequiredPayloadsPresent(nextRuntimeAssertions);
    const nextManifest = buildFullPackageManifest({
      version: options.version,
      generatedAt: packagedAt,
      components,
      optionalComponents,
      resolvedRefs,
      runtimeAssertions: nextRuntimeAssertions,
      nativeTrust,
      sizeBreakdown,
    });
    fs.writeFileSync(manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, 'utf8');

    if (JSON.stringify(sizeBreakdown) === JSON.stringify(collectFullRuntimeSizeBreakdown(runtimeRoot))) {
      return nextManifest;
    }
    manifest = nextManifest;
  }

  throw new Error('Full runtime manifest size_breakdown did not stabilize.');
}

export function writeChecksums(outDir, files) {
  const lines = files.map((filePath) => {
    const result = run('shasum', ['-a', '256', filePath], { capture: true });
    const hash = result.stdout.trim().split(/\s+/)[0];
    return `${hash}  ${path.basename(filePath)}`;
  });
  const checksumPath = path.join(outDir, 'SHA256SUMS.txt');
  fs.writeFileSync(checksumPath, `${lines.join('\n')}\n`, 'utf8');
  return checksumPath;
}
