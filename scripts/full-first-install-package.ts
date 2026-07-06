import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  formatCodexProfilePhrase,
  formatRecommendedCompanionSkills,
} from './app-product-profile.ts';
import { readAppProductProfile } from './app-product-profile/profile-contract.ts';

export const FULL_FIRST_INSTALL_OUTPUT_DIR = '/Users/gaofeng/Downloads/One-Person-Lab-Full-First-Install';
export const FULL_RELEASE_OUTPUT_DIR = 'dist/opl-full-release';
export const FULL_RUNTIME_RESOURCE_DIR = 'opl-full-runtime';
export const PACKAGED_MODULE_MARKER_FILE = 'opl-runtime-module.json';
const FULL_RUNTIME_CACHE_LAYOUT_VERSION = 1;
export const FULL_RUNTIME_CACHE_LAYER_IDS = ['toolchain', 'domain-runtime', 'opl-runtime', 'skills'] as const;
const OPL_RUNTIME_BUNDLE_LAYER_IDS = [
  'base-toolchain',
  'python-wheelhouse',
  'opl-framework-runtime',
  'domain-pack',
  'companion-skills',
  'optional-heavy-tools',
] as const;
export const FULL_RUNTIME_CACHE_LAYER_TAXONOMY = {
  canonical_layer_ids: OPL_RUNTIME_BUNDLE_LAYER_IDS,
  legacy_assembly_layer_mapping: {
    toolchain: ['base-toolchain', 'python-wheelhouse', 'optional-heavy-tools'],
    'domain-runtime': ['domain-pack'],
    'opl-runtime': ['opl-framework-runtime'],
    skills: ['companion-skills'],
  },
} as const;
const RUNTIME_FABRIC_BUNDLE_TAXONOMY = {
  'execution-core.bundle': {
    display_name: 'Agent Execution Core',
    components: ['codex', 'temporal_cli', 'opl'],
    cache_layers: ['base-toolchain', 'opl-framework-runtime'],
    smoke: 'Codex and Temporal wrapper version checks plus OPL CLI startup smoke',
  },
  'environment-materializer.bundle': {
    display_name: 'Environment Materializer',
    components: ['node', 'python', 'uv'],
    cache_layers: ['base-toolchain', 'python-wheelhouse'],
    materializer_parts: {
      language_runtimes: ['node', 'python'],
      package_and_env_resolvers: ['uv'],
      env_cache_and_isolated_prefix: 'runtime/current/.runtime-cache plus module-specific managed env roots',
      optional_resolver_slots: ['pixi_for_scientific_native_stack_when_declared'],
    },
    smoke: 'Node, Python, and uv version checks plus resolver/cache receipt presence',
  },
  'system-bridge.bundle': {
    display_name: 'OPL System Bridge',
    components: ['native_helper'],
    cache_layers: [],
    smoke: 'Native helper doctor/runtime-watch/indexer protocol smoke when helper is present',
  },
} as const;
const OPL_RUNTIME_BUNDLE_SOURCE_SURFACE = {
  contract_ref: 'gaofeng21cn/one-person-lab/contracts/opl-framework/runtime-environment-substrate-contract.json',
  readback_command_refs: {
    contract: 'opl runtime env contract --json',
    build: 'opl runtime env build --domain <domain> --profile <profile> --platform <platform> --json',
    materialize_dry_run: 'opl runtime env materialize --domain <domain> --profile <profile> --platform <platform> --dry-run --json',
    run_context: 'opl runtime env run-context --domain <domain> --profile <profile> --platform <platform> --json',
  },
  required_readback_claim_fields: [
    'implementation_status',
    'target_planned',
    'dry_run',
    'can_claim_runtime_ready',
    'can_claim_domain_ready',
    'can_claim_app_release_ready',
  ],
} as const;
const OPL_RUNTIME_BUNDLE_CONSUMER_CONTRACT = {
  schema: 'opl_runtime_bundle_manifest_consumer.v1',
  app_repo_role: 'consumer_only',
  truth_owner: 'gaofeng21cn/one-person-lab',
  dependency_truth_owner: false,
  source_surface: OPL_RUNTIME_BUNDLE_SOURCE_SURFACE,
  consumed_refs: {
    bundle_manifest: 'OPL runtime bundle manifest',
    bundle_lock: 'OPL runtime bundle lock',
    bundle_readback: 'OPL runtime env contract/readback',
    env_contract: 'OPL runtime env contract',
  },
  false_ready_flags: {
    cache_hit_is_release_ready: false,
    manifest_present_is_release_ready: false,
    lock_present_is_release_ready: false,
    full_package_built_is_release_ready: false,
    full_package_built_is_family_production_ready: false,
    app_can_claim_runtime_dependency_truth: false,
  },
  consumption_boundary: {
    records_refs_only: true,
    keeps_full_offline_first_install_payloads: true,
    can_delete_required_offline_payloads_for_size: false,
    can_materialize_runtime_root: false,
    can_claim_runtime_ready: false,
    can_claim_app_release_ready: false,
    can_claim_family_production_ready: false,
  },
  layer_taxonomy: FULL_RUNTIME_CACHE_LAYER_TAXONOMY,
  runtime_fabric_bundle_taxonomy: RUNTIME_FABRIC_BUNDLE_TAXONOMY,
} as const;
const FULL_RUNTIME_CACHE_AGGREGATE_KEY_SCHEMA = 'opl_full_runtime_cache_aggregate_key.v1';
const FULL_PACKAGE_SIZE_BUDGET = {
  platform_scope: 'macos-arm64',
  warning_full_dmg_bytes: 700000000,
  max_full_dmg_bytes: 750000000,
  max_runtime_uncompressed_bytes: 1000000000,
} as const;
const FULL_PACKAGE_MEASUREMENT_POLICY = {
  full_dmg_bytes: 'github_release_asset_size_bytes',
  runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
} as const;

const FULL_RUNTIME_PRUNE_POLICY_SCHEMA = 'opl_full_runtime_prune_policy.v1';
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FULL_RUNTIME_PRUNE_POLICY_PATH = path.join(appRoot, 'contracts', 'full-runtime-prune-policy.json');

export type FullRuntimeCacheLayerId = typeof FULL_RUNTIME_CACHE_LAYER_IDS[number];

type ComponentSnapshot = Partial<{
  source_path: string;
  version: string | null;
  git_commit: string | null;
  size_bytes: number;
  truth_owner: string;
  binary_path: string | null;
  archive_path: string | null;
  archive_size_bytes: number | null;
  required: boolean;
  status: string;
}>;

type ResolvedFullPayloadRefs = Record<string, Partial<{
  label: string;
  source_path: string | null;
  repository: string;
  requested_ref: string | null;
  resolved_commit: string | null;
  version: string | null;
  contract_path: string;
  readback_commands: string[];
}>>;

type FullPackageManifestInput = Partial<{
  version: string;
  generatedAt: string;
  components: Record<string, ComponentSnapshot>;
  optionalComponents: Record<string, ComponentSnapshot>;
  resolvedRefs: ResolvedFullPayloadRefs;
  sizeBreakdown: unknown;
  runtimeAssertions: unknown;
  nativeTrust: unknown;
}>;

function normalizeVersion(version?: string) {
  return version?.trim() || process.env.OPL_RELEASE_VERSION?.trim() || '26.5.1';
}

function normalizeComponent(input: ComponentSnapshot | undefined) {
  return {
    source_path: input?.source_path ?? null,
    version: input?.version ?? null,
    git_commit: input?.git_commit ?? null,
    size_bytes: input?.size_bytes ?? null,
  };
}

function normalizeOptionalComponent(input: ComponentSnapshot | undefined) {
  return {
    ...normalizeComponent(input),
    status: input?.status ?? 'not_packaged',
  };
}

function buildRuntimeFabricBundles(components: Record<string, ComponentSnapshot>) {
  return Object.fromEntries(
    Object.entries(RUNTIME_FABRIC_BUNDLE_TAXONOMY).map(([bundleId, bundle]) => [
      bundleId,
      {
        ...bundle,
        receipt_fields: ['components', 'cache_layers', 'smoke', 'sha256', 'rollback_ref'],
        packaged_components: Object.fromEntries(
          bundle.components.map((componentId) => [componentId, normalizeComponent(components[componentId])]),
        ),
      },
    ]),
  );
}

export function buildFullPackageArtifactNames(versionInput: string) {
  const version = normalizeVersion(versionInput);
  return {
    dmg: `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    runtimeTar: `opl-runtime-full-${version}-macos-arm64.tar.zst`,
    checksums: 'SHA256SUMS.txt',
    readme: 'README-Full-First-Install.txt',
    manifest: 'full-package-manifest.json',
    releaseManifest: 'opl-release-manifest.json',
    runtimeCacheEvents: 'runtime-cache-events.json',
  };
}

export function buildFullRuntimeCacheKey(input: {
  layerId: FullRuntimeCacheLayerId;
  parts: Record<string, unknown>;
}) {
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify({
      layout_version: FULL_RUNTIME_CACHE_LAYOUT_VERSION,
      layer_id: input.layerId,
      parts: input.parts,
    }))
    .digest('hex')
    .slice(0, 24);
  return `full-runtime-v${FULL_RUNTIME_CACHE_LAYOUT_VERSION}-${input.layerId}-${digest}`;
}

export function buildFullRuntimeAggregateCacheKeyInput(input: {
  layers: Record<FullRuntimeCacheLayerId, string>;
}) {
  return {
    schema: FULL_RUNTIME_CACHE_AGGREGATE_KEY_SCHEMA,
    layout_version: FULL_RUNTIME_CACHE_LAYOUT_VERSION,
    layer_ids: FULL_RUNTIME_CACHE_LAYER_IDS,
    opl_runtime_bundle_consumer: OPL_RUNTIME_BUNDLE_CONSUMER_CONTRACT,
    layers: input.layers,
  } as const;
}

function buildFullRuntimeCacheArchiveName(input: {
  layerId: FullRuntimeCacheLayerId;
  key: string;
}) {
  return `${input.key}.tar.zst`;
}

export function buildFullRuntimeCacheArchivePath(input: {
  cacheDir: string;
  layerId: FullRuntimeCacheLayerId;
  key: string;
}) {
  return path.join(
    input.cacheDir,
    input.layerId,
    buildFullRuntimeCacheArchiveName({ layerId: input.layerId, key: input.key }),
  );
}

export function classifyFullRuntimeLayerCache(input: {
  mode: 'readwrite' | 'readonly' | 'off';
  cacheDir: string | null;
  layerId: FullRuntimeCacheLayerId;
  key: string;
  archiveExists: boolean;
}) {
  const enabled = input.mode !== 'off' && Boolean(input.cacheDir);
  const archivePath = input.cacheDir
    ? buildFullRuntimeCacheArchivePath({
        cacheDir: input.cacheDir,
        layerId: input.layerId,
        key: input.key,
      })
    : null;

  if (!enabled) {
    return {
      layer_id: input.layerId,
      key: input.key,
      status: 'disabled',
      archive_path: null,
      read_archive: false,
      write_archive: false,
      build_layer: true,
    } as const;
  }

  if (input.archiveExists) {
    return {
      layer_id: input.layerId,
      key: input.key,
      status: 'hit',
      archive_path: archivePath,
      read_archive: true,
      write_archive: false,
      build_layer: false,
    } as const;
  }

  return {
    layer_id: input.layerId,
    key: input.key,
    status: input.mode === 'readwrite' ? 'miss_written' : 'miss_readonly',
    archive_path: archivePath,
    read_archive: false,
    write_archive: input.mode === 'readwrite',
    build_layer: true,
  } as const;
}

export function buildFullPackageManifest(input: FullPackageManifestInput = {}) {
  const version = normalizeVersion(input.version);
  const components = input.components ?? {};
  const optionalComponents = input.optionalComponents ?? {};
  const productProfile = readAppProductProfile();

  return {
    manifest_version: 2,
    package_kind: 'opl_full_first_install_macos_arm64',
    version,
    arch: 'macos-arm64',
    generated_at: input.generatedAt ?? new Date().toISOString(),
    size_budget: FULL_PACKAGE_SIZE_BUDGET,
    measurement_policy: FULL_PACKAGE_MEASUREMENT_POLICY,
    runtime_prune_policy: FULL_RUNTIME_PRUNE_POLICY,
    runtime_assertions: input.runtimeAssertions ?? {
      prune_policy_id: FULL_RUNTIME_PRUNE_POLICY.id,
      prune_policy_hash: buildFullRuntimePrunePolicyHash(),
      temporal_core_bridge_releases: [],
      excluded_module_venv_count: 0,
      packaged_global_node_packages: [],
      offline_required_payloads: [],
      declared_pruned_paths: [],
    },
    native_trust: input.nativeTrust ?? {
      schema: 'opl_full_runtime_native_trust.v1',
      status: 'not_checked',
      executable_count: 0,
      executables: [],
    },
    opl_runtime_bundle_consumer: OPL_RUNTIME_BUNDLE_CONSUMER_CONTRACT,
    runtime_fabric_bundles: buildRuntimeFabricBundles(components),
    size_breakdown: input.sizeBreakdown ?? {
      total_runtime_uncompressed_bytes: 0,
      opl_layer_taxonomy: FULL_RUNTIME_CACHE_LAYER_TAXONOMY,
      layers: {
        toolchain: { size_bytes: 0 },
        'domain-runtime': { size_bytes: 0 },
        'opl-runtime': { size_bytes: 0 },
        skills: { size_bytes: 0 },
      },
    },
    resolved_refs: input.resolvedRefs ?? {},
    runtime: {
      layout_version: 1,
      payload_resource_dir: FULL_RUNTIME_RESOURCE_DIR,
      install_root_template: '~/Library/Application Support/OPL/runtime/current',
      installed_runtime_path: '~/Library/Application Support/OPL/runtime/current',
      active_pointer_path: '~/Library/Application Support/OPL/runtime/current.json',
      version_metadata_path: '~/Library/Application Support/OPL/runtime/current/.opl-full-runtime-installed.json',
      app_uses_installed_runtime_after_first_launch: true,
      runtime_version_stored_in_metadata_only: true,
      state_policy: 'user_state_stays_outside_runtime_payload',
      domain_module_payload_policy: 'packaged_runtime_modules_are_launch_sources; managed repo reconciliation is deferred maintenance',
      managed_modules_root_template: '~/Library/Application Support/OPL/state/modules',
    },
    distribution: {
      owner_repo: 'gaofeng21cn/one-person-lab-app',
      channel: 'github_release_first_install',
      release_asset_role: 'first_install_recommended',
      product_profile_contract: 'contracts/app-product-profile.json',
      product_profile: {
        contract_schema_version: productProfile.schema_version,
        default_model: productProfile.codex.default_model,
        default_reasoning_effort: productProfile.codex.default_reasoning_effort,
        companion_tools: productProfile.companion_payloads.tools,
        domain_modules: productProfile.companion_payloads.domain_modules,
        default_packaged_codex_skill_ids: productProfile.companion_payloads.default_packaged_codex_skill_ids,
        packaged_not_default_visible_codex_skill_ids:
          productProfile.companion_payloads.packaged_not_default_visible_codex_skill_ids,
      },
      payload_boundary: {
        role: 'declared_payload_assembly_and_validation',
        app_repo_does_not_own: productProfile.boundary.app_does_not_own,
        consumer_refs: {
          opl_runtime_bundle: 'opl_runtime_bundle_consumer',
          bundle_manifest: 'opl_runtime_bundle_consumer.consumed_refs.bundle_manifest',
          bundle_lock: 'opl_runtime_bundle_consumer.consumed_refs.bundle_lock',
          bundle_readback: 'opl_runtime_bundle_consumer.consumed_refs.bundle_readback',
        },
        truth_sources: {
          framework_runtime_contracts: 'gaofeng21cn/one-person-lab',
          foundry_agent_domain_truth: 'gaofeng21cn/opl-meta-agent',
          book_domain_truth: 'gaofeng21cn/opl-bookforge',
          research_domain_truth: 'gaofeng21cn/med-autoscience',
          grant_domain_truth: 'gaofeng21cn/med-autogrant',
          visual_deliverable_domain_truth: 'gaofeng21cn/redcube-ai',
        },
      },
      github_release_upload: true,
      updater_metadata_allowed: false,
      channel_manifest: false,
      runtime_auto_update: false,
      app_auto_update: 'standard_github_release_metadata_only',
      standard_update_assets: [
        `One-Person-Lab-${version}-mac-arm64.dmg`,
        `One-Person-Lab-${version}-mac-arm64.zip`,
        'latest-arm64-mac.yml',
      ],
      signing_policy: {
        matches_standard_release_mode: true,
        developer_id_when_configured: true,
        notarization_when_configured: true,
      },
    },
    components: {
      opl: {
        ...normalizeComponent(components.opl),
        role: 'framework_cli_and_shared_contracts_payload_source',
        required: true,
      },
      codex: {
        ...normalizeComponent(components.codex),
        role: 'default_agent_cli_offline_archive_wrapper',
        required: true,
        binary_path: components.codex?.binary_path ?? null,
        archive_path: components.codex?.archive_path
          ?? 'runtime/current/vendor/codex/codex_cli_darwin_arm64.tar.gz',
        archive_size_bytes: components.codex?.archive_size_bytes ?? null,
      },
      mas: {
        ...normalizeComponent(components.mas),
        role: 'primary_domain_module',
        required: true,
        monolith_runtime: true,
        visible_in_first_run_ui: true,
      },
      mag: {
        ...normalizeComponent(components.mag),
        role: 'grant_domain_module',
        required: true,
        visible_in_first_run_ui: true,
      },
      rca: {
        ...normalizeComponent(components.rca),
        role: 'visual_deliverable_domain_module',
        required: true,
        visible_in_first_run_ui: true,
      },
      meta_agent: {
        ...normalizeComponent(components.meta_agent),
        role: 'independent_foundry_domain_module',
        truth_owner: components.meta_agent?.truth_owner ?? 'gaofeng21cn/opl-meta-agent',
        required: true,
        visible_in_first_run_ui: true,
      },
      bookforge: {
        ...normalizeComponent(components.bookforge),
        role: 'book_domain_module',
        truth_owner: components.bookforge?.truth_owner ?? 'gaofeng21cn/opl-bookforge',
        required: true,
        visible_in_first_run_ui: true,
      },
      node: {
        ...normalizeComponent(components.node),
        role: 'runtime_binary',
        required: true,
      },
      python: {
        ...normalizeComponent(components.python),
        role: 'uv_managed_python_runtime',
        required: true,
      },
      uv: {
        ...normalizeComponent(components.uv),
        role: 'python_environment_manager',
        required: true,
      },
      temporal_cli: {
        ...normalizeComponent(components.temporal_cli),
        role: 'temporal_cli_offline_archive_wrapper',
        required: true,
        binary_path: components.temporal_cli?.binary_path ?? null,
        archive_path: components.temporal_cli?.archive_path
          ?? 'runtime/current/vendor/temporal/temporal_cli_darwin_arm64.tar.gz',
        archive_size_bytes: components.temporal_cli?.archive_size_bytes ?? null,
      },
      officecli: {
        ...normalizeComponent(components.officecli),
        role: 'office_document_cli_binary',
        required: true,
      },
      mineru_open_api: {
        ...normalizeComponent(components.mineru_open_api),
        role: 'document_extraction_cli_binary',
        required: true,
      },
      skills: {
        ...normalizeComponent(components.skills),
        role: 'packaged_codex_skills_declared_by_app_product_profile',
        required: true,
      },
    },
    optional_components: {
      bun: {
        ...normalizeOptionalComponent(optionalComponents.bun),
        role: 'optional_bun_cli_runtime_payload',
        required: false,
      },
    },
  };
}

function normalizeRuntimeRelativePath(relativePath: string) {
  return relativePath.split(path.sep).join('/').replace(/^\/+/, '');
}

function hasPathSegment(relativePath: string, segment: string) {
  return relativePath.split('/').includes(segment);
}

function readFullRuntimePrunePolicy() {
  const policy = JSON.parse(fs.readFileSync(FULL_RUNTIME_PRUNE_POLICY_PATH, 'utf8'));
  if (policy.schema !== FULL_RUNTIME_PRUNE_POLICY_SCHEMA) {
    throw new Error(`Unsupported Full runtime prune policy schema: ${policy.schema}`);
  }
  if (policy.mode !== 'explicit_non_runtime_prune_only') {
    throw new Error(`Unsupported Full runtime prune policy mode: ${policy.mode}`);
  }
  return policy;
}

export const FULL_RUNTIME_PRUNE_POLICY = readFullRuntimePrunePolicy();

const EXCLUDED_RUNTIME_PATH_SEGMENTS = FULL_RUNTIME_PRUNE_POLICY.runtime_tree.excluded_path_segments as string[];
const EXCLUDED_RUNTIME_BASENAMES = FULL_RUNTIME_PRUNE_POLICY.runtime_tree.excluded_basenames as string[];
const EXCLUDED_RUNTIME_BASENAME_SUFFIXES = FULL_RUNTIME_PRUNE_POLICY.runtime_tree.excluded_basename_suffixes as string[];
const EXCLUDED_RUNTIME_PATH_PATTERN_SOURCES = FULL_RUNTIME_PRUNE_POLICY.runtime_tree.excluded_path_patterns as string[];
const EXCLUDED_RUNTIME_PATH_PATTERNS = EXCLUDED_RUNTIME_PATH_PATTERN_SOURCES.map((source) => new RegExp(source));
const INCLUDED_RUNTIME_PATH_PATTERN_SOURCES = FULL_RUNTIME_PRUNE_POLICY.runtime_tree.included_path_patterns as string[];
const INCLUDED_RUNTIME_PATH_PATTERNS = INCLUDED_RUNTIME_PATH_PATTERN_SOURCES.map((source) => new RegExp(source));
const EXCLUDED_PRODUCTION_NODE_MODULE_PATH_PATTERN_SOURCES =
  FULL_RUNTIME_PRUNE_POLICY.production_node_modules.excluded_path_patterns as string[];
const EXCLUDED_PRODUCTION_NODE_MODULE_PATH_PATTERNS =
  EXCLUDED_PRODUCTION_NODE_MODULE_PATH_PATTERN_SOURCES.map((source) => new RegExp(source));
const EXCLUDED_NODE_TOOLCHAIN_PACKAGE_PATH_PATTERN_SOURCES =
  FULL_RUNTIME_PRUNE_POLICY.node_toolchain_global_packages.excluded_path_patterns as string[];
const EXCLUDED_NODE_TOOLCHAIN_PACKAGE_PATH_PATTERNS =
  EXCLUDED_NODE_TOOLCHAIN_PACKAGE_PATH_PATTERN_SOURCES.map((source) => new RegExp(source));

export function buildFullRuntimePrunePolicyHash() {
  return crypto.createHash('sha256').update(JSON.stringify(FULL_RUNTIME_PRUNE_POLICY)).digest('hex');
}

function hasExcludedRuntimePathSegment(relativePath: string) {
  return EXCLUDED_RUNTIME_PATH_SEGMENTS.some((segment) => hasPathSegment(relativePath, segment));
}

function isExcludedRuntimeBaseName(baseName: string) {
  return EXCLUDED_RUNTIME_BASENAMES.includes(baseName)
    || EXCLUDED_RUNTIME_BASENAME_SUFFIXES.some((suffix) => baseName.endsWith(suffix));
}

function matchesExcludedRuntimePathPattern(relativePath: string) {
  return EXCLUDED_RUNTIME_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function matchesIncludedRuntimePathPattern(relativePath: string) {
  return INCLUDED_RUNTIME_PATH_PATTERNS.some((pattern) => pattern.test(relativePath));
}

export function shouldExcludeRuntimePath(relativePathInput: string) {
  const relativePath = normalizeRuntimeRelativePath(relativePathInput);

  if (!relativePath || relativePath === '.') {
    return false;
  }

  const lower = relativePath.toLowerCase();
  const baseName = path.posix.basename(relativePath);
  if (matchesIncludedRuntimePathPattern(lower)) {
    return false;
  }
  return hasExcludedRuntimePathSegment(relativePath)
    || isExcludedRuntimeBaseName(baseName)
    || matchesExcludedRuntimePathPattern(lower);
}

export function shouldExcludeProductionNodeModulePath(relativePathInput: string) {
  const relativePath = normalizeRuntimeRelativePath(relativePathInput);
  if (!relativePath || relativePath === '.') return false;
  const lower = relativePath.toLowerCase();
  const baseName = path.posix.basename(relativePath);
  return isExcludedRuntimeBaseName(baseName)
    || EXCLUDED_RUNTIME_BASENAME_SUFFIXES.some((suffix) => baseName.endsWith(suffix))
    || EXCLUDED_PRODUCTION_NODE_MODULE_PATH_PATTERNS.some((pattern) => pattern.test(lower));
}

export function shouldExcludeNodeToolchainPackagePath(relativePathInput: string) {
  const relativePath = normalizeRuntimeRelativePath(relativePathInput);
  if (!relativePath || relativePath === '.') return false;
  const lower = relativePath.toLowerCase();
  const baseName = path.posix.basename(relativePath);
  return isExcludedRuntimeBaseName(baseName)
    || EXCLUDED_RUNTIME_BASENAME_SUFFIXES.some((suffix) => baseName.endsWith(suffix))
    || EXCLUDED_NODE_TOOLCHAIN_PACKAGE_PATH_PATTERNS.some((pattern) => pattern.test(lower));
}

export type PackageLockLike = {
  packages?: Record<string, { dev?: boolean; optional?: boolean }>;
};

export function listFullRuntimeProductionNodeModulePaths(packageLock: PackageLockLike) {
  return Object.entries(packageLock.packages ?? {})
    .filter(([packagePath, metadata]) =>
      packagePath.startsWith('node_modules/')
      && !metadata.dev
      && !metadata.optional
      && packagePath.split('/').every(Boolean)
    )
    .map(([packagePath]) => normalizeRuntimeRelativePath(packagePath))
    .sort();
}

export function buildPackagedModuleMarker(input: {
  moduleId: string;
  repoName: string;
  sourcePath: string;
  headSha: string | null;
  packagedAt?: string;
}) {
  return {
    marker_version: 1,
    module_id: input.moduleId,
    repo_name: input.repoName,
    source_path: input.sourcePath,
    packaged_runtime: true,
    packaged_at: input.packagedAt ?? new Date().toISOString(),
    source_git: {
      head_sha: input.headSha,
    },
  };
}

export function buildFullFirstInstallReadme(input: {
  version: string;
  dmgName: string;
  runtimeTarName: string | null;
  notarized: boolean;
}) {
  const installPath = '~/Library/Application Support/OPL/runtime/current';
  const codexProfile = formatCodexProfilePhrase();
  const companionSkills = formatRecommendedCompanionSkills();
  return [
    `One Person Lab Full First-Install Package ${normalizeVersion(input.version)}`,
    '',
    'Distribution: this package is built by the one-person-lab-app repository and published as the recommended GitHub Release asset for first-time installation. It is not written to latest*.yml and is not an App auto-update target.',
    'The in-app updater remains unchanged and continues to read only standard One Person Lab App GitHub Release metadata.',
    'Existing users should keep using in-app updates or the standard App package. New users can choose the Full package when they want the runtime, domain modules, and companion tools preloaded for the first setup.',
    '',
    'Installation:',
    `1. Open ${input.dmgName} and drag One Person Lab to Applications.`,
    '2. On first launch, the bundled runtime is installed to the stable runtime path. Later Full package refreshes replace the same path:',
    `   ${installPath}`,
    '3. The runtime version is recorded only in current.json and current/.opl-full-runtime-installed.json; it is not encoded in the runtime directory name.',
    '4. Bundled MAS, MAG, RCA, and OPL Meta Agent payloads are launch sources inside the Full runtime. Managed repo reconciliation may later populate the standard module directory, but it is deferred maintenance and does not block first launch:',
    '   ~/Library/Application Support/OPL/state/modules/<repo-name>',
    `5. The Full runtime includes the Codex CLI, officecli CLI binary, mineru-open-api CLI binary, OPL Meta Agent, and recommended companion skills such as ${companionSkills}. App initialization makes those payloads visible to Codex without requiring Command Line Tools or git to finish first.`,
    `6. The bundled Codex profile seeds ${codexProfile} for first-run App sessions after OPL Gateway is configured; existing usable Codex login or provider access can satisfy first-launch model access without forcing Gateway setup.`,
    '7. The Full package only assembles and validates declared framework/runtime, domain module, and companion tool payloads. Runtime truth, provider implementation, domain truth, domain quality verdicts, and artifact authority remain owned by the OPL Framework and the domain agents.',
    '8. The Full package includes local state and module material required by the family runtime provider. OPL Framework source and contracts are runtime payload inputs, not owners of the App release flow. Production durable stage attempts are governed by the Temporal provider contract.',
    '9. After confirming model access in the App, open OPL initialization and confirm the Core ready, Domain modules ready, and family runtime provider ready states. Full readiness requires all three layers to pass.',
    '10. First launch reads provider-backed readiness through opl family-runtime doctor/status. The Full package no longer carries Hermes runtime payloads.',
    '11. Recommended smoke check: open Research Foundry and create or read a workspace status through MAS.',
    '',
    input.runtimeTarName
      ? `Supplemental runtime package: keep ${input.runtimeTarName} as a manual diagnostic artifact if runtime installation from the DMG fails.`
      : 'Supplemental runtime package: this version is distributed as a single DMG and does not split out a separate runtime tar.zst.',
    '',
    input.notarized
      ? 'Signing and notarization: this package has completed Developer ID signing and Apple notarization checks.'
      : 'Signing and notarization: this package uses the same release mode as the current standard GitHub DMG. If CI signing secrets are not configured, macOS may still require right-click Open or approval in System Settings.',
    '',
    'Verification: after download, compare shasum -a 256 output against SHA256SUMS.txt.',
    '',
  ].join('\n');
}
