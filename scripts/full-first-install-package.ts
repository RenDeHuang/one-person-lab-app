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
export const FULL_RUNTIME_CACHE_LAYOUT_VERSION = 1;
export const FULL_RUNTIME_CACHE_LAYER_IDS = ['toolchain', 'domain-runtime', 'opl-runtime', 'skills'] as const;
export const FULL_PACKAGE_SIZE_BUDGET = {
  platform_scope: 'macos-arm64',
  max_full_dmg_bytes: 450000000,
  max_runtime_uncompressed_bytes: 800000000,
} as const;
export const FULL_PACKAGE_MEASUREMENT_POLICY = {
  full_dmg_bytes: 'github_release_asset_size_bytes',
  runtime_uncompressed_bytes: 'manifest_size_breakdown_total_runtime_uncompressed_bytes',
} as const;

export type FullRuntimeCacheLayerId = typeof FULL_RUNTIME_CACHE_LAYER_IDS[number];

type ComponentSnapshot = Partial<{
  source_path: string;
  version: string | null;
  git_commit: string | null;
  size_bytes: number;
  truth_owner: string;
}>;

type FullPackageManifestInput = Partial<{
  version: string;
  generatedAt: string;
  components: Record<string, ComponentSnapshot>;
  sizeBreakdown: unknown;
  runtimeAssertions: unknown;
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

export function buildFullPackageArtifactNames(versionInput: string) {
  const version = normalizeVersion(versionInput);
  return {
    dmg: `One-Person-Lab-Full-${version}-mac-arm64.dmg`,
    runtimeTar: `opl-runtime-full-${version}-macos-arm64.tar.zst`,
    checksums: 'SHA256SUMS.txt',
    readme: 'README-Full-First-Install.txt',
    manifest: 'full-package-manifest.json',
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

export function buildFullRuntimeCacheArchiveName(input: {
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
  const productProfile = readAppProductProfile();

  return {
    manifest_version: 2,
    package_kind: 'opl_full_first_install_macos_arm64',
    version,
    arch: 'macos-arm64',
    generated_at: input.generatedAt ?? new Date().toISOString(),
    size_budget: FULL_PACKAGE_SIZE_BUDGET,
    measurement_policy: FULL_PACKAGE_MEASUREMENT_POLICY,
    runtime_assertions: input.runtimeAssertions ?? {
      temporal_core_bridge_releases: [],
      excluded_module_venv_count: 0,
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
        recommended_codex_skills: productProfile.companion_payloads.recommended_codex_skills,
      },
      payload_boundary: {
        role: 'declared_payload_assembly_and_validation',
        app_repo_does_not_own: productProfile.boundary.app_does_not_own,
        truth_sources: {
          framework_runtime_contracts: 'gaofeng21cn/one-person-lab',
          foundry_agent_domain_truth: 'gaofeng21cn/opl-meta-agent',
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
        role: 'default_agent_cli',
        required: true,
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
        role: 'recommended_codex_skills_including_officecli_mineru_ui_ux',
        required: true,
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

const EXCLUDED_RUNTIME_PATH_SEGMENTS: readonly string[] = [
  '.git',
  '.codex',
  '.omx',
  '.worktrees',
  '.mypy_cache',
  '.pytest_cache',
  '.ruff_cache',
  '.tox',
  '__pycache__',
  'coverage',
  'target',
  '.DS_Store',
] as const;

const EXCLUDED_RUNTIME_BASENAMES: readonly string[] = ['.DS_Store', 'state.db'];
const EXCLUDED_RUNTIME_BASENAME_SUFFIXES: readonly string[] = ['.pyc', '.pyo', '.tsbuildinfo'];

const EXCLUDED_RUNTIME_PATH_PATTERNS = [
  /^hermes\/(?:web|ui|frontend)(?:\/|$)/,
  /^hermes\/tests?(?:\/|$)/,
  /^hermes\/.*(?:voice|tts|telegram|discord|slack|matrix|dingtalk|feishu)/,
  /^modules\/[^/]+\/\.venv(?:\/|$)/,
  /^modules\/[^/]+\/tests?(?:\/|$)/,
  /^modules\/[^/]+\/(?:htmlcov|docs\/_build|notebooks|runtime|runs|sessions|\.ds)(?:\/|$)/,
  /^opl\/node_modules(?:\/|$)/,
  /^opl\/.*\/\.venv(?:\/|$)/,
  /^opl\/dist(?:\/|$)/,
] as const;

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

export function shouldExcludeRuntimePath(relativePathInput: string) {
  const relativePath = normalizeRuntimeRelativePath(relativePathInput);

  if (!relativePath || relativePath === '.') {
    return false;
  }

  const lower = relativePath.toLowerCase();
  const baseName = path.posix.basename(relativePath);
  return hasExcludedRuntimePathSegment(relativePath)
    || isExcludedRuntimeBaseName(baseName)
    || matchesExcludedRuntimePathPattern(lower);
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
