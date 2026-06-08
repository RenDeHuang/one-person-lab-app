import fs from 'node:fs';
import path from 'node:path';

import {
  PACKAGED_MODULE_MARKER_FILE,
  buildPackagedModuleMarker,
  listFullRuntimeProductionNodeModulePaths,
} from '../full-first-install-package.ts';
import { writeRuntimeWrappers } from '../full-first-install-runtime-wrappers.ts';
import { MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET } from './paths.ts';
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

export function collectRuntimeAssertions(runtimeRoot) {
  return {
    temporal_core_bridge_releases: listTemporalCoreBridgeReleases(path.join(runtimeRoot, 'opl', 'node_modules')),
    excluded_module_venv_count: countRuntimeModuleVenvDirectories(runtimeRoot),
    packaged_global_node_packages: fs.existsSync(path.join(runtimeRoot, 'node', 'lib', 'node_modules'))
      ? fs.readdirSync(path.join(runtimeRoot, 'node', 'lib', 'node_modules')).sort()
      : [],
  };
}

function writePackagedModuleMarker(moduleRoot, marker) {
  fs.writeFileSync(path.join(moduleRoot, PACKAGED_MODULE_MARKER_FILE), `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
}

export function buildToolchainLayer(layerRoot, sources) {
  copySingleFile(sources.codexBinaries.codex, path.join(layerRoot, 'bin', 'codex'));
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
