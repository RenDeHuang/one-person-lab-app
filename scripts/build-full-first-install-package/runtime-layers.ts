import fs from 'node:fs';
import path from 'node:path';

import {
  FULL_RUNTIME_PRUNE_POLICY,
  buildFullRuntimePrunePolicyHash,
  PACKAGED_MODULE_MARKER_FILE,
  buildPackagedModuleMarker,
  listFullRuntimeProductionNodeModulePaths,
} from '../full-first-install-package.ts';
import { writeRuntimeWrappers } from '../full-first-install-runtime-wrappers.ts';
import {
  CODEX_MACOS_ARM64_TARGET,
  MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET,
} from './paths.ts';
import {
  copyNodeRuntimePayload,
  copyProductionNodeModules,
  copySingleFile,
  copyTreeFiltered,
} from './filesystem.ts';
import { readGitHead } from './git.ts';
import { commandOutput, run } from './process.ts';
import { copyPackagedSkills } from './skills.ts';

export function assertOplRuntimeProductionDependencies(oplRoot) {
  const packageJsonPath = path.join(oplRoot, 'package.json');
  const packageLockPath = path.join(oplRoot, 'package-lock.json');
  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(packageLockPath)) {
    throw new Error(`Full runtime OPL payload is missing package metadata under ${oplRoot}`);
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = packageJson.dependencies ?? {};
  const requiredTemporalPackages = [
    '@temporalio/activity',
    '@temporalio/client',
    '@temporalio/common',
    '@temporalio/worker',
    '@temporalio/workflow',
  ];
  const missingDeclared = requiredTemporalPackages.filter((packageName) => typeof dependencies[packageName] !== 'string');
  if (missingDeclared.length > 0) {
    throw new Error(
      `Full runtime OPL payload has Temporal runtime packages outside dependencies: ${missingDeclared.join(', ')}`,
    );
  }

  const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
  const missingProductionPaths = listFullRuntimeProductionNodeModulePaths(packageLock)
    .filter((relativePath) => !fs.existsSync(path.join(oplRoot, relativePath)));
  if (missingProductionPaths.length > 0) {
    throw new Error([
      `Full runtime OPL payload is missing ${missingProductionPaths.length} production node module path(s).`,
      ...missingProductionPaths.slice(0, 20).map((relativePath) => `  - ${relativePath}`),
      missingProductionPaths.length > 20 ? `  ... ${missingProductionPaths.length - 20} more omitted` : '',
    ].filter(Boolean).join('\n'));
  }

  const temporalTestingPath = path.join(oplRoot, 'node_modules', '@temporalio', 'testing');
  if (fs.existsSync(temporalTestingPath)) {
    throw new Error('Full runtime OPL payload includes @temporalio/testing, which is a dev-only test server package.');
  }
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

export function writeTemporalCliWrapper(targetPath, versionOutput) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `#!/bin/bash
set -euo pipefail
TEMPORAL_VERSION_OUTPUT=${shellSingleQuote(versionOutput)}
if [[ "\${1:-}" == "--version" ]]; then
  printf '%s\\n' "$TEMPORAL_VERSION_OUTPUT"
  exit 0
fi
RUNTIME_HOME="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$RUNTIME_HOME/vendor/temporal/temporal_cli_darwin_arm64.tar.gz"
EXTRACT_ROOT="$RUNTIME_HOME/.runtime-cache/temporal-cli"
TEMPORAL_BIN="$EXTRACT_ROOT/temporal"
if [[ ! -x "$TEMPORAL_BIN" ]]; then
  if [[ ! -f "$ARCHIVE" ]]; then
    printf 'Packaged Temporal CLI archive is missing: %s\\n' "$ARCHIVE" >&2
    exit 1
  fi
  rm -rf "$EXTRACT_ROOT"
  mkdir -p "$EXTRACT_ROOT"
  tar -xzf "$ARCHIVE" -C "$EXTRACT_ROOT"
  if [[ ! -x "$TEMPORAL_BIN" ]]; then
    candidate="$(find "$EXTRACT_ROOT" -type f -name temporal -perm -111 | head -n 1 || true)"
    if [[ -n "$candidate" ]]; then
      TEMPORAL_BIN="$candidate"
    fi
  fi
fi
if [[ ! -x "$TEMPORAL_BIN" ]]; then
  printf 'Packaged Temporal CLI archive did not contain an executable temporal binary: %s\\n' "$ARCHIVE" >&2
  exit 1
fi
exec "$TEMPORAL_BIN" "$@"
`, 'utf8');
  fs.chmodSync(targetPath, 0o755);
}

export function writeCodexCliWrapper(targetPath, versionOutput) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `#!/bin/bash
set -euo pipefail
CODEX_VERSION_OUTPUT=${shellSingleQuote(versionOutput)}
if [[ "\${1:-}" == "--version" ]]; then
  printf '%s\\n' "$CODEX_VERSION_OUTPUT"
  exit 0
fi
RUNTIME_HOME="$(cd "$(dirname "\${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE="$RUNTIME_HOME/vendor/codex/codex_cli_darwin_arm64.tar.gz"
EXTRACT_ROOT="$RUNTIME_HOME/.runtime-cache/codex-cli"
CODEX_TARGET="${CODEX_MACOS_ARM64_TARGET}"
CODEX_BIN="$EXTRACT_ROOT/$CODEX_TARGET/bin/codex"
CODEX_PATH_DIR="$EXTRACT_ROOT/$CODEX_TARGET/codex-path"
if [[ ! -x "$CODEX_BIN" ]]; then
  if [[ ! -f "$ARCHIVE" ]]; then
    printf 'Packaged Codex CLI archive is missing: %s\\n' "$ARCHIVE" >&2
    exit 1
  fi
  rm -rf "$EXTRACT_ROOT"
  mkdir -p "$EXTRACT_ROOT"
  tar -xzf "$ARCHIVE" -C "$EXTRACT_ROOT"
  if [[ ! -x "$CODEX_BIN" ]]; then
    candidate="$(find "$EXTRACT_ROOT" -type f -path '*/bin/codex' -perm -111 | head -n 1 || true)"
    if [[ -n "$candidate" ]]; then
      CODEX_BIN="$candidate"
      CODEX_PATH_DIR="$(cd "$(dirname "$candidate")/.." && pwd)/codex-path"
    fi
  fi
fi
if [[ ! -x "$CODEX_BIN" ]]; then
  printf 'Packaged Codex CLI archive did not contain an executable codex binary: %s\\n' "$ARCHIVE" >&2
  exit 1
fi
if [[ -d "$CODEX_PATH_DIR" ]]; then
  export PATH="$CODEX_PATH_DIR:$PATH"
fi
exec "$CODEX_BIN" "$@"
`, 'utf8');
  fs.chmodSync(targetPath, 0o755);
}

export function createCodexCliArchive(archivePath, vendorRoot) {
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.rmSync(archivePath, { force: true });
  run('tar', ['-czf', archivePath, '-C', path.dirname(vendorRoot), path.basename(vendorRoot)]);
}

function temporalCoreBridgeReleasesRoot(nodeModulesRoot) {
  return path.join(nodeModulesRoot, '@temporalio', 'core-bridge', 'releases');
}

function listTemporalCoreBridgeReleases(nodeModulesRoot) {
  const releasesRoot = temporalCoreBridgeReleasesRoot(nodeModulesRoot);
  if (!fs.existsSync(releasesRoot)) {
    return [];
  }
  return fs.readdirSync(releasesRoot)
    .filter((entry) => fs.statSync(path.join(releasesRoot, entry)).isDirectory())
    .sort();
}

export function pruneTemporalCoreBridgeReleases(nodeModulesRoot) {
  const releasesRoot = temporalCoreBridgeReleasesRoot(nodeModulesRoot);
  if (!fs.existsSync(releasesRoot)) {
    return;
  }
  for (const releaseName of fs.readdirSync(releasesRoot)) {
    if (releaseName === MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET) {
      continue;
    }
    fs.rmSync(path.join(releasesRoot, releaseName), { recursive: true, force: true });
  }
}

export function assertTemporalCoreBridgeMacosArm64Only(nodeModulesRoot) {
  const releasesRoot = temporalCoreBridgeReleasesRoot(nodeModulesRoot);
  const releases = listTemporalCoreBridgeReleases(nodeModulesRoot);
  if (!releases.includes(MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET)) {
    throw new Error(`Full runtime Temporal core-bridge is missing ${MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET}.`);
  }
  if (releases.length !== 1) {
    throw new Error(`Full runtime Temporal core-bridge must include only ${MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET}; found ${releases.join(', ')}.`);
  }
  const nativeModule = path.join(releasesRoot, MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET, 'index.node');
  if (!fs.existsSync(nativeModule)) {
    throw new Error(`Full runtime Temporal core-bridge native module missing: ${nativeModule}`);
  }
}

function countRuntimeModuleVenvDirectories(runtimeRoot) {
  const modulesRoot = path.join(runtimeRoot, 'modules');
  if (!fs.existsSync(modulesRoot)) {
    return 0;
  }
  let count = 0;
  for (const moduleName of fs.readdirSync(modulesRoot)) {
    if (fs.existsSync(path.join(modulesRoot, moduleName, '.venv'))) {
      count += 1;
    }
  }
  return count;
}

function runtimePayloadStatus(runtimeRoot, relativePath, options = {}) {
  const absolutePath = path.join(runtimeRoot, ...relativePath.split('/'));
  const exists = fs.existsSync(absolutePath);
  const stat = exists ? fs.statSync(absolutePath) : null;
  const executable = stat?.isFile()
    ? Boolean(stat.mode & 0o111)
    : false;
  return {
    path: relativePath,
    exists,
    ...(options.executable ? { executable } : {}),
    ...(stat?.isFile() ? { size_bytes: stat.size } : {}),
  };
}

const FULL_RUNTIME_DOMAIN_PLUGIN_PAYLOADS = [
  { modulePath: 'modules/mas', pluginId: 'med-autoscience', skillId: 'med-autoscience' },
  { modulePath: 'modules/mag', pluginId: 'med-autogrant', skillId: 'med-autogrant' },
  { modulePath: 'modules/rca', pluginId: 'redcube-ai', skillId: 'redcube-ai' },
];

function domainPluginPayloadStatuses(runtimeRoot) {
  return FULL_RUNTIME_DOMAIN_PLUGIN_PAYLOADS.flatMap(({ modulePath, pluginId, skillId }) => [
    runtimePayloadStatus(runtimeRoot, `${modulePath}/plugins/${pluginId}/.codex-plugin/plugin.json`),
    runtimePayloadStatus(runtimeRoot, `${modulePath}/plugins/${pluginId}/skills/${skillId}/SKILL.md`),
  ]);
}

function listRuntimeRelativePaths(runtimeRoot) {
  if (!fs.existsSync(runtimeRoot)) return [];
  const paths = [];
  const stack = [''];
  while (stack.length > 0) {
    const relativePath = stack.pop();
    const absolutePath = relativePath ? path.join(runtimeRoot, ...relativePath.split('/')) : runtimeRoot;
    const stat = fs.lstatSync(absolutePath);
    if (!relativePath) {
      for (const entry of fs.readdirSync(absolutePath)) stack.push(entry);
      continue;
    }
    paths.push(relativePath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(absolutePath)) {
        stack.push(path.posix.join(relativePath, entry));
      }
    }
  }
  return paths;
}

function runtimePathPattern(relativePath) {
  const escaped = relativePath
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]+');
  return new RegExp(`^${escaped}(?:/|$)`);
}

function declaredPrunedPathAssertions(runtimeRoot) {
  const runtimePaths = listRuntimeRelativePaths(runtimeRoot);
  const expectedAbsent = FULL_RUNTIME_PRUNE_POLICY.runtime_assertions?.expected_absent_paths ?? [];
  const pathExists = (relativePath) => fs.existsSync(path.join(runtimeRoot, ...relativePath.split('/')));
  return expectedAbsent.map((relativePath) => ({
    path: relativePath,
    expected: 'absent',
    ...(relativePath.includes('*')
      ? { match_count: runtimePaths.filter((runtimePath) => runtimePathPattern(relativePath).test(runtimePath)).length }
      : { present: pathExists(relativePath) }),
  }));
}

export function collectRuntimeAssertions(runtimeRoot) {
  return {
    prune_policy_id: FULL_RUNTIME_PRUNE_POLICY.id,
    prune_policy_hash: buildFullRuntimePrunePolicyHash(),
    temporal_core_bridge_releases: listTemporalCoreBridgeReleases(path.join(runtimeRoot, 'opl', 'node_modules')),
    excluded_module_venv_count: countRuntimeModuleVenvDirectories(runtimeRoot),
    packaged_global_node_packages: fs.existsSync(path.join(runtimeRoot, 'node', 'lib', 'node_modules'))
      ? fs.readdirSync(path.join(runtimeRoot, 'node', 'lib', 'node_modules')).sort()
      : [],
    offline_required_payloads: [
      runtimePayloadStatus(runtimeRoot, 'bin/codex', { executable: true }),
      runtimePayloadStatus(runtimeRoot, 'vendor/codex/codex_cli_darwin_arm64.tar.gz'),
      runtimePayloadStatus(runtimeRoot, 'bin/temporal', { executable: true }),
      runtimePayloadStatus(runtimeRoot, 'vendor/temporal/temporal_cli_darwin_arm64.tar.gz'),
      runtimePayloadStatus(runtimeRoot, 'node/bin/node', { executable: true }),
      runtimePayloadStatus(runtimeRoot, 'node/bin/npm', { executable: true }),
      runtimePayloadStatus(runtimeRoot, 'node/bin/npx', { executable: true }),
      runtimePayloadStatus(runtimeRoot, 'uv/bin/uv', { executable: true }),
      runtimePayloadStatus(runtimeRoot, 'bin/officecli', { executable: true }),
      runtimePayloadStatus(runtimeRoot, 'bin/mineru-open-api', { executable: true }),
      runtimePayloadStatus(runtimeRoot, 'skills/med-autoscience/SKILL.md'),
      runtimePayloadStatus(runtimeRoot, 'skills/med-autogrant/SKILL.md'),
      runtimePayloadStatus(runtimeRoot, 'skills/redcube-ai/SKILL.md'),
      runtimePayloadStatus(runtimeRoot, 'skills/opl-bookforge/SKILL.md'),
      runtimePayloadStatus(runtimeRoot, 'modules/opl-flow/.codex-plugin/plugin.json'),
      runtimePayloadStatus(runtimeRoot, 'modules/opl-flow/scripts/install_local_plugin.py'),
      runtimePayloadStatus(runtimeRoot, 'modules/opl-flow/skills/opl-flow/SKILL.md'),
      runtimePayloadStatus(runtimeRoot, 'modules/opl-flow/skills/codex-ops-kit/SKILL.md'),
      ...domainPluginPayloadStatuses(runtimeRoot),
    ],
    declared_pruned_paths: declaredPrunedPathAssertions(runtimeRoot),
  };
}

function writePackagedModuleMarker(moduleRoot, marker) {
  fs.writeFileSync(path.join(moduleRoot, PACKAGED_MODULE_MARKER_FILE), `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
}

export function buildToolchainLayer(layerRoot, sources) {
  createCodexCliArchive(
    path.join(layerRoot, 'vendor', 'codex', 'codex_cli_darwin_arm64.tar.gz'),
    sources.codexBinaries.vendorRoot,
  );
  writeCodexCliWrapper(path.join(layerRoot, 'bin', 'codex'), commandOutput(sources.codexBinaries.codex, ['--version']));
  copySingleFile(sources.codexBinaries.rg, path.join(layerRoot, 'bin', 'rg'));
  if (sources.bunBin) {
    copySingleFile(sources.bunBin, path.join(layerRoot, 'bin', 'bun'));
  }
  copySingleFile(sources.temporalCliArchive, path.join(layerRoot, 'vendor', 'temporal', 'temporal_cli_darwin_arm64.tar.gz'));
  writeTemporalCliWrapper(path.join(layerRoot, 'bin', 'temporal'), commandOutput(sources.temporalCliBin, ['--version']));
  copySingleFile(sources.officeCliBin, path.join(layerRoot, 'bin', 'officecli'));
  copySingleFile(sources.mineruOpenApiBin, path.join(layerRoot, 'bin', 'mineru-open-api'));
  copyNodeRuntimePayload(path.dirname(path.dirname(sources.nodeToolchain.nodeBin)), path.join(layerRoot, 'node'));
  copySingleFile(sources.uvBin, path.join(layerRoot, 'uv', 'bin', 'uv'));
  copyTreeFiltered(
    sources.pythonRoot,
    path.join(layerRoot, 'python', path.basename(sources.pythonRoot)),
    `python/${path.basename(sources.pythonRoot)}`,
  );
  writeRuntimeWrappers(layerRoot);
}

export function buildDomainLayer(layerRoot, options) {
  copyTreeFiltered(options.masRoot, path.join(layerRoot, 'modules', 'mas'), 'modules/mas');
  copyTreeFiltered(options.magRoot, path.join(layerRoot, 'modules', 'mag'), 'modules/mag');
  copyTreeFiltered(options.rcaRoot, path.join(layerRoot, 'modules', 'rca'), 'modules/rca');
  copyTreeFiltered(options.metaAgentRoot, path.join(layerRoot, 'modules', 'meta-agent'), 'modules/meta-agent');
  copyTreeFiltered(options.bookforgeRoot, path.join(layerRoot, 'modules', 'bookforge'), 'modules/bookforge');
  copyTreeFiltered(options.oplFlowRoot, path.join(layerRoot, 'modules', 'opl-flow'), 'modules/opl-flow');
}

export function writeDomainMarkers(runtimeRoot, options, packagedAt) {
  writePackagedModuleMarker(path.join(runtimeRoot, 'modules', 'mas'), buildPackagedModuleMarker({
    moduleId: 'medautoscience',
    repoName: 'med-autoscience',
    sourcePath: options.masRoot,
    headSha: readGitHead(options.masRoot),
    packagedAt,
  }));
  writePackagedModuleMarker(path.join(runtimeRoot, 'modules', 'mag'), buildPackagedModuleMarker({
    moduleId: 'medautogrant',
    repoName: 'med-autogrant',
    sourcePath: options.magRoot,
    headSha: readGitHead(options.magRoot),
    packagedAt,
  }));
  writePackagedModuleMarker(path.join(runtimeRoot, 'modules', 'rca'), buildPackagedModuleMarker({
    moduleId: 'redcube',
    repoName: 'redcube-ai',
    sourcePath: options.rcaRoot,
    headSha: readGitHead(options.rcaRoot),
    packagedAt,
  }));
  writePackagedModuleMarker(path.join(runtimeRoot, 'modules', 'meta-agent'), buildPackagedModuleMarker({
    moduleId: 'oplmetaagent',
    repoName: 'opl-meta-agent',
    sourcePath: options.metaAgentRoot,
    headSha: readGitHead(options.metaAgentRoot),
    packagedAt,
  }));
  writePackagedModuleMarker(path.join(runtimeRoot, 'modules', 'bookforge'), buildPackagedModuleMarker({
    moduleId: 'oplbookforge',
    repoName: 'opl-bookforge',
    sourcePath: options.bookforgeRoot,
    headSha: readGitHead(options.bookforgeRoot),
    packagedAt,
  }));
  writePackagedModuleMarker(path.join(runtimeRoot, 'modules', 'opl-flow'), buildPackagedModuleMarker({
    moduleId: 'oplflow',
    repoName: 'opl-flow',
    sourcePath: options.oplFlowRoot,
    headSha: readGitHead(options.oplFlowRoot),
    packagedAt,
  }));
}

export function buildOplLayer(layerRoot, options) {
  const targetRoot = path.join(layerRoot, 'opl');
  copyTreeFiltered(options.frameworkRoot, targetRoot, 'opl');
  copyProductionNodeModules(options.frameworkRoot, targetRoot);
  pruneTemporalCoreBridgeReleases(path.join(targetRoot, 'node_modules'));
}

export function buildSkillsLayer(layerRoot, options) {
  copyPackagedSkills(path.join(layerRoot, 'skills'), options);
}
