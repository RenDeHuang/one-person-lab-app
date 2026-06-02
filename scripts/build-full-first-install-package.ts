#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  FULL_RELEASE_OUTPUT_DIR,
  FULL_FIRST_INSTALL_OUTPUT_DIR,
  FULL_RUNTIME_RESOURCE_DIR,
  FULL_RUNTIME_CACHE_LAYER_IDS,
  PACKAGED_MODULE_MARKER_FILE,
  buildFullRuntimeAggregateCacheKeyInput,
  buildFullRuntimeCacheArchivePath,
  buildFullPackageManifest,
  buildFullPackageArtifactNames,
  buildFullRuntimeCacheKey,
  buildFullFirstInstallReadme,
  buildPackagedModuleMarker,
  classifyFullRuntimeLayerCache,
  listFullRuntimeProductionNodeModulePaths,
  shouldExcludeRuntimePath,
} from './full-first-install-package.ts';
import { readAppProductProfile, syncAppProductProfileToShell } from './app-product-profile.ts';
import { resolveActiveShellPaths } from './app-shell-adapter.ts';
import { writeRuntimeWrappers } from './full-first-install-runtime-wrappers.ts';

const appRepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.dirname(appRepoRoot);
const MACOS_ARM64_TEMPORAL_CORE_BRIDGE_TARGET = 'aarch64-apple-darwin';
const CODEX_MACOS_ARM64_TARGET = 'aarch64-apple-darwin';

function defaultRuntimeCacheDir() {
  if (process.env.OPL_FULL_RUNTIME_CACHE_DIR?.trim()) {
    return process.env.OPL_FULL_RUNTIME_CACHE_DIR;
  }
  return path.join(os.homedir(), 'Library', 'Caches', 'One Person Lab', 'full-runtime-layers');
}

function parseArgs(argv) {
  const parsed = {
    version: process.env.OPL_RELEASE_VERSION || '26.5.1',
    outDir: process.env.CI === 'true'
      ? path.join(appRepoRoot, FULL_RELEASE_OUTPUT_DIR)
      : FULL_FIRST_INSTALL_OUTPUT_DIR,
    frameworkRoot: process.env.OPL_FRAMEWORK_ROOT
      || process.env.OPL_FULL_OPL_ROOT
      || path.join(workspaceRoot, 'one-person-lab'),
    guiRoot: process.env.OPL_FULL_GUI_ROOT || resolveActiveShellPaths().shellRoot,
    masRoot: process.env.OPL_FULL_MAS_ROOT || path.join(workspaceRoot, 'med-autoscience'),
    magRoot: process.env.OPL_FULL_MAG_ROOT || path.join(workspaceRoot, 'med-autogrant'),
    rcaRoot: process.env.OPL_FULL_RCA_ROOT || path.join(workspaceRoot, 'redcube-ai'),
    metaAgentRoot: process.env.OPL_FULL_META_AGENT_ROOT || path.join(workspaceRoot, 'opl-meta-agent'),
    superpowersRoot: process.env.OPL_FULL_SUPERPOWERS_ROOT || path.join(os.homedir(), '.codex', 'superpowers'),
    codexRoot: process.env.OPL_FULL_CODEX_ROOT || '',
    nodeBin: process.env.OPL_FULL_NODE_BIN || '',
    bunBin: process.env.OPL_FULL_BUN_BIN || '',
    uvBin: process.env.OPL_FULL_UV_BIN || path.join(os.homedir(), '.local', 'bin', 'uv'),
    temporalCliBin: process.env.OPL_FULL_TEMPORAL_CLI_BIN || '',
    temporalCliArchive: process.env.OPL_FULL_TEMPORAL_CLI_ARCHIVE || '',
    pythonRoot: process.env.OPL_FULL_PYTHON_ROOT || '',
    officeCliBin: process.env.OPL_FULL_OFFICECLI_BIN || '',
    officeCliRoot: process.env.OPL_FULL_OFFICECLI_ROOT || path.join(workspaceRoot, 'OfficeCLI'),
    mineruOpenApiBin: process.env.OPL_FULL_MINERU_OPEN_API_BIN || '',
    mineruRoot: process.env.OPL_FULL_MINERU_ROOT || path.join(workspaceRoot, 'MinerU-Ecosystem'),
    mineruDocumentExtractorRoot: process.env.OPL_FULL_MINERU_DOCUMENT_EXTRACTOR_ROOT
      || path.join(appRepoRoot, 'assets', 'companion-skills', 'mineru-document-extractor'),
    uiUxProMaxRoot: process.env.OPL_FULL_UI_UX_PRO_MAX_ROOT || path.join(workspaceRoot, 'ui-ux-pro-max-skill'),
    skipGuiBuild: false,
    splitRuntime: process.env.OPL_FULL_SPLIT_RUNTIME === '1',
    reuseGuiViteOutput: process.env.OPL_FULL_REUSE_GUI_VITE_OUTPUT === '1',
    runtimeCacheDir: defaultRuntimeCacheDir(),
    runtimeCacheMode: process.env.OPL_FULL_RUNTIME_CACHE_MODE || 'readwrite',
    printRuntimeCacheKeys: false,
    frameworkRef: process.env.OPL_FULL_FRAMEWORK_REF || process.env.OPL_FRAMEWORK_REF || null,
    masRef: process.env.OPL_FULL_MAS_REF || 'main',
    magRef: process.env.OPL_FULL_MAG_REF || 'main',
    rcaRef: process.env.OPL_FULL_RCA_REF || 'main',
    metaAgentRef: process.env.OPL_FULL_META_AGENT_REF || 'main',
    superpowersRef: process.env.OPL_FULL_SUPERPOWERS_REF || 'main',
    officeCliRef: process.env.OPL_FULL_OFFICECLI_REF || 'main',
    mineruRef: process.env.OPL_FULL_MINERU_REF || 'main',
    uiUxProMaxRef: process.env.OPL_FULL_UI_UX_PRO_MAX_REF || 'main',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--skip-gui-build') {
      parsed.skipGuiBuild = true;
      continue;
    }
    if (token === '--split-runtime') {
      parsed.splitRuntime = true;
      continue;
    }
    if (token === '--reuse-gui-vite-output') {
      parsed.reuseGuiViteOutput = true;
      continue;
    }
    if (token === '--print-runtime-cache-keys') {
      parsed.printRuntimeCacheKeys = true;
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${token}`);
    }
    index += 1;
    if (token === '--version') parsed.version = value;
    else if (token === '--out-dir') parsed.outDir = path.resolve(value);
    else if (token === '--framework-root' || token === '--opl-root') parsed.frameworkRoot = path.resolve(value);
    else if (token === '--gui-root') parsed.guiRoot = path.resolve(value);
    else if (token === '--hermes-root') {
      throw new Error('--hermes-root has been retired; OPL Full packages no longer include Hermes runtime payloads.');
    }
    else if (token === '--mas-root') parsed.masRoot = path.resolve(value);
    else if (token === '--mag-root') parsed.magRoot = path.resolve(value);
    else if (token === '--rca-root') parsed.rcaRoot = path.resolve(value);
    else if (token === '--meta-agent-root') parsed.metaAgentRoot = path.resolve(value);
    else if (token === '--superpowers-root') parsed.superpowersRoot = path.resolve(value);
    else if (token === '--codex-root') parsed.codexRoot = path.resolve(value);
    else if (token === '--node-bin') parsed.nodeBin = path.resolve(value);
    else if (token === '--bun-bin') parsed.bunBin = path.resolve(value);
    else if (token === '--uv-bin') parsed.uvBin = path.resolve(value);
    else if (token === '--temporal-cli-bin') parsed.temporalCliBin = path.resolve(value);
    else if (token === '--temporal-cli-archive') parsed.temporalCliArchive = path.resolve(value);
    else if (token === '--python-root') parsed.pythonRoot = path.resolve(value);
    else if (token === '--officecli-bin') parsed.officeCliBin = path.resolve(value);
    else if (token === '--officecli-root') parsed.officeCliRoot = path.resolve(value);
    else if (token === '--mineru-open-api-bin') parsed.mineruOpenApiBin = path.resolve(value);
    else if (token === '--mineru-root') parsed.mineruRoot = path.resolve(value);
    else if (token === '--mineru-document-extractor-root') parsed.mineruDocumentExtractorRoot = path.resolve(value);
    else if (token === '--ui-ux-pro-max-root') parsed.uiUxProMaxRoot = path.resolve(value);
    else if (token === '--runtime-cache-dir') parsed.runtimeCacheDir = path.resolve(value);
    else if (token === '--runtime-cache-mode') parsed.runtimeCacheMode = value;
    else throw new Error(`Unknown argument: ${token}`);
  }

  if (!['readwrite', 'readonly', 'off'].includes(parsed.runtimeCacheMode)) {
    throw new Error(`Unsupported runtime cache mode: ${parsed.runtimeCacheMode}`);
  }

  return parsed;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: options.capture ? 'pipe' : 'inherit',
  });
  if (result.status !== 0) {
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : '',
      result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : '',
    ].filter(Boolean).join('\n'));
  }
  return result;
}

function requirePath(filePath, label) {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath || '(empty)'}`);
  }
  return filePath;
}

function readGitHead(sourcePath) {
  if (!fs.existsSync(path.join(sourcePath, '.git'))) {
    return null;
  }
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: sourcePath,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function readGitOriginUrl(sourcePath) {
  if (!fs.existsSync(path.join(sourcePath, '.git'))) {
    return null;
  }
  const result = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
    cwd: sourcePath,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe' });
  if (result.status !== 0) {
    return null;
  }
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim() || null;
}

function monotonicSeconds() {
  return Number(process.hrtime.bigint()) / 1_000_000_000;
}

function durationSeconds(start, end) {
  return Number((end - start).toFixed(3));
}

function buildResolvedFullPayloadRefs(options, sources, components) {
  const mineruRepoRoot = sources.mineruRepoRoot || options.mineruRoot;
  return {
    opl_framework: {
      label: 'OPL Framework',
      source_path: options.frameworkRoot,
      repository: readGitOriginUrl(options.frameworkRoot) || 'gaofeng21cn/one-person-lab',
      requested_ref: options.frameworkRef || 'main',
      resolved_commit: components.opl?.git_commit ?? readGitHead(options.frameworkRoot),
    },
    mas: {
      label: 'MAS',
      source_path: options.masRoot,
      repository: readGitOriginUrl(options.masRoot) || 'gaofeng21cn/med-autoscience',
      requested_ref: options.masRef,
      resolved_commit: components.mas?.git_commit ?? readGitHead(options.masRoot),
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
    superpowers: {
      label: 'Superpowers',
      source_path: options.superpowersRoot,
      repository: readGitOriginUrl(options.superpowersRoot) || 'obra/superpowers',
      requested_ref: options.superpowersRef,
      resolved_commit: readGitHead(options.superpowersRoot),
      version: packageJsonVersion(path.join(options.superpowersRoot, 'package.json')),
    },
    officecli: {
      label: 'OfficeCLI',
      source_path: options.officeCliRoot,
      repository: readGitOriginUrl(options.officeCliRoot) || 'iOfficeAI/OfficeCLI',
      requested_ref: options.officeCliRef,
      resolved_commit: readGitHead(options.officeCliRoot),
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

function findExecutable(name) {
  const result = spawnSync('which', [name], { encoding: 'utf8', stdio: 'pipe' });
  return result.status === 0 ? result.stdout.trim() || null : null;
}

function findCompanionBinary(input) {
  const candidates = [
    input.explicitBin,
    input.envBin,
    findExecutable(input.name) || '',
    path.join(os.homedir(), '.local', 'bin', input.name),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) {
    throw new Error(`${input.name} binary not found. Install ${input.name} or pass ${input.flagName} / set ${input.envName}.`);
  }
  return found;
}

function findOfficeCliBinary(explicitBin) {
  return findCompanionBinary({
    name: 'officecli',
    explicitBin,
    envBin: process.env.OPL_OFFICECLI_BIN || '',
    flagName: '--officecli-bin',
    envName: 'OPL_FULL_OFFICECLI_BIN',
  });
}

function findMineruOpenApiBinary(explicitBin) {
  return findCompanionBinary({
    name: 'mineru-open-api',
    explicitBin,
    envBin: process.env.OPL_MINERU_OPEN_API_BIN || '',
    flagName: '--mineru-open-api-bin',
    envName: 'OPL_FULL_MINERU_OPEN_API_BIN',
  });
}

function findTemporalCliBinary(explicitBin) {
  return findCompanionBinary({
    name: 'temporal',
    explicitBin,
    envBin: process.env.OPL_TEMPORAL_CLI_BIN || '',
    flagName: '--temporal-cli-bin',
    envName: 'OPL_FULL_TEMPORAL_CLI_BIN',
  });
}

function findTemporalCliArchive(explicitArchive) {
  return requirePath(explicitArchive || process.env.OPL_FULL_TEMPORAL_CLI_ARCHIVE || '', 'Temporal CLI archive');
}

function fileSha256(filePath) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return null;
  }
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function stringSha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function functionSourceSha256(functions) {
  return stringSha256(functions.map((fn) => fn.toString()).join('\n\n'));
}

function buildRuntimeLayerPackagerInputs() {
  return {
    support_files: hashFiles(appRepoRoot, [
      'contracts/app-product-profile.json',
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

function hashFiles(sourceRoot, relativePaths) {
  const entries = {};
  for (const relativePath of relativePaths) {
    const filePath = path.join(sourceRoot, relativePath);
    entries[relativePath] = fs.existsSync(filePath) ? fileSha256(filePath) : null;
  }
  return entries;
}

function directoryFingerprint(root, runtimePrefix) {
  if (!fs.existsSync(root)) {
    return null;
  }
  const hash = crypto.createHash('sha256');
  const stack = [['', root]];
  while (stack.length > 0) {
    const [relative, current] = stack.pop();
    const runtimeRelative = relative
      ? path.posix.join(runtimePrefix, relative.split(path.sep).join('/'))
      : runtimePrefix;
    if (relative && shouldExcludeRuntimePath(runtimeRelative)) {
      continue;
    }
    const stat = fs.lstatSync(current);
    hash.update(relative);
    hash.update(stat.isDirectory() ? 'dir' : stat.isSymbolicLink() ? 'symlink' : 'file');
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current).sort().reverse()) {
        stack.push([path.join(relative, entry), path.join(current, entry)]);
      }
    } else if (stat.isSymbolicLink()) {
      hash.update(fs.readlinkSync(current));
    } else if (stat.isFile()) {
      hash.update(fs.readFileSync(current));
    }
  }
  return hash.digest('hex');
}

function productionNodeModulesFingerprint(sourceRoot) {
  const lockPath = path.join(sourceRoot, 'package-lock.json');
  if (!fs.existsSync(lockPath)) {
    return null;
  }

  const packageLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  const productionPaths = listFullRuntimeProductionNodeModulePaths(packageLock);
  const hash = crypto.createHash('sha256');
  for (const relativePath of productionPaths) {
    const absolutePath = path.join(sourceRoot, relativePath);
    hash.update(relativePath);
    hash.update(fs.existsSync(absolutePath) ? directoryFingerprint(absolutePath, relativePath) : 'missing');
  }
  return hash.digest('hex');
}

function assertOplRuntimeProductionDependencies(oplRoot) {
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

function directorySizeBytes(root) {
  let total = 0;
  if (!fs.existsSync(root)) {
    return 0;
  }
  if (fs.statSync(root).isFile()) {
    return fs.statSync(root).size;
  }
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
    } else {
      total += stat.size;
    }
  }
  return total;
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

function copyTreeFiltered(sourceRoot, targetRoot, runtimePrefix) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });

  const copyEntry = (sourcePath, targetPath, relativeFromSource) => {
    const runtimeRelative = path.posix.join(runtimePrefix, relativeFromSource.split(path.sep).join('/'));
    if (shouldExcludeRuntimePath(runtimeRelative)) {
      return;
    }

    const stat = fs.lstatSync(sourcePath);
    if (stat.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      for (const entry of fs.readdirSync(sourcePath)) {
        copyEntry(path.join(sourcePath, entry), path.join(targetPath, entry), path.join(relativeFromSource, entry));
      }
      return;
    }

    if (stat.isSymbolicLink()) {
      const realPath = fs.realpathSync(sourcePath);
      const realStat = fs.statSync(realPath);
      if (realStat.isDirectory()) {
        fs.mkdirSync(targetPath, { recursive: true });
        for (const entry of fs.readdirSync(realPath)) {
          copyEntry(path.join(realPath, entry), path.join(targetPath, entry), path.join(relativeFromSource, entry));
        }
        return;
      }
      if (realStat.isFile()) {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(realPath, targetPath);
        fs.chmodSync(targetPath, realStat.mode);
      }
      return;
    }

    if (stat.isFile()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      fs.chmodSync(targetPath, stat.mode);
    }
  };

  for (const entry of fs.readdirSync(sourceRoot)) {
    copyEntry(path.join(sourceRoot, entry), path.join(targetRoot, entry), entry);
  }
}

function findCodexRoot(explicitRoot) {
  const candidates = [
    explicitRoot,
    path.join(os.homedir(), '.nvm', 'versions', 'node', 'v22.16.0', 'lib', 'node_modules', '@openai', 'codex'),
    path.join(os.homedir(), '.bun', 'install', 'global', 'node_modules', '@openai', 'codex'),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'package.json')));
  if (!found) {
    throw new Error('Codex package root not found. Pass --codex-root or set OPL_FULL_CODEX_ROOT.');
  }
  return found;
}

function findCodexBinary(codexRoot) {
  const platformVendorRoot = path.join(
    codexRoot,
    'node_modules',
    '@openai',
    'codex-darwin-arm64',
    'vendor',
    CODEX_MACOS_ARM64_TARGET,
  );
  const localVendorRoot = path.join(codexRoot, 'vendor', CODEX_MACOS_ARM64_TARGET);
  const requireFirstPath = (candidates, label) => {
    const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!found) {
      throw new Error(`${label} not found. Checked:\n${candidates.map((candidate) => `  - ${candidate}`).join('\n')}`);
    }
    return found;
  };
  return {
    codex: requireFirstPath([
      path.join(platformVendorRoot, 'bin', 'codex'),
      path.join(localVendorRoot, 'bin', 'codex'),
      path.join(platformVendorRoot, 'codex', 'codex'),
      path.join(localVendorRoot, 'codex', 'codex'),
    ], 'Codex darwin-arm64 binary'),
    rg: requireFirstPath([
      path.join(platformVendorRoot, 'codex-path', 'rg'),
      path.join(localVendorRoot, 'codex-path', 'rg'),
      path.join(platformVendorRoot, 'path', 'rg'),
      path.join(localVendorRoot, 'path', 'rg'),
    ], 'Codex bundled rg'),
  };
}

function requireNodeToolchainFile(nodeBinDir, name) {
  const filePath = path.join(nodeBinDir, name);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`Node toolchain file not found: ${filePath}`);
  }
  return filePath;
}

function requireNodeToolchainDirectory(directoryPath) {
  if (!fs.existsSync(directoryPath) || !fs.statSync(directoryPath).isDirectory()) {
    throw new Error(`Node toolchain directory not found: ${directoryPath}`);
  }
  return directoryPath;
}

function findNodeToolchain(explicitNodeBin) {
  const candidates = [
    explicitNodeBin,
    path.join(os.homedir(), '.nvm', 'versions', 'node', 'v22.16.0', 'bin', 'node'),
    process.execPath,
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) {
    throw new Error('Node binary not found. Pass --node-bin or set OPL_FULL_NODE_BIN.');
  }
  const nodeBin = found;
  const nodeBinDir = path.dirname(nodeBin);
  const nodeRoot = path.dirname(nodeBinDir);
  return {
    nodeBin,
    npmBin: requireNodeToolchainFile(nodeBinDir, 'npm'),
    npxBin: requireNodeToolchainFile(nodeBinDir, 'npx'),
    npmRoot: requireNodeToolchainDirectory(path.join(nodeRoot, 'lib', 'node_modules', 'npm')),
  };
}

function findBunBinary(explicitBunBin) {
  const candidates = [
    explicitBunBin,
    findExecutable('bun') || '',
    path.join(os.homedir(), '.bun', 'bin', 'bun'),
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!found) {
    throw new Error('Bun binary not found. Pass --bun-bin or set OPL_FULL_BUN_BIN.');
  }
  return found;
}

function findPythonRoot(explicitPythonRoot) {
  if (explicitPythonRoot) {
    return requirePath(explicitPythonRoot, 'Python root');
  }

  const uvPythonRoot = path.join(os.homedir(), '.local', 'share', 'uv', 'python');
  const candidates = fs.existsSync(uvPythonRoot)
    ? fs.readdirSync(uvPythonRoot)
        .filter((entry) => /^cpython-3\.12\..*-macos-aarch64-none$/.test(entry))
        .sort()
        .reverse()
        .map((entry) => path.join(uvPythonRoot, entry))
    : [];
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'bin', 'python3')));
  if (!found) {
    throw new Error('uv-managed Python 3.12 arm64 root not found. Pass --python-root or set OPL_FULL_PYTHON_ROOT.');
  }
  return found;
}

function copySingleFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, fs.statSync(sourcePath).mode);
}

function isInsidePath(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function copyPortableTree(sourceRoot, targetRoot) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  const sourceBase = path.resolve(sourceRoot);
  const targetBase = path.resolve(targetRoot);

  const copyEntry = (sourcePath, targetPath) => {
    const stat = fs.lstatSync(sourcePath);
    if (stat.isDirectory()) {
      fs.mkdirSync(targetPath, { recursive: true });
      for (const entry of fs.readdirSync(sourcePath)) {
        copyEntry(path.join(sourcePath, entry), path.join(targetPath, entry));
      }
      return;
    }

    if (stat.isSymbolicLink()) {
      const linkTarget = fs.readlinkSync(sourcePath);
      const resolvedSourceTarget = path.resolve(path.dirname(sourcePath), linkTarget);
      if (isInsidePath(sourceBase, resolvedSourceTarget)) {
        const targetEquivalent = path.join(targetBase, path.relative(sourceBase, resolvedSourceTarget));
        const portableLinkTarget = path.relative(path.dirname(targetPath), targetEquivalent) || '.';
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.rmSync(targetPath, { recursive: true, force: true });
        fs.symlinkSync(portableLinkTarget, targetPath);
        return;
      }

      const realStat = fs.statSync(resolvedSourceTarget);
      if (realStat.isDirectory()) {
        copyPortableTree(resolvedSourceTarget, targetPath);
        return;
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(resolvedSourceTarget, targetPath);
      fs.chmodSync(targetPath, realStat.mode);
      return;
    }

    if (stat.isFile()) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(sourcePath, targetPath);
      fs.chmodSync(targetPath, stat.mode);
    }
  };

  copyEntry(sourceBase, targetBase);
}

function assertNoExternalSymlinks(root, label) {
  const rootPath = path.resolve(root);
  const violations = [];
  const stack = [rootPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.lstatSync(current);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry));
      }
      continue;
    }
    if (!stat.isSymbolicLink()) {
      continue;
    }
    const linkTarget = fs.readlinkSync(current);
    const resolvedTarget = path.resolve(path.dirname(current), linkTarget);
    if (path.isAbsolute(linkTarget) || !isInsidePath(rootPath, resolvedTarget)) {
      violations.push(`${path.relative(rootPath, current)} -> ${linkTarget}`);
    }
  }
  if (violations.length > 0) {
    throw new Error(`${label} contains external symlink(s):\n${violations.map((entry) => `  - ${entry}`).join('\n')}`);
  }
}

function copyPathContents(sourceRoot, targetRoot) {
  fs.mkdirSync(targetRoot, { recursive: true });
  if (!fs.existsSync(sourceRoot)) {
    return;
  }
  for (const entry of fs.readdirSync(sourceRoot)) {
    copyPortableTree(path.join(sourceRoot, entry), path.join(targetRoot, entry));
  }
}

function copyExecutableOrSymlinkTarget(sourceRoot, relativePath, targetRoot) {
  const sourcePath = path.join(sourceRoot, ...relativePath.split('/'));
  const targetPath = path.join(targetRoot, ...relativePath.split('/'));
  const stat = fs.lstatSync(sourcePath);
  if (stat.isSymbolicLink()) {
    const resolved = fs.realpathSync(sourcePath);
    const realStat = fs.statSync(resolved);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(resolved, targetPath);
    fs.chmodSync(targetPath, realStat.mode);
    return;
  }
  copySingleFile(sourcePath, targetPath);
}

function copyNodeRuntimePayload(nodeRoot, targetRoot) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  for (const relativePath of ['bin/node', 'bin/npm', 'bin/npx']) {
    copyExecutableOrSymlinkTarget(nodeRoot, relativePath, targetRoot);
  }
  for (const packageName of ['npm', 'corepack']) {
    const sourcePath = path.join(nodeRoot, 'lib', 'node_modules', packageName);
    if (!fs.existsSync(sourcePath)) {
      if (packageName === 'corepack') continue;
      throw new Error(`Node runtime package missing: lib/node_modules/${packageName}`);
    }
    copyPortableTree(sourcePath, path.join(targetRoot, 'lib', 'node_modules', packageName));
  }
  assertNoExternalSymlinks(targetRoot, 'Full first-install Node runtime');
}

function shellSingleQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function writeTemporalCliWrapper(targetPath, versionOutput) {
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
exec "$TEMPORAL_BIN" "$@"
`, 'utf8');
  fs.chmodSync(targetPath, 0o755);
}

function copyProductionNodeModules(sourceRoot, targetRoot) {
  const lockPath = path.join(sourceRoot, 'package-lock.json');
  const nodeModulesRoot = path.join(sourceRoot, 'node_modules');
  if (!fs.existsSync(lockPath) || !fs.existsSync(nodeModulesRoot)) {
    return;
  }
  const packageLock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  for (const relativePath of listFullRuntimeProductionNodeModulePaths(packageLock)) {
    const sourcePath = path.join(sourceRoot, relativePath);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    const targetPath = path.join(targetRoot, relativePath);
    fs.cpSync(sourcePath, targetPath, {
      recursive: true,
      dereference: true,
      preserveTimestamps: true,
    });
  }
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

function pruneTemporalCoreBridgeReleases(nodeModulesRoot) {
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

function assertTemporalCoreBridgeMacosArm64Only(nodeModulesRoot) {
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

function collectRuntimeAssertions(runtimeRoot) {
  return {
    temporal_core_bridge_releases: listTemporalCoreBridgeReleases(path.join(runtimeRoot, 'opl', 'node_modules')),
    excluded_module_venv_count: countRuntimeModuleVenvDirectories(runtimeRoot),
    packaged_global_node_packages: fs.existsSync(path.join(runtimeRoot, 'node', 'lib', 'node_modules'))
      ? fs.readdirSync(path.join(runtimeRoot, 'node', 'lib', 'node_modules')).sort()
      : [],
  };
}

function copySkillDirectory(sourceRoot, targetRoot, skillName) {
  if (!fs.existsSync(path.join(sourceRoot, 'SKILL.md'))) {
    throw new Error(`Skill source missing SKILL.md for ${skillName}: ${sourceRoot}`);
  }
  copyTreeFiltered(sourceRoot, targetRoot, `skills/${skillName}`);
}

function firstExistingSkillSource(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(path.join(candidate, 'SKILL.md'))) || null;
}

function copyFirstSkillSource(skillName, targetRoot, candidates) {
  const source = firstExistingSkillSource(candidates);
  if (!source) {
    throw new Error(`Required Full companion skill source not found: ${skillName}`);
  }
  copySkillDirectory(source, path.join(targetRoot, skillName), skillName);
  return source;
}

function skillSourceSnapshot(candidates, runtimePrefix) {
  const source = firstExistingSkillSource(candidates);
  return {
    source_path: source,
    git_commit: source ? readGitHead(source) : null,
    fingerprint: source ? directoryFingerprint(source, runtimePrefix) : null,
  };
}

function skillFileSourceSnapshot(candidates) {
  const source = firstExistingSkillSource(candidates);
  return {
    source_path: source,
    git_commit: source ? readGitHead(source) : null,
    skill_md_sha256: source ? fileSha256(path.join(source, 'SKILL.md')) : null,
  };
}

function masSkillCandidates(options) {
  return [
    path.join(options.masRoot, 'plugins', 'mas', 'skills', 'mas'),
    path.join(os.homedir(), '.codex', 'skills', 'mas'),
  ];
}

function metaAgentSkillSnapshot(options) {
  const domainSkill = path.join(options.metaAgentRoot, 'agent', 'skills', 'opl-meta-agent-domain-skill.md');
  const agentRoot = path.join(options.metaAgentRoot, 'agent');
  if (fs.existsSync(domainSkill) && fs.existsSync(agentRoot)) {
    return {
      source_path: options.metaAgentRoot,
      git_commit: readGitHead(options.metaAgentRoot),
      domain_skill_sha256: fileSha256(domainSkill),
      agent_payload_fingerprint: directoryFingerprint(agentRoot, 'skills/opl-meta-agent'),
    };
  }
  return skillSourceSnapshot([
    path.join(options.metaAgentRoot, 'plugins', 'opl-meta-agent', 'skills', 'opl-meta-agent'),
    path.join(os.homedir(), '.codex', 'skills', 'opl-meta-agent'),
  ], 'skills/opl-meta-agent');
}

function officeCliCoreSkillSnapshot(options) {
  if (fs.existsSync(path.join(options.officeCliRoot, 'SKILL.md'))) {
    return skillFileSourceSnapshot([options.officeCliRoot]);
  }
  return skillSourceSnapshot(officeCliCoreSkillCandidates(options).slice(1), 'skills/officecli');
}

function magSkillCandidates(options) {
  return [
    path.join(options.magRoot, 'plugins', 'mag', 'skills', 'mag'),
    path.join(os.homedir(), '.codex', 'skills', 'mag'),
  ];
}

function rcaSkillCandidates(options) {
  return [
    path.join(options.rcaRoot, 'plugins', 'rca', 'skills', 'rca'),
    path.join(os.homedir(), '.codex', 'skills', 'rca'),
  ];
}

function officeCliCoreSkillCandidates(options) {
  return [
    options.officeCliRoot,
    path.join(options.officeCliRoot, 'skills', 'officecli'),
    path.join(os.homedir(), '.skills-manager', 'skills', 'officecli'),
    path.join(os.homedir(), '.codex', 'skills', 'officecli'),
  ];
}

function mineruDocumentExtractorSkillCandidates(options) {
  return [
    options.mineruDocumentExtractorRoot,
    path.join(os.homedir(), '.skills-manager', 'skills', 'mineru-document-extractor'),
    path.join(os.homedir(), '.codex', 'skills', 'mineru-document-extractor'),
  ];
}

function appCompanionSkillRoot(skillId) {
  return path.join(appRepoRoot, 'assets', 'companion-skills', skillId);
}

function officeCliSkillCandidates(options, skillId) {
  return [
    path.join(options.officeCliRoot, 'skills', skillId),
    path.join(os.homedir(), '.skills-manager', 'skills', skillId),
    path.join(os.homedir(), '.codex', 'skills', skillId),
  ];
}

function appCompanionSkillCandidates(skillId) {
  return [
    appCompanionSkillRoot(skillId),
    path.join(os.homedir(), '.skills-manager', 'skills', skillId),
    path.join(os.homedir(), '.codex', 'skills', skillId),
  ];
}

function copyOplMetaAgentSkill(targetRoot, options) {
  const target = path.join(targetRoot, 'opl-meta-agent');
  const domainSkill = path.join(options.metaAgentRoot, 'agent', 'skills', 'opl-meta-agent-domain-skill.md');
  const agentRoot = path.join(options.metaAgentRoot, 'agent');
  if (fs.existsSync(domainSkill) && fs.existsSync(agentRoot)) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(domainSkill, path.join(target, 'SKILL.md'));
    for (const entry of ['knowledge', 'prompts', 'quality_gates', 'skills', 'stages']) {
      const source = path.join(agentRoot, entry);
      if (fs.existsSync(source)) {
        copyTreeFiltered(source, path.join(target, entry), `skills/opl-meta-agent/${entry}`);
      }
    }
    return options.metaAgentRoot;
  }
  return copyFirstSkillSource('opl-meta-agent', targetRoot, [
    path.join(options.metaAgentRoot, 'plugins', 'opl-meta-agent', 'skills', 'opl-meta-agent'),
    path.join(os.homedir(), '.codex', 'skills', 'opl-meta-agent'),
  ]);
}

function copySuperpowersBundle(targetRoot, options) {
  const sourceRoot = options.superpowersRoot;
  const skillsRoot = path.join(sourceRoot, 'skills');
  if (
    !fs.existsSync(path.join(sourceRoot, '.codex-plugin', 'plugin.json')) ||
    !fs.existsSync(path.join(skillsRoot, 'using-superpowers', 'SKILL.md')) ||
    !fs.existsSync(path.join(skillsRoot, 'verification-before-completion', 'SKILL.md'))
  ) {
    throw new Error(`Required Full companion skill source not found: superpowers bundle at ${sourceRoot}`);
  }
  copyTreeFiltered(sourceRoot, path.join(targetRoot, 'superpowers'), 'skills/superpowers');
  return sourceRoot;
}

function copyOfficeCliCoreSkill(targetRoot, options) {
  const target = path.join(targetRoot, 'officecli');
  if (fs.existsSync(path.join(options.officeCliRoot, 'SKILL.md'))) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(path.join(options.officeCliRoot, 'SKILL.md'), path.join(target, 'SKILL.md'));
    return options.officeCliRoot;
  }
  return copyFirstSkillSource('officecli', targetRoot, officeCliCoreSkillCandidates(options).slice(1));
}

function copyUiUxProMaxSkill(targetRoot, options) {
  const target = path.join(targetRoot, 'ui-ux-pro-max');
  const packagedSkill = path.join(options.uiUxProMaxRoot, '.claude', 'skills', 'ui-ux-pro-max', 'SKILL.md');
  const packagedPayload = path.join(options.uiUxProMaxRoot, 'src', 'ui-ux-pro-max');
  if (fs.existsSync(packagedSkill) && fs.existsSync(packagedPayload)) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    fs.copyFileSync(packagedSkill, path.join(target, 'SKILL.md'));
    for (const entry of ['data', 'scripts', 'templates']) {
      const source = path.join(packagedPayload, entry);
      if (fs.existsSync(source)) {
        copyTreeFiltered(source, path.join(target, entry), `skills/ui-ux-pro-max/${entry}`);
      }
    }
    return options.uiUxProMaxRoot;
  }
  return copyFirstSkillSource('ui-ux-pro-max', targetRoot, [
    path.join(os.homedir(), '.skills-manager', 'skills', 'ui-ux-pro-max'),
    path.join(os.homedir(), '.codex', 'skills', 'ui-ux-pro-max'),
  ]);
}

function createTarZst(archivePath, cwd, entries = ['.']) {
  requirePath(findExecutable('zstd'), 'zstd');
  fs.mkdirSync(path.dirname(archivePath), { recursive: true });
  fs.rmSync(archivePath, { force: true });
  const tarPath = `${archivePath}.tar`;
  fs.rmSync(tarPath, { force: true });
  try {
    run('tar', ['-cf', tarPath, '-C', cwd, ...entries]);
    run('zstd', ['-q', '-T0', '-f', tarPath, '-o', archivePath]);
  } finally {
    fs.rmSync(tarPath, { force: true });
  }
}

function archiveLayer(sourceRoot, archivePath) {
  createTarZst(archivePath, sourceRoot, ['.']);
}

function extractLayer(archivePath, targetRoot) {
  fs.mkdirSync(targetRoot, { recursive: true });
  const tarPath = path.join(os.tmpdir(), `opl-full-layer-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tar`);
  try {
    run('zstd', ['-q', '-d', '-f', archivePath, '-o', tarPath]);
    run('tar', ['-xf', tarPath, '-C', targetRoot]);
  } finally {
    fs.rmSync(tarPath, { force: true });
  }
}

function writePackagedModuleMarker(moduleRoot, marker) {
  fs.writeFileSync(path.join(moduleRoot, PACKAGED_MODULE_MARKER_FILE), `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
}

const packagedSkillCopyHandlers = {
  mas: (targetRoot, options) => copyFirstSkillSource('mas', targetRoot, masSkillCandidates(options)),
  mag: (targetRoot, options) => copyFirstSkillSource('mag', targetRoot, magSkillCandidates(options)),
  rca: (targetRoot, options) => copyFirstSkillSource('rca', targetRoot, rcaSkillCandidates(options)),
  superpowers: (targetRoot, options) => copySuperpowersBundle(targetRoot, options),
  cron: (targetRoot) => copyFirstSkillSource('cron', targetRoot, appCompanionSkillCandidates('cron')),
  'opl-meta-agent': (targetRoot, options) => copyOplMetaAgentSkill(targetRoot, options),
  officecli: (targetRoot, options) => copyOfficeCliCoreSkill(targetRoot, options),
  'officecli-docx': (targetRoot, options) => copyFirstSkillSource('officecli-docx', targetRoot, officeCliSkillCandidates(options, 'officecli-docx')),
  'officecli-pptx': (targetRoot, options) => copyFirstSkillSource('officecli-pptx', targetRoot, officeCliSkillCandidates(options, 'officecli-pptx')),
  'officecli-xlsx': (targetRoot, options) => copyFirstSkillSource('officecli-xlsx', targetRoot, officeCliSkillCandidates(options, 'officecli-xlsx')),
  'officecli-academic-paper': (targetRoot, options) => copyFirstSkillSource('officecli-academic-paper', targetRoot, officeCliSkillCandidates(options, 'officecli-academic-paper')),
  'officecli-data-dashboard': (targetRoot, options) => copyFirstSkillSource('officecli-data-dashboard', targetRoot, officeCliSkillCandidates(options, 'officecli-data-dashboard')),
  'officecli-financial-model': (targetRoot, options) => copyFirstSkillSource('officecli-financial-model', targetRoot, officeCliSkillCandidates(options, 'officecli-financial-model')),
  'officecli-pitch-deck': (targetRoot, options) => copyFirstSkillSource('officecli-pitch-deck', targetRoot, officeCliSkillCandidates(options, 'officecli-pitch-deck')),
  pdf: (targetRoot) => copyFirstSkillSource('pdf', targetRoot, appCompanionSkillCandidates('pdf')),
  'ui-ux-pro-max': (targetRoot, options) => copyUiUxProMaxSkill(targetRoot, options),
  'mineru-document-extractor': (targetRoot, options) => copyFirstSkillSource(
    'mineru-document-extractor',
    targetRoot,
    mineruDocumentExtractorSkillCandidates(options),
  ),
};

function copyPackagedSkills(targetRoot, options) {
  fs.rmSync(targetRoot, { recursive: true, force: true });
  fs.mkdirSync(targetRoot, { recursive: true });
  const productProfile = readAppProductProfile();
  const packagedSkillIds = [
    ...productProfile.companion_payloads.default_packaged_codex_skill_ids,
    ...productProfile.companion_payloads.packaged_not_default_visible_codex_skill_ids,
  ];
  for (const skillId of packagedSkillIds) {
    const copySkill = packagedSkillCopyHandlers[skillId];
    if (!copySkill) {
      throw new Error(`No Full package copy handler declared for App packaged skill: ${skillId}`);
    }
    copySkill(targetRoot, options);
  }
}

function resolveRuntimeSources(options) {
  const codexRoot = findCodexRoot(options.codexRoot);
  const codexBinaries = findCodexBinary(codexRoot);
  const nodeToolchain = findNodeToolchain(options.nodeBin);
  const bunBin = findBunBinary(options.bunBin);
  const pythonRoot = findPythonRoot(options.pythonRoot);
  const uvBin = requirePath(options.uvBin, 'uv binary');
  const temporalCliBin = findTemporalCliBinary(options.temporalCliBin);
  const temporalCliArchive = findTemporalCliArchive(options.temporalCliArchive);
  const officeCliBin = findOfficeCliBinary(options.officeCliBin);
  const mineruOpenApiBin = findMineruOpenApiBinary(options.mineruOpenApiBin);

  return {
    codexRoot,
    codexBinaries,
    nodeToolchain,
    bunBin,
    pythonRoot,
    uvBin,
    temporalCliBin,
    temporalCliArchive,
    officeCliBin,
    mineruOpenApiBin,
    mineruRepoRoot: fs.existsSync(path.join(options.mineruRoot, '.git')) ? options.mineruRoot : null,
  };
}

function packageJsonVersion(packagePath) {
  if (!fs.existsSync(packagePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(packagePath, 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

function buildRuntimeCacheKeyInputs(options, sources) {
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
        bun_sha256: fileSha256(sources.bunBin),
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

function buildRuntimeCacheKeysFromInputs(layerInputs) {
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

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function buildRuntimeCacheKeyReport(options, sources) {
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

function runCachedLayer(options, layerId, key, targetRoot, builder) {
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

function buildToolchainLayer(layerRoot, sources) {
  copySingleFile(sources.codexBinaries.codex, path.join(layerRoot, 'bin', 'codex'));
  copySingleFile(sources.codexBinaries.rg, path.join(layerRoot, 'bin', 'rg'));
  copySingleFile(sources.bunBin, path.join(layerRoot, 'bin', 'bun'));
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

function buildDomainLayer(layerRoot, options) {
  copyTreeFiltered(options.masRoot, path.join(layerRoot, 'modules', 'mas'), 'modules/mas');
  copyTreeFiltered(options.magRoot, path.join(layerRoot, 'modules', 'mag'), 'modules/mag');
  copyTreeFiltered(options.rcaRoot, path.join(layerRoot, 'modules', 'rca'), 'modules/rca');
  copyTreeFiltered(options.metaAgentRoot, path.join(layerRoot, 'modules', 'meta-agent'), 'modules/meta-agent');
}

function writeDomainMarkers(runtimeRoot, options, packagedAt) {
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

function buildOplLayer(layerRoot, options) {
  const targetRoot = path.join(layerRoot, 'opl');
  copyTreeFiltered(options.frameworkRoot, targetRoot, 'opl');
  copyProductionNodeModules(options.frameworkRoot, targetRoot);
  pruneTemporalCoreBridgeReleases(path.join(targetRoot, 'node_modules'));
}

function buildSkillsLayer(layerRoot, options) {
  copyPackagedSkills(path.join(layerRoot, 'skills'), options);
}

function writeFullRuntimeManifest(runtimeRoot, options, packagedAt, components, resolvedRefs) {
  const manifestDir = path.join(runtimeRoot, 'manifest');
  const manifestPath = path.join(manifestDir, 'full-package-manifest.json');
  fs.mkdirSync(manifestDir, { recursive: true });

  let manifest = buildFullPackageManifest({
    version: options.version,
    generatedAt: packagedAt,
    components,
    resolvedRefs,
    runtimeAssertions: collectRuntimeAssertions(runtimeRoot),
  });

  for (let attempt = 0; attempt < 8; attempt += 1) {
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    const sizeBreakdown = collectFullRuntimeSizeBreakdown(runtimeRoot);
    const nextManifest = buildFullPackageManifest({
      version: options.version,
      generatedAt: packagedAt,
      components,
      resolvedRefs,
      runtimeAssertions: collectRuntimeAssertions(runtimeRoot),
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

function prepareRuntime(options, sources) {
  const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-full-runtime-'));
  const runtimeRoot = path.join(stagingRoot, 'current');
  fs.mkdirSync(path.join(runtimeRoot, 'bin'), { recursive: true });

  const packagedAt = new Date().toISOString();
  const cacheKeyInputs = buildRuntimeCacheKeyInputs(options, sources);
  const cacheKeys = buildRuntimeCacheKeysFromInputs(cacheKeyInputs);
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
      buildSkillsLayer(layerRoot, options);
    }),
  ];
  assertOplRuntimeProductionDependencies(path.join(runtimeRoot, 'opl'));
  assertTemporalCoreBridgeMacosArm64Only(path.join(runtimeRoot, 'opl', 'node_modules'));
  writeDomainMarkers(runtimeRoot, options, packagedAt);

  const components = {
    opl: { source_path: options.frameworkRoot, git_commit: readGitHead(options.frameworkRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'opl')) },
    codex: { source_path: sources.codexRoot, version: commandOutput(path.join(runtimeRoot, 'bin', 'codex'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'codex')) },
    mas: { source_path: options.masRoot, git_commit: readGitHead(options.masRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'mas')) },
    mag: { source_path: options.magRoot, git_commit: readGitHead(options.magRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'mag')) },
    rca: { source_path: options.rcaRoot, git_commit: readGitHead(options.rcaRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'rca')) },
    meta_agent: { source_path: options.metaAgentRoot, git_commit: readGitHead(options.metaAgentRoot), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'modules', 'meta-agent')) },
    node: { source_path: sources.nodeToolchain.nodeBin, version: commandOutput(path.join(runtimeRoot, 'node', 'bin', 'node'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'node')) },
    bun: { source_path: sources.bunBin, version: commandOutput(path.join(runtimeRoot, 'bin', 'bun'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'bun')) },
    python: { source_path: sources.pythonRoot, version: commandOutput(path.join(runtimeRoot, 'python', path.basename(sources.pythonRoot), 'bin', 'python3'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'python')) },
    uv: { source_path: sources.uvBin, version: commandOutput(path.join(runtimeRoot, 'uv', 'bin', 'uv'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'uv')) },
    temporal_cli: { source_path: sources.temporalCliBin, version: commandOutput(path.join(runtimeRoot, 'bin', 'temporal'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'temporal')) },
    officecli: { source_path: sources.officeCliBin, version: commandOutput(path.join(runtimeRoot, 'bin', 'officecli'), ['--version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'officecli')) },
    mineru_open_api: { source_path: sources.mineruOpenApiBin, version: commandOutput(sources.mineruOpenApiBin, ['version']), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'bin', 'mineru-open-api')) },
    skills: { source_path: path.join(os.homedir(), '.codex', 'skills'), size_bytes: directorySizeBytes(path.join(runtimeRoot, 'skills')) },
  };

  const resolvedRefs = buildResolvedFullPayloadRefs(options, sources, components);
  const manifest = writeFullRuntimeManifest(runtimeRoot, options, packagedAt, components, resolvedRefs);

  return {
    stagingRoot,
    runtimeRoot,
    manifest,
    runtime_cache: {
      mode: options.runtimeCacheMode,
      dir: options.runtimeCacheDir || null,
      keys: cacheKeys,
      key_inputs: cacheKeyInputs,
      events: cacheEvents,
    },
    resolved_refs: resolvedRefs,
  };
}

function syncRuntimePayload(runtimeRoot, manifest, payloadRoot) {
  fs.rmSync(path.join(payloadRoot, 'runtime'), { recursive: true, force: true });
  fs.rmSync(path.join(payloadRoot, 'manifest'), { recursive: true, force: true });
  fs.mkdirSync(path.join(payloadRoot, 'runtime'), { recursive: true });
  fs.cpSync(runtimeRoot, path.join(payloadRoot, 'runtime', 'current'), {
    recursive: true,
    dereference: true,
    preserveTimestamps: true,
  });
  fs.mkdirSync(path.join(payloadRoot, 'manifest'), { recursive: true });
  fs.writeFileSync(
    path.join(payloadRoot, 'manifest', 'full-package-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

function syncRuntimePayloadToBuildRoots(runtimeRoot, manifest, guiRoot) {
  const appPayloadRoot = path.join(appRepoRoot, 'packaged-runtimes', FULL_RUNTIME_RESOURCE_DIR);
  const shellPayloadRoot = resolveActiveShellPaths({ shellRoot: guiRoot }).packagedRuntimeRoot;
  syncRuntimePayload(runtimeRoot, manifest, appPayloadRoot);
  syncRuntimePayload(runtimeRoot, manifest, shellPayloadRoot);
  return { appPayloadRoot, shellPayloadRoot };
}

function findBuiltDmg(guiRoot, version) {
  const outDir = resolveActiveShellPaths({ shellRoot: guiRoot }).buildOutputDir;
  const candidates = [
    `One-Person-Lab-${version}-mac-arm64.dmg`,
    `One Person Lab-${version}-mac-arm64.dmg`,
  ].map((name) => path.join(outDir, name));
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Built arm64 DMG not found under ${outDir} for version ${version}`);
  }
  return found;
}

function removeStandardGuiArtifacts(guiRoot, version) {
  const outDir = resolveActiveShellPaths({ shellRoot: guiRoot }).buildOutputDir;
  if (!fs.existsSync(outDir)) {
    return;
  }
  for (const entry of fs.readdirSync(outDir)) {
    if (
      entry === `One-Person-Lab-${version}-mac-arm64.dmg`
      || entry === `One Person Lab-${version}-mac-arm64.dmg`
      || entry === `One-Person-Lab-${version}-mac-arm64.zip`
      || entry === `One Person Lab-${version}-mac-arm64.zip`
      || entry === `One-Person-Lab-${version}-mac-arm64.dmg.blockmap`
      || entry === `One Person Lab-${version}-mac-arm64.dmg.blockmap`
      || entry === `One-Person-Lab-${version}-mac-arm64.zip.blockmap`
      || entry === `One Person Lab-${version}-mac-arm64.zip.blockmap`
      || entry === 'latest-mac.yml'
      || entry === 'latest-arm64-mac.yml'
    ) {
      fs.rmSync(path.join(outDir, entry), { force: true });
    }
  }
}

function writeChecksums(outDir, files) {
  const lines = files.map((filePath) => {
    const result = run('shasum', ['-a', '256', filePath], { capture: true });
    const hash = result.stdout.trim().split(/\s+/)[0];
    return `${hash}  ${path.basename(filePath)}`;
  });
  const checksumPath = path.join(outDir, 'SHA256SUMS.txt');
  fs.writeFileSync(checksumPath, `${lines.join('\n')}\n`, 'utf8');
  return checksumPath;
}

function maybeCreateRuntimeTar(options, runtimeRoot, artifactNames) {
  if (!options.splitRuntime) {
    return null;
  }
  const target = path.join(options.outDir, artifactNames.runtimeTar);
  createTarZst(target, path.dirname(runtimeRoot), [path.basename(runtimeRoot)]);
  return target;
}

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
  const sourceDmg = findBuiltDmg(options.guiRoot, options.version);
  const targetDmg = path.join(options.outDir, artifactNames.dmg);
  fs.copyFileSync(sourceDmg, targetDmg);
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
