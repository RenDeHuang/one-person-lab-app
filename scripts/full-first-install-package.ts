import crypto from 'node:crypto';
import path from 'node:path';
import {
  formatCodexProfilePhrase,
  formatRecommendedCompanionSkills,
  readAppProductProfile,
} from './app-product-profile.ts';

export const FULL_FIRST_INSTALL_OUTPUT_DIR = '/Users/gaofeng/Downloads/One-Person-Lab-Full-First-Install';
export const FULL_RELEASE_OUTPUT_DIR = 'dist/opl-full-release';
export const FULL_RUNTIME_RESOURCE_DIR = 'opl-full-runtime';
export const PACKAGED_MODULE_MARKER_FILE = 'opl-runtime-module.json';
const FULL_RUNTIME_CACHE_LAYOUT_VERSION = 1;
export const FULL_RUNTIME_CACHE_LAYER_IDS = ['toolchain', 'domain-runtime', 'opl-runtime', 'skills'] as const;
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
  source_path: string | null;
  repository: string;
  requested_ref: string | null;
  resolved_commit: string | null;
  version: string | null;
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

export function buildFullPackageArtifactNames(versionInput: string) {
  const version = normalizeVersion(versionInput);
  return {
    dmg: `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    runtimeTar: `opl-runtime-full-${version}-macos-arm64.tar.zst`,
    checksums: 'SHA256SUMS.txt',
    readme: 'README-Full-First-Install.txt',
    manifest: 'full-package-manifest.json',
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
    size_breakdown: input.sizeBreakdown ?? {
      total_runtime_uncompressed_bytes: 0,
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

const EXCLUDED_RUNTIME_PATH_SEGMENTS = [
  '.git',
  '.codegraph',
  '.codex',
  '.github',
  '.omx',
  '.worktrees',
  '.cache',
  '.mypy_cache',
  '.next',
  '.nyc_output',
  '.pytest_cache',
  '.ruff_cache',
  '.storybook',
  '.turbo',
  '.tox',
  '__pycache__',
  '__snapshots__',
  'coverage',
  'storybook-static',
  'target',
  '.DS_Store',
] as const;

const EXCLUDED_RUNTIME_BASENAMES = ['.DS_Store', 'state.db'] as const;
const EXCLUDED_RUNTIME_BASENAME_SUFFIXES = [
  '.coverage',
  '.js.map',
  '.map',
  '.pyc',
  '.pyo',
  '.tsbuildinfo',
] as const;

const EXCLUDED_RUNTIME_PATH_PATTERN_SOURCES = [
  '^hermes\\/(?:web|ui|frontend)(?:\\/|$)',
  '^hermes\\/tests?(?:\\/|$)',
  '^hermes\\/.*(?:voice|tts|telegram|discord|slack|matrix|dingtalk|feishu)',
  '^modules\\/[^/]+\\/\\.venv(?:\\/|$)',
  '^modules\\/[^/]+\\/node_modules(?:\\/|$)',
  '^modules\\/[^/]+\\/tests?(?:\\/|$)',
  '^modules\\/[^/]+\\/(?:build|dist|htmlcov|docs\\/_build|notebooks|playwright-report|runtime|runtime-state|runs|sessions|test-results|\\.ds)(?:\\/|$)',
  '^opl\\/node_modules(?:\\/|$)',
  '^opl\\/.*\\/\\.venv(?:\\/|$)',
  '^opl\\/dist(?:\\/|$)',
  '^opl\\/(?:build|playwright-report|test-results)(?:\\/|$)',
  '^python\\/[^/]+\\/lib\\/python\\d+\\.\\d+\\/(?:test|idlelib\\/idle_test|tkinter\\/test|unittest\\/test|ctypes\\/test|distutils\\/tests|lib2to3\\/tests)(?:\\/|$)',
] as const;

const EXCLUDED_RUNTIME_PATH_PATTERNS = EXCLUDED_RUNTIME_PATH_PATTERN_SOURCES.map((source) => new RegExp(source));

const INCLUDED_RUNTIME_PATH_PATTERN_SOURCES = [
  '^modules\\/meta-agent\\/runtime$',
  '^modules\\/meta-agent\\/runtime\\/authority_functions(?:\\/|$)',
] as const;

const INCLUDED_RUNTIME_PATH_PATTERNS = INCLUDED_RUNTIME_PATH_PATTERN_SOURCES.map((source) => new RegExp(source));

const EXCLUDED_PRODUCTION_NODE_MODULE_PATH_PATTERN_SOURCES = [
  '(?:^|\\/)(?:__fixtures__|__mocks__|__snapshots__|benchmarks?|coverage|docs?|examples?|fixtures?|playwright-report|storybook-static|test-results|tests?)(?:\\/|$)',
  '(?:^|\\/)(?:\\.cache|\\.github|\\.nyc_output|\\.pytest_cache|\\.turbo)(?:\\/|$)',
] as const;

const EXCLUDED_PRODUCTION_NODE_MODULE_PATH_PATTERNS = EXCLUDED_PRODUCTION_NODE_MODULE_PATH_PATTERN_SOURCES.map((source) => new RegExp(source));

const EXCLUDED_NODE_TOOLCHAIN_PACKAGE_PATH_PATTERN_SOURCES = [
  '(?:^|\\/)(?:__fixtures__|__mocks__|__snapshots__|benchmarks?|coverage|docs?|examples?|fixtures?|man|playwright-report|tap-snapshots|test-results|tests?)(?:\\/|$)',
  '(?:^|\\/)(?:\\.cache|\\.github|\\.nyc_output|\\.tap|\\.turbo)(?:\\/|$)',
] as const;

const EXCLUDED_NODE_TOOLCHAIN_PACKAGE_PATH_PATTERNS = EXCLUDED_NODE_TOOLCHAIN_PACKAGE_PATH_PATTERN_SOURCES.map((source) => new RegExp(source));

export const FULL_RUNTIME_PRUNE_POLICY = {
  schema: FULL_RUNTIME_PRUNE_POLICY_SCHEMA,
  id: 'full_runtime_offline_first_install_slim_v1',
  mode: 'explicit_non_runtime_prune_only',
  offline_first_install_boundary: 'required Codex and Temporal archives, Node, Python, uv, officecli, mineru, domain modules, and packaged default skills stay local; pruning must not introduce lazy downloads for required launch payloads',
  runtime_tree: {
    excluded_path_segments: EXCLUDED_RUNTIME_PATH_SEGMENTS,
    excluded_basenames: EXCLUDED_RUNTIME_BASENAMES,
    excluded_basename_suffixes: EXCLUDED_RUNTIME_BASENAME_SUFFIXES,
    excluded_path_patterns: EXCLUDED_RUNTIME_PATH_PATTERN_SOURCES,
    included_path_patterns: INCLUDED_RUNTIME_PATH_PATTERN_SOURCES,
  },
  production_node_modules: {
    source: 'package-lock production dependencies allowlist',
    excluded_path_patterns: EXCLUDED_PRODUCTION_NODE_MODULE_PATH_PATTERN_SOURCES,
  },
  node_toolchain_global_packages: {
    copied_packages: ['npm', 'corepack'],
    excluded_path_patterns: EXCLUDED_NODE_TOOLCHAIN_PACKAGE_PATH_PATTERN_SOURCES,
  },
  retained_runtime_support: {
    python_headers: 'retained for offline native-extension build/debug support',
    python_ensurepip: 'retained so the packaged Python remains self-contained',
    node_headers: 'not copied into the Full runtime Node payload',
  },
} as const;

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
    `6. The bundled Codex profile seeds ${codexProfile} for first-run App sessions after the Codex/OpenAI API key is configured.`,
    '7. The Full package only assembles and validates declared framework/runtime, domain module, and companion tool payloads. Runtime truth, provider implementation, domain truth, domain quality verdicts, and artifact authority remain owned by the OPL Framework and the domain agents.',
    '8. The Full package includes local state and module material required by the family runtime provider. OPL Framework source and contracts are runtime payload inputs, not owners of the App release flow. Production durable stage attempts are governed by the Temporal provider contract.',
    '9. After configuring the Codex/OpenAI API key in the App, open OPL initialization and confirm the Core ready, Domain modules ready, and family runtime provider ready states. Full readiness requires all three layers to pass.',
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
